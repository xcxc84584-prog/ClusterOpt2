/**
 * Safe Explorer entry names and non-destructive destination checks.
 * Deliberately rejects path separators and OS-reserved components.
 */
export const ExplorerEntryPolicy = Object.freeze({
  validateName(name) {
    if (typeof name !== "string" || !name.trim() ||
        name !== name.trim() || name.length > 255 ||
        /[\\/:*?"<>|\x00-\x1f]/u.test(name) ||
        name === "." || name === ".." || /[. ]$/u.test(name) ||
        /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/iu
          .test(name)) {
      const error = new RangeError("Invalid Explorer entry name");
      error.status = 400;
      throw error;
    }
    return name;
  },
  async verifyCopy(source, target) {
    if (source.size !== target.size) return false;
    // Blob slices bound transient memory to two 1 MiB buffers.
    const chunkSize = 1024 * 1024;
    for (let offset = 0; offset < source.size; offset += chunkSize) {
      const end = Math.min(source.size, offset + chunkSize);
      const [left, right] = await Promise.all([
        source.slice(offset, end).arrayBuffer(),
        target.slice(offset, end).arrayBuffer()
      ]);
      const a = new Uint8Array(left);
      const b = new Uint8Array(right);
      for (let index = 0; index < a.length; index++) {
        if (a[index] !== b[index]) return false;
      }
    }
    return true;
  },
  async ensureAbsent(directory, name) {
    for await (const entry of directory.values()) {
      if (entry.name.toLocaleLowerCase() === name.toLocaleLowerCase()) {
        const error = new Error("Destination already exists");
        error.status = 409;
        throw error;
      }
    }
  }
});
