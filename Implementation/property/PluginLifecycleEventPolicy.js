/**
 * Declarative Worker SDK event contracts. This EDPMU Property is the
 * authoritative documentation source for the actual worker callbacks
 * in PluginWorkerSource.js; it is NOT an event execution endpoint.
 */
export const PluginLifecycleEventPolicy = Object.freeze({
  registryVersion: 1,
  events: Object.freeze([
    Object.freeze({
      id: "WorkerSDK.SessionChange",
      owner: "PluginWorker",
      version: "1.0.0",
      category: "Event",
      visibility: "Public",
      audience: "PluginPublic",
      status: "Available",
      sourceLocation: Object.freeze({
        file: "Implementation/property/PluginLifecycleEventPolicy.js",
        line: 12
      }),
      triggerSourceLocation: Object.freeze({
        file: "Implementation/LinkCore/PluginWorkerSource.js",
        symbol: "notifySession"
      }),
      description: "Worker session ready or suspended notification.",
      trigger: Object.freeze([
        "ready: accepted cluster-session-hello handshake",
        "suspended: received cluster-session-suspended from Host"
      ]),
      subscribe: "Cluster.onSessionChange(listener)",
      unsubscribe: "Call the returned unsubscribe function",
      payloadSchema: Object.freeze({
        type: "string", enum: Object.freeze(["ready", "suspended"])
      }),
      ordering: "Callbacks execute in Set insertion order per message; " +
        "no total order across separate RPC chains.",
      lifecycle: "A reload creates a new Worker and a new Session. " +
        "A suspended Session denies reverse requests until resumed.",
      permissions: Object.freeze([]),
      rpcScopes: Object.freeze([]),
      examples: Object.freeze([{
        title: "Subscribe and unsubscribe",
        request: { method: "Cluster.onSessionChange",
          listenerParameter: "ready | suspended" },
        response: { unsubscribe: "function" }
      }])
    }),
    Object.freeze({
      id: "UICO.OwnedClick",
      owner: "UICO",
      version: "1.0.0",
      category: "Event",
      visibility: "Public",
      audience: "PluginPublic",
      status: "Available",
      sourceLocation: Object.freeze({
        file: "Implementation/property/PluginLifecycleEventPolicy.js",
        line: 51
      }),
      triggerSourceLocation: Object.freeze({
        file: "Implementation/object/PluginUIControlAdapter.js",
        symbol: "subscribe"
      }),
      description: "Click on a plugin-owned UI node after UI.Subscribe.",
      trigger: Object.freeze([
        "DOM click listener installed by UI.Subscribe"
      ]),
      subscribe: "UICO.uiRequest: UI.Subscribe",
      unsubscribe: "UICO.uiRequest: UI.Unsubscribe",
      payloadSchema: Object.freeze({
        type: "object", required: Object.freeze(["uiId"]),
        properties: Object.freeze({
          uiId: Object.freeze({ type: "string" })
        })
      }),
      ordering: "Click handlers dispatch in DOM event order; routed " +
        "Request completion is not globally ordered.",
      lifecycle: "Removing the owned UI node or unloading its plugin " +
        "tears down its subscriptions.",
      permissions: Object.freeze(["ui.read"]),
      rpcScopes: Object.freeze([Object.freeze({
        target: "UICO", action: "uiRequest"
      })])
    })
  ])
});
