# PR6 Patch(+10) — Durable snapshot test gate
- Browser reload test waits for both IndexedDB commit and
  the post-commit text-only fallback marker before navigation.
- Prevents racing a pending recovery persist against page unload.
- CI must pass before main merge; PR6 still PARTIAL.
