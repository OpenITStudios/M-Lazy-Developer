---
id: document.analysis.router
class: DOCUMENT
domain: analysis
role: ROUTER
authority: CANONICAL
lifecycle: ACTIVE
---

# Analysis

Canonical semantic-analysis policy. Analyzers are read-only evidence providers; they do not own production audit order.

**Current operating workflow: ChatGPT Chat + selected `.mcworld` from an accessible Google Drive link + GitHub `Local`.** ChatGPT examines source evidence read-only using available tools and reports supported findings and uncertainty. The TypeScript audit flow below is a source contract; its `runSelectedMapAudit()`, checkpoint statuses and JSON receipts must be attributed to actual code execution only.

## Selected-map audit — one door

For the **source-declared programmatic audit**, there is one canonical semantic procedure and one TypeScript entrypoint. This is not a requirement for ChatGPT to run code before reviewing the map:

```text
CLI: audit <selected.mcworld>
→ runSelectedMapAudit()
→ TARGET
→ DISCOVERY
→ UNDERSTAND
→ FORMALIZE
→ EVALUATE
→ PROVE
→ REPORT
```

**Operator master flow:** [Master Selected-Map Audit Workflow](./master-selected-map-audit-workflow.md)

**Executable checkpoint contract:** [Mandatory Gameplay Audit Procedure](./mandatory-audit-procedure.md)

**Version-change invariant:** selecting a newer map version always restarts the complete TARGET → DISCOVERY → UNDERSTAND → FORMALIZE → EVALUATE → PROVE → REPORT audit. Historical finding revalidation is only one input and cannot close the audit. The detailed rule is owned by the Master Selected-Map Audit Workflow; coverage reset semantics are owned by the Bug-Finding Coverage System.


The master workflow defines the complete human/AI work order. The Mandatory Gameplay Audit Procedure remains the executable checkpoint authority. All other gameplay-audit documents in this directory are supporting contracts loaded by that flow. They must not be interpreted as alternate workflows, alternate closure authorities, or alternate report routes.

### Authority hierarchy

```text
map-audit-pipeline.ts
  owns production entry + continuation
        ↓
mandatory-audit-procedure.ts / mandatory-audit-procedure.md
  owns ordered checkpoints
        ↓
map-audit-admission.ts
  owns first blocking stage / continuation authorization
        ↓
scenario + analyzer evidence
  supports checkpoints only
        ↓
PROVE
  emits confirmed issue projection
        ↓
BUG | DESIGN_MISMATCH
        ↓
single Map Audit output
```

### Player-flow projection

Inside the ordered stages, analysis follows the game:

```text
ENTRY / JOIN
→ READY / START
→ SETUP
→ ACTIVE GAMEPLAY
→ PROGRESSION
→ TERMINAL
→ CLEANUP / REPLAY
→ RECOVERY
```

Technical domains attach to those stages; they are not separate audit branches.

## Canonical navigation

Use this order:

1. [Master Selected-Map Audit Workflow](./master-selected-map-audit-workflow.md) — end-to-end work order.
2. [Mandatory Gameplay Audit Procedure](./mandatory-audit-procedure.md) — executable checkpoint closure.
3. Load specialist contracts only when the master flow activates them.

## Naming contract

- [Map Audit Naming Contract](./map-audit-naming-contract.md) — canonical public field/status names shared by source, schema, docs, and report.

## Supporting audit contracts

Load only when the canonical procedure activates the concern:

- [Gameplay Model Closure](./gameplay-model-closure.md) — UNDERSTAND closure semantics.
- [Bug-Finding Coverage System](./bug-finding-coverage.md) — canonical coverage accounting, blind spots, cross-system stress, proof conservation, and anti-suppression gate.
- [Audit Execution Flow](./audit-execution-flow.md) — reader-facing player-flow projection only.
- [Map Audit Report V2](./map-audit-report-v2-schema.md) — canonical human-facing full finding set across `PROVEN` and `NEED_VALIDATION`, with separate `BUG` and `DESIGN_MISMATCH` lanes.
- [Approved Bug Report V2](./gameplay-bug-report-v2.md) — downstream persisted approved `PROVEN BUG` ledger only.

None of these documents may authorize continuation independently of the Mandatory Audit Procedure receipt.

## Specialist audit contracts

Load only when the canonical audit flow activates the concern:

