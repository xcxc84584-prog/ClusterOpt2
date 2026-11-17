/**
 * Trusted application-shipped Worker only.
 * Fixed, data-only operations; no eval, user module or dynamic import.
 * This Worker inherits the application origin and is not a sandbox for
 * untrusted third-party JavaScript.
 */
const MAX_BYTES = 65536;
const encoder = new TextEncoder();
self.onmessage = event => {
  const request = event.data;
  if (!request || request.kind !== "invoke" ||
      !Number.isSafeInteger(request.id) || request.id < 1) return;
  let response;
  try {
    const data = request.payload;
    if (request.operation === "echo" &&
        data !== null && typeof data === "object" &&
        !Array.isArray(data)) {
      response = { id: request.id, ok: true, value: data };
    } else if (request.operation === "lineCount" &&
        data && typeof data.text === "string" &&
        Object.keys(data).length === 1) {
      response = { id: request.id, ok: true,
        value: { lines: data.text.length ?
          data.text.split("\n").length : 0 } };
    } else {
      response = { id: request.id, ok: false, status: 400 };
    }
    if (encoder.encode(JSON.stringify(response)).byteLength > MAX_BYTES) {
      response = { id: request.id, ok: false, status: 413 };
    }
  } catch {
    response = { id: request.id, ok: false, status: 500 };
  }
  self.postMessage(response);
};
