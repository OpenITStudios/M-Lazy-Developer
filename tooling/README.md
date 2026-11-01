# Tooling

Repository-owned developer/build/verification control plane.

```text
tooling/
├─ repository/           repository structure, dependency, ownership and API verification
├─ windows-toolchain/    normal Windows developer routing behind DEV.cmd
├─ bug-report-documents/ report document rendering/build support
└─ bug-report-ui/        Vite/GitHub persistence support for the report UI
```

`DEV.cmd` is the sole root developer entrypoint.

Tooling may invoke canonical owners but must not duplicate Bedrock semantics. `ownership.json` records the canonical tooling partition.

## Test navigation

`tooling/repository/test-inventory.json` is the single registry of physical
source-test paths and source-pinned functional categories, features and execution
lanes. The existing `run-tests.mjs` consumes that inventory; there is no
second domain/test inventory or runner.

Implementation ownership follows `engine/<package-or-analyzer>/src/` and
matching `test/` families where present. **Functional area** describes covered
gameplay/engineering behavior across packages; **lane** describes test selection.
Neither is an alternate implementation owner. See the
[Orchestrator test layout](../engine/packages/orchestrator/README.md#test-layout-and-functional-domains)
for an example. Classified source tests are not executed test results.
