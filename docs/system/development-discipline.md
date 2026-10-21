---
id: document.system.development-discipline
class: DOCUMENT
domain: system
role: CONTRACT
authority: CANONICAL
lifecycle: ACTIVE
---

# Development Discipline

## Developer ZIP provenance within existing development discipline

The exact developer method/source inventory is owned only by
`experiments/developer-practice-signals.json`. Its
`sourceFiles[].methodology` records come from pinned, user-provided
developer SKILL.md sources. The six
`DEVELOPMENT_WORKFLOW_PROVENANCE` entries provide examples for work
handoff, source change boundaries, version/export contracts and
verification triage—not a parallel source of authority.

Apply useful **principles**, not the external team's workflow literally:
one accountable owner, source-identified work, clear evidence ceiling,
bounded edits, no default microtests, explicit release permission, and
recorded unresolved proof. Do not import the ZIP's Bun/Regolith project,
STATE.md watchdog, database library, install scripts or release
commands into Lazy-Developer as an automatic prerequisite. Existing
GitHub rules, user instructions and canonical semantics prevail.
**If the user defers tests, do not run or claim tests**; still record
source-only verification and the independent proof that remains.

## Development Operating Standard

This is the mandatory behavior contract for every `SYSTEM DEVELOPMENT` task, including Product Development and Detection Development. Before material edits, the selected development skill must apply DOS; citing this document without following its decisions is not compliance. Do not create a second workflow or status owner.

**Current delivery reality: ChatGPT-native checker; no application has been built or verified.** GitHub owns the canonical source and knowledge. A TypeScript module, CLI, UI directory, Node toolchain pin, source commit or authored test is not evidence of a working app, completed map audit or executed gameplay. During development, preserve this distinction in every claim and artifact; do not add infrastructure to compensate for code that has not been executed. Direct ChatGPT inspection of a selected world remains a valid source analysis with its own explicit provenance.

1. **Normalize intent.** Translate informal or disordered user prompts into a bounded goal, observable acceptance, known constraints, non-goals and current mode. Clearly distinguish explicit user requirements from agent interpretation. Ask only when materially different implementations cannot safely be resolved from current context.
2. **Pin and understand context.** Read current `Local` source and nearest owner-specific rules before proposing a fix. Trace the affected consumer and existing design; historical notes are not implementation authority.
3. **Ground claims.** Separate observed source facts, inference, hypothesis and genuinely unresolved evidence. Exhaust relevant accessible evidence before declaring UNKNOWN; never invent API behavior, tests, or Minecraft runtime results. Stronger claims require stronger proof. Explicitly distinguish **ChatGPT artifact examination**, **GitHub source implementation**, **script execution inside ChatGPT**, **actual repository TypeScript execution**, and **live Minecraft observation**. None implies the next; do not label a source contract as an app or `runSelectedMapAudit()` receipt without executing it.
4. **Choose minimum complete solution.** Evaluate no change → remove obsolete code → correct existing owner → reuse → minimal extension → new component only when justified by existing architectural gates. Do not manufacture managers, registries, compatibility layers or parallel execution paths.
5. **Zero waste and modularity.** Every added file, interface, branch, artifact and test must have a real purpose and consumer. Prevent dead code, stale references and duplicated semantic ownership. Keep modules aligned to one responsibility; do not split files just to appear modular.
6. **Naming and hierarchy.** Reuse canonical vocabulary and established paths. Name components for responsibility and behavior, not vague labels (`Smart`, `Universal`, `V2`) or cosmetic novelty. Preserve public IDs where renaming would break consumers unless a migration is authorized.
7. **Execute autonomously within scope.** Finish coherent, bounded units without asking permission for every internal step. Never silently switch mode, modify target artifacts or extend into adjacent features. Group related corrections by root cause, not one speculative patch per symptom.
8. **Build before test proliferation.** During an unfinished architecture/integration build, use source-level consistency review and consumer tracing; do not run repeated unit tests or create new fixtures/verifiers after every small edit. Batch meaningful tests only after the bounded production path is integrated. Make an early exception solely for a concrete high-consequence change where deferral risks data loss, security, irreversible mutation, or broken trusted compatibility. Automatic CI has been explicitly suspended for test-suite pruning on `Local`; evaluate source and consumer contracts without launching workflows and mark any unexecuted source changes NOT EXECUTED. An authored test or source commit alone is never executable PASS.
9. **Complete and stop.** Report actual changed owners, verified outcome and proof ceiling, unverified residue, and confirmed commit. Stop once acceptance is met; do not create a new backlog or continue refactoring merely because more could be done.

