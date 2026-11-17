import { readFileSync, writeFileSync } from "node:fs";
import { ReleaseVersion } from "../Implementation/property/ReleaseVersion.js";

/**
 * ReleaseVersion.js is canonical. Distribution package manifests are
 * generated mirrors checked on every CI run and written at releases.
 */
const mirrors = [
  new URL("../package.json", import.meta.url),
  new URL("../Implementation/local-agent/package.json", import.meta.url)
];

for (const path of mirrors) {
  const before = readFileSync(path, "utf8");
  const pkg = JSON.parse(before);
  if (pkg.version === ReleaseVersion.product) {
    console.log("Release parity PASS:", pkg.name,
      ReleaseVersion.product);
  } else if (process.argv.includes("--write")) {
    pkg.version = ReleaseVersion.product;
    writeFileSync(path, JSON.stringify(pkg, null, 2) + "\n");
    console.log("Distribution version synced:", pkg.name,
      ReleaseVersion.product);
  } else {
    throw Error("Version mismatch: " + pkg.name);
  }
}
