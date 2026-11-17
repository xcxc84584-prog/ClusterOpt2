/**
 * PR04.08 route ownership and static dependency preflight.
 * This policy does not mint caller identity or change AccessPolicy.
 */
export const RouteControlPolicy = Object.freeze({
  scoped(source, routes, registry) {
    if (!registry.objects.has(source)) {
      return { ok: false, status: 404,
        error: "Route owner not registered" };
    }
    for (const route of routes) {
      if (route.sourceFilter.objects.length !== 1 ||
          route.sourceFilter.objects[0] !== source) {
        return { ok: false, status: 403,
          error: "Route scope exceeds owner" };
      }
      for (const id of [
        ...route.providers,
        ...(route.responsePipeline ?? []).map(item => item.providerId)
      ]) {
        const owner = registry.getProvider(id);
        if (!owner || !registry.objects.has(owner.objectId)) {
          return { ok: false, status: 404,
            error: "Provider unavailable" };
        }
        if (owner.objectId !== source) {
          return { ok: false, status: 403,
            error: "Provider ownership mismatch" };
        }
      }
    }
    return { ok: true, status: 200 };
  },

  cycles(routes, registry) {
    const edges = new Map();
    function link(left, right) {
      if (left === right) return;
      if (!edges.has(left)) edges.set(left, new Set());
      edges.get(left).add(right);
    }
    for (const route of routes) {
      const primary = route.providers.map(id =>
        registry.getProvider(id)?.objectId);
      const follow = (route.responsePipeline ?? []).map(item =>
        registry.getProvider(item.providerId)?.objectId);
      if (primary.some(id => !id) || follow.some(id => !id)) {
        return { ok: false, status: 404,
          error: "Dependency Provider missing" };
      }
      if (route.mode === "chain") {
        for (let i = 1; i < primary.length; i++) {
          link(primary[i - 1], primary[i]);
        }
      }
      const outputOwners = route.mode === "fanout" ?
        primary : [primary[primary.length - 1]];
      if (follow.length) {
        for (const owner of outputOwners) link(owner, follow[0]);
        for (let i = 1; i < follow.length; i++) {
          link(follow[i - 1], follow[i]);
        }
      }
    }
    const active = new Set();
    const finished = new Set();
    function visit(node) {
      if (active.has(node)) return true;
      if (finished.has(node)) return false;
      active.add(node);
      for (const next of edges.get(node) ?? []) {
        if (visit(next)) return true;
      }
      active.delete(node);
      finished.add(node);
      return false;
    }
    for (const node of edges.keys()) {
      if (visit(node)) return { ok: false, status: 409,
        error: "Route dependency cycle" };
    }
    return { ok: true, status: 200 };
  }
});
