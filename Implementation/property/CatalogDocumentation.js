/**
 * PR02.08 deterministic documentation from authorized catalog metadata.
 * Do not accept raw URU/EDPMU snapshots or execute plugin handlers.
 * The caller supplies only a trusted HubUnit discovery function.
 */
const MAX_BYTES = 65536;
const PAGE_SIZE = 100;
const MAX_ITEMS = 4096;
const encoder = new TextEncoder();

function failure(status, error) {
  return Object.freeze({ ok: false, status, error });
}

function safeMarkdown(value) {
  // Escape markdown control characters, HTML delimiters and newlines
  // so a descriptor cannot inject headings, links or HTML into docs.
  return String(value ?? "").replace(/\\/g, "\\\\")
    .replace(/([\\`*_{}\[\]()#+.!|>~-])/g, "\\$1")
    .replace(/</g, "&lt;").replace(/&(?!(?:lt;))/g, "&amp;")
    .replace(/[\r\n\t]/g, " ");
}

function linesFor(kind, item) {
  const d = item.descriptor;
  if (kind === "api") {
    return [
      "### " + safeMarkdown(d.id),
      "- Owner: " + safeMarkdown(item.owner),
      "- Action: " + safeMarkdown(d.action),
      "- Version: " + safeMarkdown(d.version),
      "- Visibility: " + safeMarkdown(d.visibility),
      "- Side effect: " + safeMarkdown(d.sideEffect),
      "- Deprecated: " + String(d.deprecated === true),
      ...(d.since ? ["- Since: " + safeMarkdown(d.since)] : []),
      ...(d.description ?
        ["- Description: " + safeMarkdown(d.description)] : []),
      ""
    ];
  }
  return [
    "### " + safeMarkdown(item.name),
    "- Owners: " + d.owners.map(safeMarkdown).join(", "),
    "- Type: " + safeMarkdown(d.type),
    "- Visibility: " + safeMarkdown(d.visibility),
    "- Readable: " + String(d.readable === true),
    "- Writable: " + String(d.writable === true),
    ...(d.description ?
      ["- Description: " + safeMarkdown(d.description)] : []),
    ""
  ];
}

function collectKind(discover, source, kind, origin) {
  const items = [];
  for (let offset = 0; offset <= MAX_ITEMS; offset += PAGE_SIZE) {
    const page = discover(source, "list", kind,
      { offset, limit: PAGE_SIZE }, { origin });
    if (!page?.ok) return page ?? failure(500, "Discovery unavailable");
    if (!Array.isArray(page.value?.items) ||
        !Number.isSafeInteger(page.value.total)) {
      return failure(500, "Invalid discovery response");
    }
    items.push(...page.value.items);
    if (items.length > MAX_ITEMS) {
      return failure(413, "Documentation entry limit");
    }
    if (page.value.nextOffset === null) {
      return { ok: true, status: 200, value: items };
    }
    if (page.value.nextOffset !== offset + PAGE_SIZE) {
      return failure(409, "Catalog changed during pagination");
    }
  }
  return failure(413, "Documentation entry limit");
}

export const CatalogDocumentation = Object.freeze({
  maxBytes: MAX_BYTES,
  /**
   * Return an in-memory document, never write it or inject into DOM.
   * "discover" must be a trusted HubUnit-bound function; this
   * renderer is not an externally published API or permission gate.
   */
  render(discover, source, format, options = {}) {
    if (typeof discover !== "function" ||
        !["json", "markdown"].includes(format) ||
        !["user", "agent"].includes(options?.origin ?? "user")) {
      return failure(400, "Invalid documentation request");
    }
    const origin = options.origin ?? "user";
    const apis = collectKind(discover, source, "api", origin);
    if (!apis.ok) return apis;
    const properties = collectKind(discover, source, "property", origin);
    if (!properties.ok) return properties;

    const document = {
      schemaVersion: 1, apis: apis.value, properties: properties.value
    };
    const output = format === "json" ?
      JSON.stringify(document, null, 2) :
      [
        "# ClusterOpt2 API Catalog",
        "",
        "## APIs",
        "",
        ...apis.value.flatMap(item => linesFor("api", item)),
        "## Properties",
        "",
        ...properties.value.flatMap(item => linesFor("property", item))
      ].join("\n");
    if (encoder.encode(output).byteLength > MAX_BYTES) {
      return failure(413, "Documentation exceeds 64 KiB");
    }
    return Object.freeze({
      ok: true, status: 200,
      value: Object.freeze({ format, content: output })
    });
  }
});
