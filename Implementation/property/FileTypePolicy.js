/** Reused ClusterOpt extension filter. Never deletes disk files. */
const DEFAULTS = Object.freeze([
  ".mp4", ".m4v", ".mov", ".avi", ".mkv", ".webm",
  ".mp3", ".wav", ".flac", ".ogg", ".jpg", ".jpeg", ".png",
  ".gif", ".webp", ".bmp", ".ico", ".svg", ".pdf", ".zip",
  ".7z", ".rar", ".tar", ".gz", ".exe", ".dll", ".bin", ".iso"
]);

export const FileTypePolicy = Object.freeze({
  defaults: DEFAULTS,
  storageKey: "clusteropt2.file-types.v1",
  normalize(input) {
    const text = String(input ?? "").trim().toLowerCase();
    const ext = text.startsWith(".") ? text : "." + text;
    if (!/^\.[a-z0-9][a-z0-9_-]{0,19}$/.test(ext)) {
      const error = new TypeError("Invalid file extension");
      error.status = 400;
      throw error;
    }
    return ext;
  },
  sanitize(items) {
    if (!Array.isArray(items) || items.length > 100) {
      const error = new RangeError("Invalid file type list");
      error.status = 400;
      throw error;
    }
    return [...new Set(items.map(item => this.normalize(item)))].sort();
  },
  blocked(filename, extensions) {
    const value = String(filename ?? "").toLowerCase();
    return extensions.some(ext => value.endsWith(ext));
  }
});
