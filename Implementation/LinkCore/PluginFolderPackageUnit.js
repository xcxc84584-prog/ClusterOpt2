import { PluginFolderPackagePolicy as Policy } from
  "../property/PluginFolderPackagePolicy.js";

/**
 * Host-only file snapshotter. Reads all eligible files in a selected folder.
 * Snapshot is portable but never executable by mere presence in storage.
 */
const decoder = new TextDecoder("utf-8", { fatal: true });
const encoder = new TextEncoder();

function fail(status, error) {
  return { ok: false, status, error };
}

function toBase64(bytes) {
  let value = "";
  for (let i = 0; i < bytes.length; i += 32768) {
    value += String.fromCharCode(...bytes.subarray(i, i + 32768));
  }
  return btoa(value);
}

function fromBase64(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

export class PluginFolderPackageUnit {
  constructor(omu) {
    this.omu = omu;
  }

  record(status, reason) {
    this.omu?.record(status < 400 ? "Log" : "EHU",
      "PluginFolderPackage", "Plugin.Package.Snapshot", status,
      "local-folder", { reason });
  }

  async snapshot(directory) {
    if (!directory || directory.kind !== "directory" ||
        typeof directory.entries !== "function") {
      this.record(400, "invalid-directory");
      return fail(400, "Directory iteration unavailable");
    }
    const files = Object.create(null);
    let count = 0;
    let total = 0;
    const visit = async (folder, prefix = "", depth = 0) => {
      if (depth > 12) throw Error("Folder depth exceeded");
      for await (const [name, handle] of folder.entries()) {
        const path = prefix + name;
        if (!Policy.validPath(path)) {
          throw Error("Unsafe asset path");
        }
        if (handle.kind === "directory") {
          await visit(handle, path + "/", depth + 1);
          continue;
        }
        if (handle.kind !== "file" || ++count > Policy.maxFiles) {
          throw Error("Asset count exceeded");
        }
        const file = await handle.getFile();
        if (file.size > Policy.maxFileBytes ||
            (total += file.size) > Policy.maxTotalBytes) {
          throw Error("Asset size exceeded");
        }
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (bytes.length !== file.size) {
          throw Error("Asset changed during snapshot");
        }
        files[path] = toBase64(bytes);
      }
    };
    try {
      await visit(directory);
      if (!Object.hasOwn(files, "plugin.json")) {
        throw Error("plugin.json missing");
      }
      const manifestText = decoder.decode(fromBase64(files["plugin.json"]));
      const snapshot = {
        format: "cluster-plugin-folder", formatVersion: 1,
        manifestText, files
      };
      const checked = Policy.inspect(snapshot);
      if (!checked.ok) {
        this.record(checked.status, "invalid-package");
        return checked;
      }
      if (toBase64(encoder.encode(manifestText)) !==
          files["plugin.json"]) {
        throw Error("Manifest encoding mismatch");
      }
      this.record(200, "snapshot-created");
      return { ok: true, status: 200, value: snapshot };
    } catch {
      this.record(400, "snapshot-failed");
      return fail(400, "Cannot safely snapshot selected folder");
    }
  }

  inspectImport(snapshot) {
    const checked = Policy.inspect(snapshot);
    if (!checked.ok) {
      this.record(checked.status, "import-rejected");
      return checked;
    }
    try {
      const actual = decoder.decode(
        fromBase64(snapshot.files["plugin.json"]));
      if (actual !== snapshot.manifestText) {
        throw Error("Manifest differs from assets");
      }
      this.record(200, "import-validated");
      return { ok: true, status: 200, value: snapshot };
    } catch {
      this.record(400, "import-decoding-failed");
      return fail(400, "Invalid imported manifest bytes");
    }
  }
}
