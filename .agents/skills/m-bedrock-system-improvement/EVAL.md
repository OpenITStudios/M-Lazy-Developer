# Product Development Evaluation

Evaluate the skill's decisions with representative tasks; these are scenarios, not claims of automated test execution.

1. **General feature:** a UI feature request routes here, finds the existing UI owner, and accepts a bounded change.
2. **Detector improvement:** a request to improve bug-finding accuracy routes instead to Detection Development.
3. **Map audit:** a request to discover map bugs routes to Map Bug Audit without changing engine code.
4. **Insufficient evidence:** an ambiguous failure remains a hypothesis with a named separating check, not a speculative subsystem.
5. **Existing owner:** a source mismatch is repaired where owned, not copied into a new manager.
6. **Proof boundary:** exact-head source verification is not reported as executed runtime proof.
7. **STOP:** an accepted commit ends the work; no automatic expansion or mode switching.

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
