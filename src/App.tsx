import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { MdError, MdSettings } from "react-icons/md";

import { DOWNLOAD_STATUS_INDICATOR_CLASS, NO_AUTO_FILL } from "./consts";
import { DBProvider } from "./db/DBContext";
import { useDownloadState, useQueryOptions } from "./hooks";
import { segment } from "./parse";
import Radio from "./Radio";
import SentenceCard from "./SentenceCard";
import SettingsDialog from "./SettingsDialog";

import type { SettingsDialogPage, Sentence } from "./types";

export default function App() {
	const queryOptions = useQueryOptions();
	const { language, voice, inferenceMode, voiceSpeed, hakkaToneMode, setLanguage, setVoice } = queryOptions;
	const [sentences, setSentences] = useState<Sentence[]>([
		{ language: "waitau", voice: "male", inferenceMode: "online", voiceSpeed: 1, syllables: segment("天地玄黃，宇宙洪荒。") },
		{ language: "waitau", voice: "female", inferenceMode: "online", voiceSpeed: 1, syllables: segment("日月盈昃，辰宿列張。") },
		{ language: "hakka", voice: "male", inferenceMode: "online", voiceSpeed: 1, syllables: segment("天地玄黃，宇宙洪荒。") },
		{ language: "hakka", voice: "female", inferenceMode: "online", voiceSpeed: 1, syllables: segment("日月盈昃，辰宿列張。") },
	]);

	const textArea = useRef<HTMLTextAreaElement>(null);
	const btnAddSentence = useRef<HTMLButtonElement>(null);

	const resizeElements = useCallback(() => {
		if (textArea.current && btnAddSentence.current) {
			const height = textArea.current.style.height;
			textArea.current.style.setProperty("height", "");
			textArea.current.style.setProperty("min-height", "");
			btnAddSentence.current.style.setProperty("min-height", "");
			const scrollHeight = textArea.current.scrollHeight;
			textArea.current.style.setProperty("height", height, "important");
			textArea.current.style.setProperty("min-height", `${scrollHeight}px`, "important");
			btnAddSentence.current.style.setProperty("min-height", `${Math.max(parseInt(height) || 0, scrollHeight)}px`, "important");
		}
	}, [textArea, btnAddSentence]);

	const addSentence = useCallback(() => {
		return;
		setSentences([
			...textArea.current.value.split("\n").flatMap(text => (text.trim() ? [{ language, voice, inferenceMode, voiceSpeed, syllables: segment(text) }] : [])),
			...sentences,
		]);
		textArea.current.value = "";
		resizeElements();
	}, [textArea, language, voice, inferenceMode, voiceSpeed, sentences, resizeElements]);

	useEffect(() => {
		if (!textArea.current) return;
		const currTextArea = textArea.current;
		const observer = new ResizeObserver(resizeElements);
		observer.observe(currTextArea);
		return () => observer.unobserve(currTextArea);
	}, [textArea, resizeElements]);

	const [currSettingsDialogPage, setCurrSettingsDialogPage] = useState<SettingsDialogPage>(null);
	const settingsDialog = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		const { current: dialog } = settingsDialog;
		if (dialog && !dialog.open && currSettingsDialogPage) {
			dialog.inert = true;
			dialog.showModal();
			dialog.inert = false;
			dialog.addEventListener("close", () => setCurrSettingsDialogPage(null), { once: true });
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [settingsDialog.current, currSettingsDialogPage, setCurrSettingsDialogPage]);

	const [downloadState, setDownloadState] = useDownloadState();
	const currInferenceModeDownloadState = inferenceMode === "online" ? "latest" : downloadState.get(inferenceMode)!;

	return <DBProvider>
		<div>
			<div>
				<div className="flex items-end gap-3 mb-4">
					<div>
						<div className="text-primary text-lg font-semibold ms-0.5 mb-0.5 tracking-widest">語言</div>
						<div className="join bg-base-100" role="group" aria-label="選擇語言">
							<Radio name="btnlanguage" className="btn-primary" state={language} setState={setLanguage} value="waitau" />
							<Radio name="btnlanguage" className="btn-primary" state={language} setState={setLanguage} value="hakka" />
						</div>
					</div>
					<div>
						<div className="text-secondary text-lg font-semibold ms-0.5 mb-0.5 tracking-widest">聲線</div>
						<div className="join bg-base-100" role="group" aria-label="選擇聲線">
							<Radio name="btnvoice" className="btn-secondary" state={voice} setState={setVoice} value="male" />
							<Radio name="btnvoice" className="btn-secondary" state={voice} setState={setVoice} value="female" />
						</div>
					</div>
					<div>
						<button type="button" className="btn btn-ghost max-sm:btn-sm max-sm:px-2.5 relative flex-col flex-nowrap gap-0 text-base whitespace-nowrap h-20 min-h-20 text-slate-500 font-extrabold hover:bg-opacity-10" onClick={() => setCurrSettingsDialogPage("settings")}>
							{currInferenceModeDownloadState !== "latest" && <MdError size="1.5em" className={`absolute -top-1 -right-1 ${DOWNLOAD_STATUS_INDICATOR_CLASS[currInferenceModeDownloadState]}`} />}
							<MdSettings size="2em" />
							設定
						</button>
						{createPortal(
							<SettingsDialog
								ref={settingsDialog}
								currSettingsDialogPage={currSettingsDialogPage}
								setCurrSettingsDialogPage={setCurrSettingsDialogPage}
								queryOptions={queryOptions}
								downloadState={downloadState}
								setDownloadState={setDownloadState} />,
							document.body,
						)}
					</div>
				</div>
				<div className="join w-full">
					<textarea
						className="textarea textarea-accent text-lg h-0 min-h-0 max-sm:py-2.5 sm:textarea-lg sm:text-xl flex-grow join-item overflow-hidden"
						placeholder="輸入文字……"
						rows={1}
						{...NO_AUTO_FILL}
						ref={textArea}
						onChange={resizeElements} />
					<button
						type="button"
						className="btn btn-accent h-0 min-h-0 max-sm:text-base sm:btn-lg join-item"
						ref={btnAddSentence}
						onClick={addSentence}>
						加入句子
					</button>
				</div>
			</div>
			<div className="mt-5">
				{sentences.flatMap((sentence, i) => (
					sentence.language === language
						? [
							<SentenceCard
								key={sentences.length - i}
								sentence={sentence}
								hakkaToneMode={hakkaToneMode}
								setDownloadState={setDownloadState}
								currSettingsDialogPage={currSettingsDialogPage}
								setCurrSettingsDialogPage={setCurrSettingsDialogPage} />,
						]
						: []
				))}
			</div>
		</div>
	</DBProvider>;
}
