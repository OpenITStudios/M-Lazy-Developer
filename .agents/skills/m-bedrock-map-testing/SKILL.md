---
name: m-bedrock-map-testing
description: >
  Test and understand a selected Minecraft Bedrock or Education map within ChatGPT Chat using LOAD, UNDERSTAND, TEST, REPORT and source-grounded Skills/Skills Probe references.
---

# TEST MAP

**Lane: TEST MAP — one of exactly two internal skills.**
**Operator:** ChatGPT Chat; an accessible selected `.mcworld` may be supplied via Google Drive. **Map authority:** the exact selected immutable `.mcworld`; GitHub `Local` owns code and reference contracts. This skill checks current maps, not engine source improvement.

## Entry, safety and evidence

Normalize the request and present one small Pre-Audit plan; secure one user confirmation when beginning a production full audit. Pin the exact map identity/version before inspecting it. Read one selected map and its source/IR only; symptoms, old QA, other maps, Skills and Probe reports do not define Expected Behavior. Do not modify engine or original map. If only direct ChatGPT source examination occurs, present that as a scoped static/source result, **never** as an executed `runSelectedMapAudit()` or Minecraft gameplay.

## Four user-facing stages, one existing engine

1. **LOAD = internal TARGET + DISCOVERY.** Fingerprint the selected archive, preserve safe/opaque source, inspect manifests, behavior/resource packs, scripts, functions, entity, world/NBT/LevelDB, structures and references. Produce selected-artifact source identities, inventory and unsupported-source gaps.
2. **UNDERSTAND = internal UNDERSTAND + FORMALIZE.** Reconstruct the player journey (ENTRY/JOIN → READY/START → SETUP → ACTIVE GAMEPLAY → PROGRESSION → WIN/LOSE → CLEANUP/REPLAY → RECOVERY). Build authored/inferred/unknown objective, actor/state ownership, Semantic IR, Gameplay Intent, transitions, arena and multiplayer contracts. Consult only relevant reviewed `bedrock-*` methods and version-locked Probe examples through the existing `resource-context.ts`, matched to exact current-map source/IR; never infer map design from an upstream preference.
3. **TEST = internal EVALUATE + PROVE.** Challenge normal path, recovery, edge cases, concurrency, permission/version and cross-system relations, then counter-prove each apparent contradiction. Differentiate `BUG`, `DESIGN_MISMATCH`, `PROVEN`, `NEED_VALIDATION` and unresolved Audit Obligations. Upstream Probe is an **external evidence pointer**, not native runtime proof for this map. If behavior cannot be proved from source, preserve one precise runtime-proof request without claiming it ran.
4. **REPORT = internal REPORT.** One coherent Game Understanding → source-grounded findings → narrow unknown/next proof output. Use `MapAuditOutputV2` only when the actual canonical programmatic audit runs; otherwise report scoped ChatGPT findings with exact evidence and limits. No parallel issue store.

The canonical existing `runSelectedMapAudit()` and detailed checkpoint/proof logic remain internal control contracts: `../../../docs/analysis/master-selected-map-audit-workflow.md`. Grouping does **not** erase gates, weaken coverage, or convert UNKNOWN into PASS. Present **LOAD/UNDERSTAND/TEST/REPORT** as the only top-level operator workflow.

## Optional *approved* target repair — not an audit stage or third lane

A test finding NEVER authorizes mutation. Only after a distinct explicit user approval and a pinned original/working identity may a **separate approved working-copy repair operation** be considered: `Must Change` + `Must Preserve` → guarded patch transaction → focused change/preservation proof. Original artifact stays immutable. Use the existing `engine/packages/repair/` / `engine/packages/preservation/` owners and `references/repair/` contracts; a dedicated conditional permission guard must approve the exact working-copy path. Any missing approval, preservation contract or fingerprint means STOP/deny. No implicit repair after TEST.

## Knowledge and coverage owners

`experiments/developer-practice-signals.json` is the single curated
**REFERENCE** store for developer methods and Skills Probe evidence;
`engine/packages/orchestrator/src/workflow/resource-context.ts` is its
selected-map witness gate. For required coverage/proof, follow
`../../../docs/analysis/bug-finding-coverage.md` and the canonical
master audit workflow, not a second checklist or a full-map automatic PASS.

## Capability gap and boundaries

If a mechanic cannot be interpreted or tested, report a source-identified `capability-gap`. Do **not** switch to IMPROVE SYSTEM, modify a detector or suppress an independently proven finding without explicit user direction. Source reference selection retains its 16 reviewed patterns and rejects un-routed developer methods such as generic entity spawn → particles.

## STOP

Stop when scoped findings/unknowns are documented or the single production report is admission-ready. Do not promise that runtime, TypeScript, multiplayer, or Minecraft Education execution happened unless it actually did.
