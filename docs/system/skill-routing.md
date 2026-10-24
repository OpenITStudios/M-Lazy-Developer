---
id: document.system.skill-routing
class: DOCUMENT
domain: system
role: WORKFLOW
authority: CANONICAL
lifecycle: ACTIVE
---

# Skill Routing — exactly two internal skills

Two **ChatGPT Chat** operator modes select one active internal
`SKILL.md` and keep it until STOP or explicit user handoff:

| Mode | Registered skill | Purpose and mutation boundary |
|---|---|---|
| **IMPROVE SYSTEM** | `m-bedrock-system-improvement` | Change the existing checker, parser, engine, references and source/knowledge. Benchmark is a frozen measurement operation, not another lane. Never write a target map. |
| **TEST MAP** | `m-bedrock-map-testing` | Use current checker on one immutable map, read-only. An approved working-copy repair is a separately authorized suboperation, not implicit after findings. |

```text
IMPROVE SYSTEM
→ DEFINE → INVESTIGATE → DESIGN → IMPLEMENT → VERIFY → COMMIT & STOP

TEST MAP
→ one Pre-Audit scope confirmation
→ LOAD → UNDERSTAND → TEST → REPORT
```

## Internal proof mapping, not new stages

- **LOAD** groups existing TARGET / DISCOVERY identities and source inventory.
- **UNDERSTAND** groups existing UNDERSTAND / FORMALIZE, Semantic IR,
  Gameplay Intent, player journey, state and arena ownership.
- **TEST** groups EVALUATE / PROVE, cross-system scenarios, counterproof,
  Minecraft compatibility, true proof ceiling and validation residue.
- **REPORT** remains one source-grounded human output and one authoritative
  programmatic Map Audit Output V2 only when the TypeScript entrypoint ran.

`operatorMapTestStageFor()` projects the four display stages; the
seven internal `currentStage` checkpoint values still govern ordered
admission. Direct ChatGPT map source review must not claim programmatic `runSelectedMapAudit()` or an actual Minecraft runtime execution
without corresponding evidence. Do not create a second map-audit pipeline.

## One shared Bedrock reference domain

The original `minecraft-bedrock-agent-skills` ZIP owns native skill
identity, SKILL.md method, module manifests, folder hashes and
`requires` edges. The independent Skills Probe ZIP owns its separately
pinned client/lock, 14 clean examples, 49 source-reviewed report texts,
and their PASS/FAIL/BLOCKED/PARTIAL qualifications. Neither supplies a
Map Design contract or an automatic bug detector.

`skills/bedrock/` owns source identity; the *one* curated metadata
owner is `experiments/developer-practice-signals.json`.
`engine/packages/orchestrator/src/workflow/resource-context.ts`
selects at most relevant reviewed method/report pointers **after exact
selected-map Semantic IR/source evidence**, never by generic text or
upstream status. `bedrock-player-attached-particles` remains unrouted
until a precise typed source witness exists.

Artifact/content/compatibility and cross-owner reasoning are technical
procedures in `docs/system/implementation-map.md` and the preserved
two-skill reference trees, not separate active agent skills.

## Benchmark, repair, evidence and STOP

- **Benchmark (within IMPROVE SYSTEM):** freeze expectations and actual
  observed results independently; the permission preflight denies
  implementation/frozen-corpus mutation during measurement. Scoring is
  valid only when its exact engine/fixture ran; a written test is not PASS.
- **Approved repair (within TEST MAP):** test result does not authorize
  mutation. Only a distinct explicit user-approved working-copy request
  with exact SHA, Must Change and Must Preserve is eligible; original
  source remains immutable. Deny target writes in normal TEST MAP.
- **capability-gap:** if source interpretation or proof is unsupported,
  preserve a bounded, referenced gap instead of false BUG or SAFE.
  No automatic lane switch to IMPROVE SYSTEM.
- **Source proof:** ChatGPT source observation, executed Node tooling,
  executed TypeScript audit and Minecraft gameplay are distinct tiers.

Before writes, external-network/dependency work or live Minecraft
interaction, follow `.agents/permissions/evaluate-lane-permission.mjs`
and the two-lane `lane-permissions.json` / `path-access.json`
policies. Never invent approval or override a denial via a reference.

This file is the **single selection owner**. The user-facing flow
lives in [Product Flow](../product/flow.md), source development in
[Development Discipline](development-discipline.md), and detailed map
checkpoint/proof instructions in
[Master Audit](../analysis/master-selected-map-audit-workflow.md).
