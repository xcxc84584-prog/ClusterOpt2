/**
 * OCDA object interface.
 * Properties are managed by EDPMU; transport by HubUnit; logging by OMU.
 * Private program code remains encapsulated inside each implementation.
 */
export function validateObjectContract(object) {
  const failures = [];
  if (typeof object?.id !== "string" || !object.id) {
    failures.push("id");
  }
  if (typeof object?.receive !== "function") failures.push("Response");
  if (object?.parentPath !== undefined &&
      typeof object.parentPath !== "string") {
    failures.push("parentPath");
  }
  return { ok: failures.length === 0, failures };
}

export function objectPath(parent, child) {
  if (!parent || !child || /\s/.test(parent + child)) {
    throw new TypeError("Invalid object path");
  }
  return parent + "." + child;
}
