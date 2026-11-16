/**
 * Shared workbench tool-tab rules. Tools are not document files,
 * do not enter the FileWorkspace document/recovery collection, and
 * may only be inserted among visible document tabs.
 */
export const ToolTabPolicy = Object.freeze({
  pluginId: "tool.plugin-manager",
  validIndex(index, length) {
    if (!Number.isSafeInteger(length) || length < 0 ||
        !Number.isSafeInteger(index) || index < 0 || index > length) {
      const error = new RangeError("Invalid tool tab position");
      error.status = 400;
      throw error;
    }
    return index;
  },
  entries(documents, state) {
    const entries = documents.map(doc => ({
      id: doc.id, kind: "document", name: doc.name
    }));
    if (state.open) {
      const index = Math.min(state.position, entries.length);
      entries.splice(index, 0, {
        id: this.pluginId, kind: "tool"
      });
    }
    return entries;
  }
});