**Development preflight:** before editing, be able to answer: What did the user ask? What is inferred? Which owner and consumer are affected? What is the smallest safe change? What evidence would falsify success? What is the STOP condition? If essential facts remain unresolved, investigate or ask one decisive question rather than implementing a guess.

**Development completion review:** inspect whether the intended architecture-to-consumer path is actually wired, whether any obsolete parallel implementation remains, and whether source claims exceed evidence. Do not make completed test counts the primary measure of unfinished architecture. Defer noncritical executable proof explicitly instead of inventing a PASS.

## Architecture-first construction before acceptance

When the user requests architecture completion or explicitly defers testing, use **BUILD** as a working emphasis inside the existing SYSTEM DEVELOPMENT lane, not a new stage, skill, authority, or persisted status machine.

- **Define the macro outcome.** Name the production input, authoritative output, data contracts, canonical owners, consumers and what constitutes a useful end-to-end result. Resolve contradictions at the owner boundary before changing files.
- **Implement a complete vertical path.** Prefer one coherent multi-owner integration that connects ingestion → evidence → semantics → model → operator output. Complete missing wiring and source behavior before expanding edge cases. Do not confuse a large diff with a complete flow.
- **Consolidate rather than stack.** Reuse the existing parser, Semantic IR, Gameplay Intent, graph, orchestration and report contracts. Remove demonstrably duplicated behavior or obsolete branches only after their callers are known. Never add a second coordinator, registry, manager, gate, schema, status ledger or compatibility layer for the same fact.
- **Review source while building.** Review imports, type contracts, provenance, data flow, observable consumers, and irreversible/security-sensitive boundaries. This is engineering review, **not** an executed test or gameplay proof. Record narrow risks without turning each risk into a micro-fixture or standalone verifier.
- **Defer the test campaign.** Do not author, run, rerun or expand tests by default during an explicitly unfinished macro build. Keep existing tests untouched unless a contract is deliberately changed and old expectations are definitively invalid; defer any corresponding acceptance updates to the integration boundary. Exception: a demonstrated critical risk cannot safely be deferred.
- **Open acceptance only at a meaningful integration boundary.** The user-facing production entrypoint must be wired through to a coherent artifact/report, no known duplicate authority must remain in the changed scope, and unknown evidence must be explicit. At that point select a small representative positive/negative/end-to-end set, not exhaustive tests for every implementation detail. If acceptance fails, correct the owning design in a coherent batch rather than repeatedly patching test cases.

These are sequencing decisions, not permission to claim the system is reliable without tests. During BUILD, label executable/runtime acceptance **NOT EXECUTED**; do not publish release-readiness, defect absence, or runtime safety claims. Never delete important tests merely to reduce their count; testing is deferred, not disabled forever. No fixed test-to-code ratio substitutes for the integrated outcome.

## Complete repair and version discipline

- **Repair the root cause as one coherent outcome.** Inspect the affected owner and consumers before modifying source. Consolidate related failures into a bounded change; do not repeatedly add local guards, exception chains, fallback paths, or symptom-specific patches that leave the underlying model inconsistent.
- **Prefer correction over accumulation.** When replacing behavior, remove obsolete code, duplicate implementations, unused helpers, and stale references only when their callers and compatibility needs have been checked. No speculative mass deletion.
- **One owner, one current implementation.** Refactor within the existing canonical module. Add files only for a distinct, demonstrated responsibility with real consumers; avoid scattered fix files and ambiguous layers.
- **No cosmetic version proliferation.** Never create `v2`, `v3`, `new`, `latest`, `final`, or similarly suffixed copies merely to revise a component. Update the canonical owner and use Git history to track iterations.
- **Version only real contracts.** Preserve legitimate Minecraft versions, selected map versions, released product versions, schema versions, compatibility boundaries, and versioned public formats. A new versioned artifact requires an actual compatibility or release contract and migration/consumer plan; renaming identifiers is not a shortcut.
- **Batch by responsibility, not file count.** A complete change may touch multiple necessary files in one logical commit. Do not merge unrelated root causes into a single unreviewable change or demand a separate commit for every small edit.
- **Stop before adding a workaround.** If the next patch cannot be explained by the same proven root cause and a concrete acceptance criterion, reassess the model rather than stacking another workaround.

