import { readFileSync, writeFileSync } from "node:fs";
import { ReleaseVersion } from "../Implementation/property/ReleaseVersion.js";

/**
 * ReleaseVersion.js is canonical. package.json is a generated mirror.
 * --check is mandatory in CI; --write is used only at a major release.
 */
const path = new URL("../package.json", import.meta.url);
const before = readFileSync(path, "utf8");
const pkg = JSON.parse(before);
if (pkg.version === ReleaseVersion.product) {
  console.log("Release version parity PASS:", ReleaseVersion.product);
} else if (process.argv.includes("--write")) {
  pkg.version = ReleaseVersion.product;
  writeFileSync(path, JSON.stringify(pkg, null, 2) + "\n");
  console.log("Distribution version synchronized:", ReleaseVersion.product);
} else {
  throw Error("ReleaseVersion/product and package.json mismatch");
}
