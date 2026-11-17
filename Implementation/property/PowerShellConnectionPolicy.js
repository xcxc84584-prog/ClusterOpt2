/**
 * PR9 native terminal boundary. Pairing secrets never enter LinkCore,
 * the URL, persistent browser storage, or an OMU log.
 */
export const PowerShellConnectionPolicy = Object.freeze({
  defaultPort: 43881,
  protocol: "clusteropt-terminal-v1",
  maxSessions: 8,

  port(value) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) ||
        number < 1024 || number > 65535) {
      throw new RangeError("Invalid local agent port");
    }
    return number;
  },

  token(value) {
    if (typeof value !== "string" ||
        !/^[a-f0-9]{64}$/iu.test(value.trim())) {
      throw new TypeError("Invalid pairing token");
    }
    return value.trim();
  },

  localAgentOrigin(port) {
    return "http://127.0.0.1:" + this.port(port);
  },

  socketUrl(port) {
    return "ws://127.0.0.1:" + this.port(port) + "/terminal/ws";
  }
});
