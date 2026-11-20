/**
 * PR24.81/82: bounded Host-owned RPC timeout circuit breaker.
 * This helper is pure policy, NOT a new EDPMU shared Property.
 * A Worker may neither raise the threshold nor reset an open circuit.
 */
const WINDOW_MS = 60000;
const TRIP_COUNT = 3;

export const PluginRPCCircuitPolicy = Object.freeze({
  windowMs: WINDOW_MS,
  tripCount: TRIP_COUNT,
  recordTimeout(previous, timestamp) {
    if (!Array.isArray(previous) || previous.length > TRIP_COUNT ||
        !Number.isFinite(timestamp)) {
      return Object.freeze({ ok: false, status: 400 });
    }
    const recent = previous.filter(item =>
      Number.isFinite(item) && item <= timestamp &&
      timestamp - item <= WINDOW_MS);
    recent.push(timestamp);
    const timestamps = Object.freeze(recent.slice(-TRIP_COUNT));
    return Object.freeze({
      ok: true, status: 200,
      timestamps, open: timestamps.length >= TRIP_COUNT
    });
  }
});
