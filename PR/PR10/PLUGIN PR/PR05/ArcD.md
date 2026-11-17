# PLUGIN PR05 ArcD

Host → LinkCore → HubUnit → RouteTransactionUnit → existing RouteTablePolicy, RouteControlPolicy, Provider registry. HubUnit alone swaps immutable route snapshots, increments generation and logs EHU. All configured routes retain existing authorization. Event chain: Begin → Validate (dry-run) → CAS Commit / 409 or Abort. Runtime transaction candidates are discarded on reload.
