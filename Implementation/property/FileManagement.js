/**
 * Shared metadata projection for File and Explorer objects.
 * No filesystem access, DOM access or mutable global state.
 */
export const FileManagement = Object.freeze({
  normalizeQuery(query = "") {
    return String(query).trim().toLocaleLowerCase();
  },
  summarize(documents) {
    return documents.map(document => ({
      id: document.id,
      name: document.name,
      status: document.status,
      hasHandle: Boolean(document.handle)
    }));
  },
  filter(entries, query = "") {
    const needle = this.normalizeQuery(query);
    return entries.filter(entry =>
      entry.name.toLocaleLowerCase().includes(needle));
  }
});
