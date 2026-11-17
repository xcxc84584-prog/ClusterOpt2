# PR16.1 — Plugin-managed workbench tabs
Objective: plugin manager, editor, PowerShell and Agent are peer workbench surfaces.
Source references: Cluster/BASE/index.html, Cluster/plugin_ai_agent/agent.js,
Cluster/plugin_ai_agent/agent.css, ClusterOpt2 PowerShell UI.
Do not change editor or PowerShell business logic.
PluginWorkbenchTabUnit restores disposable Agent tab after editor rerenders,
hides adjacent panes while active, and keeps PowerShell sessions alive.
Tests: agent tab creation on first open, switching among editor/tool/PS,
close/remove, no duplicate native PowerShell sessions.
Risk: async core render races, stale tab active state, lifecycle cleanup.
