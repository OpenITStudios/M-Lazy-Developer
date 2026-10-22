# Orchestrator

`packages/orchestrator` is the composition layer for cross-owner Bedrock inspection, diagnosis, repair admission, runtime evidence, reporting, reliability workflows, and release-oriented decisions.

It is expected to have higher fan-out than ordinary engine modules because it composes analyzers and deterministic package owners. High fan-out alone is not a reason to create another package, but orchestration is not permission to absorb reusable domain semantics.

## Internal navigation

The public export surface is `src/index.ts`: it includes family barrels **and explicitly retained root production audit owners**. Most older flat root paths are compatibility aliases, but root location alone does not prove a file is an alias.

```text
src/
├── core/index.ts
├── inspection/index.ts
├── arena/index.ts
├── diagnosis/index.ts
├── repair/index.ts
├── reliability/index.ts
├── reporting/index.ts
├── workflow/index.ts
├── release/index.ts
└── index.ts
```

These family barrels are the canonical navigation hierarchy for orchestrator.

## File responsibility and navigation

The user-facing selected-map flow is `TARGET → DISCOVERY → UNDERSTAND → FORMALIZE → EVALUATE → PROVE → REPORT`. These are **workflow stages**, not additional source directories or alternate semantic owners. Navigate stages through the existing canonical `docs/system/implementation-map.md` and the audit workflow; implementation remains owned by the responsible family/package/analyzer. `MODEL` is a derived representation used across UNDERSTAND/FORMALIZE, and stress/cross-system checks are EVALUATE obligations, not alternate audit stages.

- Root production audit implementations such as `map-audit-pipeline.ts`, `map-audit-admission.ts`, `map-audit-issue-projection.ts` and `map-audit-output-v2.ts` own actual audit coordination, admission or projections. They are not compatibility stubs.
- Family `src/<family>/<responsibility>.ts` files own their declared orchestration concern. A family index is a navigation/export surface, not a second implementation.
- Confirmed flat root files containing only re-exports (for example `context-compiler.ts` and `arena-lifecycle-analysis.ts`) are legacy compatibility paths, never the preferred implementation or a new source of truth.
- When a name does not match its implementation, prove the actual owner and affected imports before renaming or moving it.
- One authoritative result contract per production flow; derived report formats must not create parallel state or approval authority.

## Compatibility alias rule

**Only confirmed re-export-only files** among root `src/*.ts` paths are compatibility stubs. Production root audit owners contain real imports, logic and exports and must not be relabeled as compatibility by their path.

Rules:

- new code imports from the family path (`inspection/`, `diagnosis/`, `repair/`, etc.);
- do not add new flat root re-export stubs;
- do not duplicate implementation behind an alias;
- remove legacy aliases only in a verified import-migration pass.

This keeps current work practical without a risky mass-delete while CI/local verification is deferred.

## Physical layout

Canonical implementations live primarily under the family directories above, **plus the established root `map-audit-*` production owners** documented in [Implementation Map](../../../docs/system/implementation-map.md). A verified re-export-only root stub must not receive new implementation logic. Classify by actual source contents and consumers before proposing any move, merge or deletion.

## Production selected-map audit boundary

Production gameplay bug audit has one operator entry, one authority, and one stage order:

```text
audit <selected-map>
→ runSelectedMapAudit({ artifactPath })
→ TARGET
→ DISCOVERY
→ UNDERSTAND
→ FORMALIZE
→ EVALUATE
→ PROVE
→ REPORT
```

Blocking does not fork the workflow. It stops authorization at the first unresolved stage and resumes the same `SelectedMapAuditRun` through its single allowed continuation.

`inspectArtifact()` and the inspection family are engineering primitives used by the canonical audit, reliability tooling, comparison, repair verification, and focused engine development. They are not alternate production audit entry points. The sole production CLI command is `audit`. Engineering-only `dev-*` projections may reuse the canonical audit snapshot but cannot authorize production decisions.

Repository verification enforces this boundary through `verify:audit-entrypoint`.

## Inspection pipeline

`inspect.ts` is the internal inspection composition flow used underneath the canonical audit. Detailed work is delegated to bounded stages:

```text
filesystem inventory
→ inspect-packs
→ inspect-source-index
→ inspect-graph-enrichment
→ inspect-script-import-graph
→ inspect-script-compatibility
→ inspect-entity-knowledge-stage
→ inspect-runtime-analysis-stage
→ knowledge runtime composition
→ inspect-education-stage
→ inspect-causality-stage
→ inspect-result
```

Supporting pure helpers:

```text
inspect-identifiers
inspect-runtime-evidence
```

### RIG demand reconciliation and ZIP source reuse

The canonical `runSelectedMapAudit()` may need a second inspection when
Required Inspection Graph demand expands. Both passes share **one validated
ZIP extraction** through `withPreparedArtifactInspection()` in the existing
inspection owner. Each pass gets a fresh, disposable working directory;
native LevelDB reads never share mutable working state. The selected ZIP is
hash-checked on preparation and throughout the inspection scope, with archive
changes aborting rather than producing mixed-version evidence.

ZIP preparation, the file inventory/content hashes, and successful native
LevelDB metadata summaries are reused when the second RIG pass is required.
Failed native reads are retried rather than silently promoted to success.
File reuse is bound to the selected artifact ID and fingerprint, and each
pass receives its own inventory objects and LevelDB summary copy.

**Gameplay/source parsing, Semantic IR, diagnosis and proof still run again**
for expanded RIG demand. Their mutable graphs are not cached without a
measured bottleneck and equivalent end-to-end results. The reuse is transient,
not a persistent cache, competing audit entrypoint or Minecraft runtime proof.
The standalone `inspectArtifact()` signature and existing TARGET → REPORT
stage gates remain unchanged.

## Stage rule

Create or extract an inspection stage only when all of these are true:

- it owns one coherent transformation or analysis concern;
- its inputs and outputs can be stated explicitly;
- it reduces direct coupling or control-flow noise in `inspect.ts`;
- it does not duplicate an analyzer/package semantic owner;
- it can be validated through the existing integrated inspection tests.

Do not create stages merely to reduce line count.

## Extraction gate

Before adding another orchestrator module, ask:

```text
Does this only compose existing owners?
  yes → orchestrator may own it

Does it define reusable semantics/policy/state/mutation?
  yes → move it to the canonical package/analyzer owner

Is it consumer/UI-specific?
  yes → apps/tooling owns it, not orchestrator
```

Keep the source layout shallow when path stability is materially valuable. Introduce a physical subdirectory only for a cohesive family with a stable boundary; do not mass-move files merely for appearance.

## Boundaries

Orchestrator may compose analyzers and core packages. It must not:

- become the canonical parser for Bedrock formats;
- duplicate compatibility, graph, repair, diagnostic, or knowledge semantics;
- hide mutable global state;
- create interface-specific behavior for CLI/MCP/UI;
- treat static/package evidence as runtime proof;
- expose a user-facing production path that bypasses `runSelectedMapAudit()`.

`inspect.ts` should remain readable as a top-to-bottom composition flow. Detailed parsing, derivation, diagnostics, and result projection belong in the nearest bounded stage or their existing semantic owner.

## Projection boundary

New consumers should not use `gameplayWorld` as their primary model.

```text
gameplaySemantic
→ gameplay meaning, subjects, arena structure, authored systems

engineeringAssessment
→ capacity, lifecycle convergence, cleanup, isolation, proof, contract/runtime gaps

gameplayWorld
→ deprecated compatibility composite only
```

This prevents QA state from becoming gameplay meaning and prevents inferred gameplay structure from being treated as engineering proof.
