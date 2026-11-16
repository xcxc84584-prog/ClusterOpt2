import { UI_COLOR } from "../property/UI_COLOR.js";

/**
 * OCDA InterfacePalette Object (hand), driven by the UI_COLOR Property.
 * All mutation flows through HubUnit Request/Response.
 */
export class InterfacePalette {
	constructor(core, { storage = null, target = null } = {}) {
		this.id = "InterfacePalette";
		this.core = core;
		this.storage = storage;
		this.target = target;
		this.strictOCDA = true;
		this.authorization = Object.freeze({
			default: "Private",
			get: "Public",
			set: "Public",
			restore: "Public"
		});
		this.ocda = Object.freeze({
			Request: ["get", "set", "restore"],
			Response: ["get", "set", "restore"],
			UserAPI: ["get", "set", "restore"],
			AgentAPI: ["get"],
			Property: ["UI_COLOR"],
			Program: "InterfacePalette",
			EHU: "LinkCore.OMU",
			Log: "LinkCore.OMU"
		});
		this.rgb = [...UI_COLOR.defaultRGB];
		if (!this.core.register(this)) throw new Error("Palette registration failed");
		this.load();
	}

	load() {
		if (this.storage) {
			try {
				const saved = this.storage.getItem(UI_COLOR.storageKey);
				if (saved !== null) {
					const parsed = JSON.parse(saved);
					if (!UI_COLOR.valid(parsed)) {
						throw new RangeError("Stored RGB channels are invalid");
					}
					this.rgb = [...parsed];
				}
			} catch {
				this.core.omu.record("EHU", this.id, "Restore", 400,
					"UI_COLOR", { reason: "Invalid or unavailable stored preference" });
			}
		}
		this.core.hub.publishProperty("UI_COLOR", [...this.rgb]);
		this.apply();
	}

	apply() {
		const derived = UI_COLOR.derive(this.rgb);
		if (this.target?.style) {
			for (const [key, value] of Object.entries(derived)) {
				if (key === "mode") continue;
				this.target.style.setProperty("--ui-" + key, value);
			}
			this.target.style.colorScheme = derived.mode;
		}
	}

	snapshot() {
		return Object.freeze({
			rgb: Object.freeze([...this.rgb]),
			hex: UI_COLOR.toHex(this.rgb),
			mode: UI_COLOR.derive(this.rgb).mode
		});
	}

	async receive(action, payload = {}) {
		if (action === "get") return this.snapshot();
		if (action === "restore") return this.set(UI_COLOR.defaultRGB);
		if (action === "set") return this.set(payload.rgb);
		throw new Error("Unsupported palette request: " + action);
	}

	set(rgb) {
		if (!UI_COLOR.valid(rgb)) {
			const error = new RangeError("RGB values must be integers in 0..255");
			error.status = 400;
			throw error;
		}
		const next = [...rgb];
		const result = this.core.hub.publishProperty("UI_COLOR", next);
		if (!result.ok) {
			const error = new Error("UI_COLOR property update rejected");
			error.status = result.status;
			throw error;
		}
		this.rgb = next;
		this.apply();
		try {
			this.storage?.setItem(UI_COLOR.storageKey, JSON.stringify(next));
		} catch {
			this.core.omu.record("EHU", this.id, "Persist", 503,
				"UI_COLOR", { reason: "Storage unavailable; in-memory mode" });
		}
		return this.snapshot();
	}
}
