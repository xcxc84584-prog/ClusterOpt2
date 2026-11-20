/**
 * PR23.8 — host-only plugin view asset policy.
 * Assets originate from the installed and approved PluginUIHostUnit
 * snapshot. Untrusted HTML is rendered only inside an opaque-origin
 * sandbox iframe with restrictive CSP; never inserted in host DOM.
 */
export const PluginUIViewCSP =
  "default-src 'none'; script-src 'unsafe-inline'; " +
  "style-src 'unsafe-inline'; img-src data:; connect-src 'none'; " +
  "font-src 'none'; worker-src 'none'; frame-src 'none'; " +
  "object-src 'none'; form-action 'none'; base-uri 'none'";

const VIEW = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const MAX_HTML = 262144;

export const PluginUIViewPolicy = Object.freeze({
  read(snapshot, viewId) {
    if (!snapshot || typeof snapshot.manifestText !== "string" ||
        !snapshot.files || typeof snapshot.files !== "object" ||
        !VIEW.test(viewId)) {
      return Object.freeze({ ok: false, status: 400 });
    }
    let manifest;
    try { manifest = JSON.parse(snapshot.manifestText); }
    catch { return Object.freeze({ ok: false, status: 400 }); }
    const entry = viewId === "index" && typeof manifest.uiEntry === "string" ?
      manifest.uiEntry : "views/" + viewId + ".html";
    if (!/^(?:views\/)?[A-Za-z][A-Za-z0-9_-]{0,63}\.html$/.test(entry) ||
        !Object.hasOwn(snapshot.files, entry)) {
      return Object.freeze({ ok: false, status: 404 });
    }
    const encoded = snapshot.files[entry];
    if (typeof encoded !== "string" || encoded.length > MAX_HTML * 2) {
      return Object.freeze({ ok: false, status: 400 });
    }
    try {
      const binary = atob(encoded);
      if (binary.length > MAX_HTML) {
        return Object.freeze({ ok: false, status: 413 });
      }
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      const html = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return Object.freeze({
        ok: true, status: 200, entry,
        srcdoc: '<meta http-equiv="Content-Security-Policy" content="' +
          PluginUIViewCSP + '">' + html
      });
    } catch {
      return Object.freeze({ ok: false, status: 400 });
    }
  }
});
