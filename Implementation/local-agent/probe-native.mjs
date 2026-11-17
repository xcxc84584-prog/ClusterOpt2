/**
 * Local Agent native ConPTY readiness probe.
 *
 * Run as a file, not as `node -e`: PowerShell's native argument
 * marshalling must never rewrite JavaScript string delimiters.
 * No network request, persistent token or browser permission is used.
 */
import * as nodePtyModule from "node-pty";

const pty = nodePtyModule.default ?? nodePtyModule;
if (process.platform !== "win32") {
  console.error("ConPTY probe requires Windows");
  process.exitCode = 2;
} else if (typeof pty.spawn !== "function") {
  console.error("node-pty spawn API is unavailable");
  process.exitCode = 2;
} else {
  let terminal;
  try {
    terminal = pty.spawn(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-NonInteractive",
        "-Command", "exit 0"],
      {
        name: "xterm-256color",
        cols: 40,
        rows: 10,
        cwd: process.env.USERPROFILE || process.cwd(),
        env: { ...process.env }
      }
    );
    const timeout = setTimeout(() => {
      console.error("ConPTY native probe timed out");
      terminal.kill();
      process.exitCode = 3;
    }, 8000);
    terminal.onExit(({ exitCode }) => {
      clearTimeout(timeout);
      if (process.exitCode) return;
      process.exitCode = exitCode === 0 ? 0 : 4;
      if (exitCode !== 0) {
        console.error("ConPTY native shell exited with an error");
      }
    });
    terminal.onData(() => {});
  } catch (error) {
    console.error("ConPTY failed to start:", error?.message);
    process.exitCode = 5;
  }
}
