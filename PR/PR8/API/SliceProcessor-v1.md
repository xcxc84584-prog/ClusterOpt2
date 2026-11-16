# SliceProcessor API — proposal v1

Status: specification only. Custom execution is not enabled in Patch(+8).

## Contract
- Stage: after full-load admission and before editor rendering.
- Preloaded chunks must not pass through this stage.
- Input: { apiVersion: 1, documentId, sliceId, revision,
  text, startByte, endByte, locale }.
- Output: { apiVersion: 1, sliceId, revision, text, decorations }.
- Text transformation must preserve source mapping and report offsets.
- Invalid output, timeout or crash must not replace original content.

## Modules
- Default: text highlighter, Chinese encoding/decoding aid,
  line-number display helper.
- Each default can be disabled independently once the runtime exists.
- Disable never deletes or rewrites file data.

## Safety
- User-selected plugin source requires an explicit trust decision.
- No eval, Function, dynamic remote import or ambient disk/network access.
- Use isolated worker/module execution with permission and resource limits.
- All operations must return bounded outputs and structured errors.
- Request/Response route via HubUnit; OMU records EHU 400/408/413/500.
- Registered version and capability list must be validated first.

## Lifecycle
register -> enable -> process -> disable -> unregister.
A disabled plugin is bypassed; cancellation must be supported.
