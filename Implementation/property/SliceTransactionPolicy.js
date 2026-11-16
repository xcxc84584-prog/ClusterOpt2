/**
 * Pure, bounded UTF-16 slice transaction policy. Operations are validated
 * before the owning Object publishes an immutable Piece Tree revision.
 */
export const SliceTransactionPolicy = Object.freeze({
  maxSliceUnits: 1024 * 1024,
  maxOperations: 128,

  checkText(text) {
    if (typeof text !== "string" || text.length > this.maxSliceUnits) {
      const error = new TypeError("Invalid slice text or text exceeds budget");
      error.status = 400;
      throw error;
    }
    return text;
  },

  checkId(id) {
    if (typeof id !== "string" ||
        !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) {
      const error = new TypeError("Invalid slice transaction ID");
      error.status = 400;
      throw error;
    }
    return id;
  },

  checkOperations(operations) {
    if (!Array.isArray(operations) || operations.length < 1 ||
        operations.length > this.maxOperations) {
      const error = new TypeError("Invalid transaction operation count");
      error.status = 400;
      throw error;
    }
    for (const op of operations) {
      if (!op || !["insert", "remove", "replace"].includes(op.type)) {
        const error = new TypeError("Unsupported slice edit operation");
        error.status = 400;
        throw error;
      }
      if (op.type !== "remove") this.checkText(op.text);
    }
    return operations;
  },

  apply(tree, root, operation, nextPriority) {
    const length = tree.length(root);
    const { start, end, text, type } = operation;
    const validStart = Number.isSafeInteger(start) &&
      start >= 0 && start <= length;
    const validEnd = Number.isSafeInteger(end) &&
      end >= start && end <= length;
    if (!validStart || (type !== "insert" && !validEnd)) {
      const error = new RangeError("Slice edit outside current range");
      error.status = 400;
      throw error;
    }
    if (type === "insert") {
      return tree.insert(root, start, text, nextPriority);
    }
    const removed = tree.remove(root, start, end, nextPriority);
    return type === "replace"
      ? tree.insert(removed, start, text, nextPriority)
      : removed;
  }
});
