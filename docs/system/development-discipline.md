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

## Publisher-aligned updates without changing the product identity

When Bedrock skills or Skills Probe change, treat them as **independent
upstream revisions**. Follow native `skills.json` / folder hashes,
`module.json` / `requires`, source/lock identity, and the Skills Probe
target/example/report protocol. Pin exact original source/ZIP identities,
review only changed source/consumer meaning, and preserve negative cases,
unknown engine statuses and client/version scope. A new skill or an upstream
PASS is not permission to manufacture a new detector, new work lane or
Minecraft fact. Never copy upstream scripts or team-specific instructions
as global policy.

The sole intake/review owners are
`skills/bedrock/README.md` (native release identities) and
`experiments/developer-practice-signals.json` (curated reference and
probe-example/report metadata). The one selected-map consumer is
`engine/packages/orchestrator/src/workflow/resource-context.ts`.
A source refresh is **IMPROVE SYSTEM**, not a separate map-audit
checkpoint. Build/verify the smallest complete changed source-to-consumer
path before starting test proliferation; preserve the suspended CI policy.

## Development Operating Standard

This is the mandatory behavior contract for every `IMPROVE SYSTEM` task, including Product Development and Detection Development. Before material edits, the selected development skill must apply DOS; citing this document without following its decisions is not compliance. Do not create a second workflow or status owner.

**Current product workflow: Minecraft map checking inside ChatGPT Chat, using selected Google Drive `.mcworld` evidence and canonical GitHub `Local` source/knowledge.** TypeScript modules, CLI/report-interface sources, Node metadata, commits and authored tests are source artifacts, not completed engine-audit or Minecraft-runtime evidence. During development preserve the actual proof tier; do not add infrastructure just to suggest an unobserved capability. Direct ChatGPT inspection of a selected world remains valid source analysis with explicit provenance.

1. **Normalize intent.** Translate informal or disordered user prompts into a bounded goal, observable acceptance, known constraints, non-goals and current mode. Clearly distinguish explicit user requirements from agent interpretation. Ask only when materially different implementations cannot safely be resolved from current context.
2. **Pin and understand context.** Read current `Local` source and nearest owner-specific rules before proposing a fix. Trace the affected consumer and existing design; historical notes are not implementation authority.
3. **Ground claims.** Separate observed source facts, inference, hypothesis and genuinely unresolved evidence. Exhaust relevant accessible evidence before declaring UNKNOWN; never invent API behavior, tests, or Minecraft runtime results. Stronger claims require stronger proof. Explicitly distinguish **ChatGPT artifact examination**, **GitHub source implementation**, **script execution inside ChatGPT**, **actual repository TypeScript execution**, and **live Minecraft observation**. None implies the next; do not describe a source contract as an executed `runSelectedMapAudit()` receipt.
4. **Choose minimum complete solution.** Evaluate no change → remove obsolete code → correct existing owner → reuse → minimal extension → new component only when justified by existing architectural gates. Do not manufacture managers, registries, compatibility layers or parallel execution paths.
5. **Zero waste and modularity.** Every added file, interface, branch, artifact and test must have a real purpose and consumer. Prevent dead code, stale references and duplicated semantic ownership. Keep modules aligned to one responsibility; do not split files just to appear modular.
6. **Naming and hierarchy.** Reuse canonical vocabulary and established paths. Name components for responsibility and behavior, not vague labels (`Smart`, `Universal`, `V2`) or cosmetic novelty. Preserve public IDs where renaming would break consumers unless a migration is authorized.
7. **Execute autonomously within scope.** Finish coherent, bounded units without asking permission for every internal step. Never silently switch mode, modify target artifacts or extend into adjacent features. Group related corrections by root cause, not one speculative patch per symptom.
8. **Build before test proliferation.** During an unfinished architecture/integration build, use source-level consistency review and consumer tracing; do not run repeated unit tests or create new fixtures/verifiers after every small edit. Batch meaningful tests only after the bounded production path is integrated. Make an early exception solely for a concrete high-consequence change where deferral risks data loss, security, irreversible mutation, or broken trusted compatibility. Automatic CI has been explicitly suspended for test-suite pruning on `Local`; evaluate source and consumer contracts without launching workflows and mark any unexecuted source changes NOT EXECUTED. An authored test or source commit alone is never executable PASS.
9. **Complete and stop.** Report actual changed owners, verified outcome and proof ceiling, unverified residue, and confirmed commit. Stop once acceptance is met; do not create a new backlog or continue refactoring merely because more could be done.

