import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const vault = require("../plugins/ai-agent-mcp/local-agent/secure-store.cjs");

test("PR21.3 DPAPI persists secret without plaintext", {
  skip: process.platform !== "win32"
}, () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "cluster-dpapi-"));
  try {
    const target = path.join(folder, "token.dpapi");
    const secret = "a".repeat(64);
    vault.protectFile(target, secret);
    const stored = fs.readFileSync(target, "utf8");
    assert.match(stored, /^dpapi-v1:[A-Za-z0-9+/]+=*\n$/);
    assert.equal(stored.includes(secret), false);
    assert.equal(vault.unprotectFile(target), secret);
    vault.protectFile(target, "b".repeat(64));
    assert.equal(vault.unprotectFile(target), "b".repeat(64));
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

test("PR21.3 migration does not retain plaintext after protection", {
  skip: process.platform !== "win32"
}, () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "cluster-migrate-"));
  try {
    const legacy = path.join(folder, "pairing-token");
    const encrypted = legacy + ".dpapi";
    const original = "c".repeat(64);
    fs.writeFileSync(legacy, original + "\n");
    const migrated = vault.loadOrMigrate(encrypted, legacy,
      candidate => /^[a-f0-9]{64}$/.test(candidate),
      () => { throw Error("Should not generate a new token"); });
    assert.equal(migrated, original);
    assert.equal(fs.existsSync(legacy), false);
    assert.equal(vault.unprotectFile(encrypted), original);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
