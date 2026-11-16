/**
 * Safe Explorer entry names and non-destructive destination checks.
 * Deliberately rejects path separators and OS-reserved components.
 */
export const ExplorerEntryPolicy = Object.freeze({
  validateName(name) {
    if (typeof name !== "string" || !name.trim() ||
        name !== name.trim() || name.length > 255 ||
        /[\\/:*?"<>|\x00-\x1f]/u.test(name) ||
        name === "." || name === ".." || /[. ]$/u.test(name)) {
      const error = new RangeError("Invalid Explorer entry name");
      error.status = 400;
      throw error;
    }
    return name;
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
