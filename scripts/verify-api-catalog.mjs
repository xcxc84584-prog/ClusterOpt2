/**
 * PR25 source provenance CI gate.
 * Live URU descriptors remain authoritative. A descriptor with explicit
 * sourceLocation is also a static declaration and MUST agree with source.
 * No inferred schema, no second registry, no user-visible test prompts.
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve, relative, isAbsolute } from "node:path";
import { LinkCore } from "../Implementation/LinkCore/LinkCore.js";

const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function auditStaticSources(core, root = process.cwd(),
  readText = path => readFileSync(path, "utf8")) {
  const failures = [];
  let checked = 0;
  for (const [owner, object] of core.uru.objects) {
    for (const descriptor of object.ocda?.APIDescriptors ?? []) {
      const location = descriptor.sourceLocation;
      if (!location) continue;
      checked++;
      const { file, line } = location;
      let code = null;
      let note = "";
      if (typeof file !== "string" || !file ||
          typeof line !== "number" || !Number.isSafeInteger(line) ||
          line < 1 || !VERSION.test(descriptor.version)) {
        code = "CATALOG_SOURCE_LOCATION_INVALID";
      } else {
        const fullPath = resolve(root, file);
        const rel = relative(root, fullPath);
        if (isAbsolute(file) || rel.startsWith("..") ||
            isAbsolute(rel)) {
          code = "CATALOG_SOURCE_LOCATION_INVALID";
        } else {
          try {
            const text = readText(fullPath);
            const sourceLine = text.split(/\r?\n/)[line - 1] ?? "";
            // Checks the literal version on the explicitly pinned line.
            // Do not infer versions from file names or adjacent APIs.
            const escaped = descriptor.version.replace(/\./g, "\\.");
            if (!new RegExp(
              "\\bversion\\s*:\\s*['\\\"]" + escaped + "['\\\"]"
            ).test(sourceLine)) {
              code = "CATALOG_STATIC_VERSION_MISMATCH";
              note = "Version literal missing from pinned source line";
            }
          } catch (_error) {
            code = "CATALOG_SOURCE_UNREADABLE";
          }
        }
      }
      if (code) {
        const issue = {
          code, owner, id: descriptor.id,
          expectedVersion: descriptor.version, file, line, note
        };
        failures.push(issue);
        core.omu.record("EHU", "LinkCore", "Catalog.SourceAudit",
          409, owner, issue);
      }
    }
  }
  // Event documentation is also a static EDPMU declaration.
  // It must refer to an actual Worker event source, not an invented API.
  const lifecycle = core.edpmu.get("PluginLifecycleEventPolicy");
  for (const descriptor of lifecycle?.events ?? []) {
    checked++;
    const { file, line } = descriptor.sourceLocation ?? {};
    const { file: triggerFile, symbol } =
      descriptor.triggerSourceLocation ?? {};
    const source = typeof file === "string" ? resolve(root, file) : "";
    const trigger = typeof triggerFile === "string" ?
      resolve(root, triggerFile) : "";
    let code = null;
    if (!file || !triggerFile || !Number.isSafeInteger(line) ||
        line < 1 || !VERSION.test(descriptor.version) ||
        isAbsolute(file) || isAbsolute(triggerFile) ||
        relative(root, source).startsWith("..") ||
        relative(root, trigger).startsWith("..")) {
      code = "CATALOG_SOURCE_LOCATION_INVALID";
    } else {
      try {
        const row = readText(source).split(/\r?\n/)[line - 1] ?? "";
        const escaped = descriptor.version.replace(/\./g, "\\.");
        if (!new RegExp(
          "\\bversion\\s*:\\s*['\\\"]" + escaped + "['\\\"]"
        ).test(row)) {
          code = "CATALOG_STATIC_VERSION_MISMATCH";
        } else {
          const worker = readText(trigger);
          if (symbol !== "notifySession" ||
              !worker.includes("function notifySession(state)") ||
              !worker.includes('notifySession("ready")') ||
              !worker.includes('notifySession("suspended")')) {
            code = "CATALOG_EVENT_TRIGGER_MISMATCH";
          }
        }
      } catch {
        code = "CATALOG_SOURCE_UNREADABLE";
      }
    }
    if (code) {
      const issue = { code, owner: descriptor.owner,
        id: descriptor.id, expectedVersion: descriptor.version,
        file, line, triggerFile };
      failures.push(issue);
      core.omu.record("EHU", "LinkCore", "Catalog.SourceAudit",
        409, descriptor.owner, issue);
    }
  }
  // Host Protocol declarations are static EDPMU metadata, not
  // executable Worker permissions. Every version shares a pinned
  // source constant to prevent stale copies after a code change.
  for (const descriptor of
    core.edpmu.get("HubProtocolPolicy")?.descriptions ?? []) {
    checked++;
    const { file, line } = descriptor.sourceLocation ?? {};
    let code = null;
    if (!file || !Number.isSafeInteger(line) || line < 1 ||
        !VERSION.test(descriptor.version) || isAbsolute(file) ||
        relative(root, resolve(root, file)).startsWith("..")) {
      code = "CATALOG_SOURCE_LOCATION_INVALID";
    } else {
      try {
        const row = readText(resolve(root, file))
          .split(/\r?\n/)[line - 1] ?? "";
        if (!row.includes(
          'const STATIC_PROTOCOL_VERSION = "' +
            descriptor.version + '";')) {
          code = "CATALOG_STATIC_VERSION_MISMATCH";
        }
      } catch {
        code = "CATALOG_SOURCE_UNREADABLE";
      }
    }
    if (code) {
      const issue = {
        code, owner: "HubUnit", id: descriptor.id,
        expectedVersion: descriptor.version, file, line
      };
      failures.push(issue);
      core.omu.record("EHU", "LinkCore", "Catalog.SourceAudit",
        409, "HubUnit", issue);
    }
  }
  return Object.freeze({
    ok: failures.length === 0,
    status: failures.length ? 409 : 200,
    checked, failures
  });
}

if (process.argv[1] &&
    import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = auditStaticSources(new LinkCore());
  if (!result.ok) {
    process.stderr.write(JSON.stringify(result, null, 2) + "\n");
    process.exitCode = 1;
  } else {
    process.stdout.write("Catalog static provenance PASS: " +
      result.checked + " descriptor(s)\n");
  }
}
