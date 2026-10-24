---
id: document.system.implementation-map
class: DOCUMENT
domain: system
role: GUIDE
authority: CANONICAL
lifecycle: ACTIVE
---

# Implementation Map

Human-readable routing map for implementation ownership.

**ChatGPT Chat operating reality:** this file identifies canonical GitHub `Local` source/knowledge owners for M-Lazy-Developer map checking. Selected `.mcworld` artifacts may come from accessible Google Drive links. Source paths such as `apps/`, `engine/`, `runSelectedMapAudit()` and output schemas describe implementation contracts; they establish execution evidence only when the exact code is invoked. Direct ChatGPT source interpretation is independently valid evidence, not a synthesized `SelectedMapAuditRun` or Minecraft gameplay observation.

This file is intentionally high-level. It is **not** a manually maintained database of every source file or symbol.

Exact implementation lookup follows:

```text
Task / concern
→ Router
→ Resource Catalog
→ ownership.json
→ targeted source lookup
```

Machine-readable ownership and current source win if this overview becomes stale.

## Engine domains

| Concern | Canonical implementation owner |
|---|---|
| Artifact identity / fingerprint | `engine/packages/artifact/` |
| Archive / ZIP safety and deterministic transport | `engine/packages/archive/` |
| Shared dependency-neutral primitives | `engine/packages/common/` |
| Project/workspace/session models | `engine/packages/project-model/` |
| Semantic dependency graph / invalidation | `engine/packages/graph/` |
| Semantic execution/state representation | `engine/packages/semantic-ir/` |
| Parser-independent value/data flow | `engine/packages/dataflow/` |
| Platform knowledge contracts/applicability | `engine/packages/knowledge/` + `engine/knowledge/` |
| Gameplay intent / selected-artifact expected behavior | `engine/packages/gameplay-intent/` |
| Behavioral state/transition/temporal model | `engine/packages/behavior-model/` |
| Compatibility / edition / capability | `engine/packages/compatibility/` |
| Runtime target identity | `engine/packages/runtime-profile/` |
| Diagnostic contracts | `engine/packages/diagnostics/` |
| Diagnostic reasoning / hypotheses / counter-evidence | `engine/packages/diagnostic-reasoning/` |
| Constraint/reachability reasoning | `engine/packages/logic-solver/` |
| Minimum-sufficient analysis planning | `engine/packages/analysis-planner/` |
| Diagnosis execution/reuse | `engine/packages/diagnosis-pipeline/` |
| Repair mutation | `engine/packages/repair/` |
| Preservation contracts/proof | `engine/packages/preservation/` |
| Validation contracts/results | `engine/packages/validation/` |
| Runtime telemetry | `engine/packages/telemetry/` |
| Controlled runtime experiments | `engine/packages/runtime-lab/` + `engine/runtime/` |
| Reliability models/fingerprints/retest | `engine/packages/reliability/` |
| Reliability search/minimization/robustness | `engine/packages/reliability-search/` |
| Repository affected-work planning | `engine/packages/task-graph/` |
| Cross-owner composition / production workflows | `engine/packages/orchestrator/` |
| Approved Bug Report V2 | `engine/packages/bug-report/` |
| Game Design specification | `engine/packages/game-design-spec/` + `engine/design/` |

Canonical package grouping is machine-readable in:

```text
engine/packages/ownership.json
```

## Analyzer domains

| Concern | Canonical analyzer owner |
|---|---|
| File/content discovery | `engine/analyzers/discovery/` |
| Manifest semantics | `engine/analyzers/manifest/` |
| mcfunction parsing | `engine/analyzers/functions/` |
| Command semantics | `engine/analyzers/commands/` |
| Script / TypeScript semantics | `engine/analyzers/scripts/` |
| Dialogue semantics | `engine/analyzers/dialogue/` |
| Entity authored state | `engine/analyzers/entities/` |
| Block definition semantics | `engine/analyzers/blocks/` |
| Resource-pack authored semantics | `engine/analyzers/resource-pack/` |
| Gameplay intent extraction | `engine/analyzers/gameplay-intent/` |
| Reference resolution | `engine/analyzers/references/` |
| Spatial/topology analysis | `engine/analyzers/topology/` |
| Native world DB evidence | `engine/analyzers/world-db/` |
| Derived diagnostics | `engine/analyzers/diagnostics/` |

