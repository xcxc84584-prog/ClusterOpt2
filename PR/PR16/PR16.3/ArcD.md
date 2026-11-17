# PR16.3 Architecture
Agent setup UI -> trusted host downloadAgentPackage -> ZIP (17 assets)
-> user extracts -> local-agent/Quick-Setup.cmd -> Setup-Quick.ps1
-> npm local dependencies -> server.cjs (127.0.0.1:43879)
-> token copied by user into trusted browser prompt.
Local Agent and remote MCP/OAuth remain distinct optional services.
