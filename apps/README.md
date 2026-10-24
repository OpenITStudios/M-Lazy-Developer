# Interface Source (`apps/`)

M-Lazy-Developer is operated through ChatGPT Chat. This existing technical directory contains optional CLI and report-view sources that consume canonical GitHub `Local` engine/contracts. Their presence does not prove programmatic audit execution.

## Surface ownership

| Source directory | Responsibility | Boundary |
|---|---|---|
| `cli/` | Developer-facing inspection/audit command source | A programmatic selected-map production audit must enter via `runSelectedMapAudit()`; command source does not prove execution. |
| `bug-report-ui/` | Svelte/Vite viewer/export surface for approved Bug Report V2 | Read-only projection of canonical approved BUG state; not the complete Map Audit Report or a second bug database. |
| `report-system-next/` | Independent, design-locked offline HTML/JSON renderer and tester-workspace source | Requires its own source/evidence-bound `m-lazy-report-next/v1` input; not a production replacement or migration of Bug Report V2, prior Bug Tracker, or existing project outputs. |

`ownership.json` lists these source surfaces and is the canonical interface-source ownership inventory. The directories do not authorize Bedrock parsing, diagnosis, repair decisions, persistent gameplay facts or silent report migration. Canonical Minecraft semantics belong to engine owners; the new report renderer has its own bounded input contract but **no assumed production adapter or publisher**. Distinguish independently stored tester results from canonical audit findings or approved bug state.

For cross-surface report ownership, follow [Bug Report Ownership](../docs/system/bug-report-ownership.md) and the surface-specific READMEs. Do not create a shared replacement report schema, adapter, or output path without actual producer/consumer analysis and an authorized migration.
