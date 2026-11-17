/**
 * API Descriptor compatibility is metadata only, never authorization.
 * Stable major versions are compatible; pre-1.0 minors are pinned.
 * An optional "since" field must not describe a future version.
 */
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function parse(value) {
  if (typeof value !== "string" || value.length > 64 ||
      !VERSION.test(value)) return null;
  const numbers = value.split(".").map(Number);
  if (numbers.some(number => !Number.isSafeInteger(number))) return null;
  return Object.freeze(numbers);
}

function compare(a, b) {
  for (let index = 0; index < 3; index++) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  }
  return 0;
}

function compatible(current, required) {
  if (current[0] !== required[0]) return false;
  if (current[0] === 0 && current[1] !== required[1]) {
    return false;
  }
  return compare(current, required) >= 0;
}

export const CatalogVersionPolicy = Object.freeze({
  parse,
  compare(a, b) {
    const left = parse(a);
    const right = parse(b);
    return left && right ? compare(left, right) : null;
  },
  inspect(descriptor, requiredVersion = null) {
    const current = parse(descriptor?.version);
    const since = descriptor?.since === undefined ?
      null : parse(descriptor.since);
    const required = requiredVersion === null ?
      null : parse(requiredVersion);
    if (!current || (descriptor?.since !== undefined && !since) ||
        (requiredVersion !== null && !required)) {
      return Object.freeze({
        ok: false, status: 400, error: "Invalid catalog API version"
      });
    }
    if (since && compare(since, current) > 0) {
      return Object.freeze({
        ok: false, status: 400, error: "API since exceeds version"
      });
    }
    const supported = required === null ||
      (compatible(current, required) &&
       (since === null || compare(required, since) >= 0));
    return Object.freeze({
      ok: true, status: 200,
      value: Object.freeze({
        compatible: supported,
        deprecated: descriptor.deprecated === true,
        version: descriptor.version,
        since: descriptor.since ?? null
      })
    });
  }
});
