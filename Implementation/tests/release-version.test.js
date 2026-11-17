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

test("release authority is immutable and EDPMU denies version drift",
  () => {
    const core = new LinkCore();
    assert.throws(() => { core.version = "99.99.99"; }, TypeError);
    const update = core.hub.publishProperty("SystemVersion", "bad");
    assert.equal(update.status, 403);
    assert.equal(core.edpmu.get("SystemVersion"),
      ReleaseVersion.product);
    assert.equal(core.version, ReleaseVersion.product);
    assert.ok(core.getSnapshot().logs.some(event =>
      event.kind === "EHU" && event.action === "Property.SystemVersion" &&
      event.status === 403));
  });