Canonical grouping:

```text
engine/analyzers/ownership.json
engine/adapters/ownership.json
```

## Data and evidence owners

| Data | Canonical owner |
|---|---|
| Minecraft platform/runtime facts | `engine/knowledge/` |
| Engineering contracts | `engine/contracts/engineering/` |
| Reliability catalogs | `engine/reliability/catalogs/` |
| Frozen evaluation corpus | `engine/reliability/corpus/` |
| Historical execution evidence | `engine/reliability/history/` |
| Regression fixtures | `engine/fixtures/regressions/` |
| Current project continuity | `workspace/projects/` |
| Current Bug Report V2 | `workspace/projects/<project-id>/report/` (or level-scoped report) |
| Current Developer Notes | `workspace/projects/<project-id>/report/developer-notes.json` (or level-scoped report) |
| Work intent | `planning/` |

## Flow-to-owner navigation

A workflow stage is a navigation label, not a second implementation owner. Start with the production flow, then follow the canonical implementation owner and its output contract. Never create a duplicate module or alias to make a stage name match a path.

| Selected-map audit concern | Workflow coordination | Semantic implementation responsibility |
|---|---|---|
| TARGET | `engine/packages/orchestrator/src/map-audit-pipeline.ts` and `map-audit-user-intent.ts` | Selected artifact identity and project-model; current selected artifact is the authority |
| DISCOVERY | `engine/packages/orchestrator/src/inspection/inspect.ts` under the production pipeline | `engine/analyzers/discovery/` plus format-specific adapters and analyzers |
| UNDERSTAND | Production pipeline composes inspection and gameplay evidence | `engine/packages/gameplay-intent/` and relevant authored-source analyzers |
| FORMALIZE | `gameplay-world-model.ts`, `gameplay-scenario-model.ts` and `mandatory-audit-procedure.ts` derive scoped contracts/checkpoint evidence from the same inspection result | `gameplay-intent/` owns inferred purpose; `semantic-ir/` owns source state/execution; `behavior-model/` owns structural transitions; Scenario Graph and Gameplay World Model are derived compositions, never independent source truth |
| EVALUATE | Production pipeline coordinates cross-domain checks | Existing analyzer, diagnosis, and reliability owners according to the specific invariant |
| PROVE | `map-audit-admission.ts`, the audit proof/honesty projections | Canonical evidence and diagnostic owners; no static-to-runtime promotion |
| REPORT | `map-audit-output-v2.ts` and `reporting/report-defect-collector.ts` | `engine/packages/bug-report/` for separately approved bugs |

The table routes investigation; it does not claim that each stage is completely implemented, equate stage output with persisted truth, or override the precise contracts in the Master Selected-Map Audit Workflow and the current source.

For SYSTEM DEVELOPMENT, start from `AGENTS.md` and the owning development skill, locate the first incorrect implementation owner here, fix it in place, and verify the affected consumers. Development is not another Map Audit stage.

### One source, one meaning, one authoritative output

- **One source:** each semantic fact or behavior has one canonical implementation/data owner. An export barrel is an API surface, not a new owner.
- **One meaning:** file and folder names must describe their actual responsibility. If an implementation combines unrelated responsibilities, separate only where an existing owner and consumers prove the boundary.
- **One output authority:** each production workflow has one authoritative result contract. Derived HTML/JSON, report previews, search indexes and compatibility exports are views, not competing output truth.
- **No new aliases:** canonical internal imports go directly to their owning family. Legacy re-export paths are compatibility debt, not acceptable destinations for new imports.
- **Safe retirement:** do not delete compatibility paths until internal, tooling, test, and external/deep-import contracts are accounted for. No mass renaming solely to mirror a user-facing stage.

## Critical selected-map audit entrypoints

These exact source entrypoints are intentionally listed because they define production workflow authority.

