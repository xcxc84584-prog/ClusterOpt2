import { PluginPackageManifestPolicy } from
  "../property/PluginPackageManifestPolicy.js";

/**
 * PR13.2: read only files explicitly selected by the user.
 * No registration, script evaluation, Worker creation or permission grant.
 */
const MAX_ENTRY_BYTES = 1048576;

function fail(status, error) {
  return { ok: false, status, error };
}

async function readBounded(handle, maxBytes) {
  const file = await handle.getFile();
  if (file.size > maxBytes) return fail(413, "File exceeds limit");
  const content = await file.text();
  if (new TextEncoder().encode(content).byteLength > maxBytes) {
    return fail(413, "Decoded file exceeds limit");
  }
  return { ok: true, status: 200, value: content };
}

export class PluginLocalPackageUnit {
  constructor(omu) {
    this.omu = omu;
  }

  record(status, reason) {
    this.omu?.record(status < 400 ? "Log" : "EHU",
      "PluginLocalPackage", "Plugin.Package.Stage", status,
      "local-package", { reason });
  }

  async stageDirectory(directory) {
    try {
      if (!directory || directory.kind !== "directory" ||
          typeof directory.getFileHandle !== "function" ||
          typeof directory.getDirectoryHandle !== "function") {
        this.record(400, "invalid-selection");
        return fail(400, "Expected selected directory");
      }
      const manifestHandle = await directory.getFileHandle("plugin.json");
      const raw = await readBounded(manifestHandle,
        PluginPackageManifestPolicy.maxBytes);
      if (!raw.ok) {
        this.record(raw.status, "manifest-size");
        return raw;
      }
      const parsed = PluginPackageManifestPolicy.validate(raw.value);
      if (!parsed.ok) {
        this.record(parsed.status, "manifest-contract");
        return parsed;
      }
      const parts = parsed.value.entry.split("/");
      let current = directory;
      for (const part of parts.slice(0, -1)) {
        current = await current.getDirectoryHandle(part);
      }
      const entryHandle = await current.getFileHandle(parts.at(-1));
      const entry = await readBounded(entryHandle, MAX_ENTRY_BYTES);
      if (!entry.ok) {
        this.record(entry.status, "entry-size");
        return entry;
      }
      // This is a detached, pending installation. Code is never executed.
      this.record(200, "staged");
      return { ok: true, status: 200, value: Object.freeze({
        manifest: parsed.value,
        source: entry.value,
        state: "staged"
      }) };
    } catch {
      this.record(400, "unreadable-package");
      return fail(400, "Selected package files unavailable");
    }
  }

  async selectAndStage() {
    if (typeof globalThis.showDirectoryPicker !== "function") {
      this.record(503, "picker-unavailable");
      return fail(503, "Directory picker unavailable");
    }
    try {
      // Must be invoked synchronously in a user-gesture event handler.
      const directory = await globalThis.showDirectoryPicker({
        mode: "read"
      });
      return this.stageDirectory(directory);
    } catch (error) {
      const cancelled = error?.name === "AbortError";
      this.record(cancelled ? 400 : 503,
        cancelled ? "selection-cancelled" : "selection-error");
      return fail(cancelled ? 400 : 503,
        cancelled ? "Selection cancelled" : "Directory selection failed");
    }
  }
}
