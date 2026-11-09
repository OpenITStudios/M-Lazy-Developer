# IMPROVE SYSTEM Evaluation

Evaluate the skill's decisions with representative tasks; these are scenarios, not claims of automated test execution.

1. **General feature:** a UI feature request routes here, finds the existing UI owner, and accepts a bounded change.
2. **Detector improvement:** a request to improve reusable bug detection belongs to the same IMPROVE SYSTEM skill, not a separate Detection Development work lane.
3. **Map audit:** checking a selected map belongs to TEST MAP without changing engine code.
4. **Insufficient evidence:** an ambiguous failure remains a hypothesis with a named separating check, not a speculative subsystem.
5. **Existing owner:** a source mismatch is repaired where owned, not copied into a new manager.
6. **Proof boundary:** exact-head source verification is not reported as executed runtime proof.
7. **STOP:** a verified Local source commit ends scoped work; neither a ZIP-derived method nor a written test proves TypeScript/Minecraft execution.

## Development Operating Standard scenarios

- **Unstructured prompt:** infer a bounded engineering goal, distinguish user requirements from technical hypotheses, and ask only for a decision-changing ambiguity.
- **Existing feature:** confirm current behavior before adding code; choose no change if already complete.
- **Unused output:** reject new files/functions without a real consumer; check dead paths and stale references after edits.
- **Duplicated architecture:** reuse a canonical owner rather than introducing a parallel manager or registry.
- **Cross-owner change:** check affected consumer and narrowly scoped regression without full-repository refactoring.
- **False claim:** never equate written tests, successful commit, or inferred semantics with executed proof.
- **Scope creep:** an unrelated issue is reported separately rather than silently implemented; STOP once scoped acceptance is reached.

## Matt Pocock method source-review scenarios

These scenarios exercise the existing IMPROVE SYSTEM contract as **manual review expectations**, not model-run scores or additions to the protected `.agents/evals/` corpus. A missing actual run remains NOT EXECUTED.

- **Ambiguous terms:** conflicting meanings for a gameplay term are reconciled against `docs/system/canonical-naming.md` and current semantic source; do not add a second glossary merely to record a synonym.
- **Deep module:** a proposed wrapper over existing graph/analysis code must pass the deletion test and identify concrete callers, responsibilities, evidence boundaries and test seams; otherwise reuse the canonical owner.
- **Failure diagnosis:** an analyzer false-positive request identifies a red-capable source witness or executed reproduction and rival explanations. If execution is unavailable, retain the exact missing proof without claiming red-green success.
- **Two-axis change review:** evaluate Standards and Spec independently for a pinned diff. A compliant source change missing requested downstream behavior must fail the Spec axis; an apparently correct feature violating permission/proof rules must fail Standards.
- **Agent documentation:** a revised root Agent Rule is a short trigger pointing to one canonical procedure; reject duplicated instructions, new active Skills and a default third agent.
- **Selected-map guard:** invoking a Matt Pocock reference while testing a selected `.mcworld` never changes the TEST MAP lane, permits source mutation or turns a static observation into Minecraft runtime proof.
- **Effectiveness:** a baseline/candidate comparison without independent, matching case/receipt evidence cannot establish improved agent behavior. The frozen scored corpus and permission profile remain unchanged.

## Complete repair and naming scenarios

- Several related symptoms share one owner: consolidate the root-cause correction and remove superseded branches after consumer checks instead of stacking independent patches.
- A proposed `SomethingV3` or `FinalManager` duplicates an existing module: revise the canonical owner, preserving existing consumers.
- A Minecraft version or public schema format genuinely changes: retain explicit version identity and require a compatibility or migration rationale rather than blindly removing versioning.
- A narrow patch makes one test pass but leaves downstream behavior inconsistent: do not report completion until the bounded change and consumer checks agree.

## ZIP-derived method / Probe scenarios (not executed tests)

- `skills/bedrock/source-lock.json` preserves publisher skill-folder/module hashes and `requires` relationships; `experiments/developer-practice-signals.json` preserves independently versioned Skills Probe reports. A newer developer ZIP must not relabel an older Probe verdict.
- `bedrock-project-setup`, `bedrock-agent-team`, `bedrock-git-workflow`, `bedrock-testing-policy`, `bedrock-release-export` and `bedrock-game-results` guide only source/proof/approval discipline, not automatic project scaffold, CI, stakeholder rule or release.
- An un-routed technical skill is REFERENCE ONLY without a precise selected-map typed Semantic IR witness. A Probe PASS, FAIL, BLOCKED, PARTIAL or pending status retains its original client, fixture and negative-control boundary.
- BENCHMARK is a separately scoped read-only measurement operation within IMPROVE SYSTEM and never writes frozen expectations or creates a third work lane.

## Clockwork Harness2 experiment — paused 2026-11-10

This is a bounded evidence review of the existing Harness work, not a new
benchmark expectation, audit receipt, checkpoint store, or automatic PASS.

- **Sample:** The Clockwork Vault v1.1.1, selected Google Drive `.mcworld`,
  SHA-256 `e7de6660b71b1126eebb250ec2e1655c0edef6034bca80e9129dc6f86f112634`.
  The selected world is read-only; source findings are not Minecraft runtime
  observations.
- **Pinned baseline:** `Local` at
  `64533d95ef7eb17ca398a8fab3ba4fc73dfa03d5`.
- **Pre-Clockwork candidate:** `Harness` at
  `04ed9554813b6314e9ca51f78126c19b233295bf`.
  Its counterproof receipt validation was stronger on isolated synthetic
  controls; no measured automatic Clockwork discovery gain was established.
- **Clockwork source investigations:** CW-001 (failed reset followed by
  potential arena reuse), CW-002 (failed lobby recovery followed by reset
  request), and CW-003 (completion finalizer shared by reset success/abort)
  are source-level investigation candidates, **not PROVEN gameplay bugs**.
  Mocked JavaScript controls do not establish actual world corruption,
  player stranding, or erroneous final scoring.
- **Applied generalizable detector change:** commit
  `fea1559c3889292bfbc69d4dce4c3b15255ddaa9` introduces
  `abort-and-complete-share-finalizer-candidate` in the existing
  cleanup analyzer and adds source-level regression cases. The evidence
  kind denotes a paired callback investigation lead; it must not imply
  that the shared finalizer ignores the error. An error-gated finalizer
  remains a mandatory negative control.
- **Proof ceiling:** source review and isolated AST/JavaScript probes only.
  Native TypeScript/Vitest, current-map canonical CLI audit, downstream
  evidence consumption, independent scored baseline/candidate map runs,
  and actual Minecraft gameplay were **NOT EXECUTED / NOT VERIFIED**.
- **Resume only on explicit new authorization:** first verify the exact
  source-to-consumer route for the new evidence kind, execute native
  focused tests if available, then compare independent positive,
  negative, and correct-UNKNOWN cases without editing frozen oracles.
  Do not silently promote Clockwork findings into production bug verdicts.

**Disposition:** user requested to stop Harness work here. No further
experiments, source patches, merges, or CI actions are authorized by
this record.
