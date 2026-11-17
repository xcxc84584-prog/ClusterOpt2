import { RouteTablePolicy } from "../property/RouteTablePolicy.js";

/**
 * PR05.01–03: bounded host-only candidate transactions.
 * HubUnit remains the sole executor, validator and Route Table writer.
 * Candidate identity is runtime-local, never persisted or public.
 */
export class RouteTransactionUnit {
  constructor(hub) {
    this.hub = hub;
    this.pending = new Map();
    this.serial = 0;
  }

  begin(candidate) {
    if (this.pending.size >= 16) {
      return this.record("Begin", 429);
    }
    const parsed = RouteTablePolicy.validate(candidate);
    if (!parsed.ok) return this.record("Begin", parsed.status);
    const id = "route-tx-" + (++this.serial);
    this.pending.set(id, {
      generation: this.hub.routeGeneration,
      table: parsed.value,
      validated: false
    });
    this.record("Begin", 201);
    return { ok: true, status: 201, value: Object.freeze({
      transactionId: id, generation: this.hub.routeGeneration
    }) };
  }

  validate(id) {
    const candidate = this.pending.get(id);
    if (!candidate) return this.record("Validate", 404);
    if (candidate.generation !== this.hub.routeGeneration) {
      return this.record("Validate", 409);
    }
    const check = this.hub.configureServiceRoutes(
      candidate.table, false, {
        expectedGeneration: candidate.generation, dryRun: true
      });
    candidate.validated = check.ok;
    if (!check.ok) return this.record("Validate", check.status);
    this.record("Validate", 200);
    return { ok: true, status: 200, value: Object.freeze({
      transactionId: id, generation: candidate.generation
    }) };
  }

  commit(id) {
    const candidate = this.pending.get(id);
    if (!candidate) return this.record("Commit", 404);
    if (candidate.generation !== this.hub.routeGeneration) {
      this.pending.delete(id);
      return this.record("Commit", 409);
    }
    if (!candidate.validated) return this.record("Commit", 412);
    // Always validate again: registry/Provider health can change.
    const result = this.hub.configureServiceRoutes(
      candidate.table, false, {
        expectedGeneration: candidate.generation
      });
    this.pending.delete(id);
    this.record("Commit", result.status);
    return result;
  }

  abort(id) {
    if (!this.pending.delete(id)) return this.record("Abort", 404);
    return this.record("Abort", 200);
  }

  record(action, status) {
    this.hub.omu.record(status >= 400 ? "EHU" : "Log",
      "LinkCore", "Service.Route.Transaction." + action, status);
    return { ok: status < 400, status };
  }
}
