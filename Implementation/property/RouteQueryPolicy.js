import { CapabilityIdPolicy } from "../property/CapabilityIdPolicy.js";

/**
 * Read-only public query grammar. No caller identity, runtime handle
 * or mutable route structure may be passed via this API.
 */
const ID = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const ACTION = /^[a-z][a-zA-Z0-9]{0,63}$/;
const MAX_PAGE = 32;
function record(value, allowed) {
  if (!value || typeof value !== "object" ||
      Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== Object.keys(value).length) return false;
  const properties = Object.getOwnPropertyDescriptors(value);
  return keys.every(key => typeof key === "string" &&
    allowed.includes(key) &&
    Object.hasOwn(properties[key], "value"));
}
const error = Object.freeze({
  ok: false, status: 400, error: "Invalid route query"
});

export const RouteQueryPolicy = Object.freeze({
  parse(command, input) {
    if (command === "list" &&
        record(input, ["offset", "limit"])) {
      const offset = input.offset ?? 0;
      const limit = input.limit ?? 20;
      if (Number.isInteger(offset) && offset >= 0 && offset <= 32 &&
          Number.isInteger(limit) && limit >= 1 &&
          limit <= MAX_PAGE) {
        return { ok: true, value: { offset, limit } };
      }
    }
    if (command === "describe" && typeof input === "string" &&
        input.length <= 128 && ID.test(input)) {
      return { ok: true, value: { routeId: input } };
    }
    if (command === "preview" &&
        record(input, ["service", "action"]) &&
        Object.keys(input).length === 2 &&
        CapabilityIdPolicy.validate(input.service).ok &&
        typeof input.action === "string" &&
        ACTION.test(input.action)) {
      return { ok: true, value: {
        service: input.service, action: input.action
      } };
    }
    return error;
  }
});
