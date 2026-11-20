import { APIDescriptorPolicy } from "./APIDescriptorPolicy.js";

/**
 * PR23.4 — immutable state transition for plugin-owned UI API extensions.
 * Caller identity/capability MUST be checked by HubUnit/UICO before calling.
 * This property helper is not a runtime registry or permission authority.
 */
const ID = /^[A-Za-z][A-Za-z0-9._-]{0,127}$/;
const CODE = Object.freeze({
  "00": "Add", "01": "Delete", "10": "Query", "11": "Update"
});
const own = (o, key) => Object.hasOwn(o, key);
const result = (status, value = null) => Object.freeze({
  ok: status >= 200 && status < 300, status, value
});
function record(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v) &&
    (Object.getPrototypeOf(v) === Object.prototype ||
     Object.getPrototypeOf(v) === null);
}
function safeId(id) { return typeof id === "string" && ID.test(id); }
function descriptorValid(descriptor, source, apiId) {
  const parsed = APIDescriptorPolicy.validate(descriptor);
  return parsed.ok && parsed.value.id === apiId &&
    parsed.value.owner === source;
}
function copyMap(current) {
  return new Map(current ? [...current.entries()] : []);
}
export const UIExtensionAPIPolicy = Object.freeze({
  operations: CODE,

  /**
   * An operation changes only plugin extension metadata. Native descriptors
   * are never writable here even if a caller requests a special privilege.
   * Existing owner and provenance cannot be replaced by user payload.
   */
  transition(current, request, context) {
    if (!(current instanceof Map) || current.size > 100 ||
        !record(request) || !record(context) ||
        !safeId(request.uiId) || !safeId(request.apiId) ||
        !own(CODE, request.operationCode) ||
        !safeId(context.ownerId) ||
        context.authorized !== true) {
      return result(context?.authorized === false ? 403 : 400);
    }
    const key = request.uiId + "/" + request.apiId;
    const prior = current.get(key);
    const op = request.operationCode;
    if (prior?.provenance === "native" ||
        request.apiId.startsWith("native.")) return result(403);

    if (op === "10") {
      if (!prior) return result(404);
      if (prior.ownerId !== context.ownerId) return result(403);
      return result(200, Object.freeze({ state: current, entry: prior }));
    }
    if (op === "00") {
      if (prior) return result(409);
      if (current.size >= 100) return result(429);
      if (!descriptorValid(request.descriptor, context.ownerId,
          request.apiId)) return result(400);
      const entry = Object.freeze({
        uiId: request.uiId, apiId: request.apiId,
        ownerId: context.ownerId, provenance: "plugin",
        revision: 1,
        descriptor: APIDescriptorPolicy.validate(request.descriptor).value
      });
      const next = copyMap(current);
      next.set(key, entry);
      return result(201, Object.freeze({ state: next, entry }));
    }
    if (!prior) return result(404);
    if (prior.ownerId !== context.ownerId) return result(403);
    if (!Number.isSafeInteger(request.expectedRevision) ||
        request.expectedRevision !== prior.revision) return result(409);

    const next = copyMap(current);
    if (op === "01") {
      next.delete(key);
      return result(200, Object.freeze({
        state: next, entry: Object.freeze({ ...prior,
          revision: prior.revision + 1 })
      }));
    }
    if (!descriptorValid(request.descriptor, context.ownerId,
        request.apiId)) return result(400);
    const entry = Object.freeze({
      ...prior,
      descriptor: APIDescriptorPolicy.validate(request.descriptor).value,
      revision: prior.revision + 1
    });
    next.set(key, entry);
    return result(200, Object.freeze({ state: next, entry }));
  }
});
