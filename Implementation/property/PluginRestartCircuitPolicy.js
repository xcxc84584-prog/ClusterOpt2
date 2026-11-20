/**
 * PR24.85: Host-only per-Provider Worker fault/restart policy.
 * This is pure policy, NOT an EDPMU Property or a Worker capability.
 * Deliberate disable/enable never counts as a crash.
 */
const WINDOW_MS = 60000;
const COOLDOWNS_MS = Object.freeze([1500, 6000, 60000]);
const MAX_HISTORY = 3;

function invalid() {
  return Object.freeze({ ok: false, status: 400 });
}

export const PluginRestartCircuitPolicy = Object.freeze({
  windowMs: WINDOW_MS,
  cooldownsMs: COOLDOWNS_MS,

  fault(previous, timestamp) {
    if (!Array.isArray(previous) ||
        previous.length > MAX_HISTORY ||
        !Number.isSafeInteger(timestamp) || timestamp < 0 ||
        previous.some(value =>
          !Number.isSafeInteger(value) || value < 0 ||
          value > timestamp)) {
      return invalid();
    }
    const history = previous.filter(value =>
      timestamp - value < WINDOW_MS);
    history.push(timestamp);
    const retained = Object.freeze(history.slice(-MAX_HISTORY));
    const delay = COOLDOWNS_MS[Math.min(
      retained.length, COOLDOWNS_MS.length) - 1];
    return Object.freeze({
      ok: true, status: 200,
      history: retained,
      retryAfterMs: delay,
      nextAllowedAt: timestamp + delay,
      open: retained.length >= MAX_HISTORY
    });
  },

  status(entry, timestamp) {
    if (!Number.isSafeInteger(timestamp) || timestamp < 0 ||
        (entry !== null && (
          !entry || entry.ok !== true ||
          !Number.isSafeInteger(entry.nextAllowedAt)))) {
      return invalid();
    }
    if (!entry || entry.nextAllowedAt <= timestamp) {
      return Object.freeze({
        ok: true, status: 200, allowed: true,
        retryAfterMs: 0, open: false
      });
    }
    return Object.freeze({
      ok: true, status: 429, allowed: false,
      retryAfterMs: entry.nextAllowedAt - timestamp,
      open: entry.open === true
    });
  }
});
