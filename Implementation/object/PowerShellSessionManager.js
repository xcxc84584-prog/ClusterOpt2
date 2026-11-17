/**
 * OCDA session lifecycle only. Actual OS commands require the separately
 * installed local agent and its authenticated native ConPTY endpoint.
 * Never accept or log pairing tokens or executable command strings.
 */
export class PowerShellSessionManager {
  constructor(core) {
    this.id = "powershell-session-manager";
    this.core = core;
    this.sessions = [];
    this.activeId = null;
    this.nextId = 1;
    this.strictOCDA = true;
    this.authorization = Object.freeze({ default: "Public" });
    const actions = ["create", "select", "close", "list", "closeAll"];
    this.ocda = Object.freeze({
      Request: actions, Response: actions, UserAPI: actions,
      AgentAPI: [], Property: ["PowerShellConnectionPolicy"],
      Program: "PowerShellSessionManager",
      EHU: "LinkCore.OMU", Log: "LinkCore.OMU"
    });
    if (!core.register(this)) throw new Error("PSM registration failed");
  }

  fail(message, status) {
    const error = new Error(message);
    error.status = status;
    throw error;
  }

  snapshot() {
    return {
      activeId: this.activeId,
      sessions: this.sessions.map(session => ({ ...session }))
    };
  }

  async receive(action, payload = {}) {
    const policy = this.core.readProperty(
      this.id, "PowerShellConnectionPolicy").value;
    if (action === "list") return this.snapshot();
    if (action === "create") {
      if (this.sessions.length >= policy.maxSessions) {
        return this.fail("Too many terminal sessions", 429);
      }
      const id = this.nextId++;
      this.sessions.push({ id, title: "PowerShell " + id });
      this.activeId = id;
      return this.snapshot();
    }
    if (action === "select" || action === "close") {
      if (!Number.isSafeInteger(payload.id) ||
          !this.sessions.some(item => item.id === payload.id)) {
        return this.fail("Unknown session", 404);
      }
      if (action === "select") {
        this.activeId = payload.id;
      } else {
        this.sessions = this.sessions.filter(
          item => item.id !== payload.id);
        if (this.activeId === payload.id) {
          this.activeId = this.sessions.at(-1)?.id ?? null;
        }
      }
      return this.snapshot();
    }
    if (action === "closeAll") {
      this.sessions = [];
      this.activeId = null;
      return this.snapshot();
    }
    return this.fail("Unknown PowerShell action", 400);
  }
}
