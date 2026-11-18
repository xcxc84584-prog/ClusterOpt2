# PR20.2 ArcD — installer and public endpoint architecture

```text
User → MCP-Quick-Setup.cmd (single file)
     → verified commit SHA + PowerShell sequential downloads (5 assets)
     → CPO-enabled MCP Gateway (127.0.0.1:43880)
     → optional OAuth Gateway (127.0.0.1:43879)
     → user-owned HTTPS reverse proxy + clusteropt2.<owned-domain>
     → ChatGPT MCP client

MCP requests → OAuth scope ACL → MCP bearer gateway →
Local Agent (127.0.0.1:43881) → browser ToolBox + per-PS approval
```

## Objects/properties
No new Object or shared EDPMU Property. Plugin installer scripts and documentation only. Existing HubUnit/OMU/EHU relationships unchanged. Download failure is displayed to the initiating user; no listener starts before full download completion.

## Event chain / EHU
Failure before local service startup: CMD displays file name, URL and exception, then exits nonzero. Existing local listener, ToolBox and OAuth paths retain existing OMU/EHU logging once started. No fake EHU entries for failed Windows bootstrap stages.
