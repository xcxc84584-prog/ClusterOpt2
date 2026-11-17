import { PowerShellConnectionPolicy as policy } from
  "../property/PowerShellConnectionPolicy.js";

/**
 * UI adapter for an already installed ClusterOpt native local agent.
 * The terminal is authentic ConPTY via xterm; no simulated web shell or
 * generic HTTP command execution is offered.
 */
export function mountNativePowerShell({ core, button, host, translate }) {
  const content = document.createElement("section");
  content.id = "nativePowerShellPane";
  content.className = "native-ps-pane";
  content.hidden = true;
  content.innerHTML = `
    <div class="native-ps-header">
      <strong>PowerShell</strong>
      <div id="nativePsTabs" class="native-ps-tabs"></div>
      <button id="nativePsNew" type="button">＋</button>
      <button id="nativePsHide" type="button">×</button>
    </div>
    <div id="nativePsConnect" class="native-ps-connect">
      <label for="nativePsPort">Local Agent port</label>
      <input id="nativePsPort" type="number" min="1024"
        max="65535" value="43881">
      <label for="nativePsToken">Pairing token</label>
      <input id="nativePsToken" type="password" autocomplete="off"
        spellcheck="false">
      <button id="nativePsPair" type="button">Connect</button>
      <p id="nativePsNotice" role="status" aria-live="polite"></p>
    </div>
    <div id="nativePsTerminal" class="native-ps-terminal"></div>`;
  host.append(content);

  const select = name => content.querySelector("#" + name);
  const tabs = select("nativePsTabs");
  const terminalHost = select("nativePsTerminal");
  const notice = select("nativePsNotice");
  const records = new Map();
  let state = { sessions: [], activeId: null };
  let pairedToken = "";
  let port = policy.defaultPort;
  let visible = false;
  let xtermPromise = null;

  const logFailure = (action, error) => {
    // Never log token, input bytes or terminal output to OMU.
    core.omu.record("EHU", "powershell-ui", action, 503,
      "powershell-session-manager", {
        error: error?.name ?? "TerminalUnavailable"
      });
    notice.textContent = translate("powerShellUnavailable");
  };

  function show() {
    visible = true;
    content.hidden = false;
    button.setAttribute("aria-pressed", "true");
    if (!state.sessions.length) void dispatch("create");
    paint();
  }

  function hide() {
    visible = false;
    content.hidden = true;
    button.setAttribute("aria-pressed", "false");
  }

  async function loadXterm() {
    if (window.Terminal) return window.Terminal;
    if (!xtermPromise) {
      xtermPromise = new Promise((resolve, reject) => {
        const stylesheet = document.createElement("link");
        stylesheet.rel = "stylesheet";
        stylesheet.href =
          "https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css";
        document.head.append(stylesheet);
        const script = document.createElement("script");
        script.src =
          "https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js";
        script.onload = () => resolve(window.Terminal);
        script.onerror = () => reject(new Error("xterm unavailable"));
        document.head.append(script);
      }).catch(error => {
        xtermPromise = null;
        throw error;
      });
    }
    return xtermPromise;
  }

  function dispose(id) {
    const session = records.get(id);
    if (!session) return;
    session.socket?.close();
    session.term?.dispose();
    session.element.remove();
    records.delete(id);
  }

  async function connect(session) {
    if (!pairedToken || session.socket) return;
    try {
      const Terminal = await loadXterm();
      if (!records.has(session.id)) return;
      const styles = getComputedStyle(document.documentElement);
      const color = (name, fallback) =>
        styles.getPropertyValue(name).trim() || fallback;
      const term = new Terminal({
        cursorBlink: true,
        fontFamily: "Consolas, monospace",
        fontSize: 13,
        scrollback: 10000,
        theme: {
          background: color("--ui-editor", "#101318"),
          foreground: color("--ui-text", "#f1f2f5")
        }
      });
      session.term = term;
      term.open(session.element);
      const socket = new WebSocket(policy.socketUrl(port),
        policy.protocol);
      session.socket = socket;
      socket.addEventListener("open", () => {
        socket.send(JSON.stringify({
          type: "auth", token: pairedToken
        }));
      });
      socket.addEventListener("message", event => {
        let message;
        try { message = JSON.parse(event.data); } catch { return; }
        if (message.type === "data") term.write(message.data);
        if (message.type === "error") {
          term.writeln("\r\n" + translate("powerShellUnavailable"));
        }
        if (message.type === "ready") resize(session);
      });
      socket.addEventListener("close", () => {
        if (session.socket === socket) session.socket = null;
      });
      term.onData(data => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "input", data }));
        }
      });
      if (state.activeId === session.id) term.focus();
    } catch (error) { logFailure("Terminal.Connect", error); }
  }

  function resize(session) {
    if (session.socket?.readyState !== WebSocket.OPEN ||
        !session.term || session.element.hidden) return;
    const width = session.element.clientWidth;
    const height = session.element.clientHeight;
    const cols = Math.max(20, Math.min(500, Math.floor(width / 8)));
    const rows = Math.max(8, Math.min(200, Math.floor(height / 17)));
    session.term.resize(cols, rows);
    session.socket.send(JSON.stringify({ type: "resize", cols, rows }));
  }

  function paint() {
    content.hidden = !visible;
    tabs.replaceChildren();
    for (const item of state.sessions) {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.textContent = item.title;
      tab.className = item.id === state.activeId ? "active" : "";
      tab.addEventListener("click", () => void dispatch("select", {
        id: item.id
      }));
      const close = document.createElement("button");
      close.type = "button";
      close.textContent = "×";
      close.setAttribute("aria-label", "Close " + item.title);
      close.addEventListener("click", () => void dispatch("close", {
        id: item.id
      }));
      tabs.append(tab, close);
      if (!records.has(item.id)) {
        const element = document.createElement("div");
        element.className = "native-ps-session";
        terminalHost.append(element);
        records.set(item.id, { id: item.id, element, socket: null,
          term: null });
      }
    }
    for (const [id, record] of records) {
      if (!state.sessions.some(item => item.id === id)) {
        dispose(id);
      } else {
        record.element.hidden = !visible || id !== state.activeId;
      }
    }
    const selected = records.get(state.activeId);
    if (selected && pairedToken) {
      void connect(selected);
      requestAnimationFrame(() => {
        resize(selected);
        selected.term?.focus();
      });
    }
  }

  async function dispatch(action, payload = {}) {
    const result = await core.request("ui",
      "powershell-session-manager", action, payload,
      { origin: "user" });
    if (!result.ok) return logFailure("Session." + action,
      { name: "RequestDenied" });
    state = result.value;
    paint();
  }

  select("nativePsHide").addEventListener("click", hide);
  select("nativePsNew").addEventListener("click", () =>
    void dispatch("create"));
  select("nativePsPair").addEventListener("click", () => {
    try {
      port = policy.port(select("nativePsPort").value);
      pairedToken = policy.token(select("nativePsToken").value);
      select("nativePsToken").value = "";
      notice.textContent = translate("powerShellConnecting");
      for (const id of records.keys()) dispose(id);
      paint();
    } catch (error) {
      notice.textContent = translate("powerShellPairInvalid");
    }
  });
  button.addEventListener("click", () => {
    if (visible) hide(); else show();
  });
  window.addEventListener("resize", () => {
    const selected = records.get(state.activeId);
    if (selected) resize(selected);
  });
  return Object.freeze({ hide, show });
}
