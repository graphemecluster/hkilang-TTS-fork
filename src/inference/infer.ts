import { InferenceSession, Tensor, env } from "onnxruntime-web";
import seedrandom from "seedrandom";
import { setRandom, sampleNormal } from "vega-statistics";

import NDArray from "./NDArray";
import { getDBInstance } from "../db/instance";
import { DatabaseError } from "../errors";
import { fromLength } from "../utils";

import type { Language, ModelComponent, Voice } from "../types";
import type { TypedTensor } from "onnxruntime-web";

env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/";

export const ALL_MODEL_COMPONENTS: readonly ModelComponent[] = ["enc", "emb", "sdp", "flow", "dec"];

type FloatTensor = TypedTensor<"float32">;
type FloatTensorArray<Shape extends readonly number[]> = NDArray<Float32Array, Readonly<Shape>>;

const lessThan = NDArray.vectorize((a, b) => +(a < b), Float32Array);
const multiply = NDArray.vectorize((a, b) => a * b, Float32Array);

type Batch = number & { readonly brand: unique symbol };
type Tx = number & { readonly brand: unique symbol };
type Ty = number & { readonly brand: unique symbol };
type FeatureDim = number & { readonly brand: unique symbol };

function sequenceMask<Dim extends number>(lengths: FloatTensorArray<[Dim]>, maxLength = Math.max(...lengths.data)) {
	const x = NDArray.grid([maxLength as Ty], Float32Array, i => i);
	return lessThan(x.expandDims(0), lengths.expandDims(1));
}

function transformUsingAttention(attn: FloatTensorArray<[Batch, Tx, Ty]>, data: FloatTensorArray<[Batch, FeatureDim, Tx]>) {
	const [batch, t_x, t_y] = attn.shape;
	const [, feature_dim] = data.shape;

	const result = NDArray.zeros([batch, feature_dim, t_y], Float32Array);
	for (let i = 0; i < batch; i++) {
		for (let j = 0; j < t_y; j++) {
			for (let k = 0; k < t_x; k++) {
				for (let f = 0; f < feature_dim; f++) {
					result.set(result.get(i, f, j) + attn.get(i, k, j) * data.get(i, f, k), i, f, j);
				}
			}
		}
	}
	return result;
}

function generatePath(duration: FloatTensorArray<[Batch, 1, Tx]>, mask: FloatTensorArray<[Batch, 1, Ty, Tx]>) {
	const [batch, , t_y, t_x] = mask.shape;
	let sum: number;
	const cumDuration = duration.map((value, _batch, _, i) => {
		if (!i) sum = 0;
		return sum += value;
	});

	const cumDurationFlat = cumDuration.reshape([batch * t_x]);
	const path = sequenceMask(cumDurationFlat, t_y).reshape([batch, t_x, t_y]);
	return path.map((value, _batch, _tx, _ty) => value ^ (_tx ? path.get(_batch, _tx - 1, _ty) : 0));
}

export default async function infer(language: Language, voice: Voice, seq: number[], tone: number[], voiceSpeed = 1, sdpNoiseScale = 0.6, seqNoiseScale = 0.8) {
	const db = await getDBInstance();
	async function getSession(component: ModelComponent) {
		let file: ArrayBuffer;
		try {
			({ file } = (await db.get("models", `${language}/${voice}/${component}`))!);
		}
		catch (error) {
			throw new DatabaseError("無法存取語音模型：資料庫出錯", { cause: error });
		}
		return InferenceSession.create(file);
	}
	setRandom(seedrandom("42"));

	const emb = await getSession("emb");
	const sid = new Tensor("int64", [0]);
	let { g } = await emb.run({ sid });
	await emb.release();
	sid.dispose();
	g = g.reshape([...g.dims, 1]);

	const enc = await getSession("enc");
	const seqTensor = new Tensor("int64", seq, [1, seq.length]);
	const toneTensor = new Tensor("int64", tone, [1, tone.length]);
	const languageTensor = new Tensor("int64", Array.from(seq, () => 0), [1, seq.length]);
	const { xout: x, m_p, logs_p, x_mask } = await enc.run({ x: seqTensor, t: toneTensor, language: languageTensor, g });
	await enc.release();
	seqTensor.dispose();
	toneTensor.dispose();
	languageTensor.dispose();

	const sdp = await getSession("sdp");
	const zin = new Tensor("float32", fromLength(x.dims[0] * 2 * x.dims[2], () => sampleNormal(0, sdpNoiseScale)), [x.dims[0], 2, x.dims[2]]);
	const { logw } = await sdp.run({ x, x_mask, zin, g });
	await sdp.release();
	zin.dispose();
	x.dispose();

	const x_mask_array = await NDArray.fromTensor<[Batch, 1, Tx], "float32">(x_mask as FloatTensor);
	const logw_array = await NDArray.fromTensor<[Batch, 1, Tx], "float32">(logw as FloatTensor);
	const w_ceil = NDArray.vectorize((d, m) => Math.ceil(Math.exp(d) * m / voiceSpeed), Float32Array)(x_mask_array, logw_array);
	logw_array.dispose();
	const [batch, , t_x] = x_mask_array.shape;
	const y_lengths = NDArray.grid([batch], Float32Array, batch => {
		let sum = 0;
		for (let i = 0; i < t_x; i++) {
			sum += w_ceil.get(batch, 0, i);
		}
		return Math.max(1, Math.min(100000, sum));
	});
	const y_mask_array = sequenceMask(y_lengths).expandDims(1);
	y_lengths.dispose();
	const attn_mask = multiply(x_mask_array.expandDims(2), y_mask_array.expandDims(-1));
	x_mask_array.dispose();
	const attn = generatePath(w_ceil, attn_mask);
	w_ceil.dispose();
	attn_mask.dispose();
	const m_p_array = await NDArray.fromTensor<[Batch, FeatureDim, Tx], "float32">(m_p as FloatTensor);
	const new_m_p = transformUsingAttention(attn, m_p_array);
	m_p_array.dispose();
	const logs_p_array = await NDArray.fromTensor<[Batch, FeatureDim, Tx], "float32">(logs_p as FloatTensor);
	const new_logs_p = transformUsingAttention(attn, logs_p_array);
	attn.dispose();
	logs_p_array.dispose();
	const z_p = NDArray.vectorize((m, p) => sampleNormal(m, Math.exp(p) * seqNoiseScale), Float32Array)(new_m_p, new_logs_p);
	new_m_p.dispose();
	new_logs_p.dispose();

	const flow = await getSession("flow");
	const z_p_tensor = new Tensor("float32", z_p.data, z_p.shape);
	z_p.dispose();
	const y_mask_tensor = new Tensor("float32", y_mask_array.data, y_mask_array.shape);
	y_mask_array.dispose();
	const { z: z_in } = await flow.run({ z_p: z_p_tensor, y_mask: y_mask_tensor, g });
	await flow.release();
	z_p_tensor.dispose();
	y_mask_tensor.dispose();

	const dec = await getSession("dec");
	const { o } = await dec.run({ z_in, g });
	await dec.release();
	z_in.dispose();
	g.dispose();

	const output = await o.getData() as Float32Array;
	o.dispose();
	return output;
}
