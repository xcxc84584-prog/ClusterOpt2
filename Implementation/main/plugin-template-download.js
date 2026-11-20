/**
 * PR13 plugin author template. This produces an editable multi-file ZIP.
 * The ZIP is a development scaffold, not a trusted executable plugin.
 */
const encoder = new TextEncoder();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function write16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function write32(view, offset, value) {
  view.setUint32(offset, value, true);
}

/**
 * Bounded ZIP file with STORE entries and UTF-8 names.
 * Neither generated files nor archive payload are evaluated.
 */
export function createTemplateZip(files) {
  const entries = Object.entries(files).map(([name, text]) => {
    if (name.length > 256 || name.startsWith("/") ||
        name.split("/").some(part => !part ||
          part === "." || part === "..") ||
        typeof text !== "string") {
      throw new TypeError("Unsafe template entry");
    }
    return { name: encoder.encode(name),
      data: encoder.encode(text) };
  });
  if (!entries.length || entries.length > 48 ||
      entries.some(item => item.name.length > 65535 ||
        item.data.length > 64 * 1024 * 1024) ||
      entries.reduce((total, item) => total + item.data.length,
        0) > 68 * 1024 * 1024) {
    throw new RangeError("Template exceeds ZIP budget");
  }
  const locals = [];
  const central = [];
  let cursor = 0;
  for (const item of entries) {
    const checksum = crc32(item.data);
    const local = new Uint8Array(30 + item.name.length +
      item.data.length);
    const head = new DataView(local.buffer);
    write32(head, 0, 0x04034b50);
    write16(head, 4, 20);
    write16(head, 6, 0x0800);
    write16(head, 8, 0);
    write32(head, 14, checksum);
    write32(head, 18, item.data.length);
    write32(head, 22, item.data.length);
    write16(head, 26, item.name.length);
    local.set(item.name, 30);
    local.set(item.data, 30 + item.name.length);
    locals.push(local);

    const record = new Uint8Array(46 + item.name.length);
    const view = new DataView(record.buffer);
    write32(view, 0, 0x02014b50);
    write16(view, 4, 20);
    write16(view, 6, 20);
    write16(view, 8, 0x0800);
    write16(view, 10, 0);
    write32(view, 16, checksum);
    write32(view, 20, item.data.length);
    write32(view, 24, item.data.length);
    write16(view, 28, item.name.length);
    write32(view, 42, cursor);
    record.set(item.name, 46);
    central.push(record);
    cursor += local.length;
  }
  const centralSize = central.reduce((sum, item) =>
    sum + item.length, 0);
  const trailer = new Uint8Array(22);
  const end = new DataView(trailer.buffer);
  write32(end, 0, 0x06054b50);
  write16(end, 8, entries.length);
  write16(end, 10, entries.length);
  write32(end, 12, centralSize);
  write32(end, 16, cursor);
  const output = new Uint8Array(cursor + centralSize + 22);
  let at = 0;
  for (const item of [...locals, ...central, trailer]) {
    output.set(item, at);
    at += item.length;
  }
  return output;
}

