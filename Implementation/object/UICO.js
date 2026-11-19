import { UISP } from "../property/UISP.js";
import { UIProtocolPolicy } from "../property/UIProtocolPolicy.js";

/**
 * PR23.3 — UI domain hub (initial read-only implementation).
 *
 * HubUnit is the sole external Request/Response and ACL entry point.
 * This Object does not acquire DOM handles or create controls.
 * Native UI adapters and mutations are reserved for PR23.4–PR23.8.
 */
export class UICO {
	constructor(core) {
		this.id = "UICO";
		this.core = core;
		this.strictOCDA = true;
		this.authorization = Object.freeze({
			default: "Private",
			describe: "Public",
			list: "Public"
		});
		this.ocda = Object.freeze({
			Request: Object.freeze(["describe", "list"]),
			Response: Object.freeze(["describe", "list"]),
			UserAPI: Object.freeze(["describe", "list"]),
			AgentAPI: Object.freeze(["describe", "list"]),
			Property: Object.freeze(["UISP"]),
			Program: "UICO",
			EHU: "LinkCore.OMU",
			Log: "LinkCore.OMU"
		});
	}

	/**
	 * Lists only verified, registered UI descriptors.
	 * Inventory is empty until PR23.4/23.6 migration.
	 */
	async receive(action, payload = {}) {
		if (action === "describe") {
			return Object.freeze({
				objectId: this.id,
				protocol: UIProtocolPolicy.protocol,
				property: "UISP",
				propertyVersion: UISP.version,
				readOnly: true
			});
		}
		if (action === "list") {
			if (payload !== null &&
				(typeof payload !== "object" || Array.isArray(payload))) {
				const error = new TypeError("Invalid UI query");
				error.status = 400;
				throw error;
			}
			return Object.freeze([]);
		}
		const error = new Error("Unsupported UICO action");
		error.status = 404;
		throw error;
	}
}