## SYSTEM DEVELOPMENT execution contract

SYSTEM DEVELOPMENT changes Lazy-Developer itself. It uses the existing Product Development contract, or the existing Detection Development lane when the explicit goal is reusable bug-detection improvement. It never silently becomes MAP BUG AUDIT, Detection Benchmark, or Target Repair.

For a material change follow one bounded sequence:

1. **DEFINE** — state the requested outcome, success metric, scope, non-goals, proof ceiling, and STOP condition.
2. **INVESTIGATE** — pin the current `Local` source, identify the first wrong canonical owner, and distinguish observed failure from inference.
3. **DESIGN** — reuse/remove an existing owner or behavior before introducing new abstraction; select the smallest change that achieves the outcome.
4. **IMPLEMENT** — complete the bounded owner-to-consumer integration, consolidate proven duplicates, and preserve existing tests during BUILD. Make new tests only when acceptance is opened or a concrete critical risk makes deferral unsafe. Keep target map originals immutable.
5. **VERIFY** — during BUILD, verify source contracts and affected consumer paths without initiating a test campaign. At an agreed integration boundary, use the smallest decisive end-to-end/regression evidence. Source review is not executable/runtime proof; unresolved claims remain explicit.
6. **COMMIT & STOP** — publish one valid logical outcome with the repository's commit continuity metadata, confirm the new `Local` HEAD, then stop when the agreed outcome is met.

Do not make each step a separate persisted workflow stage or commit. If work exceeds one bounded unit, commit independently valid outcomes with their remaining proof and next action. An unqualified "continue" retains the current mode and scope.

**Completion means** the requested bounded outcome exists at the canonical owner, the strongest available applicable proof is identified without overclaiming, and the commit is confirmed on the intended ref. If the result depends on unavailable runtime evidence, finish the source-valid portion and state the exact unresolved runtime claim; do not automatically expand scope, claim full runtime success, or require user-local tooling for source decisions.

A map-specific bug encountered during development can supply a regression example, not authority to modify that map or to promote it into a production Bug Report. Conversely, a detection gap discovered during MAP BUG AUDIT requires explicit handoff before any system development.

## Development decision quality

Apply these four decisions within DEFINE → INVESTIGATE → DESIGN → VERIFY. They are reasoning checks, not additional workflow stages or persisted statuses.

1. **Problem classification:** identify whether the request is a verified implementation defect, a missing required capability, an intentional design change, a documentation/contract mismatch, or an unproven hypothesis. A user-reported symptom is evidence to investigate, not proof of root cause. Keep unproven claims explicit.
2. **Root-cause discrimination:** locate the earliest canonical owner whose behavior or contract contradicts the expected result. Compare current source with the requirement and seek one discriminating observation or reduced fixture where ambiguity remains. Fixing downstream output cannot substitute for fixing an upstream incorrect owner.
3. **Solution selection:** compare no change, deletion, correction within the existing owner, reuse of an existing capability, and minimal addition—in that order. Reject parallel registries, generic managers, speculative fallbacks, and changes that do not address the established cause. Record why a new abstraction is necessary if selected.
4. **Completion discipline:** accept only the originally scoped observable outcome with matching proof; inspect affected downstream consumers and regressions. Distinguish implementation present, source verified, executable verified, and Minecraft runtime verified. Do not convert an unrelated failure, unresolved runtime claim, or future improvement opportunity into automatic scope expansion.

When evidence is insufficient, state the **exact undecided claim**, what current evidence says, and the **minimum next evidence** that would distinguish alternatives. UNKNOWN is not automatically a bug, a development request, or permission for a new subsystem.

## Recommendation maturity and verification economy

Before recommending implementation, establish the actual user outcome, source evidence, responsible owner, affected consumers, simpler alternatives, risks, acceptance criteria and STOP boundary. Distinguish observed findings from hypotheses. If a decision-changing assumption remains unverified, investigate before presenting the solution as ready. Experiments may gather evidence but are not production recommendations.

Scale verification to a complete integrated outcome, consequence and uncertainty—not edit count. Under an explicit BUILD-first instruction, do not run tests or generate fixtures for partial subsystems merely because a source change was committed. Prefer existing acceptance cases when the production path is ready. Add enduring cases only for distinct, demonstrated failure families; a new standalone test runner or verifier needs a recurring consumer. Keep narrow early review for security, data integrity, permissions and irreversible mutation. Full Verify is push-triggered on `Local` by user authorization; it provides integration evidence but is not a prerequisite for independent source-level work.

