/**
 * PR23.3 — reusable immutable UI Standard Property definition.
 * No DOM handles or executable plugin callbacks are accepted.
 * EDPMU retains the sole shared definition authority.
 */
const SPACES = Object.freeze(["viewport", "window", "content"]);
const TYPES = Object.freeze([
	"button", "window", "tab", "menu-item", "panel"
]);
const ID = /^[A-Za-z][A-Za-z0-9._-]{0,127}$/;
const MAX_PIXELS = 100000;
const MAX_STRING = 512;

function record(value) {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function isPlainTree(value, depth = 0) {
	if (depth > 8) return false;
	if (value === null || typeof value === "boolean") return true;
	if (typeof value === "number") return Number.isFinite(value);
	if (typeof value === "string") return value.length <= MAX_STRING;
	if (Array.isArray(value)) {
		return value.length <= 64 &&
			value.every(item => isPlainTree(item, depth + 1));
	}
	if (!record(value) || Object.keys(value).length > 64) return false;
	return Object.keys(value).every(key =>
		!["__proto__", "prototype", "constructor"].includes(key) &&
		isPlainTree(value[key], depth + 1));
}

function freeze(value) {
	if (Array.isArray(value)) {
		return Object.freeze(value.map(freeze));
	}
	if (!record(value)) return value;
	return Object.freeze(Object.fromEntries(
		Object.entries(value).map(([key, item]) => [key, freeze(item)])
	));
}

function validGeometry(value) {
	if (!record(value)) return false;
	if (Object.keys(value).some(key =>
		!["space", "x", "y", "width", "height"].includes(key))) {
		return false;
	}
	if (!SPACES.includes(value.space)) return false;
	return ["x", "y", "width", "height"].every(key => {
		const n = value[key];
		if (typeof n !== "number" || !Number.isFinite(n) ||
			Math.abs(n) > MAX_PIXELS) return false;
		return ["width", "height"].includes(key) ? n >= 0 : true;
	});
}

export const UISP = Object.freeze({
	version: 1,
	spaces: SPACES,
	kinds: TYPES,

	/** Validate a single UI Object's property projection, not an ACL. */
	validate(candidate) {
		if (!record(candidate) || !isPlainTree(candidate)) {
			return Object.freeze({ ok: false, status: 400 });
		}
		const fields = [
			"uiId", "kind", "parentId", "owner", "geometry",
			"appearance", "interaction", "accessibility", "revision"
		];
		if (Object.keys(candidate).some(key => !fields.includes(key)) ||
			typeof candidate.uiId !== "string" ||
			!ID.test(candidate.uiId) ||
			!TYPES.includes(candidate.kind) ||
			typeof candidate.parentId !== "string" ||
			!ID.test(candidate.parentId) ||
			typeof candidate.owner !== "string" ||
			!ID.test(candidate.owner) ||
			!validGeometry(candidate.geometry) ||
			!record(candidate.appearance) ||
			!record(candidate.interaction) ||
			!record(candidate.accessibility) ||
			!Number.isSafeInteger(candidate.revision) ||
			candidate.revision < 0) {
			return Object.freeze({ ok: false, status: 400 });
		}
		return Object.freeze({
			ok: true,
			status: 200,
			value: freeze(candidate)
		});
	}
});
