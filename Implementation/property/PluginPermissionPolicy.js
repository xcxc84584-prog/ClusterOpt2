/**
 * PR06.01–02: data-only capability declaration and explicit grants.
 * Manifest permissions express intent, never runtime authority.
 * Privileged grants require an explicit host approval; Core is reserved.
 */
const LEVELS = Object.freeze({
  "document.slice.read": "privileged",
  "editor.decoration.publish": "standard",
  "route.inspect": "standard",
  "route.configure": "core",
  "storage.write": "core",
  "network.request": "privileged",
  "local-agent.pair": "privileged",
  "model.configure": "privileged",
  "model.task": "privileged"
});
const ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;

export const PluginPermissionPolicy = Object.freeze({
  levels: LEVELS,
  inspect(permissions) {
    if (!Array.isArray(permissions) || permissions.length > 32 ||
        new Set(permissions).size !== permissions.length ||
        !permissions.every(name =>
          typeof name === "string" && name.length <= 64 &&
          ID.test(name) && Object.hasOwn(LEVELS, name))) {
      return { ok: false, status: 400,
        error: "Invalid plugin permission declaration" };
    }
    return { ok: true, status: 200,
      value: Object.freeze([...permissions]) };
  },
  level(name) { return LEVELS[name] ?? null; },
  authorize(name, approved = false) {
    if (!Object.hasOwn(LEVELS, name)) {
      return { ok: false, status: 400 };
    }
    if (LEVELS[name] === "core") {
      return { ok: false, status: 403 };
    }
    if (LEVELS[name] === "privileged" && approved !== true) {
      return { ok: false, status: 403 };
    }
    return { ok: true, status: 200 };
  }
});
