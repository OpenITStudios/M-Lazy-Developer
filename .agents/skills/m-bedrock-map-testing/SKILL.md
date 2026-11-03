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

## Mandatory ChatGPT executable preflight (before interpreting the map)

For every requested **full production map audit**:
1. Identify the immutable selected `.mcworld` bytes and SHA-256; pin the current GitHub `Local` HEAD. Do not start with isolated examples and later describe them as a complete engine test.
2. Look for the existing GitHub `Package Source Snapshot` artifact named `lazy-developer-portable` **at that exact HEAD**. It is source/dependency transport, not a tested-map receipt. Download it into ChatGPT, verify the artifact tar SHA-256, safe extraction, `.portable-provenance.json` commit/lock/Node/entrypoint and native LevelDB capability before relying on it. An artifact from an older HEAD may only support a clearly dated historical-engine comparison.
3. When the package is valid, run the canonical `apps/cli/src/audit.ts` through its included `tsx` inside ChatGPT with `--expected-source-sha <current Local SHA>` and `--expected-sha256 <selected mcworld SHA-256>`; preserve its complete canonical JSON and exit status. Exit `0` permits inspection of admission; exit `2` is an **incomplete but emitted** audit and must retain the report; exit `1` is a processing failure and must not be described as coverage. Do not turn successful module import or archive packaging into an engine execution result.
4. Inspect the real output's stage, reasons, unresolved source call edges, `auditObligations`, findings and model handoff; use the existing `--handoff` / `--responses` continuation for source-verifiable open tasks when possible. Work on blocker causes, not aggregate counts; do not silently drop any obligation or fabricate source/runtime proof. If an available step is still runnable, continue it before stopping.
5. If there is no exact-HEAD package or it fails, investigate the existing delivery/provenance route rather than assuming ChatGPT cannot run Node. Complete all independent direct-artifact source inspections but label them separate from a current `runSelectedMapAudit()` result. A requested full audit stays **INCOMPLETE** until the real canonical run and its applicable coverage/proof gates close; irreducible native multiplayer/render/network behavior remains explicitly `NEED_VALIDATION`, not skipped or passed.

This is the existing TEST MAP lane and existing canonical engine, not a second checker, new operator workspace, substitute dataset or separate audit authority. Never ask for the user's PC, Work, Codex, or a manual checkout. The GitHub snapshot job may transfer code/dependencies, but it must not process selected maps or execute test CI.

## Fixed user-authorized scope: complete ChatGPT source/artefact QA

The user has explicitly excluded live Minecraft execution from M-Lazy-Developer's ChatGPT QA workflow. This is a scope boundary, NOT an instruction to skip difficult source checks.

**In scope (mandatory when applicable):** read-only selected-world ZIP/manifest/JSON/NBT/LevelDB/structures, full canonical source engine, exact callback/control/dataflow/state/resource edges, authored objectives/arena IDs and physical evidence available from archive, round/reconnect/cleanup/persistence static and deterministic simulation checks, compiler/tests, independent counterexamples, evidence-traced bug/design mismatch validation, all resolvable source obligations, and schema-correct canonical reporting.

**Out of scope (do not schedule or require):** launching Minecraft, real client animation/rendering/audio perception, real network-latency and FPS/TPS measurements, actual multi-client play sessions and Minecraft import/play acceptance. A source/model simulation is allowed but must not be relabeled as actual in-game behavior. Keep native-only uncertainties in existing canonical `runtime-proof` / `NEED_VALIDATION` output for truthfulness; in operator summaries classify them **EXTERNAL_ONLY / OUT_OF_SCOPE_FOR_CHATGPT**, not as ChatGPT tests omitted. This label is an explanation, not a new schema status, proof type or source authority. Never suppress evidence, alter official `BLOCKED` status, or mark unresolved source obligations safe.

**Completion criterion:** every ChatGPT-callable source and artefact inspection and every applicable source-verifiable proof attempt has been performed; all material source paths have a source-bound finding, reasoned safe/negative disposition, or an explicitly unresolved *source* reason. Separate remaining source ambiguities from excluded Minecraft-only observation. Do not stop because the native game is unavailable or claim 100% real-world behavior without live evidence.

## Four user-facing stages, one existing engine

