import test from "node:test";
import assert from "node:assert/strict";
import { createLocalAgent } from "../local-agent/server.mjs";

test("PR9 local agent denies origin spoofing and invalid tokens", async () => {
  const token = "a".repeat(64);
  const origin = "https://xcxc84584-prog.github.io";
  const { server } = createLocalAgent({
    token, origins: new Set([origin])
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const endpoint = "http://127.0.0.1:" + server.address().port;
  const request = (headers = {}) => fetch(endpoint + "/status", {
    method: "POST",
    headers: { Origin: origin, Authorization: "Bearer " + token,
      "Content-Type": "application/json", ...headers },
    body: "{}"
  });
  try {
    const allowed = await request();
    assert.equal(allowed.status, 200);
    const payload = await allowed.json();
    assert.equal(payload.connected, true);
    assert.equal(payload.version,
      process.env.CLUSTEROPT_AGENT_VERSION || "unknown");
    assert.equal((await request({
      Origin: "https://malicious.example"
    })).status, 403);
    assert.equal((await request({
      Authorization: "Bearer wrong"
    })).status, 401);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
