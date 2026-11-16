/**
 * Domain-wide Language Property: shared immutable translation catalogue.
 * Add a locale here without changing Object routing or UI components.
 */
const CATALOG = Object.freeze({
	"zh-Hant": Object.freeze({
		file: "檔案", newFile: "建立新檔", openFile: "開啟檔案",
		saveFile: "儲存", saveAsFile: "另存新檔", closeFile: "關閉分頁",
		tool: "工具", language: "語言", palette: "介面調色盤",
		emptyHint: "選擇「檔案」建立或開啟文件",
		ready: "就緒", synced: "已與磁碟同步",
		dirty: "尚未儲存", failed: "操作失敗",
		loading: "操作中", unknown: "未知狀態",
		editor: "文字編輯器", tabs: "文件分頁",
		confirmClose: "檔案尚未儲存，確定要關閉「{name}」？",
		openUnavailable: "需要 Chromium HTTPS 或 localhost 才能開啟文件",
		saveUnavailable: "需要 Chromium HTTPS 或 localhost 才能儲存文件",
		paletteTitle: "介面調色盤", paletteRGB: "介面色系 RGB",
		paletteHint: "選擇顏色以即時預覽整體介面",
		paletteDark: "黑色端點", paletteLight: "白色端點",
		palettePreset: "端點風格", paletteDone: "完成",
		paletteFooter: "設定會自動儲存",
		paletteError: "介面調色盤：{message}",
		modeDark: "DARK", modeLight: "LIGHT",
		plainText: "純文字", palettePreview: "UI PREVIEW"
	}),
	"en": Object.freeze({
		file: "File", newFile: "New File", openFile: "Open File",
		saveFile: "Save", saveAsFile: "Save As",
		closeFile: "Close Tab", tool: "Tools", language: "Language",
		palette: "Interface Palette",
		emptyHint: "Choose File to create or open a document",
		ready: "Ready", synced: "Synced with disk",
		dirty: "Unsaved changes", failed: "Operation failed",
		loading: "Working", unknown: "Unknown status",
		editor: "Text editor", tabs: "Document tabs",
		confirmClose: "The file \"{name}\" has unsaved changes. Close it?",
		openUnavailable: "Opening files requires Chromium HTTPS or localhost",
		saveUnavailable: "Saving files requires Chromium HTTPS or localhost",
		paletteTitle: "Interface Palette", paletteRGB: "Interface RGB Color",
		paletteHint: "Choose a color to preview the interface",
		paletteDark: "Black Endpoint", paletteLight: "White Endpoint",
		palettePreset: "Endpoint Style", paletteDone: "Done",
		paletteFooter: "Changes are saved automatically",
		paletteError: "Interface Palette: {message}",
		modeDark: "DARK", modeLight: "LIGHT",
		plainText: "Plain text", palettePreview: "UI PREVIEW"
	})
});

export const Language = Object.freeze({
	defaultLocale: "zh-Hant",
	storageKey: "clusteropt2.language.v1",
	catalog: CATALOG,
	supported: Object.freeze(Object.keys(CATALOG)),
	valid(locale) {
		return typeof locale === "string" &&
			Object.hasOwn(CATALOG, locale);
	},
	translate(locale, key, args = {}) {
		const dictionary = CATALOG[locale] ?? CATALOG[this.defaultLocale];
		const template = dictionary[key] ?? CATALOG[this.defaultLocale][key];
		if (typeof template !== "string") return key;
		return template.replace(/\{([a-zA-Z]+)\}/g,
			(_, name) => String(args[name] ?? ""));
	}
});