- [User Input Translation Contract](./user-input-translation-contract.md) — translates user/client wording into bounded non-authoritative audit search guidance.
- [Hidden Gameplay Defect Analysis](./hidden-gameplay-defect-analysis.md) — higher-order contradiction and latent gameplay-defect reasoning.
- [Vital Gameplay Knowledge Closure](./vital-gameplay-knowledge-closure.md) — read-only closure projection for the eight vital gameplay domains.
- [Runtime Telemetry Contract](./runtime-telemetry-contract.md) — trace/evidence envelope for runtime observation and diagnostics.
- [Developer Note Coverage](./developer-note-coverage.md) — engineering-note admission and separation from BUG / DESIGN_MISMATCH.

## Optional developer-origin interpretation

- [Developer-Practice Knowledge for Gameplay Interpretation](./developer-practice-context.md) — **REFERENCE only**: curated, source-fingerprinted hints from evolving developer material, retrieved selectively after current-map evidence raises a question. Its linked JSON is machine-readable and updateable; it never creates a gameplay requirement, a finding, or a separate audit stage. Source inventory remains in [Examples](../examples/bedrock-developer-agent-skills-reference.md).

## Analysis domains

### Core models and graphs
- [Dependency graph](./dependency-graph.md) — semantic relationships, reference resolution, and reverse-impact traversal.
- [Topology](./topology.md) — coordinate resolution, translated-region candidates, conservative outliers, and bounded native chunk correlation.
- [Executable reasoning architecture](./executable-reasoning-architecture.md) — executable reasoning/model integration.
- [State authority](./state-authority-runtime.md) — logical authority, scope, mirrors, durability, and reconciliation.

### Authored source semantics
- [Content discovery](./content-discovery.md) — file/pack discovery and first semantic extraction.
- [Command semantics](./command-context-runtime.md) — typed effects plus executor, dimension, position, selector scope, and target cardinality.
- [Entity state analysis](./entity-state-analysis.md) — possible-state modeling plus attack, sensor, targeting, navigation, event-reachability, and prerequisite knowledge.
- [Script API](./script-api.md) — static Script API usage and compatibility semantics.

### Native world and structure evidence
- [World DB](./world-db.md) — conservative LevelDB/keyspace evidence and native differential boundaries.
- [mcstructure](./mcstructure.md) — normalized structures, embedded runtime commands, load correlation, command-chain topology, and placement transforms.

### Platform knowledge and compatibility
- [Compatibility](./compatibility.md) — edition/version/module/experiment/runtime-profile compatibility.
- [Education](./education.md) — Education-specific feature, Agent/Code Builder, permission-block, and runtime context.

### Gameplay capacity and concurrency
- [Capacity and Concurrency](./capacity-concurrency.md) — presented vs deliverable capacity, throughput bottlenecks, queue behavior, and concurrency boundaries.

### Runtime gameplay domains
Runtime documents describe evidence requirements only; knowledge presence is not proof and does not create a workflow.

- arena/session: [arena cleanup](./arena-cleanup-runtime.md), [round integrity](./round-integrity-runtime.md), [multi-arena](./multi-arena-audit-contract.md)
- player lifecycle: [player lifecycle](./player-lifecycle.md), [inventory](./inventory-runtime.md), [interaction](./interaction-runtime.md), [effects](./effects-runtime.md), [permissions](./permissions-runtime.md)
- entities/combat: [entity navigation](./entity-runtime-navigation.md), [entity population](./entity-population-runtime.md), [combat](./combat-runtime.md), [mounts](./mounts-runtime.md)
- world/chunks: [chunk loading](./chunk-runtime-loading.md), [world state](./world-state-runtime.md), [world mutation](./world-mutation-runtime.md), [spatial containment](./spatial-containment-runtime.md), [physics](./physics-runtime.md)
- execution/order: [event ordering](./event-ordering-runtime.md), [persistence/recovery](./persistence-recovery-runtime.md), [automation](./automation-runtime.md)
- presentation/control: [cinematic](./cinematic-runtime.md), [client feedback](./client-feedback-runtime.md)
- economy/content: [loot/economy](./loot-economy-runtime.md)
- operational risk: [performance](./performance-runtime.md), [teleport](./teleport-runtime.md)

## Placement rule

A new analysis document is not a new audit stage. Durable semantics belong here. Historical runs belong in `engine/reliability/history/`; active work intent belongs in `planning/`; working/project execution data belongs in `workspace/`. Production execution order remains owned by the Mandatory Audit Procedure.