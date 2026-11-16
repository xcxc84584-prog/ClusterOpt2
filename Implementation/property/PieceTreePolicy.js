/**
 * Immutable piece treap for incremental text edits.
 * Positions count UTF-16 code units, matching textarea selection offsets.
 * No document-wide flattening is required for edits or point lookup.
 */
export const PieceTreePolicy = Object.freeze({
  length(node) { return node?.length ?? 0; },
  node(text, priority, left = null, right = null) {
    if (!text) throw new TypeError("Empty text piece");
    return Object.freeze({
      text, priority, left, right,
      length: text.length + this.length(left) + this.length(right)
    });
  },
  merge(a, b) {
    if (!a) return b;
    if (!b) return a;
    if (a.priority <= b.priority) {
      return this.node(a.text, a.priority, a.left,
        this.merge(a.right, b));
    }
    return this.node(b.text, b.priority, this.merge(a, b.left),
      b.right);
  },
  split(root, offset, nextPriority) {
    if (!Number.isSafeInteger(offset) || offset < 0 ||
        offset > this.length(root)) {
      throw new RangeError("Offset outside piece tree");
    }
    if (!root) return [null, null];
    const leftSize = this.length(root.left);
    if (offset < leftSize) {
      const [a, b] = this.split(root.left, offset, nextPriority);
      return [a, this.node(root.text, root.priority, b, root.right)];
    }
    if (offset > leftSize + root.text.length) {
      const [a, b] = this.split(root.right,
        offset - leftSize - root.text.length, nextPriority);
      return [this.node(root.text, root.priority, root.left, a), b];
    }
    const within = offset - leftSize;
    if (within === 0) {
      return [root.left,
        this.node(root.text, root.priority, null, root.right)];
    }
    if (within === root.text.length) {
      return [this.node(root.text, root.priority, root.left), root.right];
    }
    const a = this.node(root.text.slice(0, within),
      root.priority, root.left);
    const b = this.node(root.text.slice(within),
      root.priority, null, root.right);
    return [a, b];
  },
  insert(root, offset, text, nextPriority) {
    if (typeof text !== "string") throw new TypeError("Invalid text");
    const [a, b] = this.split(root, offset, nextPriority);
    return text ? this.merge(this.merge(a,
      this.node(text, nextPriority())), b) : this.merge(a, b);
  },
  remove(root, start, end, nextPriority) {
    if (!Number.isSafeInteger(end) || end < start ||
        end > this.length(root)) {
      throw new RangeError("Invalid deletion range");
    }
    const [a, remaining] = this.split(root, start, nextPriority);
    const [, b] = this.split(remaining, end - start, nextPriority);
    return this.merge(a, b);
  },
  locate(root, offset) {
    if (!Number.isSafeInteger(offset) || offset < 0 ||
        offset >= this.length(root)) {
      throw new RangeError("Offset outside text");
    }
    let node = root;
    let start = 0;
    while (node) {
      const boundary = start + this.length(node.left);
      if (offset < boundary) {
        node = node.left;
      } else if (offset < boundary + node.text.length) {
        return { start: boundary, offset: offset - boundary,
          text: node.text };
      } else {
        start = boundary + node.text.length;
        node = node.right;
      }
    }
    throw new Error("Corrupt piece tree");
  },
  *pieces(root) {
    if (!root) return;
    yield* this.pieces(root.left);
    yield root.text;
    yield* this.pieces(root.right);
  },
  read(root, start, end) {
    if (!Number.isSafeInteger(start) || start < 0 ||
        !Number.isSafeInteger(end) || end < start ||
        end > this.length(root)) {
      throw new RangeError("Invalid read range");
    }
    const output = [];
    let cursor = 0;
    for (const text of this.pieces(root)) {
      const finish = cursor + text.length;
      if (finish > start && cursor < end) {
        output.push(text.slice(Math.max(0, start - cursor),
          Math.min(text.length, end - cursor)));
      }
      cursor = finish;
      if (cursor >= end) break;
    }
    return output.join("");
  }
});
