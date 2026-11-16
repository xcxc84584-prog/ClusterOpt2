import { Language } from "./Language.js";
/** Shared document-status property: four mutually exclusive states. */
export const DocumentStatus = Object.freeze({
  SYNCED: "green",
  DIRTY: "yellow",
  ERROR: "red",
  LOADING: "blue"
});

export function statusLabel(state, locale = Language.defaultLocale) {
	const key = {
		green: "synced", yellow: "dirty",
		red: "failed", blue: "loading"
	}[state] ?? "unknown";
	return Language.translate(locale, key);
}
