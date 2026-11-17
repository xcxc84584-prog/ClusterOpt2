import { PluginPackageManifestPolicy } from
  "./PluginPackageManifestPolicy.js";

/**
 * PR13.2/13.8: portable whole-folder package bounds and path rules.
 * File bytes are inert data: this policy never executes imported code.
 */
const MAX_FILES = 128;
const MAX_FILE_BYTES = 2097152;
const MAX_TOTAL_BYTES = 16777216;
const MAX_PATH = 256;
const NAME = /^[A-Za-z0-9_][A-Za-z0-9_. -]*$/;
const BLOCKED = new Set([
  ".git", "node_modules", "__proto__", "constructor", "prototype"
]);

function fail(status, error) {
  return Object.freeze({ ok: false, status, error });
}

function validPath(path) {
  if (typeof path !== "string" || !path ||
      path.length > MAX_PATH || path.includes("\\") ||
      path.includes(":") || path.startsWith("/")) return false;
  return path.split("/").every(part =>
    NAME.test(part) && !part.startsWith(".") &&
    part !== "." && part !== ".." && !BLOCKED.has(part));
}

function plain(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export const PluginFolderPackagePolicy = Object.freeze({
  maxFiles: MAX_FILES,
  maxFileBytes: MAX_FILE_BYTES,
  maxTotalBytes: MAX_TOTAL_BYTES,
  validPath,

  inspect(snapshot) {
    if (!plain(snapshot) || snapshot.format !== "cluster-plugin-folder" ||
        snapshot.formatVersion !== 1 || !plain(snapshot.files) ||
        typeof snapshot.manifestText !== "string") {
      return fail(400, "Invalid folder package");
    }
    const parsed = PluginPackageManifestPolicy.validate(
      snapshot.manifestText);
    if (!parsed.ok) return parsed;
    const paths = Object.keys(snapshot.files);
    if (!paths.length || paths.length > MAX_FILES ||
        !paths.includes("plugin.json") ||
        !paths.includes(parsed.value.entry) ||
        (parsed.value.uiEntry !== undefined &&
         !paths.includes(parsed.value.uiEntry)) ||
        paths.some(path => !validPath(path))) {
      return fail(400, "Invalid package file inventory");
    }
    let total = 0;
    for (const path of paths) {
      const encoded = snapshot.files[path];
      if (typeof encoded !== "string" ||
          encoded.length > Math.ceil(MAX_FILE_BYTES / 3) * 4 + 4 ||
          !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
            .test(encoded)) {
        return fail(400, "Invalid asset encoding");
      }
      const padding = encoded.endsWith("==") ? 2 :
        encoded.endsWith("=") ? 1 : 0;
      const bytes = encoded.length / 4 * 3 - padding;
      if (bytes > MAX_FILE_BYTES) return fail(413, "Asset too large");
      total += bytes;
      if (total > MAX_TOTAL_BYTES) return fail(413, "Package too large");
    }
    // Byte-to-text equality is checked by the package reader on import.
    return Object.freeze({
      ok: true, status: 200,
      value: Object.freeze({
        manifest: parsed.value, fileCount: paths.length,
        totalBytes: total
      })
    });
  }
});
