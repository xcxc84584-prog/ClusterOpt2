/** Shared ordering algorithm. Reorder only siblings, never disk files. */
export const ExplorerOrderPolicy = Object.freeze({
  key(node) {
    return node.name + ":" + node.kind;
  },
  ordered(nodes, saved = []) {
    const order = new Map(saved.map((value, index) => [value, index]));
    return [...nodes].sort((a, b) => {
      const left = order.get(this.key(a));
      const right = order.get(this.key(b));
      if (left !== undefined || right !== undefined) {
        if (left === undefined) return 1;
        if (right === undefined) return -1;
        return left - right;
      }
      if (a.kind !== b.kind) {
        return a.kind === "directory" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  },
  move(nodes, sourceId, targetId) {
    const from = nodes.findIndex(node => node.id === sourceId);
    const to = nodes.findIndex(node => node.id === targetId);
    if (from < 0 || to < 0) {
      const error = new RangeError("Reorder requires sibling entries");
      error.status = 400;
      throw error;
    }
    if (from === to) return false;
    const [node] = nodes.splice(from, 1);
    nodes.splice(to, 0, node);
    return true;
  }
});
