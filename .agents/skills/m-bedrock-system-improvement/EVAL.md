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
