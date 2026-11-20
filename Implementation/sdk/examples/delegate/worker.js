// Requests route through Host Session, HubUnit and URU, never DOM.
const sessionEvents = [];
Cluster.onSessionChange(state => sessionEvents.push(state));
Cluster.handle("delegate", async payload => {
  await Cluster.ready;
  const echoed = await Cluster.service(
    "SDK.ExampleEcho", "echo", { message: payload.message });
  let denied = null;
  try {
    await Cluster.request("UICO", "describe", {});
  } catch (error) {
    denied = { code: error.code, status: error.status };
  }
  return { echoed, denied, hasReady: sessionEvents.includes("ready") };
});
