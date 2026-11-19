/**
 * PR23.7 — deterministic Request/Response schema compatibility.
 * Canonical JSON compares complete supplied descriptors without hash collisions.
 * Pure validator: no HubUnit registration, DOM mutation or ACL decision.
 */
const forbidden = new Set(["__proto__", "prototype", "constructor"]);
function record(v) {
	return v !== null && typeof v === "object" && !Array.isArray(v) &&
		(Object.getPrototypeOf(v) === Object.prototype ||
		 Object.getPrototypeOf(v) === null);
}
function canonical(v, depth = 0) {
	if (depth > 16) throw new TypeError("Schema too deep");
	if (v === null || typeof v === "string" || typeof v === "boolean") {
		return JSON.stringify(v);
	}
	if (typeof v === "number" && Number.isFinite(v)) return JSON.stringify(v);
	if (Array.isArray(v)) {
		return "[" + v.map(x => canonical(x, depth + 1)).join(",") + "]";
	}
	if (!record(v)) throw new TypeError("Non-JSON schema");
	const keys = Object.keys(v).sort();
	if (keys.some(k => forbidden.has(k))) throw new TypeError("Unsafe key");
	return "{" + keys.map(k => JSON.stringify(k) + ":" +
		canonical(v[k], depth + 1)).join(",") + "}";
}
function inspect(snapshot) {
	if (!record(snapshot) || typeof snapshot.version !== "string" ||
		!record(snapshot.actions) || Object.keys(snapshot.actions).length > 256) {
		return { valid: false, legacy: false };
	}
	const actions = Object.create(null);
	let legacy = false;
	try {
		for (const [name, item] of Object.entries(snapshot.actions)) {
			if (!/^[A-Za-z][A-Za-z0-9._-]{0,127}$/.test(name)) {
				return { valid: false, legacy: false };
			}
			if (typeof item === "string") {
				legacy = true;
				actions[name] = { capability: item, legacy: true };
				continue;
			}
			if (!record(item) || typeof item.capability !== "string" ||
				!record(item.requestSchema) || !record(item.responseSchema)) {
				return { valid: false, legacy: false };
			}
			const request = canonical(item.requestSchema);
			const response = canonical(item.responseSchema);
			if (request.length > 65536 || response.length > 65536) {
				return { valid: false, legacy: false };
			}
			actions[name] = { capability: item.capability, request, response };
		}
	} catch { return { valid: false, legacy: false }; }
	return { valid: true, legacy, actions };
}
function output(status, issues) {
	return Object.freeze({ status, issues: Object.freeze(issues) });
}
export const UICOContractCompatibilityPolicy = Object.freeze({
	fingerprint: canonical,
	compare(previous, current) {
		const now = inspect(current);
		if (!now.valid) {
			return output("FAIL", ["INVALID_CURRENT_CONTRACT"]);
		}
		if (now.legacy && Object.values(now.actions).some(a => !a.legacy)) {
			return output("FAIL", ["MIXED_CURRENT_CONTRACT"]);
		}
		if (previous == null) {
			return output("UNVERIFIED", ["MISSING_BASELINE"]);
		}
		const old = inspect(previous);
		if (!old.valid) {
			return output("UNVERIFIED", ["INVALID_BASELINE_CONTRACT"]);
		}
		if (old.legacy !== now.legacy) {
			return output("UNVERIFIED", ["SCHEMA_BASELINE_MIGRATION"]);
		}
		const issues = [];
		for (const [name, item] of Object.entries(old.actions).sort()) {
			const next = now.actions[name];
			if (!next) { issues.push("REMOVED:" + name); continue; }
			if (item.capability !== next.capability) {
				issues.push("CAPABILITY_CHANGED:" + name);
			}
			if (!old.legacy && item.request !== next.request) {
				issues.push("REQUEST_SCHEMA_CHANGED:" + name);
			}
			if (!old.legacy && item.response !== next.response) {
				issues.push("RESPONSE_SCHEMA_CHANGED:" + name);
			}
		}
		return output(issues.length ? "FAIL" : "PASS", issues);
	}
});
