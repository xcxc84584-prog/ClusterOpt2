/**
 * Single product-release authority. This value changes only at a
 * verified major-PR release gate, never for a draft child PR.
 * package.json is a checked distribution mirror, not an authority.
 */
export const ReleaseVersion = Object.freeze({
  product: "0.0.12",
  channel: "stable",
  nextRelease: "0.0.13",
  /** Read-only metadata: no route or permission is implied. */
  get version() { return this.product; }
});