| Responsibility | Source owner |
|---|---|
| Production selected-map audit entry, continuation and guarded response admission | `engine/packages/orchestrator/src/map-audit-pipeline.ts` |
| Read-only, bounded model handoff projection | `engine/packages/orchestrator/src/reporting/map-audit-model-handoff.ts` (stable re-export from `map-audit-pipeline.ts`) |
| User intent / pre-audit confirmation | `engine/packages/orchestrator/src/map-audit-user-intent.ts` |
| Ordered stage admission | `engine/packages/orchestrator/src/map-audit-admission.ts` |
| Canonical Map Audit Output V2 schema and projection | `engine/packages/orchestrator/src/map-audit-output-v2.ts` |
| Read-only human-facing audit brief renderer | `engine/packages/orchestrator/src/reporting/map-audit-brief.ts` (stable re-export from `map-audit-output-v2.ts`) |
| Audit obligations | `engine/packages/orchestrator/src/map-audit-obligations.ts` |
| Model-facing bounded task context | `engine/packages/orchestrator/src/map-audit-model-task.ts` |
| Work Session audit projection | `engine/packages/orchestrator/src/workflow/map-audit-work-session.ts` |
| Report candidate collection | `engine/packages/orchestrator/src/reporting/report-defect-collector.ts` |
| Bug review / approval | `engine/packages/bug-report/src/review.ts` |
| Repair admission | `engine/packages/orchestrator/src/repair/repair-admission-pipeline.ts` |

Human workflow owners:

- [Master Selected-Map Audit Workflow](../analysis/master-selected-map-audit-workflow.md)
- [Mandatory Gameplay Audit Procedure](../analysis/mandatory-audit-procedure.md)
- [Bug-Finding Coverage](../analysis/bug-finding-coverage.md)

### Audit coordination files and distinct responsibilities

The following root `map-audit-*.ts` files own the canonical audit contract and decision flow. **Two stable named re-exports are deliberate compatibility exceptions:** `formatSelectedMapAuditBrief` stays importable from `map-audit-output-v2.ts` and `projectSelectedMapAuditModelHandoff` stays importable from `map-audit-pipeline.ts`, while their sole implementations live under `reporting/`. These read-only views are not second audit owners. Navigate by the concern and concrete implementation, not filename similarity.

| Current implementation | Distinct responsibility |
|---|---|
| `map-audit-pipeline.ts` | Single production audit coordination, continuation, model-response validation, review and approved-report handoff; read-only model handoff remains a named compatibility export |
| `map-audit-admission.ts` | Stage order, checkpoint-to-stage mapping and admission decisions |
| `map-audit-authority.ts` | Audit authority token issuance and authority issue assessment |
| `map-audit-issue-projection.ts` | Projection of evidence-backed ready issues and their classification |
| `map-audit-validation-projection.ts` | Projection of issues requiring validation and combined issue views |
| `map-audit-validation-plan.ts` | Grouping of unresolved finding validation tests |
| `map-audit-honesty.ts` | Audit truthfulness and evidence-ceiling assessment |
| `map-audit-quality-gates.ts` | Information-integrity and zero-finding quality gate projection |
| `map-audit-obligations.ts` | Derivation of unfinished audit/model/proof obligations |
| `map-audit-model-task.ts` | Bounded model-facing task/evidence context packets and one canonical model-kind eligibility vocabulary shared with read-only handoff |
| `map-audit-revision.ts` | Revision identity derived from audit inputs |
| `map-audit-output-v2.ts` | Canonical Map Audit V2 types and structured report projection; named compatibility export for the brief |
| `reporting/map-audit-brief.ts` | Sole human-readable brief formatter; read-only view of canonical report, source evidence and existing model tasks |
| `reporting/map-audit-model-handoff.ts` | Sole read-only paginated model handoff projector from canonical `SelectedMapAuditRun`; never admits responses |

These responsibilities may compose each other but must not become independent production entrypoints or separate sources of gameplay truth. Their ownership is backed by current exports/source; this table is navigation guidance, not a new machine registry. Rename, merge or move only if overlapping *behavior* (not similar words or file size) is proven and all consumers can be migrated.

### Selected-source reference and continuation boundaries

- Source locator grammar: `engine/packages/project-model/src/project/source-ref.ts`.
- Typed IR reference selector: `engine/packages/orchestrator/src/workflow/resource-context.ts`.
- Model task and Knowledge context: `engine/packages/orchestrator/src/map-audit-model-task.ts`.
- Optional current-snapshot continuation (no implicit stale task references):
  `engine/packages/orchestrator/src/map-audit-pipeline.ts`.
