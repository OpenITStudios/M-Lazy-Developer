---
id: document.system.skill-routing
class: DOCUMENT
domain: system
role: WORKFLOW
authority: CANONICAL
lifecycle: ACTIVE
---

# Skill Routing

Skills are routed on **two dimensions**:

1. **Work lane** — what kind of job is being performed.
2. **Domain specialist** — what semantic owner is needed for one decision.

Do not use a domain skill to infer the work lane.

## External Bedrock skills are not internal work lanes

The original developer `bedrock-*` skills are a **source-owned technical
methodology domain**, keyed by their native `skills.json`, whole-folder hashes,
`SKILL.md` and module manifests. Their names must not be added to the internal
`.agents/skill-registry.json` as new work lanes or silently activated as
ChatGPT instructions. Existing lane permissions and one-domain-specialist
routing remain intact.

Skills Probe is an **independently versioned evidence source**, not another
work lane or automatically executed verification service. Its native clean
examples distinguish `status`, `nodeStatus`, `engineStatus`, and the
test-target/skills-lock revision. Probes and test-pack examples may be
deliberately broken; upstream PASS only applies to its original claim.

For source-only map interpretation, continue through the existing
`m-bedrock-content-analysis` domain specialist. Only after selected-map
Semantic IR/source evidence and an actual question match a reviewed pattern
may the existing `compileDeveloperPracticeReferenceContext()` supply a
bounded developer-method reference and associated clean-example status.
Missing source/unknown version must remain UNKNOWN. Updating these references
uses SYSTEM DEVELOPMENT; an operational Map Audit never edits them.

