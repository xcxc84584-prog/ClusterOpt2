import { Language } from "../property/Language.js";
import { LanguageManager } from "../object/LanguageManager.js";

/**
 * DOM adapter to ClusterOpt's original language submenu.
 * Static UI translations are a projection of the shared Language Property.
 */
export function mountLanguageUI(core, doc, storage, onLocaleChange) {
	const $ = id => doc.getElementById(id);
	const manager = new LanguageManager(core, {
		storage, onChange: locale => {
			const t = (key, args) => Language.translate(locale, key, args);
			const labels = {
				explorerTitle: "explorerTitle",
				menuBtn: "file", newFile: "newFile", openFile: "openFile",
				saveFile: "saveFile", saveAsFile: "saveAsFile",
				closeFile: "closeFile",
				closeAllMain: "closeAllMain", toolBtn: "tool",
				pluginBtn: "plugin",
				pluginPerformanceNavLabel: "pluginPerformance",
				pluginMaxLabel: "pluginMaxLabel",
				pluginOffLabel: "pluginOffLabel",
				pluginApply: "pluginApply",
				pluginLimitNote: "pluginLimitNote",
				pluginHighlighterNavLabel: "pluginHighlighter",
                pluginDialogTitle: "pluginManager",
                pluginDialogIntro: "pluginIntro",
                pluginPerformanceTitle: "pluginPerformance",
                pluginProcessorNavLabel: "pluginProcessor",
                pluginCommitterNavLabel: "pluginCommitter",
                pluginApiTitle: "pluginApiTitle",
                pluginNavCaption: "pluginNavCaption",
                pluginHighlighterTitle: "pluginHighlighterTitle",
                pluginProcessorTitle: "pluginProcessorTitle",
                pluginCommitterTitle: "pluginCommitterTitle",
                pluginHighlighterDescription: "pluginHighlighterDescription",
                pluginProcessorDescription: "pluginProcessorDescription",
                pluginCommitterDescription: "pluginCommitterDescription",
                pluginHighlighterState: "pluginUnavailable",
                pluginProcessorState: "pluginUnavailable",
                pluginCommitterState: "pluginUnavailable",
                pluginProcessorApi: "pluginProcessorApi",
                pluginCommitterApi: "pluginCommitterApi",
                pluginHighlighterApi: "pluginHighlighterApi",
                pluginFooter: "pluginFooter",
                pluginDone: "pluginCloseWindow",
				blockedTypesBtn: "blockedTypes",
				priorityHeading: "priorityHeading",
				paletteBtn: "palette", languageBtn: "language",
				paletteTitle: "paletteTitle", paletteLabel: "paletteRGB",
				paletteHint: "paletteHint", palettePresetLabel: "palettePreset",
				paletteDark: "paletteDark", paletteLight: "paletteLight",
				paletteFooterHint: "paletteFooter", paletteDone: "paletteDone",
				palettePreview: "palettePreview",
				emptyHint: "emptyHint", fileType: "plainText"
			};
			for (const [id, key] of Object.entries(labels)) {
				const node = $(id);
				if (!node) continue;
				const arrow = id === "menuBtn" ? "⌄" :
					["toolBtn", "paletteBtn", "languageBtn",
					"blockedTypesBtn"].includes(id) ? " ›" : "";
				const symbol = id === "pluginBtn" ? "◇ " :
                  id === "blockedTypesBtn" ? "▧ " : "";
                node.textContent = symbol + t(key) + arrow;
			}
			$("explorerSearch").placeholder = t("explorerSearch");
			$("explorerAddFolder").textContent =
				"▣ " + t("explorerImportFolder");
			$("explorerAddFile").textContent =
				"◇ " + t("explorerImportFile");
			$("explorerRefresh").title = t("explorerRefresh");
			$("editor").setAttribute("aria-label", t("editor"));
			$("tabs").setAttribute("aria-label", t("tabs"));
			doc.documentElement.lang = locale;
			$("paletteClose").setAttribute("aria-label", t("closeDialog"));
			$("menu").setAttribute("aria-label", t("fileMenu"));
			$("toolOptions").setAttribute("aria-label", t("toolsGroup"));
			for (const button of doc.querySelectorAll("[data-locale]")) {
				const selected = button.dataset.locale === locale;
				button.querySelector(".locale-check").textContent =
					selected ? "✓" : "";
				button.setAttribute("aria-pressed", String(selected));
			}
            const select = $("priority");
            for (const option of select.options) {
              option.textContent = t(option.value === "internal" ?
                "internalFirst" : "externalFirst");
            }
            select.setAttribute("title", t("priorityHeading"));
            select.setAttribute("aria-label", t("priorityHeading"));
            onLocaleChange?.(locale);
		}
	});
	const languageButton = $("languageBtn");
	const languageOptions = $("languageOptions");
	languageButton.addEventListener("click", event => {
		event.stopPropagation();
		languageOptions.hidden = !languageOptions.hidden;
		languageButton.setAttribute("aria-expanded",
			String(!languageOptions.hidden));
	});
	languageOptions.addEventListener("click", event => {
		const button = event.target.closest("[data-locale]");
		if (!button) return;
		void core.request("ui", "LanguageManager", "set", {
			locale: button.dataset.locale
		}, { origin: "user" }).then(result => {
			if (!result.ok) {
				core.omu.record("EHU", "ui", "Language.UISet",
					result.status, "LanguageManager",
					{ error: result.error });
			}
		});
		languageOptions.hidden = true;
		languageButton.setAttribute("aria-expanded", "false");
		$("toolOptions").hidden = true;
		$("toolBtn").setAttribute("aria-expanded", "false");
		$("menu").hidden = true;
		$("menuBtn").setAttribute("aria-expanded", "false");
	});
	return manager;
}
