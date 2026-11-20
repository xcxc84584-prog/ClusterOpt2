// Independent, untrusted third-party plugin using only the Host SDK.
const providerId = "example.sdk.native-ui";
let presses = 0;

function ui(action, payload, requestId) {
  return Cluster.request("UICO", "uiRequest", {
    protocol: "cluster.ui/1", targetId: "UICO", requestId,
    action, payload: { providerId, ...payload }
  });
}

Cluster.handle("createControls", async () => {
  const created = await ui("UI.Create", {
    kind: "button", parentId: "slot.plugin-toolbar",
    props: { text: "External SDK Button" },
    onActivateAction: "pressed"
  }, "nativeButton1");
  const window = await ui("UI.OpenWindow", {
    kind: "window", parentId: "slot.plugin-window",
    props: { text: "External SDK Settings" }
  }, "nativeWindow1");
  const id = window.data.uiId;
  await ui("UI.AddTab", {
    uiId: id, tabId: "general", title: "General"
  }, "nativeTab1");
  await ui("UI.AddTab", {
    uiId: id, tabId: "advanced", title: "Advanced"
  }, "nativeTab2");
  return { buttonId: created.data.uiId, windowId: id };
});

Cluster.handle("pressed", () => ({ presses: ++presses }));
Cluster.handle("status", () => ({ presses }));
Cluster.handle("probeNativeACL", async () => {
  let denied = false;
  try {
    await ui("UI.Update", {
      uiId: "editor", props: { text: "Not allowed" }
    }, "nativeTamper1");
  } catch (error) {
    denied = error.status === 403 || error.status === 404;
  }
  return { denied };
});