The **single product flow** is defined at
[Product Flow](../product/flow.md#publisher-aligned-bedrock-skills-and-skills-probe-evidence).
Native source identity and update details are routed through
[Native Bedrock Skills](../../skills/bedrock/README.md). These are
source-selection rules, not a parallel map-audit coordinator.

## User-facing modes

Two **ChatGPT Chat** operator modes select the appropriate source/evidence route. M-Lazy-Developer checks accessible selected Minecraft maps provided through Google Drive, using GitHub `Local` for source/knowledge. Names such as `engine`, `pipeline`, `production`, `UI` and `CLI` in repository files describe code/contracts until actual execution is verified:

| Mode | Purpose | Internal route | Not allowed |
|---|---|---|---|
| `SYSTEM DEVELOPMENT` | Design/build/improve Lazy-Developer | `m-bedrock-product-development` with `product-development` permission profile, or `m-bedrock-detection-development` for reusable bug detection improvements | Treating a map-specific finding as proof that an engine change is correct |
| `MAP BUG AUDIT` | Find/classify bugs in a selected map using current capabilities | `m-bedrock-map-bug-audit` | Editing engine, detectors, or platform knowledge while auditing |

**ChatGPT Chat checker boundary:** In MAP BUG AUDIT, ChatGPT directly examines the selected artifact and canonical GitHub knowledge/contract sources. It may give an evidence-grounded audit response but must not claim programmatic `runSelectedMapAudit()`, canonical `SelectedMapAuditRun` or generated `MapAuditOutputV2` without actual execution. In SYSTEM DEVELOPMENT, source-contract/TypeScript changes saved to GitHub are verified only at the proof tier actually reached. The user's PC, CI, a separate interface and an emulator are not prerequisites for source-verifiable analysis.

The operator mode is not an additional machine skill/lane or artifact authority. Detection Benchmark and Target Repair remain separate specialized routes when requested. Domain specialists never change the selected mode. An audit detection gap is a handoff, not automatic development permission; a development improvement never automatically resumes or reclassifies a map audit.

**Default from user intent:** "develop/improve the system" selects SYSTEM DEVELOPMENT; "audit/find map bugs" selects MAP BUG AUDIT. For ambiguous requests with materially different outcomes, ask which outcome is intended. An unqualified "continue" retains the active mode. Switch modes only on explicit user request, and finish/record the current lane's handoff before switching.

## Work lanes

### Product Development

`m-bedrock-product-development`

Use for general Lazy-Developer product, architecture, UI, engine, and tooling development. It uses `docs/system/development-discipline.md` and the existing `product-development` permission profile. No skill-specific output schema or script is required for a source change whose proof is owned by existing repository verifiers.

### 1. Operational Map Audit

`m-bedrock-map-bug-audit`

Use to find/classify bugs in a map with current capabilities.

Allowed:
- pin one Selected Map Version;
- derive gameplay surfaces and Gameplay Contract from that artifact only;
- inspect Actual Behavior from that same artifact;
- account for every in-scope gameplay surface;
- classify contradictions/findings;
- identify detection gaps.

Forbidden:
- improving analyzers/rules/knowledge during the audit;
- turning unsupported capability into a defect.

### 2. Detection Development

`m-bedrock-detection-development`

Use to improve Lazy-Developer bug-finding capability.

Allowed:
- parser/analyzer/knowledge/rule/model/diagnostic/proof improvements;
- reduced fixtures;
- reusable capability changes.

Forbidden:
- treating a production Bug Report as development completion;
- map-specific hardcoded logic.

### 3. Detection Benchmark

`m-bedrock-detection-benchmark`

Use to measure current capability against frozen expectations.

Allowed:
- regression/golden evaluation;
- false-positive/negative classification;
- proof/coverage/cost measurement.

Forbidden:
- changing production implementation;
- changing expectations to fit current output.

### 4. Target Repair

`m-bedrock-target-repair`

Use only for an Approved Bug or an explicit intentional modification that requires target source/artifact mutation.

## Domain specialists

Artifact/container/workspace/package:
→ `m-bedrock-artifact-engineering`

Manifest/function/command/reference/semantic analysis:
→ `m-bedrock-content-analysis`

Version/edition/API/capability:
→ `m-bedrock-compatibility`

Cross-owner ambiguity:
→ `m-bedrock-cross-owner-routing`

## Routing algorithm

```text
user goal
→ choose one work lane
→ identify current semantic decision
→ consult at most one domain specialist
→ return typed result to lane
→ continue lane
```

A lane remains active across domain handoffs. Do not replace Map Audit with Detection Development automatically when a detection gap appears.

## Handoff contracts

### Map Audit → Detection Development

An unsupported mechanism is a `detection-gap` handoff, not permission to change production detection or to mark the map safe.

Emit:

```text
Detection Gap
- unsupported claim/evidence
- seed artifact/reference
- current proof ceiling
- likely canonical owner
- smallest reproduction
- audit impact
```

Then STOP that claim in the audit.

### Detection Development → Benchmark

Emit:

```text
Detection Capability Delta
- gap class
- owner changed
- generalized behavior added
- fixture/expectation
- expected before/after difference
- remaining proof residue
```

### Benchmark → Map Audit

Benchmark does not automatically reopen a map audit. A new operational run must consume the verified capability.

## Separation rule

```text
USE detection capability != DEVELOP detection capability != BENCHMARK detection capability
```

Never combine all three in one implicit skill flow.


## Development naming

`DEVELOP` alone means generic Product Development unless the goal is explicitly to improve bug-detection correctness/coverage.

```text
add/change product feature
→ Product Development execution contract

make bug finding smarter/more accurate
→ Detection Development
```

The mandatory work-lane structure is defined in this document.


## Permission preflight

Work-lane routing and mutation authority are separate decisions.

Before write/network/live execution:

```text
active lane
→ planned action + resource/path
→ lane permission preflight
→ allow / ask / deny
```

- `allow`: continue within the active lane.
- `ask`: obtain the required explicit approval or execution-context escalation.
- `deny`: stop that action; do not switch lanes implicitly.

A domain specialist cannot override a denied lane permission.

## Work-lane contract

Every work-lane skill must expose the same control structure:

1. Purpose
2. Entry criteria
3. Allowed actions
4. Forbidden actions
5. lane-specific procedure
6. Output contract
7. Handoff
8. STOP

Canonical work-lane names:

```text
Product Development
Map Bug Audit
Detection Development
Detection Benchmark
Target Repair
```

Product Development is not Detection Development. Generic repository/product feature work uses the normal development execution contract and canonical semantic owner.

General Product Development uses the permission profile `product-development` in `.agents/permissions/lane-permissions.json`. The permission profile is the existing authorization contract for the registered Product Development work lane. It permits bounded repository/source changes but never grants target-artifact mutation. The closest canonical owner and existing development contract still govern scope.

### Domain specialist contract

Domain specialists may use a smaller procedure, but must declare:
- role = domain specialist;
- lane boundary;
- owned decision/result;
- no implicit expansion of mutation or execution authority.

### No implicit lane switching

```text
Map Bug Audit
  detection gap
    → handoff record
    → stop that claim

Detection Development
  capability complete
    → benchmark handoff
    → stop development

Detection Benchmark
  pass/fail
    → report/handoff
    → stop benchmark
```

A handoff is data. It is not permission to continue automatically into another lane.