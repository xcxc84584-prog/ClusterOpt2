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
  return { ok: failures.length === 0, failures };
}

export function objectPath(parent, child) {
  if (!parent || !child || /\s/.test(parent + child)) {
    throw new TypeError("Invalid object path");
  }
  return parent + "." + child;
}
