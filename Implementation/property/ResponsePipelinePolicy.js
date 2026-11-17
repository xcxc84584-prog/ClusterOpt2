import { CapabilityIdPolicy } from "./CapabilityIdPolicy.js";

/**
 * PR04.07: a bounded, declarative response-only pipeline.
 * No executable functions, identities, permissions or status fields.
 */
const KINDS = new Set(["validate", "transform", "aggregate"]);
const KEYS = new Set(["kind", "providerId"]);
const LIMIT = 4;
function frozen(value) {
  if (!value || typeof value !== "object") return value;
  for (const item of Object.values(value)) frozen(item);
  return Object.freeze(value);
}

export const ResponsePipelinePolicy = Object.freeze({
  maxStages: LIMIT,
  validate(items, mode) {
    if (!Array.isArray(items) || items.length < 1 ||
        items.length > LIMIT) return false;
    const providers = new Set();
    for (const [index, item] of items.entries()) {
      if (!item || typeof item !== "object" ||
          Array.isArray(item) ||
          Object.keys(item).length !== KEYS.size ||
          Object.keys(item).some(key => !KEYS.has(key)) ||
          !KINDS.has(item.kind) ||
          !CapabilityIdPolicy.validate(item.providerId).ok ||
          providers.has(item.providerId)) return false;
      if (item.kind === "aggregate" &&
          (mode !== "fanout" || index !== 0)) return false;
      providers.add(item.providerId);
    }
    return true;
  },
  // Detach data between trusted host Providers; never allow them to
  // mutate prior outputs or fabricate the Hub response envelope.
  clone(value) {
    return frozen(JSON.parse(JSON.stringify(value)));
  },
  fanoutSchema: Object.freeze({
    type: "array", items: Object.freeze({ type: "object" })
  }),
  booleanSchema: Object.freeze({ type: "boolean" })
});
