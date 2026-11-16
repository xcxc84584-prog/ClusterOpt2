/** OCDA owner of global blocked extensions. Updates route via HubUnit. */
export class FileTypeManager {
  constructor(core, storage = globalThis.localStorage) {
    this.id = "file-types";
    this.core = core;
    this.storage = storage;
    this.strictOCDA = true;
    this.authorization = Object.freeze({ default: "Public" });
    const actions = ["list", "add", "remove", "reset"];
    this.ocda = Object.freeze({
      Request: actions, Response: actions, UserAPI: actions,
      AgentAPI: [], Property: ["FileTypePolicy", "BlockedFileTypes"],
      Program: "FileTypeManager", EHU: "LinkCore.OMU",
      Log: "LinkCore.OMU"
    });
    if (!core.register(this)) throw new Error("FileTypeManager registration");
    const policy = this.policy();
    try {
      const stored = storage?.getItem(policy.storageKey);
      if (stored !== null && stored !== undefined) {
        this.publish(policy.sanitize(JSON.parse(stored)));
      }
    } catch (error) {
      core.omu.record("EHU", this.id, "FileTypes.Restore",
        400, policy.storageKey, { error: String(error) });
    }
  }

  policy() {
    return this.core.readProperty(this.id, "FileTypePolicy").value;
  }

  current() {
    return this.core.readProperty(this.id, "BlockedFileTypes").value;
  }

  publish(items) {
    const result = this.core.hub.publishProperty("BlockedFileTypes", items);
    if (!result.ok) throw new Error("BlockedFileTypes update failed");
    try {
      this.storage?.setItem(this.policy().storageKey,
        JSON.stringify(items));
    } catch (error) {
      this.core.omu.record("EHU", this.id, "FileTypes.Persist",
        503, "localStorage", { error: String(error) });
    }
    return items;
  }

  async receive(action, payload = {}) {
    const policy = this.policy();
    if (action === "list") return this.current();
    if (action === "reset") return this.publish([...policy.defaults]);
    if (action === "add") {
      return this.publish(policy.sanitize([
        ...this.current(), policy.normalize(payload.extension)
      ]));
    }
    if (action === "remove") {
      const extension = policy.normalize(payload.extension);
      return this.publish(this.current().filter(item => item !== extension));
    }
    const error = new Error("Unknown file type action");
    error.status = 400;
    throw error;
  }
}
