/**
 * PR13 HubUnit core Req/Rep metadata, not a new execution endpoint.
 * These describe public method envelopes and immutable parameter names.
 * Per-Object action payloads still come from their own Provider Contract.
 */
const req = {
  type: "object",
  properties: {
    source: { type: "string" },
    target: { type: "string" },
    action: { type: "string" },
    payload: { type: "any" },
    options: { type: "object" }
  },
  required: ["source", "target", "action"]
};
const rep = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    status: { type: "integer" },
    value: { type: "any" },
    error: { type: "string" }
  },
  required: ["ok", "status"]
};

const DEFINITIONS = [
  {
    id: "HubUnit.request",
    action: "request",
    description: "OCDA Object-to-Object request and response envelope.",
    inputSchema: req,
    outputSchema: rep
  },
  {
    id: "HubUnit.requestService",
    action: "requestService",
    description: "Resolve a Service Provider and route a declared Action.",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string" },
        service: { type: "string" },
        action: { type: "string" },
        payload: { type: "any" },
        options: { type: "object" }
      },
      required: ["source", "service", "action"]
    },
    outputSchema: rep
  },
  {
    id: "HubUnit.readProperty",
    action: "readProperty",
    description: "Read a registered Property subject to HubUnit ACL.",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string" },
        name: { type: "string" }
      },
      required: ["source", "name"]
    },
    outputSchema: rep
  },
  {
    id: "HubUnit.discoverCatalog",
    action: "discoverCatalog",
    description: "Authorized, paginated API and Property metadata.",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string" },
        command: { type: "string" },
        kind: { type: "string" },
        selector: { type: "object" },
        options: { type: "object" }
      },
      required: ["source", "command", "kind"]
    },
    outputSchema: rep
  },
  {
    id: "HubUnit.listActionContracts",
    action: "listActionContracts",
    description: "List explicitly exposed Object UserAPI/AgentAPI actions.",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string" },
        options: { type: "object" }
      },
      required: ["source"]
    },
    outputSchema: rep
  },
  {
    id: "HubUnit.listProviderContracts",
    action: "listProviderContracts",
    description: "Read live URU Provider service input/output contracts.",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string" },
        options: { type: "object" }
      },
      required: ["source"]
    },
    outputSchema: rep
  }
];

function frozen(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(frozen));
  if (value && typeof value === "object") {
    return Object.freeze(Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, frozen(item)])));
  }
  return value;
}

export const HubProtocolPolicy = Object.freeze({
  version: 1,
  descriptions: frozen(DEFINITIONS)
});
