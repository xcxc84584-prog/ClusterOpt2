/** In-memory OMU event log and observed dependency graph. */
export class ObjectManagementUnit {
  constructor(clock = () => Date.now(), limit = 2000) {
    this.clock = clock;
    this.limit = limit;
    this.logs = [];
    this.lastPass = new Map();
    this.dependencies = new Map();
    this.nextEventId = 1;
  }

  record(kind, source, action, status, target = "", details = {}) {
    const now = this.clock();
    const key = [source, action, target, status].join("|");
    // EHU and failures are always recorded. Only ordinary PASS is cooled.
    if (kind === "Log" && status >= 200 && status < 300) {
      const previous = this.lastPass.get(key);
      if (previous !== undefined && now - previous < 1000) return null;
      this.lastPass.set(key, now);
    }
    const item = Object.freeze({
      eventId: this.nextEventId++,
      timestamp: new Date(now).toISOString(),
      kind, source, target, action, status, details
    });
    this.logs.unshift(item);
    if (this.logs.length > this.limit) this.logs.pop();
    return item;
  }

  dependency(source, target, direction) {
    const key = source + "->" + target;
    const current = this.dependencies.get(key) ?? { request: false, response: false };
    current[direction] = true;
    this.dependencies.set(key, current);
  }

  relations() {
    return [...this.dependencies].map(([key, value]) => ({
      link: key,
      // Bit 1 = Request, bit 0 = Response, relative to the source.
      code: String(Number(value.request)) + String(Number(value.response))
    }));
  }

  snapshot() {
    return { logs: [...this.logs], dependencies: this.relations() };
  }
}