## Minimum complete change

Default order:

```text
No change required?
→ delete unnecessary path?
→ reuse current owner/path?
→ use native/existing dependency?
→ smallest complete addition
→ new abstraction/system only after repeated responsibility is proven
```

Quality is not measured by code volume, abstraction count, tool count, or architectural novelty.

## Evidence gate

For non-trivial mutation:

```text
symptom/requested outcome
→ current evidence
→ failure classification
→ first wrong owner
→ smallest complete change
→ matching proof
→ STOP
```

`UNKNOWN` is valid only when the next separating evidence is named.

## Ownership rules

- one responsibility → one canonical owner;
- one persisted fact → one authority;
- one behavior → one primary execution path;
- adapters are adapters, not semantic managers;
- interfaces present/orchestrate, not duplicate core truth;
- derived caches are rebuildable;
- compatibility fallbacks require evidence;
- generic registries/managers are not default architecture.

## New abstraction gate

Create a new abstraction only when at least one is true:

1. a repeated responsibility already exists in multiple real owners;
2. a trust/security boundary requires isolation;
3. a stable external protocol/format boundary requires adaptation;
4. measurable hot-path performance requires a specialized representation.

Do not create abstractions for hypothetical reuse.

## Efficiency

Optimize cost to accepted result, not static line count.

Prefer:

- incremental indexing;
- change-scoped invalidation;
- content-addressed identity;
- selective parsing;
- bounded evidence;
- typed transformations;
- deterministic fixtures.

Do not sacrifice validation, recoverability, security, data-loss prevention, or explicit user requirements merely to reduce code.

## Product focus — map design before checker expansion

The decisive M-Lazy-Developer outcome is **correctly reconstructing the selected map's authored gameplay** and **reporting material discrepancies/bugs with appropriate proof**, as defined in `docs/product/flow.md`. More rules, validation gates, candidate families, dashboards, schemas, or infrastructure are not progress unless they improve that outcome.

For future SYSTEM DEVELOPMENT decisions:

- **Start with real-map output, not a wished-for detector.** Inspect a pinned selected artifact and its game-design interpretation: player objective, phase transitions, actors, progression, ownership, failure/retry, and player-facing capability. State the concrete mechanic or contradiction the current approach missed or falsely asserted.
- **Find the first wrong existing owner.** Is evidence missing from DISCOVERY, incorrectly joined in UNDERSTAND, misinterpreted in FORMALIZE, prematurely promoted by PROVE, or concealed by REPORT? Reuse and correct that owner and its actual consumer. If the existing ChatGPT source review already answers the question with honest uncertainty, no code change is required.
- **Evaluate against decisions, not internal coverage counts.** A useful improvement reconstructs a real mechanic more faithfully, finds a defensible issue missed before, rejects a false positive, or gives a more actionable Expected/Actual and proof boundary. Compare source-backed positives, intentional designs/negative cases, and explicit UNKNOWNs. Do not optimize for raw issue count or a fabricated precision score.
- **No checker proliferation.** Add/extend a detector or validation rule only for a demonstrated, material, generalizable failure that the current owner cannot resolve more simply. Do not create a new test, benchmark, receipt or coverage layer just to validate another layer. Existing proof protection stays in place; its expansion requires a specific decision it will change.
- **Stop at useful output.** A bounded source-backed map-design explanation plus correctly classified findings and exact material unknowns is more valuable than exhaustive unrelated validations. Retain final-report admission and safety rules, but do not present inability to certify every runtime behavior as inability to understand any gameplay.

For the next acceptance boundary, compare the existing selected-source Defense v1.1.5 and Fall of the Pillager L1 v1.1.0 reviews (different script styles and gameplay), then one independently inspected contrasting map when accessible. Use their actual evidence and negative controls; do not manufacture an executed TypeScript audit or promote historical QA. Fix only the first demonstrable generalized gap and reassess the human-usable outcome.

## User-value gate

Before adding a new subsystem, proof layer, registry, workflow state, dashboard, or candidate family, answer:

```text
Which real repeated failure does this remove?
Why can the current owner not solve it?
What user-visible result improves?
How will we know it helped?
```

If those answers are not grounded in repeated evidence, do not add the abstraction.

For M-Bedrock bug finding, discovery breadth and correct classification take priority over additional repair/report infrastructure until real-map evidence proves otherwise.