**Development preflight:** before editing, be able to answer: What did the user ask? What is inferred? Which owner and consumer are affected? What is the smallest safe change? What evidence would falsify success? What is the STOP condition? If essential facts remain unresolved, investigate or ask one decisive question rather than implementing a guess.

**Development completion review:** inspect whether the intended architecture-to-consumer path is actually wired, whether any obsolete parallel implementation remains, and whether source claims exceed evidence. Do not make completed test counts the primary measure of unfinished architecture. Defer noncritical executable proof explicitly instead of inventing a PASS.

## Evidence-contrast improvement (Harness2 method adapted to ChatGPT)

This is a method within existing IMPROVE SYSTEM, not a new agent, skill,
database, or replacement for Bedrock semantic analysis. Inspired by
[google-research/harness2](https://github.com/google-research/harness2)
(main SHA `6868817518876de8fd170c6a8354daca273b6191`).

For recurring failures, follow **Propose → Probe → Compose → Reflect**:

1. **Baseline:** pin `Local` SHA, the first wrong canonical owner, exact
   input/evidence identity, source-reproducible symptom and proof ceiling.
2. **Propose:** contrast a general workflow/tool correction with a
   Bedrock-semantic correction where relevant. Isolate one variable when
   feasible, avoid repeated proposals once a deterministic fix is known,
   and never hardcode a sampled map or edit frozen expectations to pass.
3. **Probe:** replay against the SAME source, expected contract and negative
   control. Compare actual differences in execution, cost, failure, or
   delivered artifact. Source review alone must be labeled STATIC REVIEW,
   not observed runtime improvement; record missing proof.
4. **Compose:** choose only a candidate with evidence of improvement and
   no weaker source ownership, provenance, audit admission, permissions or
   uncertainty handling. Conflicting/unsupported candidates remain open.
   Do not use majority vote or AI confidence as evidence.
5. **Reflect once:** classify each change `helped`, `hurt`,
   `no observed effect` or `confounded` and cite the contrasting
   observation. Adopt at most one generalizable lesson only if isolated
   evidence supports it; otherwise record `NO EVIDENCE-SUPPORTED LESSON`.
   Persist rules with their EXISTING owner and material decision/proof
   in the same Git commit, not a parallel experience registry.

The existing `score:agent-eval` scorer can accept an **optional
second, read-only contrasts input** and a third receipt directory
(`node tooling/repository/score-agent-eval.mjs
<runs.json> <contrasts.json> <receipt-directory>`). This avoids changing the separately protected
canonical `.agents/schemas/agent-eval-runs.schema.json`. The paired input
contract lives only at `tooling/repository/agent-eval-contrasts.schema.json`.
It references baseline/candidate `runId` values in the unchanged run
payload and supplies matching exact task `inputFingerprint`, unique
`executionEvidenceSha256`, `executionStatus`, and candidate/baseline
`harnessFingerprint` under `runEvidence`. Each entry must also name
`receiptFile`, a bounded direct-child JSON file in the explicitly selected
directory. The existing scorer now opens these files read-only, rejects
symlinks/unsafe names and oversized files, verifies actual SHA-256 bytes,
and compares `agent-eval-execution-receipt` run, case, model, input,
harness, executed status, and recorded observations against the canonical
agent-eval run. Any absent or mismatched receipt is `confounded`, never
`helped`, even when the sidecar declares a plausible 64-character hash. Each pair must use the same
frozen `caseId` and model; each harness must retain its content identity
across comparison pairs. At least two independent pairs and exactly one
changed component are needed for an observational component verdict.

The scorer uses the existing frozen skill routing/procedure expectations
to count declared correctness, never a model-authored PASS. A missing or
reused receipt, mismatched task, multiple changed components, incomplete
assertions, or inconsistent results is `confounded`; equal quality is
`no observed effect`. Latency/token deltas remain informational, not
substitutes for quality or unobserved proof. A proposed reusable lesson
requires improvement across two distinct evaluation cases and remains
`REVIEWABLE_CANDIDATE_NOT_ADOPTED` because matching receipt bytes still do
not prove who produced them, that an executor actually ran, or that the
edited harness caused the observed change. A hash verifies integrity
relative to the supplied digest, not authenticity or independent execution
attestation. Do not
persist a lesson automatically or promote agent-routing metrics into
Minecraft audit accuracy. Actual adoption still needs owner review and
independent frozen benchmark/negative controls.

The **same existing benchmark scorer** also accepts
`node .agents/skills/m-bedrock-system-improvement/references/benchmark/scripts/score-benchmark.mjs
--compare <comparison.json>` for post-execution source-claim comparisons.
The ephemeral input is
`{schemaVersion:1,policy:"selected-map-frozen-outcome-comparison",
baselineSourceCommit:"<40-hex-baseline-SHA>",
candidateSourceCommit:"<40-hex-candidate-SHA>",
pairs:[{id,baselineResultFile,candidateResultFile},...]}`.
The distinct source commits are pinned **once for the whole experiment**:
EVERY baseline/candidate CLI receipt must match its respective manifest
commit across all artifacts. Mixed candidate versions, mixed baselines and
role swaps fail closed rather than pooling unrelated evidence. Commit equality
proves only source identity, not the substantive one-component harness diff,
operator independence or causal effect; those still require separate review.
At least two independent selected-artifact SHA-256 identities are needed.
Each pair must use byte-identical independently frozen claims, distinct
frozen canonical source observations, and positive + negative controls. A canonical CLI receipt's
`auditRevision` MUST exactly match the revision in its observed JSON;
freezing and the scorer both reject mismatched revisions. For claimed
source improvements, changing only `auditRevision` (metadata) cannot
establish a distinct material audit observation, even if a reviewer
relabels claims. Exact report-byte digests remain independently checked.
The existing per-claim full-map scorer validates both outcomes first;
no metrics-only reduced-fixture result can be promoted to map accuracy.
Regression of any negative control, false positive, positive miss, or
correct-UNKNOWN behavior retains the baseline. A candidate improving at
least two independent cases with no regressions is only
`CANDIDATE_ELIGIBLE_FOR_INDEPENDENT_REVIEW`, never automatically selected,
applied to the Git source, or treated as Minecraft gameplay proof.
The comparator is a **Probe → Compose review gate**, not a rollout
executor or end-to-end Propose–Probe–Compose engine. Neither the generated
source observations nor reviewer-declared decisions are independently
attested by their own SHA/metadata. Keep frozen acceptance oracle data
hidden from any proposer; do not learn from blind evaluation labels.
Current real-map audit corpus is empty, so no fresh measured real-map
benefit is claimed.

**Actual canonical CLI receipt chain for matched experiments:** invoke the
EXISTING `apps/cli/src/audit.ts` with one read-only selected map,
`--expected-sha256 <artifact-sha256>`, `--expected-source-sha
<exact-local-commit>` and `--execution-receipt <outside-source-scratch.json>`.
Use the default full canonical JSON output, retaining stdout and exit 2
(`BLOCKED` is a valid incomplete report). This optional mode refuses
model responses, prior handoff snapshots, brief/HTML/compact/gzip views
and any output path inside the verified source package. It first executes
the canonical audit, then exclusively creates an immutable scratch
receipt binding source commit, selected map SHA-256, audit revision, status,
exit code and canonical output byte SHA-256. The existing portable-source
manifest is checked before loading or invoking the engine; a freshly
invented JSON shape alone cannot produce this CLI-side record.

The optional `--execution-output <new-canonical-json>` used with
`--execution-receipt <new-receipt-json>` captures both outputs in the SAME
CLI invocation as distinct, exclusively-created files in the same canonical
scratch directory outside the verified portable source tree. The CLI still
emits unchanged canonical JSON on stdout and preserves BLOCKED exit 2.
The receipt records the sibling canonical JSON filename and output hash;
a write failure leaves no admissible matched receipt/report pair. Do not
interpret a partially written scratch output or an operator's redirected
stdout as a successful verified probe.

Next call the EXISTING `freeze-observed-map-audit.mjs` with
`<artifact.mcworld> <canonical-stdout.json> <frozen-output.json>
<cli-execution-receipt.json>`. The freezer checks actual selected archive
bytes, raw output SHA-256 and receipt identity, including the captured
sibling report when present. It creates only a NEW scratch file outside the verified source tree (no
overwrites of a map, canonical report, receipt or earlier freeze) and uses the receipt's
verified source commit instead of `git rev-parse HEAD` (portable snapshots
have no `.git`). The existing `score-benchmark.mjs --compare` now
requires a bound receipt in BOTH frozen observations, different source
commits for baseline versus candidate, exact manifest-pinned source commits
consistent across every compared case, and SHA-256 agreement with each
reconstructed canonical JSON report. Legacy single-report scoring/freezing
remain supported but unreceipted reports are not eligible for paired
candidate review. Do not infer end-to-end executor authenticity or
independence from a hash: the byte source package, CLI invocation and
reviewer are still only proven to the strongest level actually observed.

**Operator-run blind selection (existing benchmark helpers):** the old
`references/benchmark/scripts/blind-compare.mjs` now calls the **same
canonical `score-benchmark.mjs --compare`** internally. It no longer
accepts two arbitrary scored JSON files, and never trusts direct TP/FP
numbers from a candidate. After individually running a pinned baseline
and a proposed variant through the existing canonical map-audit entrypoint
on the same selected read-only artifact, freeze their independent outputs,
lock the positive/negative claims with a separate reviewer, then assemble
the existing `--compare` manifest. Do **not** run acceptance cases in a
proposer's view or expose frozen expectation labels to a candidate.

The comparison operator keeps a private high-entropy (24+ printable
character) key and runs
`node .agents/skills/m-bedrock-system-improvement/references/benchmark/scripts/blind-compare.mjs --blind <comparison.json> <private-key>`.
Only the anonymized A/B counts and a `sessionId` may be given to a
reviewer; withhold the manifest, key and execution trajectory until their
choice is recorded. A separate operator then runs
`blind-compare.mjs --reveal <comparison.json> <same-key> <A|B|KEEP_BASELINE>
<sessionId>`. Unblinding rescans the same per-claim oracle and refuses
changed manifests/scores/keys; a false-positive or missing evidence still
forces `KEEP_BASELINE`. The only favorable outcome is
`CANDIDATE_ELIGIBLE_FOR_INDEPENDENT_REVIEW`: human source review and a
separately approved Git commit are still required. The script does not
invoke a map engine, mutate source, store secrets or learn rules.

This is **blind to the reviewer only if the operator actually withholds**
the private key, comparison manifest, and candidate identity. A local
command-line key is not protected from process-history access, and a
same-person ChatGPT operator/reviewer cannot claim independent blindness.
The system does not attest executor provenance, measured generalization to
unseen maps or fully automatic recursive harness updates. Until actual
matched rollouts and outside review exist, report this as an integrated
selection protocol with `NOT EXECUTED` evidence, not a successful PPC run.

Do not import upstream Python executors, unrestricted networks, default
4k rollouts, automatic prompt mutation or benchmark score authority.
ChatGPT Chat remains the operator; TEST MAP and its canonical proof gates
retain authority. Never reactivate CI as part of this method.

## Architecture-first construction before acceptance

When the user requests architecture completion or explicitly defers testing, use **BUILD** as a working emphasis inside the existing IMPROVE SYSTEM lane, not a new stage, skill, authority, or persisted status machine.

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

## IMPROVE SYSTEM execution contract

IMPROVE SYSTEM is the only development skill
(`.agents/skills/m-bedrock-system-improvement/SKILL.md`) for architecture,
source, engine, detection, native Skills/Probe updates, benchmark and
maintenance. Product and detection development are **concerns**, not
separate work lanes. A bounded frozen benchmark is a read-only measuring
operation inside IMPROVE SYSTEM. TEST MAP is the other skill and may
not edit engine source during an audit. Approved target repair is an
optional explicit working-copy operation in TEST MAP, not a separate
automatic lane. These scopes never silently switch.

For a material change follow one bounded sequence:

1. **DEFINE** — state the requested outcome, success metric, scope, non-goals, proof ceiling, and STOP condition.
2. **INVESTIGATE** — pin the current `Local` source, identify the first wrong canonical owner, and distinguish observed failure from inference.
3. **DESIGN** — reuse/remove an existing owner or behavior before introducing new abstraction; select the smallest change that achieves the outcome.
4. **IMPLEMENT** — complete the bounded owner-to-consumer integration, consolidate proven duplicates, and preserve existing tests during BUILD. Make new tests only when acceptance is opened or a concrete critical risk makes deferral unsafe. Keep target map originals immutable.
5. **VERIFY** — during BUILD, verify source contracts and affected consumer paths without initiating a test campaign. At an agreed integration boundary, use the smallest decisive end-to-end/regression evidence. Source review is not executable/runtime proof; unresolved claims remain explicit.
6. **COMMIT & STOP** — publish one valid logical outcome with the repository's commit continuity metadata, confirm the new `Local` HEAD, then stop when the agreed outcome is met.

Do not make each step a separate persisted workflow stage or commit. If work exceeds one bounded unit, commit independently valid outcomes with their remaining proof and next action. An unqualified "continue" retains the current mode and scope.

**Completion means** the requested bounded outcome exists at the canonical owner, the strongest available applicable proof is identified without overclaiming, and the commit is confirmed on the intended ref. If the result depends on unavailable runtime evidence, finish the source-valid portion and state the exact unresolved runtime claim; do not automatically expand scope, claim full runtime success, or require user-local tooling for source decisions.

A map-specific bug encountered during development can supply a regression example, not authority to modify that map or to promote it into a production Bug Report. Conversely, a capability gap discovered during TEST MAP requires explicit user handoff before IMPROVE SYSTEM changes source.

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

For future IMPROVE SYSTEM decisions:

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
