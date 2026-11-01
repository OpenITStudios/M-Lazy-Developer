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
for an example.

Each test has one evidence-reviewed **primary** `functionalArea`/`featureId`.
Optional `mechanicTags` identify secondary topics without promoting them into
another primary owner. `--list-areas` includes every declared area, including
areas with zero primary test files; `--show-area <area>` distinguishes a
declared-but-empty area from a misspelled/unknown area. Look up secondary cases
via `--list-mechanics` and `--show-mechanic <tag>`. Do not fill an empty
area by reclassifying unrelated suites or by adding placeholder tests.
Similar fixtures used at analyzer and Orchestrator layers can cover distinct
producer and consumer contracts; overlap alone does not authorize deletion.
Classified source tests, selected lanes and historical consolidation metadata
are not executed test or Minecraft gameplay results.