export function pluginTemplateFiles(locale = "zh-Hant",
  catalogJSON = null, sdkTypes = null) {
  const english = locale === "en";
  const manifest = {
    packageVersion: 1,
    name: english ? "My HubUnit Plugin" : "我的 HubUnit 插件",
    description: english ?
      "Editable OCDA plugin example" : "可編輯的 OCDA 插件範例",
    entry: "src/worker.js",
    uiEntry: "index.html",
    provider: {
      manifestVersion: 1,
      providerId: "example.my-plugin",
      objectId: "Example.MyPlugin",
      provides: [{
        service: "example.text.transform",
        action: "transform",
        version: "1.0.0",
        inputSchema: {
          type: "object",
          properties: { text: { type: "string" } },
          required: ["text"],
          additionalProperties: false
        },
        outputSchema: {
          type: "object",
          properties: { result: { type: "string" } },
          required: ["result"],
          additionalProperties: false
        }
      }],
      requires: [],
      permissions: [],
      execution: { isolation: "worker", concurrency: "serial" }
    },
    rpcScopes: []
  };
  const readme = english ? [
    "# HubUnit Plugin Development Template",
    "",
    "1. Read the included API-CATALOG.json and docs/API-REFERENCE.md.",
    "2. Read each Request input and Response output contract.",
    "3. Declare services and actions in plugin.json (Provider Contract).",
    "4. Keep all file paths relative to this folder.",
    "5. Implement plugin behavior inside src/worker.js.",
    "6. Customize index.html, src/ui.js and styles/main.css.",
    "7. Use the Resources tab to validate the extracted folder.",
    "",
    "This ZIP uses the current validated Worker SDK and Manifest.",
    "Approved Workers register actions via Cluster.handle(action, fn).",
    "Do not use direct Host imports or parent DOM access.",
    "UI HTML and Worker RPC execute in isolated contexts.",
    "No direct access to the host DOM, filesystem or internal Cluster APIs.",
    "Do not assume a Manifest declaration grants a permission."
  ] : [
    "# HubUnit 插件製作範本",
    "",
    "1. 先閱讀 ZIP 內的 API-CATALOG.json 與 docs/API-REFERENCE.md。",
    "2. 詳讀每個 Request 輸入與 Response 輸出的契約。",
    "3. 在 plugin.json 宣告 Service／Action 與 Provider Contract。",
    "4. 所有資源路徑都必須是插件資料夾內的相對路徑。",
    "5. 在 src/worker.js 實作插件邏輯。",
    "6. 可自由編輯 index.html、src/ui.js、styles/main.css。",
    "7. 解壓後到資源頁選擇資料夾執行驗證。",
    "",
    "此 ZIP 使用目前正式驗證的 Worker SDK 與 Manifest 格式。",
    "核准後透過 Cluster.handle(action, fn) 註冊 Action。",
    "Worker 不可直接匯入 Host 內部程式或父頁 DOM。",
    "HTML UI 和 Worker RPC 均於隔離環境執行。",
    "插件不得直接存取主頁 DOM、檔案系統或 Cluster 內部實例。",
    "Manifest 宣告權限不代表已獲准使用。"
  ];
  // Worker handlers are registered via the public Cluster SDK.
  // Host injects Cluster after explicit package approval.
  const worker = [
    "// No direct access to LinkCore or the parent page.",
    "Cluster.onSessionChange(state => {",
    "  if (state === \"suspended\") {",
    "    // Stop scheduling Host requests during suspension.",
    "  }",
    "});",
    "",
    "Cluster.handle(\"transform\", payload => {",
    "  const text = typeof payload?.text === \"string\" ?",
    "    payload.text : \"\";",
    "  return { result: text.toUpperCase() };",
    "});",
    ""
  ].join("\n");
  const html = `<!doctype html>
<html lang="${english ? "en" : "zh-Hant"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>My HubUnit Plugin</title>
  <link rel="stylesheet" href="./styles/main.css">
</head>
<body>
  <main><h1>My HubUnit Plugin</h1>
    <input id="message" value="Hello">
    <button id="preview" type="button">Preview</button>
    <output id="output"></output>
  </main>
  <script type="module" src="./src/ui.js"></script>
</body>
</html>
`;
  const ui = `// Self-contained sandbox UI. Never reference parent.Cluster.
const input = document.getElementById("message");
const output = document.getElementById("output");
document.getElementById("preview").addEventListener("click", () => {
  output.textContent = input.value.toUpperCase();
});
`;
  const apiGuide = [
    "# ClusterOpt2 API Reference",
    "",
    "The API-CATALOG.json in this ZIP is a full authorized snapshot.",
    "Categories: api / service / property / event / protocol.",
    "Only registered URU/EDPMU descriptors are included.",
    "Do not infer missing schemas or treat metadata as permission.",
    "HostInternal routes are not external Worker capabilities.",
    "PluginPublic still requires live Hub ACL, consent and Session.",
    "Read inputSchema and outputSchema before every call.",
    "Worker SDK: Cluster.ready, request, service, handle,",
    "onSessionChange and RPCError; see types/cluster-plugin-sdk.d.ts.",
    "API data is source-filtered: never forward the catalog as a grant.",
    "Redownload when the live snapshotRevision changes.",
    ""
  ].join("\n");
  const manifestGuide = [
    "# plugin.json Manifest v1 (Host-validated schema)",
    "",
    "Required: packageVersion=1, name, entry, provider.",
    "Optional: description, uiEntry, rpcScopes.",
    "Provider requires manifestVersion=1, providerId, objectId,",
    "provides, requires, permissions, execution.",
    "Each provides entry has service, action, version (semver),",
    "inputSchema and outputSchema. Match the Worker handler name.",
    "execution.isolation must be worker.",
    "execution.concurrency: serial | per-slice | parallel.",
    "rpcScopes: exact {target, action} entries. A property key is",
    "allowed only with target=HubUnit, action=Property.Read.",
    "All resource paths must be relative to this plugin folder.",
    "Never embed credentials or keys. No Manifest grants permission.",
    ""
  ].join("\n");
  const runtimeGuide = [
    "# Installation, Authorization and Events",
    "",
    "Unzip; select the folder under Plugin Manager > Resources.",
    "The Host snapshots files, validates the Manifest, and requests",
    "explicit permission and rpcScopes approval before Worker start.",
    "Use Cluster.handle(action, handler) for declared Provider Actions.",
    "Use Cluster.request(target, action, payload) for reverse RPC.",
    "Subscribe using Cluster.onSessionChange(listener).",
    "Session states: ready and suspended. Call its unsubscribe handle.",
    "Do not access the parent DOM, filesystem, or Host internals.",
    "400: schema invalid; 403: forbidden; 404: missing action;",
    "409: stale revision; 503: Session not available.",
    "Do not retry a non-idempotent write automatically.",
    "The HTML UI runs separately from the Worker RPC context.",
    ""
  ].join("\n");
  const catalog = catalogJSON ?? JSON.stringify({
    schemaVersion: 1, status: "NOT_EMBEDDED",
    note: "Download this ZIP from ClusterOpt2 Resources for live data"
  }, null, 2) + "\n";
  const sdk = sdkTypes ??
    "// Download from ClusterOpt2 Resources to embed live SDK types\n";
  return Object.freeze({
    "plugin.json": JSON.stringify(manifest, null, 2) + "\n",
    "README.md": readme.join("\n") + "\n",
    "API-CATALOG.json": catalog,
    "docs/API-REFERENCE.md": apiGuide,
    "docs/MANIFEST.md": manifestGuide,
    "docs/SECURITY-EVENTS.md": runtimeGuide,
    "types/cluster-plugin-sdk.d.ts": sdk,
    "index.html": html,
    "src/worker.js": worker,
    "src/ui.js": ui,
    "styles/main.css": `body { font: 16px system-ui; margin: 24px; }
main { display: grid; gap: 12px; max-width: 400px; }
button { cursor: pointer; padding: 8px; }
`
  });
}

