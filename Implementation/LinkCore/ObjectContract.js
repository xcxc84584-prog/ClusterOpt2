import { APIDescriptorPolicy } from
  "../property/APIDescriptorPolicy.js";

/** Standard OCDA contract, describing the outward-facing black-box object. */
const REQUIRED = Object.freeze([
  "Request", "Response", "UserAPI", "AgentAPI", "Property",
  "Program", "EHU", "Log"
]);

export function validateObjectContract(object, strict = false) {
  const failures = [];
  if (typeof object?.id !== "string" || !object.id) {
    failures.push("id");
  }
  if (typeof object?.receive !== "function") failures.push("receive");
  if (object?.parentPath !== undefined &&
      typeof object.parentPath !== "string") failures.push("parentPath");
  if (strict || object?.ocda) {
    for (const name of REQUIRED) {
      if (!(name in (object?.ocda ?? {}))) failures.push(name);
    }
    for (const name of ["Request", "Response", "UserAPI",
      "AgentAPI", "Property"]) {
      if (!Array.isArray(object?.ocda?.[name])) failures.push(name + ".type");
    }
  }
  const declared = object?.ocda?.APIDescriptors;
  if (declared !== undefined) {
    if (!Array.isArray(declared) || declared.length > 64) {
      failures.push("APIDescriptors.type");
    } else {
      const actions = new Set();
      for (const descriptor of declared) {
        const result = APIDescriptorPolicy.validate(descriptor);
        if (!result.ok) {
          failures.push("APIDescriptors.invalid");
          continue;
        }
        const value = result.value;
        if (value.owner !== object.id) {
          failures.push("APIDescriptors.owner");
        }
        if (!object.ocda.Request?.includes(value.action)) {
          failures.push("APIDescriptors.action");
        }
        if (actions.has(value.action)) {
          failures.push("APIDescriptors.duplicate");
        }
        actions.add(value.action);
        const required = object.authorization?.[value.action] ??
          object.authorization?.default ?? "Public";
        if (value.visibility !== required) {
          failures.push("APIDescriptors.visibility");
        }
      }
    }
  }
  return { ok: failures.length === 0, failures };
}

/**
 * Internal URU-only descriptor projection. Public API discovery will go
 * through a HubUnit-validated Catalog in PR02.04–PR02.06.
 */
export function describeObjectAPIs(object) {
  const contract = validateObjectContract(object, true);
  if (!contract.ok) {
    return { ok: false, status: 400, failures: contract.failures };
  }
  const entries = object.ocda.APIDescriptors ?? [];
  const values = entries.map(item => APIDescriptorPolicy.validate(
    item).value);
  return { ok: true, status: 200, value: Object.freeze(values) };
}

export function objectPath(parent, child) {
  if (!parent || !child || /\s/.test(parent + child)) {
    throw new TypeError("Invalid object path");
  }
  return parent + "." + child;
}
