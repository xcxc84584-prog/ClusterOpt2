import { UIProtocolPolicy } from "./UIProtocolPolicy.js";
import { UICOActionContractDescriptors } from
  "./UICOActionContractDescriptors.js";
import { UISP } from "./UISP.js";

/**
 * Side-effect-free PR23.7 Request/Response acceptance fixtures.
 * These guard runtime validator drift; they do not grant permissions or
 * prove browser DOM behaviour, handler execution, or full JSON Schema parity.
 */
const ID = { uiId: "test.panel" };
const FIXTURES = Object.freeze({
  "UI.List": {},
  "UI.Describe": ID,
  "UI.GetState": ID,
  "UI.GetProperty": { ...ID, property: "geometry" },
  "UI.Create": {
    kind: "button", parentId: "slot.plugin-toolbar",
    props: { text: "Fixture" }
  },
  "UI.Update": { ...ID, props: { text: "Fixture" } },
  "UI.Remove": ID,
  "UI.Batch": {
    operations: [{
      action: "UI.Update",
      payload: { ...ID, props: { text: "Fixture" } }
    }]
  },
  "UI.SetVisibility": { ...ID, visible: true },
  "UI.SetFocus": ID,
  "UI.OpenWindow": {
    kind: "window", parentId: "slot.plugin-window", props: {}
  },
  "UI.CloseWindow": ID,
  "UI.AddTab": { ...ID, tabId: "details", title: "Details" },
  "UI.RemoveTab": { ...ID, tabId: "details" },
  "UI.NavigatePluginView": { ...ID, viewId: "details" },
  "UI.Subscribe": { ...ID, subscriptionId: "click" },
  "UI.Unsubscribe": { ...ID, subscriptionId: "click" }
});

function request(action, payload) {
  return {
    protocol: UIProtocolPolicy.protocol,
    requestId: "fixture-1",
    targetId: "UICO",
    action,
    payload
  };
}

export const UICOProtocolFixturePolicy = Object.freeze({
  inspect() {
    const issues = [];
    const declared = Object.keys(UIProtocolPolicy.capabilities).sort();
    const fixtureNames = Object.keys(FIXTURES).sort();
    if (JSON.stringify(declared) !== JSON.stringify(fixtureNames)) {
      issues.push("ACTION_FIXTURE_COVERAGE");
    }
    const descriptors = UICOActionContractDescriptors.build(
      UIProtocolPolicy.capabilities, UISP.version);
    for (const action of declared) {
      const payload = FIXTURES[action];
      if (!payload) {
        issues.push("MISSING_FIXTURE:" + action);
        continue;
      }
      const valid = request(action, payload);
      const contract = descriptors[action];
      if (!contract ||
          contract.capability !== UIProtocolPolicy.capabilities[action] ||
          contract.requestSchema?.properties?.action?.const !== action ||
          !contract.requestSchema?.required?.includes("payload")) {
        issues.push("DESCRIPTOR_MISMATCH:" + action);
      }
      for (const field of contract?.requestSchema?.properties?.payload
        ?.required ?? []) {
        if (!Object.hasOwn(payload, field)) {
          issues.push("REQUIRED_PAYLOAD_MISMATCH:" + action + ":" + field);
        }
      }
      if (!UIProtocolPolicy.validateRequest(valid).ok) {
        issues.push("VALID_REQUEST_REJECTED:" + action);
      }
      if (UIProtocolPolicy.validateRequest({
        ...valid, unexpected: "denied"
      }).ok) {
        issues.push("UNKNOWN_FIELD_ACCEPTED:" + action);
      }
      if (UIProtocolPolicy.validateRequest({
        ...valid, payload: null
      }).ok) {
        issues.push("INVALID_PAYLOAD_ACCEPTED:" + action);
      }
    }
    const success = {
      requestId: "fixture-1", eventId: 1, status: 200,
      ok: true, data: {}
    };
    const denied = {
      requestId: "fixture-1", eventId: 2, status: 403,
      ok: false, error: { code: "DENIED", message: "Denied" }
    };
    if (!UIProtocolPolicy.validateResponse(success).ok ||
        !UIProtocolPolicy.validateResponse(denied).ok) {
      issues.push("VALID_RESPONSE_REJECTED");
    }
    if (UIProtocolPolicy.validateResponse({
      ...success, status: 403
    }).ok || UIProtocolPolicy.validateResponse({
      ...denied, error: { message: "Missing code" }
    }).ok || UIProtocolPolicy.validateResponse({
      ...success, eventId: -1
    }).ok) {
      issues.push("INVALID_RESPONSE_ACCEPTED");
    }
    return Object.freeze({
      ok: issues.length === 0,
      testedActions: declared.length,
      issues: Object.freeze(issues)
    });
  }
});
