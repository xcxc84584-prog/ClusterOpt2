import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ReleaseVersion } from "../property/ReleaseVersion.js";
import { LinkCore } from "../LinkCore/LinkCore.js";

test("only ReleaseVersion governs runtime and distribution metadata", () => {
  const pkg = JSON.parse(readFileSync(new URL("../../package.json",
    import.meta.url), "utf8"));
  assert.equal(pkg.version, ReleaseVersion.product,
    "Update package mirror in the same release commit");
  assert.equal(new LinkCore().version, ReleaseVersion.product);
  assert.equal(new LinkCore().edpmu.get("SystemVersion"),
    ReleaseVersion.product);
  assert.equal(ReleaseVersion.channel, "development");
  assert.equal(Object.isFrozen(ReleaseVersion), true);
});
