# PR8 ArcD (initial draft)
Object: VirtualFile, SliceLoader, SliceRegistry, SliceProcessor,
EditorViewport, SliceCommitter, WritebackUnit, RecoveryController,
PluginManager.
Property: PieceTreePolicy, BPlusSliceIndex, CacheBudgetPolicy,
HighlightCSSPolicy, SliceMVCCPolicy.
Event chain: UI.scroll -> Hub -> Viewport -> SliceLoader -> Registry
-> PluginManager.process -> UI.render -> Commit -> MVCC
-> Writeback -> Registry.demote.
SubObjects inherit shared UI_COLOR and Language via LinkCore.
EHU statuses: 200 PASS, 400 invalid slice/CSS, 409 MVCC conflict,
413 resource budget, 500 write failed, 503 storage unavailable.
All independent slices may be scheduled concurrently; same slice
mutations are FIFO with generation/version fencing.
