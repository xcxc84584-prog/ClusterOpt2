import { PluginMessagePolicy } from "./PluginMessagePolicy.js";

/**
 * PR13.3: validate an isolated plugin RPC envelope.
 * No Worker bootstrap or arbitrary import is authorized by validation.
 */
const MAX_CALL_ID = 2147483647;

function fail(status = 400) {
  return Object.freeze({ ok: false, status });
}

function match(value, fields) {
  return value && typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === fields.length &&
    fields.every(name => Object.hasOwn(value, name));
}

export const PluginRPCContractPolicy = Object.freeze({
  request(candidate, manifest) {
    const parsed = PluginMessagePolicy.inspect(candidate);
    if (!parsed.ok) return parsed;
    const value = parsed.value;
    if (!match(value, ["kind", "id", "service", "action", "payload"]) ||
        value.kind !== "invoke" ||
        !Number.isSafeInteger(value.id) ||
        value.id <= 0 || value.id > MAX_CALL_ID ||
        typeof value.service !== "string" ||
        typeof value.action !== "string") return fail();
    const declared = manifest?.provides?.some(item =>
      item.service === value.service && item.action === value.action);
    return declared ?
      Object.freeze({ ok: true, status: 200, value }) : fail(403);
  },

  response(candidate, expectedId) {
    const parsed = PluginMessagePolicy.inspect(candidate);
    if (!parsed.ok) return parsed;
    const value = parsed.value;
    if (!Number.isSafeInteger(expectedId) || expectedId <= 0 ||
        !value || value.kind !== "response" ||
        value.id !== expectedId || typeof value.ok !== "boolean") {
      return fail(502);
    }
    if (value.ok) {
      return match(value, ["kind", "id", "ok", "value"]) ?
        Object.freeze({ ok: true, status: 200, value: value.value }) :
        fail(502);
    }
    return match(value, ["kind", "id", "ok", "status"]) &&
      [400, 403, 404, 413, 429, 500, 503, 504].includes(value.status) ?
      Object.freeze({ ok: false, status: value.status }) : fail(502);
  }
});