export async function downloadPluginTemplate(
  doc, locale = "zh-Hant", core) {
  if (!core || typeof core.exportLiveCatalog !== "function") {
    throw Error("Authorized API catalog is required");
  }
  const [catalog, sdkResponse] = await Promise.all([
    core.exportLiveCatalog("ui", "user"),
    doc.defaultView.fetch(
      new URL("../sdk/cluster-plugin-sdk.d.ts", import.meta.url),
      { cache: "no-store" })
  ]);
  if (!catalog.ok || !sdkResponse.ok) {
    throw Error("Live API or SDK reference unavailable");
  }
  const sdk = await sdkResponse.text();
  if (!sdk.includes("declare namespace ClusterSDK")) {
    throw Error("Incomplete SDK definition");
  }
  const zip = createTemplateZip(pluginTemplateFiles(
    locale, catalog.value.json, sdk));
  const blob = new doc.defaultView.Blob([zip],
    { type: "application/zip" });
  const url = doc.defaultView.URL.createObjectURL(blob);
  const link = doc.createElement("a");
  link.download = locale === "en" ?
    "ClusterOpt2-Plugin-Template-EN.zip" :
    "ClusterOpt2-Plugin-Template-ZH.zip";
  link.href = url;
  doc.body.append(link);
  try { link.click(); } finally {
    link.remove();
    doc.defaultView.setTimeout(() =>
      doc.defaultView.URL.revokeObjectURL(url), 1000);
  }
}
