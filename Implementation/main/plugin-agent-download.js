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
  "MCP-SETUP.md",
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
  "local-agent/Start-OAuth.ps1",
  "local-agent/Quick-Setup.cmd",
  "local-agent/MCP-Quick-Setup.cmd",
  "local-agent/Setup-Quick.ps1",
  "local-agent/Port-CPO.ps1"
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

/**
 * Quick setup is a single Windows CMD entrypoint, independent of the
 * full plugin ZIP. Its pinned helper retrieves only reviewed assets.
 */
export async function downloadAgentQuickSetup(doc) {
  const win = doc.defaultView;
  const path = PACKAGE_ROOT + "local-agent/Quick-Setup.cmd";
  const response = await win.fetch(path, { cache: "no-store" });
  if (!response.ok) throw Error("Quick setup asset unavailable");
  const content = await response.text();
  if (content.length < 500 || content.length > 16384 ||
      !content.startsWith("@echo off")) {
    throw Error("Invalid quick setup CMD");
  }
  const blob = new win.Blob([content], {
    type: "application/octet-stream"
  });
  const url = win.URL.createObjectURL(blob);
  const link = doc.createElement("a");
  link.download = "AI-Agent-MCP-Quick-Setup.cmd";
  link.href = url;
  doc.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    win.setTimeout(() => win.URL.revokeObjectURL(url), 1000);
  }
}

/**
 * Second reviewed standalone installer: local MCP + opt-in OAuth.
 * The sandbox requests it; only the trusted host fetches and downloads it.
 */
export async function downloadMCPQuickSetup(doc) {
  const win = doc.defaultView;
  const path = PACKAGE_ROOT + "local-agent/MCP-Quick-Setup.cmd";
  const response = await win.fetch(path, { cache: "no-store" });
  if (!response.ok) throw Error("MCP setup asset unavailable");
  const content = await response.text();
  if (content.length < 500 || content.length > 16384 ||
      !content.startsWith("@echo off")) {
    throw Error("Invalid MCP setup CMD");
  }
  const blob = new win.Blob([content], {
    type: "application/octet-stream"
  });
  const url = win.URL.createObjectURL(blob);
  const link = doc.createElement("a");
  link.download = "AI-Agent-MCP-Quick-Connect.cmd";
  link.href = url;
  doc.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    win.setTimeout(() => win.URL.revokeObjectURL(url), 1000);
  }
}
