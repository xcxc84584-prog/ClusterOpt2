/**
 * PR23.7 — deterministic trigger decision for static UICO contract VTE.
 *
 * No I/O, scheduling, DOM or storage operations. The host supplies trusted
 * LinkCore version and previously recorded test status. A VTE runner and
 * console entry point are separate integration responsibilities.
 */
const VERSION = /^[0-9A-Za-z][0-9A-Za-z.+-]{0,63}$/;
const ERROR_STATES = new Set(["fail", "error", "unverified"]);
const REASONS = Object.freeze([
	"version-change", "previous-error", "previous-incomplete", "manual"
]);

function validVersion(version) {
	return typeof version === "string" && VERSION.test(version);
}

function decision(run, reasons, status = "scheduled") {
	return Object.freeze({
		run,
		status,
		reasons: Object.freeze(reasons)
	});
}

export const UICOVTETriggerPolicy = Object.freeze({
	reasons: REASONS,

	/**
	 * 'previous-error' must refer to a UICO contract or Event Chain error,
	 * never to an unrelated editor/network failure. An explicit console
	 * request always triggers a run, even on an unchanged release.
	 */
	evaluate(candidate) {
		if (!candidate || typeof candidate !== "object" ||
			Array.isArray(candidate)) return decision(false, [], "invalid");
		const {
			currentVersion, previousOpenedVersion,
			previousTestStatus, manual, inFlight
		} = candidate;
		if (!validVersion(currentVersion) ||
			(previousOpenedVersion !== null &&
				previousOpenedVersion !== undefined &&
				!validVersion(previousOpenedVersion)) ||
			(previousTestStatus !== undefined &&
				previousTestStatus !== null &&
				typeof previousTestStatus !== "string") ||
			typeof manual !== "boolean" ||
			typeof inFlight !== "boolean") {
			return decision(false, [], "invalid");
		}
		const reasons = [];
		if (previousOpenedVersion !== undefined &&
			previousOpenedVersion !== null &&
			previousOpenedVersion !== currentVersion) {
			reasons.push("version-change");
		}
		if (ERROR_STATES.has(previousTestStatus)) {
			reasons.push("previous-error");
		}
		// A launch interrupted after scheduling must be retried on reload.
		if (previousTestStatus === "pending") {
			reasons.push("previous-incomplete");
		}
		if (manual) reasons.push("manual");
		if (!reasons.length) return decision(false, [], "skip");
		if (inFlight) return decision(false, reasons, "coalesced");
		return decision(true, reasons);
	}
});
