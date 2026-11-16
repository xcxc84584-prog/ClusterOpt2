import { Language } from "../property/Language.js";

/**
 * OCDA language Object: Request API is the hand, Language Property
 * owns the dictionary and validation algorithm (brain).
 */
export class LanguageManager {
	constructor(core, { storage = null, onChange = () => {} } = {}) {
		this.id = "LanguageManager";
		this.core = core;
		this.storage = storage;
		this.onChange = onChange;
		this.locale = Language.defaultLocale;
		this.strictOCDA = true;
		this.authorization = Object.freeze({ default: "Private",
			get: "Public", set: "Public", translate: "Public" });
		this.ocda = Object.freeze({
			Request: ["get", "set", "translate"],
			Response: ["get", "set", "translate"],
			UserAPI: ["get", "set", "translate"],
			AgentAPI: ["get", "translate"],
			Property: ["Language"],
			Program: "LanguageManager",
			EHU: "LinkCore.OMU",
			Log: "LinkCore.OMU"
		});
		if (!core.register(this)) {
			throw new Error("LanguageManager registration failed");
		}
		this.restore();
	}

	restore() {
		if (this.storage) {
			try {
				const saved = this.storage.getItem(Language.storageKey);
				if (saved !== null) {
					if (!Language.valid(saved)) {
						throw new RangeError("Unsupported saved locale");
					}
					this.locale = saved;
				}
			} catch {
				this.core.omu.record("EHU", this.id, "Restore", 400,
					"Language", { reason: "Stored locale unavailable or invalid" });
			}
		}
		this.core.hub.publishProperty("Language", this.locale);
		this.onChange(this.locale);
	}

	snapshot() {
		return Object.freeze({ locale: this.locale,
			supported: Language.supported });
	}

	async receive(action, payload = {}) {
		if (action === "get") return this.snapshot();
		if (action === "translate") {
			return Language.translate(this.locale, payload.key, payload.args);
		}
		if (action === "set") return this.set(payload.locale);
		throw new Error("Unsupported language action: " + action);
	}

	set(locale) {
		if (!Language.valid(locale)) {
			const error = new RangeError("Unsupported locale");
			error.status = 400;
			throw error;
		}
		if (this.locale === locale) return this.snapshot();
		const result = this.core.hub.publishProperty("Language", locale);
		if (!result.ok) {
			const error = new Error("Language property publication failed");
			error.status = result.status;
			throw error;
		}
		this.locale = locale;
		try {
			this.storage?.setItem(Language.storageKey, locale);
		} catch {
			this.core.omu.record("EHU", this.id, "Persist", 503,
				"Language", { reason: "Storage unavailable; memory state retained" });
		}
		this.onChange(locale);
		return this.snapshot();
	}
}
