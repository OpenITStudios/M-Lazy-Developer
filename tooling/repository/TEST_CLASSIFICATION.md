# Source Test Inventory — Lean Core

## Active scope — 31 October 2026

**Target:** approximately 100 physical source test files without repeatedly
adding micro-tests, suite-consolidation wrappers, fixtures or runners.

**Result on pinned `Local` parent `e7f391141f829d3b094e40dd9a164f6a3ba60122`:** **401 → 120** physical
test files. Exactly **281 test files were deleted**, including their cases
and assertions. They were **not** moved into larger suites or replaced with
new test layers. The exact active list and metadata live only in
[`test-inventory.json`](./test-inventory.json); Git history retains the
pre-pruning code without another maintained archive.

| Lane | Before | Retained | Deleted |
| --- | ---: | ---: | ---: |
| Development | 240 | 78 | 162 |
| Safety | 46 | 20 | 26 |
| Runtime | 50 | 5 | 45 |
| Regression | 45 | 9 | 36 |
| Acceptance | 20 | 8 | 12 |
| **Total** | **401** | **120** | **281** |

### Retention decisions

- **100 core paths:** the union of canonical capability-proof paths,
  knowledge-detector proof paths, default acceptance selectors and native
  test runners. Every existing one of the **55 capability bindings** and
  **458 knowledge-detector bindings** keeps its declared source proof path.
- **20 additional critical paths:** source-specific repair authorization,
  approval/admission, working-copy mutation safety, preservation, repair
  evidence lineage, post-repair proof, package verification, runtime
  experimental authority, multi-client evidence, regression-proof refusal,
  and selected-map proof saturation/admission.
- **281 removed paths:** all other unbound/nondefault source tests. This
  is **intentional breadth reduction**, not full source-consumer proof that
  those tests were redundant or that their unique negative cases are
  covered elsewhere. The retained selection protects named core boundaries;
  it cannot establish full regression-equivalence with the old suite.

### Evidence boundary

This reduction was constructed from exact GitHub source-tree paths,
canonical test inventory, runner entrypoints, and proof binding references.
All remaining source test paths and binding paths must exist. The
Capability Truth Index is a *derived structural projection*; a registered
test path is not an executed or passing test.

**NOT EXECUTED:** TypeScript, Vitest, `runSelectedMapAudit()`, selected
`.mcworld`, and actual Minecraft gameplay. Runtime speedup, assertion
equivalence, recall, false-negative rate and release readiness are
**UNKNOWN**. In particular, deleting 26 Safety and 45 Runtime suites
reduces future regression-detection opportunity; never claim unchanged
safety or bug-finding performance from the lower file count.

### Execution and scope

The normal test selector retains its original ten Vitest suites and
one native Node acceptance entrypoint. All three native test paths
remain. Full and focused test selection continue to use the *existing*
`tooling/repository/run-tests.mjs` owner; automatic GitHub CI remains
suspended. No new scheduler, gate, management file, test data store,
fixture, or fallback test pipeline was created.

Source repository tests are separate from per-map audit scenarios.
Minecraft selected-map analysis still follows
[Bug-Finding Coverage](../../docs/analysis/bug-finding-coverage.md)
and the [Mandatory Audit Procedure](../../docs/analysis/mandatory-audit-procedure.md);
pruning repository tests does not waive current-map proof obligations.

### Maintenance

Prefer production code review and existing core tests for an owner-local
change. Add or restore a specific test only for a demonstrated new
high-consequence failure or a proven gap in the retained core; avoid
one-microtest-per-case work and no arbitrary file-count campaigns.
Use Git history for prior test source rather than copying it into a
shadow test archive. A future source test reduction is not equivalent
unless its complete consumer, positive/negative behavior and proof
boundary are independently established.

The older 687 → 402 → 401 consolidation history remains in Git;
historical counts must not override this active registry.
