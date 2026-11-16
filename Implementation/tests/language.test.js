import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { Language } from "../property/Language.js";
import { LanguageManager } from "../object/LanguageManager.js";
import { statusLabel } from "../property/DocumentStatus.js";

function createStorage(saved = null) {
	const entries = new Map();
	if (saved !== null) entries.set(Language.storageKey, saved);
	return {
		getItem: key => entries.get(key) ?? null,
		setItem: (key, value) => entries.set(key, value),
		read: key => entries.get(key) ?? null
	};
}

function setup(saved = null) {
	const core = new LinkCore();
	core.register({ id: "ui", receive: async () => null });
	const storage = createStorage(saved);
	const changes = [];
	const manager = new LanguageManager(core, {
		storage,
		onChange: locale => changes.push(locale)
	});
	return { core, manager, changes, storage };
}

test("default locale is registered once and shared by objects", () => {
	const { core } = setup();
	assert.equal(core.readProperty("ui", "Language").value, "zh-Hant");
	core.register({ id: "Panel", receive: async () => null });
	assert.equal(core.readProperty("Panel", "Language").value, "zh-Hant");
	assert.equal(core.getSnapshot().properties.filter(
		item => item.name === "Language").length, 1);
});

test("user language Request publishes Property and OMU logs", async () => {
	const { core, manager, changes, storage } = setup();
	const result = await core.request("ui", "LanguageManager", "set",
		{ locale: "en" }, { origin: "user" });
	assert.equal(result.status, 200);
	assert.equal(manager.snapshot().locale, "en");
	assert.equal(core.readProperty("ui", "Language").value, "en");
	assert.equal(storage.read(Language.storageKey), "en");
	assert.deepEqual(changes, ["zh-Hant", "en"]);
	assert.ok(core.getSnapshot().logs.some(item =>
		item.status === 200 && item.action === "Property.Language"));
});

test("invalid locale rejects with EHU 400 and no mutation", async () => {
	const { core } = setup();
	const result = await core.request("ui", "LanguageManager", "set",
		{ locale: "de" }, { origin: "user" });
	assert.equal(result.status, 400);
	assert.equal(core.readProperty("ui", "Language").value, "zh-Hant");
	assert.ok(core.getSnapshot().logs.some(item =>
		item.kind === "EHU" && item.status === 400));
});

test("Agent can translate/read but cannot mutate Language", async () => {
	const { core } = setup();
	const denied = await core.request("ui", "LanguageManager", "set",
		{ locale: "en" }, { origin: "agent" });
	assert.equal(denied.status, 403);
	const allowed = await core.request("ui", "LanguageManager", "translate",
		{ key: "file" }, { origin: "agent" });
	assert.equal(allowed.status, 200);
	assert.equal(allowed.value, "檔案");
});

test("saved locale restored and invalid persisted locale fails safe", () => {
	const restored = setup("en");
	assert.equal(restored.manager.snapshot().locale, "en");
	assert.equal(restored.core.readProperty("ui", "Language").value, "en");
	const invalid = setup("xx");
	assert.equal(invalid.manager.snapshot().locale, "zh-Hant");
	assert.ok(invalid.core.getSnapshot().logs.some(item =>
		item.kind === "EHU" && item.action === "Restore"));
});

test("translations are expandable with safe fallback and variables", () => {
	assert.equal(Language.translate("en", "saveFile"), "Save");
	assert.equal(Language.translate("zh-Hant", "saveFile"), "儲存");
	assert.equal(Language.translate("en", "confirmClose", {
		name: "test.txt"
	}), 'The file "test.txt" has unsaved changes. Close it?');
	assert.equal(Language.translate("fr", "saveFile"), "儲存");
	assert.equal(Language.translate("en", "notYetDefined"), "notYetDefined");
	assert.equal(statusLabel("yellow", "en"), "Unsaved changes");
	assert.equal(statusLabel("green", "zh-Hant"), "已與磁碟同步");
});

test("identical language Requests remain valid without excess mutations", async () => {
	const { core, manager, changes } = setup();
	const result = await core.request("ui", "LanguageManager", "set",
		{ locale: "zh-Hant" }, { origin: "user" });
	assert.equal(result.status, 200);
	assert.equal(manager.locale, "zh-Hant");
	assert.deepEqual(changes, ["zh-Hant"]);
});

test("unavailable preference storage preserves in-memory language", async () => {
	const core = new LinkCore();
	core.register({ id: "ui", receive: async () => null });
	const brokenStorage = {
		getItem() { throw new Error("Read blocked"); },
		setItem() { throw new Error("Write blocked"); }
	};
	const manager = new LanguageManager(core, { storage: brokenStorage });
	const result = await core.request("ui", "LanguageManager", "set",
		{ locale: "en" }, { origin: "user" });
	assert.equal(result.status, 200);
	assert.equal(manager.locale, "en");
	assert.ok(core.getSnapshot().logs.some(item =>
		item.kind === "EHU" && item.status === 503));
});