1. **LOAD = internal TARGET + DISCOVERY.** Fingerprint the selected archive, preserve safe/opaque source, inspect manifests, behavior/resource packs, scripts, functions, entity, world/NBT/LevelDB, structures and references. Produce selected-artifact source identities, inventory and unsupported-source gaps.
2. **UNDERSTAND = internal UNDERSTAND + FORMALIZE.** Read the full material selected-map surface first; reconstruct **this map's** game/mode, player journey, objective, allowed actions, ownership, transitions, level/arena boundaries and optional mechanics. Preserve unresolved sources and the exact selected artifact identity. Only after this source-bound model exists, select relevant reviewed `bedrock-*` / Skills Probe methodology and its negative controls through the existing `resource-context.ts`. Reference snippets and old Probe fixtures never determine what mechanics must exist.
3. **TEST = internal EVALUATE + PROVE.** For every applicable discovered mechanic/transition, route normal, failure, recovery, concurrency and boundary checks to available **source-verified Skills/Skills Probe methods** and existing Semantic IR/QA/PROVE owners. Run only a genuinely available, authorized current-map proof capability. A version-pinned upstream Probe example/report is an **investigation reference**, never a current-map execution receipt. Exhaust valid static evidence and counterproof; never promote a suggested Probe question to PASS, a BUG, or Minecraft execution. If a mechanism cannot be decided, retain the exact gap, missing capability/evidence and one narrow deciding test instead of fabricating a detector or probe result.
4. **REPORT = internal REPORT.** Deliver **Game Understanding → verified Bug/Design Mismatch findings → uncovered/untested mechanisms and precise next-proof requests** in one existing report. Preserve `PROVEN` versus `NEED_VALIDATION`, the original Audit Obligations and exact source/probe/execution boundaries. Label absence of an applicable probe reference as **unverified coverage**, not a confirmed lack of Probe capability. Use `MapAuditOutputV2` only after its programmatic audit actually runs; otherwise clearly label the result ChatGPT source inspection. Do not build a separate gap database or bug store.

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

## Probe coverage, applicability and capability gaps

The order is mandatory: **pin map → discover/UNDERSTAND its actual game systems
→ assign source-specific applicable QA checks → choose matching Skills Probe
method/negative control → evaluate with available current-map proof
→ report findings and uncovered proof**. Never select all 24 developer skills
or assume every selected map has a lobby, currency, result screen or replay.

For each applicable material requirement, account through the existing
Scenario Graph, evidence and Audit Obligations for: selected-map source
identity and scope; necessary verification question; source-matched
developer/Probe method and its original client/version/lock when available;
**what was actually executed** versus merely referenced; counterproof;
and the exact remaining source/runtime proof. These dimensions are
read-only routing/explanations, not additional state machines or checklists.

- **Matched method**: a specific method/reference and upstream Probe report
  may guide TEST, but does not establish that a test ran on this map.
- **No eligible method reference**: report reference matching as unresolved;
  a bounded reference selection or missing source witness alone does NOT
  prove that Skills Probe cannot support the mechanic.
- **Verified unsupported capability / missing semantic evidence**: preserve
  the existing `detection-gap`, `knowledge-gap` or other appropriate
  canonical Audit Obligation with a source locator, missing proof and
  proposed narrow investigation. Do not create substitute probe scripts,
  invent findings or start IMPROVE SYSTEM automatically.
- **Requires actual game behavior only**: retain the existing `runtime-proof`
  obligation as an honest external evidence limit, but do not require or
  schedule Minecraft tests within ChatGPT QA. Explain `OUT_OF_SCOPE_FOR_CHATGPT`
  in the operator view; distinguish mixed source/runtime questions because
  any source-resolvable portion remains mandatory. Node/engine/source results
  must never be presented as observed Minecraft gameplay.

The goal is comprehensive applicable coverage, **not a predefined promise
of 100% Skills Probe compatibility**. A complete inventory and real
current-map results are required to establish that level of coverage.
Source reference selection uses reviewed `patterns[]` in
`experiments/developer-practice-signals.json` through
`resource-context.ts`; an unrouted developer reference is not gameplay
proof.

## STOP

## STOP

Stop only after every available ChatGPT-native, source/artefact-verifiable audit operation has been attempted and the canonical report remains losslessly available. An exact-HEAD portable engine MUST run if accessible. Remaining source-decidable gaps require source investigation, not a Minecraft handoff. Record any still-ambiguous source proof separately from excluded native game observations. Preserve canonical BLOCKED where present; never claim multiplayer runtime, performance or Minecraft Education gameplay was observed.
