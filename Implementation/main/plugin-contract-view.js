/**
 * Read-only API contract presentation. No HubUnit route or permission changes.
 * Render only descriptor metadata already returned by the catalog/registry.
 */
function node(doc, tag, className = "", content) {
  const result = doc.createElement(tag);
  if (className) result.className = className;
  if (content !== undefined) result.textContent = String(content);
  return result;
}
function field(doc, label, value) {
  const pair = node(doc, "div", "pm-contract-field");
  pair.append(node(doc, "dt", "", label),
    node(doc, "dd", "", value === undefined || value === null ||
      value === "" ? "—" : String(value)));
  return pair;
}
function section(doc, title) {
  const wrapper = node(doc, "section", "pm-contract-section");
  wrapper.append(node(doc, "h3", "", title));
  return wrapper;
}
function schemaRow(doc, label, schema, t, depth = 0) {
  const wrapper = node(doc, "div", "pm-schema-row");
  if (!schema || typeof schema !== "object" || depth > 8) {
    wrapper.textContent = t("未提供結構", "Schema unavailable");
    return wrapper;
  }
  const type = schema.type || "unknown";
  const details = node(doc, "details", "pm-schema-details");
  details.open = depth < 2;
  const summary = node(doc, "summary");
  summary.append(node(doc, "strong", "", label),
    node(doc, "span", "pm-schema-type", type));
  if (schema.required?.length) {
    summary.append(node(doc, "small", "",
      t("必要欄位", "Required") + ": " + schema.required.join(", ")));
  }
  details.append(summary);
  if (type === "object" && schema.properties) {
    const list = node(doc, "div", "pm-schema-children");
    for (const [name, child] of Object.entries(schema.properties)) {
      const childRow = schemaRow(doc, name, child, t, depth + 1);
      if ((schema.required || []).includes(name)) {
        childRow.dataset.required = "true";
      }
      list.append(childRow);
    }
    details.append(list);
  } else if (type === "array" && schema.items) {
    details.append(schemaRow(doc, t("陣列元素", "Array items"),
      schema.items, t, depth + 1));
  }
  if (schema.additionalProperties !== undefined) {
    details.append(node(doc, "p", "pm-muted",
      t("其他欄位", "Additional properties") + ": " +
      String(schema.additionalProperties)));
  }
  wrapper.append(details);
  return wrapper;
}
export function renderContractDetail(doc, host, entry, t, onBack) {
  const descriptor = entry.descriptor;
  const header = node(doc, "div", "pm-contract-actions");
  const back = node(doc, "button", "pm-mini",
    "← " + t("返回 API 清單", "Back to API list"));
  back.type = "button";
  back.addEventListener("click", onBack);
  header.append(back);
  host.append(header);
  host.append(node(doc, "h2", "pm-contract-heading", entry.id));
  const overview = section(doc, t("契約概覽", "Contract overview"));
  const fields = node(doc, "dl", "pm-contract-fields");
  const values = [
    [t("種類", "Kind"), entry.kind],
    ["ID", descriptor.id || descriptor.name || entry.id],
    [t("所屬物件", "Owner"), entry.owner],
    [t("提供者", "Provider"), entry.providerId || "—"],
    [t("動作", "Action"), descriptor.action],
    [t("版本", "Version"), descriptor.version],
    [t("建立版本", "Since"), descriptor.since],
    [t("可見性", "Visibility"), descriptor.visibility],
    [t("副作用", "Side effect"), descriptor.sideEffect],
    [t("所需權限", "Permissions"),
      descriptor.permissions?.join(", ")],
    [t("已棄用", "Deprecated"), descriptor.deprecated === undefined ?
      undefined : String(descriptor.deprecated)],
    [t("型別", "Type"), descriptor.type],
    [t("可讀取", "Readable"), descriptor.readable === undefined ?
      undefined : String(descriptor.readable)],
    [t("可寫入", "Writable"), descriptor.writable === undefined ?
      undefined : String(descriptor.writable)]
  ];
  for (const [label, value] of values) fields.append(field(doc,label,value));
  overview.append(fields);
  overview.append(node(doc,"p","pm-contract-description",
    descriptor.description || t("未提供描述","No description registered")));
  host.append(overview);
  if (entry.kind === "Request" || entry.kind === "Provider" ||
      entry.kind === "Protocol" || entry.kind === "Action") {
    const envelopes=section(doc,t("Request / Response 對稱協議",
      "Symmetric Request / Response protocol"));
    const methods=node(doc,"div","pm-contract-fields");
    const call = entry.kind === "Protocol" ? entry.id + "(...)" :
      entry.kind === "Provider" ?
        "HubUnit.requestService(source, service, action, payload, options)" :
        "HubUnit.request(source, target, action, payload, options)";
    methods.append(field(doc,"Request",call));
    methods.append(field(doc,"Response",
      "{ ok: boolean, status: number, value?: output, error?: string }"));
    methods.append(field(doc,t("輸入 Payload", "Input payload"),
      descriptor.inputSchema ?
        JSON.stringify(descriptor.inputSchema) :
        t("契約未宣告", "Schema not declared")));
    methods.append(field(doc,t("輸出 Value", "Output value"),
      descriptor.outputSchema ?
        JSON.stringify(descriptor.outputSchema) :
        t("契約未宣告", "Schema not declared")));
    envelopes.append(methods);
    envelopes.append(node(doc,"p","pm-muted",t(
      "此處為已註冊契約；HubUnit 仍在每次呼叫時檢查權限，" +
        "失敗結果記錄至 EHU。",
      "These are registered contracts. HubUnit checks authorization " +
        "on each call and records failures in EHU.")));
    host.append(envelopes);
  }
  if (descriptor.inputSchema || descriptor.outputSchema) {
    const schemas=section(doc,t("輸入與輸出結構","Input and output schemas"));
    if (descriptor.inputSchema) schemas.append(schemaRow(doc,
      t("輸入", "Input"),descriptor.inputSchema,t));
    if (descriptor.outputSchema) schemas.append(schemaRow(doc,
      t("輸出", "Output"),descriptor.outputSchema,t));
    host.append(schemas);
  }
  if (descriptor.invariants?.length) {
    const rules=section(doc,t("屬性約束","Property invariants"));
    const list=node(doc,"ul");
    for (const invariant of descriptor.invariants) {
      list.append(node(doc,"li","",invariant));
    }
    rules.append(list);host.append(rules);
  }
  const raw=section(doc,t("原始註冊契約","Registered contract JSON"));
  const pre=node(doc,"pre","pm-contract-json",
    JSON.stringify(descriptor,null,2));
  pre.tabIndex=0;
  raw.append(pre);host.append(raw);
}
