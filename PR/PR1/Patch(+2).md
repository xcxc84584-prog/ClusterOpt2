# Patch(+2) — OCDA foundation and extensibility

State: code implemented, CI/browser acceptance pending.

- Split LinkCore into HubUnit, ObjectManagementUnit,
  EntireDomainPropertyManagementUnit and UnifiedRegistrationUnit.
- Add a stable LinkCore facade compatible with existing UI calls.
- Add property registration and centralized SystemVersion publication.
- Add EHU for failures, one-second pass cooldown, relation observations.
- Reject unknown sender/receiver unless a trusted factory exists.
- Add object contract utilities and basic Node.js relation tests.
- Add CI workflow for syntax checks and automated LinkCore unit tests.
- Keep FileDocument and FileWorkspace intact as independent objects.

Known gaps:
- The object contract is not yet enforced for all declared OCDA fields.
- VTE sandbox and authorized virtual Req/Rep are not implemented.
- Full Public/Protected/Private access control is not implemented.
- LinkCore property routing remains preliminary; existing UI uses a static
  DocumentStatus import.
- Manual browser E2E testing is still outstanding.
