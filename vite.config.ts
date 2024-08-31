import { extname } from "path";

import react from "@vitejs/plugin-react-swc";
import autoprefixer from "autoprefixer";
import { csvParse, tsvParse } from "d3-dsv";
import postCSSNesting from "postcss-nesting";
import tailwindcss from "tailwindcss";
import tailwindcssNesting from "tailwindcss/nesting";
import { ViteImageOptimizer } from "vite-plugin-image-optimizer";
import { ViteMinifyPlugin } from "vite-plugin-minify";
import { VitePWA } from "vite-plugin-pwa";
import { viteStaticCopy } from "vite-plugin-static-copy";

import type { UserConfig } from "vite";

const dsvParsers: Record<string, ((input: string) => unknown) | undefined> = { ".csv": csvParse, ".tsv": tsvParse };

const isProduction = process.env["NODE_ENV"] === "production";
const coiServiceWorkerPath = `coi-serviceworker${isProduction ? ".min" : ""}.js`;

export default {
	base: "./",
	plugins: [
		react(),
		{
			name: "dsv-transform",
			transform(code, id) {
				const parser = dsvParsers[extname(id)];
				return parser && {
					code: `export default JSON.parse(${JSON.stringify(JSON.stringify(parser(code)))});`,
					map: { mappings: "" },
				};
			},
		},
		ViteMinifyPlugin(),
		ViteImageOptimizer(),
		// https://stackoverflow.com/a/76185792
		viteStaticCopy({
			targets: [
				{
					src: `node_modules/coi-serviceworker/${coiServiceWorkerPath}`,
					dest: ".",
				},
			],
		}),
		{
			name: "inject-coi-serviceworker",
			transformIndexHtml(html) {
				return html.replace(/(?=\s*<\/body>)/, `${isProduction ? "\n\t\t<script>window.coi = { quiet: true };</script>" : ""}\n\t\t<script src="${coiServiceWorkerPath}"></script>`);
			},
		},
		VitePWA({
			outDir: "build",
			registerType: "autoUpdate",
			manifest: false,
			includeAssets: [
				"./assets/favicon-64x64.png",
				"./assets/favicon-128x128.png",
				"./assets/favicon-192x192.png",
				"./assets/hkilang-logo.svg",
				"./assets/credit-logos.svg",
			],
			workbox: {
				runtimeCaching: [
					{
						urlPattern: ({ url }) => url.origin === "https://cdn.jsdelivr.net",
						handler: "CacheFirst",
						options: {
							cacheName: "jsdelivr-cache",
							cacheableResponse: {
								statuses: [0, 200],
							},
						},
					},
				],
				sourcemap: !isProduction,
				maximumFileSizeToCacheInBytes: 4194304,
			},
		}),
	],
	css: {
		postcss: {
			plugins: [
				tailwindcssNesting(postCSSNesting({ edition: "2024-02" })),
				tailwindcss(),
				autoprefixer(),
			],
		},
	},
	build: {
		outDir: "build",
		target: "ES2017",
		rollupOptions: {
			output: {
				assetFileNames: "[name].[hash].[ext]",
				chunkFileNames: "[name].[hash].js",
				entryFileNames: "[name].[hash].js",
				hashCharacters: "hex",
			},
		},
	},
} satisfies UserConfig;
