/**
 * PR03.09: deterministic Provider health transitions.
 * Does not change URU registrations or bypass Hub authorization.
 */
const FAIL_LIMIT = 3;
const COOLDOWN_MS = 30000;

export const ProviderHealthPolicy = Object.freeze({
  initial: Object.freeze({
    state: "healthy", failures: 0, cooldownUntil: 0
  }),
  transition(previous, outcome, now = Date.now()) {
    if (!["ok", "failure", "timeout"].includes(outcome) ||
        !Number.isSafeInteger(now) || now < 0) {
      return { ok: false, status: 400 };
    }
    const before = previous ?? this.initial;
    if (before.state === "faulted" && now < before.cooldownUntil) {
      return { ok: false, status: 429,
        error: "Provider cooling down" };
    }
    if (outcome === "ok") {
      return { ok: true, status: 200,
        value: this.initial };
    }
    const failures = before.failures + 1;
    const faulted = failures >= FAIL_LIMIT;
    return {
      ok: true, status: 200,
      value: Object.freeze({
        state: faulted ? "faulted" : "degraded",
        failures,
        cooldownUntil: faulted ? now + COOLDOWN_MS : 0
      })
    };
  },
  isAvailable(health, now = Date.now()) {
    const state = health ?? this.initial;
    return state.state !== "faulted" ||
      now >= state.cooldownUntil;
  }
});
