import { createTemplateZip } from "./plugin-template-download.js";

/**
 * Publish the reviewed, multi-file AI Agent source package unchanged.
 * File names are allowlisted; downloading never installs or grants access.
 */
export const AI_AGENT_PACKAGE_FILES = Object.freeze([
  "plugin.json",
  "worker.js",
  "index.html",
  "README.md",
  "locales/en.json",
  "locales/zh-Hant.json",
  "local-agent/README.md",
  "local-agent/package.json",
  "local-agent/server.cjs",
  "local-agent/remote-mcp.cjs",
  "local-agent/mcp-stdio.cjs",
  "local-agent/oauth-mcp-gateway.cjs",
  "local-agent/Start-LocalAgent.ps1",
  "local-agent/Start-MCP.ps1",
  "local-agent/Start-OAuth.ps1"
]);

const PACKAGE_ROOT = "./Implementation/plugins/ai-agent-mcp/";

export async function fetchAgentPackageFiles(fetcher) {
  const entries = await Promise.all(AI_AGENT_PACKAGE_FILES.map(async name => {
    const response = await fetcher(PACKAGE_ROOT + name, {
      cache: "no-store"
    });
    if (!response.ok) throw Error("Missing plugin asset: " + name);
    const text = await response.text();
    if (new TextEncoder().encode(text).length > 1048576) {
      throw Error("Plugin asset exceeds ZIP budget: " + name);
    }
    return [name, text];
  }));
  return Object.fromEntries(entries);
}

export async function downloadAgentPackage(doc) {
  const win = doc.defaultView;
  const files = await fetchAgentPackageFiles(win.fetch.bind(win));
  const zip = createTemplateZip(files);
  const blob = new win.Blob([zip], { type: "application/zip" });
  const url = win.URL.createObjectURL(blob);
  const link = doc.createElement("a");
  link.href = url;
  link.download = "ClusterOpt2-AI-Agent-MCP.zip";
  doc.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    win.setTimeout(() => win.URL.revokeObjectURL(url), 1000);
  }
}
