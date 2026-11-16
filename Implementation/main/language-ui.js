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
				menuBtn: "file", newFile: "newFile", openFile: "openFile",
				saveFile: "saveFile", saveAsFile: "saveAsFile",
				closeFile: "closeFile", toolBtn: "tool",
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
					["toolBtn", "paletteBtn", "languageBtn"].includes(id) ? " ›" : "";
				node.textContent = t(key) + arrow;
			}
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
