/**
 * PR23.7 static UI API contract compatibility comparator.
 * Bounded, deterministic and side-effect free.
 * Missing baseline is UNVERIFIED, never a false PASS.
 */
function isRecord(value) {
	return value !== null && typeof value === "object" &&
		!Array.isArray(value) &&
		(Object.getPrototypeOf(value) === Object.prototype ||
			Object.getPrototypeOf(value) === null);
}

function valid(snapshot) {
	return isRecord(snapshot) &&
		typeof snapshot.version === "string" &&
		isRecord(snapshot.actions) &&
		Object.keys(snapshot.actions).length <= 256 &&
		Object.values(snapshot.actions).every(value =>
			typeof value === "string" && value.length <= 128);
}

export const UICOContractCompatibilityPolicy = Object.freeze({
	compare(previous, current) {
		if (!valid(current)) {
			return Object.freeze({
				status: "FAIL",
				issues: Object.freeze(["INVALID_CURRENT_CONTRACT"])
			});
		}
		if (!valid(previous)) {
			return Object.freeze({
				status: "UNVERIFIED",
				issues: Object.freeze(["MISSING_BASELINE"])
			});
		}
		const issues = [];
		for (const [action, schema] of Object.entries(previous.actions)) {
			if (!Object.hasOwn(current.actions, action)) {
				issues.push("REMOVED:" + action);
			} else if (current.actions[action] !== schema) {
				issues.push("CHANGED:" + action);
			}
		}
		return Object.freeze({
			status: issues.length ? "FAIL" : "PASS",
			issues: Object.freeze(issues)
		});
	}
});
