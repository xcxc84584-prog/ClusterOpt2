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
  if (!entries.length || entries.length > 32 ||
      entries.some(item => item.name.length > 65535 ||
        item.data.length > 1048576)) {
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

export function pluginTemplateFiles(locale = "zh-Hant") {
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
    }
  };
  const readme = english ? [
    "# HubUnit Plugin Development Template",
    "",
    "1. Open ClusterOpt2 > Plugin Manager > API List FIRST.",
    "2. Read each Request input and Response output contract.",
    "3. Declare services and actions in plugin.json (Provider Contract).",
    "4. Keep all file paths relative to this folder.",
    "5. Implement plugin behavior inside src/worker.js.",
    "6. Customize index.html, src/ui.js and styles/main.css.",
    "7. Use the Resources tab to validate the extracted folder.",
    "",
    "IMPORTANT: The current PR13 build stores untrusted folders as data.",
    "Automatic execution awaits sandbox, RPC and HubUnit ACL approval.",
    "No direct access to the host DOM, filesystem or internal Cluster APIs.",
    "Do not assume a Manifest declaration grants a permission."
  ] : [
    "# HubUnit 插件製作範本",
    "",
    "1. 請先開啟 ClusterOpt2 > 插件管理 > API 列表。",
    "2. 詳讀每個 Request 輸入與 Response 輸出的契約。",
    "3. 在 plugin.json 宣告 Service／Action 與 Provider Contract。",
    "4. 所有資源路徑都必須是插件資料夾內的相對路徑。",
    "5. 在 src/worker.js 實作插件邏輯。",
    "6. 可自由編輯 index.html、src/ui.js、styles/main.css。",
    "7. 解壓後到資源頁選擇資料夾執行驗證。",
    "",
    "重要：目前 PR13 僅將自製插件儲存為資料。",
    "執行仍需通過隔離環境、RPC、HubUnit ACL 授權驗收。",
    "插件不得直接存取主頁 DOM、檔案系統或 Cluster 內部實例。",
    "Manifest 宣告權限不代表已獲准使用。"
  ];
  const worker = english ? `// Worker service logic, loaded only in an approved sandbox.
// See Plugin Manager > API List for the input/output contract.
export function transform(payload) {
  const text = typeof payload?.text === "string" ? payload.text : "";
  return { result: text.toUpperCase() };
}
// The future PR13 RPC bridge will dispatch declared actions here.
` : `// 插件服務邏輯，只能在通過審核的隔離環境啟動。
// 呼叫前請查看「插件管理 > API 列表」的輸入／輸出契約。
export function transform(payload) {
  const text = typeof payload?.text === "string" ? payload.text : "";
  return { result: text.toUpperCase() };
}
// 後續 PR13 RPC Bridge 將負責派送已宣告的 Action。
`;
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
  return Object.freeze({
    "plugin.json": JSON.stringify(manifest, null, 2) + "\n",
    "README.md": readme.join("\n") + "\n",
    "index.html": html,
    "src/worker.js": worker,
    "src/ui.js": ui,
    "styles/main.css": `body { font: 16px system-ui; margin: 24px; }
main { display: grid; gap: 12px; max-width: 400px; }
button { cursor: pointer; padding: 8px; }
`
  });
}

export function downloadPluginTemplate(doc, locale = "zh-Hant") {
  const zip = createTemplateZip(pluginTemplateFiles(locale));
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