- Upstream developer ZIP signals: `experiments/developer-practice-signals.json`.
  Its source SHA and report provenance are comparison records, not authority
  for map gameplay.
- External skill/probe refresh (development-side, **not** a map-audit
  stage): `tooling/repository/inspect-developer-upstream.mjs` compares bounded
  user-provided ZIPs read-only; the only durable metadata owner is
  `experiments/developer-practice-signals.json` (`pendingIntake` for
  unreviewed candidates, existing `sourceSnapshot` / `probeSnapshot` /
  `sourceFiles` / `patterns` / `probeEvidence` for active references).
  The operator reviews source/consumers under
  [Developer-Practice Knowledge](../analysis/developer-practice-context.md#upstream-zip-intake-in-chatgpt-chat--candidate-before-promotion);
  `workflow/resource-context.ts` remains the one conditional selector.
  Neither the ZIP nor pending metadata defines an internal agent skill,
  current-map contract, or Minecraft runtime proof.

### Existing governance verifiers — enforcement, not semantic ownership

The existing `tooling/repository/verify-engine-ownership.mjs`
compares the package/analyzer ownership registries with their physical
domains. The current `engine/packages/ownership.json` and
`engine/analyzers/ownership.json` correctly classify the package/domain
directories; they must **not** be extended with individual formatter or
handoff functions. The `orchestrator` package remains the sole module
owner for those internal views.

`tooling/repository/verify-selected-map-audit-entrypoint.mjs`
keeps the one production audit door, guards admission, and checks the
stable named re-exports for the read-only formatter and model handoff
against exactly one implementation each. The handoff and brief must
never implement issue admission, audit mutation or a second public
entrypoint.

`tooling/repository/verify-documentation-ownership.mjs`
keeps documentation in its existing domains and checks ZIP reference
metadata against its single machine snapshot. The source-of-truth
for developer skill identities, original archive SHAs, module/report
inventory and upstream probe statuses is
`experiments/developer-practice-signals.json`. None of these checks
establishes gameplay truth or a verified Minecraft runtime result.

## Knowledge access owners

```text
Router
→ docs/README.md + domain README

Catalog
→ tooling/repository/resource-catalog.mjs

Graph
→ tooling/repository/graph.mjs

Retrieval
→ `engine/packages/analysis-planner/src/retrieval.ts`
→ repository entrypoint: `tooling/repository/retrieve.ts`
→ section ranking: `engine/packages/analysis-planner/src/section-retrieval.ts`
→ repository lexical scoring: `tooling/repository/lexical-retrieval.mjs`

Context
→ `engine/packages/orchestrator/src/workflow/context-compiler.ts` + `resource-context.ts`
```

Catalog and Graph are derived navigation structures. They never replace the source/data owners listed above. The 458 knowledge-to-analyzer/proof declarations (as of the 2026-10-11 Phase D audit) remain in the reliability registry for explicit lookup, but no longer create inferred module-level `USES`/`VALIDATES` edges in the active retrieval Graph. Of those declarations, 375 reference at least one file in the orchestrator package; collapsing those files to one SOURCE module created a large unrelated-fact fanout. These were administrative relationships, not proven analyzer consumption. Keep the direct Knowledge Catalog, content lookup and scoped lexical retrieval; do not promote declaration count to detector coverage or bug-finding recall.

**Seeded retrieval after Phase D:** `retrieveResources()` retains strict explicit-domain searches and empty-text Graph navigation. For a source/owner seed and a nonempty text query with no relevant reachable candidate in the requested class, it may fall back to **scored** structural, lexical and semantic hits without restoring declared analyzer-binding edges. Returned resources remain evidence-navigation candidates, not claims of applicability, gameplay design, or detector recall. Source-only and unsupported-language queries can still miss; ChatGPT should reformulate the question using grounded English Minecraft identifiers/terms and examine actual source content rather than trusting top scores.

## Bounded Knowledge context delivery (ChatGPT + GitHub)

The repository retrieval entrypoint returns ranked Resource IDs and, for each selected
Knowledge fact/relation, an optional **resourceContext** with the exact statement
or subject/relation/object, original catalog applicability, source references,
and provenance. Exact ID lookup also returns the selected Knowledge record.
Only ranked records are hydrated; no duplicate Knowledge store or persistent
search index is created. Other resource classes keep their existing locator
presentation.

The model-facing `compileContextPack()` accepts `resourceSelection` and
`resourceKnowledge` keyed by the **same selected Resource Catalog IDs**.
Unknown/missing contents are visible as `knowledgeContent.status=PARTIAL`;
they cannot silently constitute complete context. Version/edition applicability
is `NOT_EVALUATED` without a selected runtime profile and is not Minecraft
runtime proof. A historical record is a search hint, never gameplay truth.

The exact `retrieve:repository -- --id knowledge.<fact-id>` command can also reveal `bindingDeclaration` with analyzer/proof paths, clearly labeled `REFERENCE_ONLY_NOT_CONSUMPTION_PROOF`. This is a navigation detail, not part of the active ranking graph.

The GitHub connector in ChatGPT **cannot execute this repository CLI**.
In GitHub-only conversations, use the same source authority directly:
pin the exact `Local` commit, route via
`engine/knowledge/ownership.json` or engineering ownership, fetch the
selected JSON catalog from that commit, locate the exact fact/relation ID,
and read its `sourceIds`, `sources` and `applicability`. Do not infer that
a GitHub code-search hit from the default branch represents `Local`.
The CLI's enriched output is a production/source contract for callers that
can actually execute it; it is not a new ChatGPT remote execution capability.

## Gameplay-driven Knowledge lookup

The production `deriveAuditModelTaskPackets()` derives a small
`knowledgeLookup` hint only for packets with scoped subject IDs.
When the canonical audit receives an already-loaded `KnowledgeCatalog`, those
same source-grounded tasks additionally select at most three in-memory
fact/relation references using the **same scorer** as repository retrieval
(`scoreTextDocuments()` in `analysis-planner/src/retrieval.ts`).
The task `retrievedKnowledge` projection preserves original Knowledge IDs,
statement, source IDs/URLs, omitted counts and declared edition applicability.
It has no independent storage or fact authority. Edition match is a *partial
claim scope check*, not version/experiment/API validation and never a bug
proof. Source-unrelated or goal-only tasks do not receive fabricated matches.
The existing `--brief` output displays these references only as investigation
context; the canonical MapAuditOutputV2 schema and issue admission stay intact.

Its query uses the packet's decision question and up to four grounded,
non-hypothetical current-artifact mechanic labels. Unknown/historical-only
subjects are retained in `unresolvedSubjectIds`, not promoted to gameplay
facts or forced into a generic detector category. The hint is **not**
a claim of Knowledge retrieval, applicability, or Minecraft execution.

The existing `retrieveResources()` and repository retrieval CLI can use
this `knowledgeLookup.query` as scoped search text; selected facts/relations
still come from the canonical Resource Catalog and are hydrated only
after selection. Through GitHub-only ChatGPT access, the agent must follow
the equivalent exact-commit ownership/targeted-file retrieval sequence;
there is no claim that the GitHub connector executes repo TypeScript.

The existing `compileResourceContext()` and `compileContextPack()`
accept an optional `targetRuntimeProfile` and use the **existing**
`evaluateKnowledgeApplicabilityV2()` on legacy fact/relation constraints.
Returned state is `applies`, `does-not-apply`, `unknown`,
or `not-evaluated` without a profile. This is a decision relative to the
supplied profile, not proof the profile matches a particular `.mcworld`
or that gameplay behavior occurs. An inapplicable fact remains visible
with its status so it cannot silently supply bug proof.

## Exact lookup rule

Do not expand this document back into a per-symbol or per-file database.

For an exact implementation question:

1. resolve the concern through the appropriate Router;
2. resolve registered resources through the Resource Catalog;
3. inspect the matching machine-readable ownership file;
4. search only the selected owner/module;
5. read the minimum source required to decide the question.

If a responsibility cannot be resolved through this path, fix ownership/routing metadata rather than adding another row of ad-hoc implementation trivia here.