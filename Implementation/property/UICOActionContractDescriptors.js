/**
 * PR23.7 static, versioned metadata for current UIProtocolPolicy validators.
 * Metadata describes accepted envelope and required payload fields.
 * Runtime enforcement remains in UIProtocolPolicy; this is NOT an ACL.
 */
const id = { type: "string", pattern: "^[A-Za-z][A-Za-z0-9._-]{0,127}$" };
const object = { type: "object" };
const boolean = { type: "boolean" };
const string = { type: "string" };
const schema = (required = [], properties = {}, extra = true) =>
	({ type: "object", required, properties, additionalProperties: extra });
const uiId = schema(["uiId"], { uiId: id });
const payload = Object.freeze({
	"UI.List": schema(),
	"UI.Describe": uiId,
	"UI.GetState": uiId,
	"UI.GetProperty": schema(["uiId", "property"], {
		uiId: id, property: id
	}),
	"UI.Create": schema(["kind", "parentId", "props"], {
		kind: { enum: ["button", "window", "tab", "menu-item", "panel"] },
		parentId: id, props: object, onActivateAction: id
	}),
	"UI.Update": schema(["uiId", "props"], { uiId: id, props: object }),
	"UI.Remove": uiId,
	"UI.Batch": schema(["operations"], {
		operations: { type: "array", minItems: 1, maxItems: 50,
			items: { type: "object", required: ["action", "payload"],
				properties: {
					action: { enum: ["UI.Create", "UI.Update", "UI.Remove"] },
					payload: object
				}, additionalProperties: true } }
	}),
	"UI.SetVisibility": schema(["uiId", "visible"], {
		uiId: id, visible: boolean
	}),
	"UI.SetFocus": uiId,
	"UI.OpenWindow": schema(["kind", "parentId", "props"], {
		kind: { enum: ["button", "window", "tab", "menu-item", "panel"] },
		parentId: id, props: object, onActivateAction: id
	}),
	"UI.CloseWindow": uiId,
	"UI.AddTab": schema(["uiId", "tabId", "title"], {
		uiId: id, tabId: id, title: string
	}),
	"UI.RemoveTab": schema(["uiId", "tabId"], {
		uiId: id, tabId: id
	}),
	"UI.NavigatePluginView": schema(["uiId", "viewId"], {
		uiId: id, viewId: id
	}),
	"UI.Subscribe": schema(["uiId", "subscriptionId"], {
		uiId: id, subscriptionId: id
	}),
	"UI.Unsubscribe": schema(["uiId", "subscriptionId"], {
		uiId: id, subscriptionId: id
	})
});
const response = schema(["requestId", "eventId", "status", "ok"], {
	requestId: id,
	eventId: { type: "integer", minimum: 0 },
	status: { type: "integer", minimum: 100, maximum: 599 },
	ok: boolean,
	revision: { type: "integer", minimum: 0 },
	data: {},
	error: schema(["code", "message"], {
		code: id, message: { type: "string", maxLength: 512 },
		details: {}
	}, false)
}, false);
const requestFor = (action, payloadSchema) =>
	schema(["protocol", "requestId", "targetId", "action", "payload"], {
		protocol: { const: "cluster.ui/1" },
		requestId: id,
		targetId: { const: "UICO" },
		action: { const: action },
		payload: payloadSchema,
		expectedRevision: { type: "integer", minimum: 0 },
		deadlineMs: { type: "integer", minimum: 1, maximum: 30000 }
	}, false);

export const UICOActionContractDescriptors = Object.freeze({
	build(capabilities, uispVersion) {
		const actions = Object.create(null);
		for (const [action, capability] of Object.entries(capabilities)) {
			if (!Object.hasOwn(payload, action)) {
				throw new Error("Missing PR23 contract descriptor: " + action);
			}
			actions[action] = {
				capability,
				requestSchema: requestFor(action, payload[action]),
				responseSchema: response
			};
		}
		actions["UISP.version"] = {
			capability: "property.read",
			requestSchema: schema(),
			responseSchema: { type: "string", const: String(uispVersion) }
		};
		return actions;
	}
});
