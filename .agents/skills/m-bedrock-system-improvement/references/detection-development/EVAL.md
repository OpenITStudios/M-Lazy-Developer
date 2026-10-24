# Eval Contract

Evaluate whether Detection Development:
- triggers for false-positive/false-negative/detection-gap prompts;
- does not trigger for generic Product Development;
- changes engine but not target artifacts;
- fixes the first missing reusable owner;
- avoids seed-specific logic;
- freezes expectations before benchmark output;
- hands off to Detection Benchmark rather than declaring success from implementation alone.

## Discovery decision scenarios

- A selected artifact contains a material gameplay mechanic not represented by current semantics: the skill identifies the first missing owner rather than declaring Discovery complete from indexed files alone.
- An unresolved operation has a relevant existing evidence path: the skill searches that path before accepting UNKNOWN; if inaccessible, it names the precise blockage.
- A positive ownership example and a same-name/different-owner counterexample produce different decisions, not unconditional isolated or unconditional UNKNOWN.
- Arena instance count differs from requested/safe concurrency: the skill keeps all three meanings separate through consumers.
- SourceRef matches artifact/file but not a proving statement: the skill does not treat location as semantic proof.
- The source fix changes one layer but its consumer still reports COMPLETE incorrectly: the skill requires end-to-end propagation and regression acceptance before completion.
- Static verification without test execution is reported as source-verified only; CI remains optional, not a mandatory development gate.

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
