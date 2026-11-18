# PR22.2 Patch(+1)

## Changes
- PluginLocalAgentObject: bounded activity callback on tool request
  and tool_result, protocol error, and shell execution completion.
- PluginUIHostUnit: deliver sanitized activity and bounded
  PowerShell exitCode/stdout/stderr to AI Agent sandbox feed.
- AI Agent index.html: render timestamps, action states, results,
  and failures like legacy Cluster; retain 40-message cap.
- Native server.cjs: return HTTP 403 for a rejected browser tool
  response or a declined PowerShell request.
- New pr22-ai-agent-feed.test.js for audit/bridge contracts.

## Not changed
All PowerShell commands still require explicit user approval.
The ToolBox remains the owner of CRUD/PS grants.
No hardcoded secrets, absolute Windows paths, new global Property,
or changes to unrelated LinkCore methods.

## Current validation
Changes committed to draft PR #73; real Windows integration and
GitHub CI result must be checked before merging. The latest
observed Gateway status was connected, Browser Editor connected;
task status returned a transient fetch failure.
