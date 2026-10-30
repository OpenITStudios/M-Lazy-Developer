---
id: document.system.development-operations
class: DOCUMENT
domain: system
role: GUIDE
authority: CANONICAL
lifecycle: ACTIVE
---

# Development Operations

## Remote GitHub operating mode

The primary source-development context is **REMOTE_GITHUB**, operated from **ChatGPT Chat**. The user provides an accessible Google Drive `.mcworld` map for inspection; GitHub `Local` stores canonical code, knowledge, commits and continuity. ChatGPT source examination is available independently of repository TypeScript execution.

For M-Lazy-Developer, **`Local` is the remote GitHub branch**, never a user-PC directory. The user's interface is **ChatGPT Chat**; connected Google Drive supplies the selected map, and GitHub `Local` holds source/commits. Never route verification to ChatGPT Work, the user's PC, an external compute service or a required manual pipeline. If executable or Minecraft-runtime evidence is unavailable, state only the exact `UNKNOWN / NOT EXECUTED` residue and finish independently source-verifiable work under `GITHUB_RULES.md#41-chatgpt-no-local-pc-invariant`.

```text
GitHub ref / exact source
→ identify canonical owner
→ minimum source reads
→ diagnose first wrong owner
→ bounded repository mutation
→ exact-head source/static verification
→ explicit higher-context residue only when inherently required
→ STOP
```

A local checkout, Node installation, npm install, `npm run check`, Vitest, TypeScript execution, or `DEV.cmd` is **not required** for direct ChatGPT Minecraft checking or to complete normal remote repository work. Do not frame missing optional Node/npm dependencies as a blocker for archive, scripts, functions, NBT, LevelDB, structures, and source-reasoning checks accessible through actual ChatGPT tools.

Remote completion must state its proof ceiling honestly. Source/static claims may close remotely. Claims about compiler execution, tests actually passing, archive execution, Minecraft import, or gameplay remain unclaimed unless matching execution evidence exists.

## Optional local developer commands

`DEV.cmd` is retained only as a convenience for developers who intentionally use a local Windows checkout:

```text
DEV.cmd setup
DEV.cmd doctor
DEV.cmd audit
DEV.cmd check
DEV.cmd test
DEV.cmd inspect <artifact>
DEV.cmd finalize-local
```

These commands are not ChatGPT workflow authority and never gate remote GitHub completion.

## Toolchain authority

`toolchain.json` describes optional developer/build compatibility. It pins Node `22.16.0` and npm `10.9.2` as the **ChatGPT-container-compatible baseline**, not a requirement for ChatGPT Chat's direct source checking. `package.json#engines` supports Node 22.12+ and Node 24, while the source minimum for TypeScript is 5.8.3. The exact lockfile now pins TypeScript 5.8.3 and Node 22 typings (`@types/node@22.15.30`); version compatibility does not imply that package installation, TypeScript compilation, native addons or Minecraft gameplay has executed. If source-declared build tasks are genuinely executed, use the installed dependency versions and disclose the actual Node/toolchain proof.

Do not require global TypeScript/Vitest/build tools when package-managed versions are sufficient.

### ChatGPT execution compatibility

The lowest verified *toolchain baseline* in the current ChatGPT container is Node 22.16.0, npm 10.9.2 and globally available TypeScript 5.8.3. The optional dependency graph permits this Node major for common JavaScript tooling (Vite 7.3.6 requires Node >=22.12), but a locked optional native binary `@napi-rs/lzma-linux-x64-gnu@1.5.1` declares Node ^22.20 or ^24.12. `@8crafter/leveldb-zlib` also has a native install script. A full `npm ci`/native world-DB run on 22.16 therefore remains **UNVERIFIED**, not PASS.

Execution levels must remain distinct: (1) exact GitHub source and selected `.mcworld` archive inspection, available with native ChatGPT tools; (2) isolated AST/JavaScript probes using installed TypeScript, executable where source bytes are accessible; (3) exact repository `tsc`, Vitest or `runSelectedMapAudit()` only when the *complete exact-ref* source and matching locked dependencies are actually available; (4) Minecraft gameplay only with real game execution evidence. No lower version requirement can solve missing repository mounting or missing `node_modules`. Never replace an unexecuted tier with a source-only PASS.

### Real-report parity fixture boundary

The ChatGPT-portable source package intentionally excludes `workspace/projects/`, including project registry `project.json`, current `report/bug-report.json` and `report/developer-notes.json` files. Therefore `tooling/bug-report-documents/tracker/real-reports.test.ts` cannot execute its five real-project parity cases from the portable package alone. An ENOENT at fixture loading is **NOT EXECUTED / MISSING FIXTURE**, neither a renderer failure nor a PASS. Do not weaken the existing tests, invent fixtures, remove the exclusion from the portable package, or enable broad CI to make them appear green.

For a real-project acceptance pass, retrieve the exact current project/report/note JSON inputs read-only at the **same GitHub Local commit** as the portable source, compare their source identities and then execute the existing bounded parity suite. Check every canonical BUG/DESIGN_MISMATCH and Developer Note ID exactly once in derived JSON/HTML, and require the existing export/read-only verification contract. Derive expected Developer Note IDs from the current source rather than freezing outdated counts: Attack Challenge now has six source notes at `c0b4df6` although the old fixture table expected zero. Preserve version/fingerprint and record the actual environment and whether the test executed. Do not treat a historical report ZIP or a different HEAD's JSON as exact-current-map parity.

### Native world DB loading boundary

The canonical Bedrock LevelDB adapter keeps `openBedrockLevelDbSnapshot()` as its only native-reader entrypoint. `@8crafter/leveldb-zlib@1.6.0` is declared as an **optional runtime dependency**: on a compatible machine it remains the original native LevelDB reader; when its compiled binding cannot be installed it must not prevent package installation of the rest of the source-analysis toolchain. The `@8crafter/leveldb-zlib` import happens **inside that asynchronous operation**, not at module evaluation time. Importing scripts, parser contracts, the orchestrator source or LevelDB structural helpers must not itself require a compiled native addon. This change does not install any dependency or create an alternate inspection engine.

A requested native DB scan still requires the addon, and an unavailable/incompatible binding returns the existing `WorldDbNativeSummary.status = "failed"` with `actorContentComplete = false`. `inspectArtifact()` propagates failed scan into `nativeWorldScanIncomplete`/discovery closure; callers must not report world/chunk/actor coverage as scanned or claim FORMALIZE/EVALUATE closure from source-only evidence. Absence of the `db/` directory is separately `not-present`, not a successful scan.

**Remaining environment gap:** GitHub connector file reads are authenticated evidence, but they are not a mounted exact-commit repository tree. A source/lockfile-compatible Node version cannot provide missing source files, `node_modules`, `vitest`, `tsx` or `@zip.js/zip.js`; no full repository test may be reported as executed until those exact inputs are genuinely present. The lockfile now pins `@types/node@22.15.30`, `undici-types@6.21.0` and TypeScript 5.8.3 using published package integrity metadata. This is a source/lockfile alignment, **not** evidence of successful `npm ci`, `tsc` or Vitest execution.

### ChatGPT Chat: exact-source isolated module execution

When this conversation has a connected GitHub source reader but no mounted repository checkout, do not equate failure to clone with inability to run **any** repository code. Select one small, relevant source owner and its minimum dependency closure. Fetch the file at the exact `Local` commit through authenticated GitHub, reconstruct its UTF-8 contents in the ChatGPT execution container, and compare `git hash-object <file>` with the fetched Git blob SHA **before** executing it. An unmatched blob must not be used as exact-ref repository proof. Never copy target-map proprietary source into GitHub.

If TypeScript is installed in the ChatGPT container, an exact source module may be transpiled with its installed compiler and executed when its imports are available. A pure function can alternatively be extracted **unchanged** from the SHA-verified file for an explicitly isolated test; that is a test of the specified source function, **not** proof that the whole package resolved, typechecked or passed Vitest. Record the installed compiler version, imported dependencies, executed assertions, and any mocks/extracted scope. Import-time native availability and native function invocation are separate claims. Do not create a parallel engine, synthetic audit receipt or large source-copy database.

Observed feasibility example at exact GitHub `4ba3106f8e14fe443ec6ce80c20be5b5ca270394` in ChatGPT Chat with Node 22.16.0 and TypeScript 5.8.3:
- `engine/adapters/leveldb/src/native-reader.ts` Git blob `649e8dbdc09bfcbcf6e834f2d0f473506741f19c`: reconstructed content SHA matched; isolated transpilation reported 0 diagnostics; module loaded without its native dependency; invoking the reader failed with `MODULE_NOT_FOUND` (as expected because native binding was not installed).
- `engine/analyzers/diagnostics/src/arena/arena-capacity.ts` Git blob `410bd2dcf99f780e57ce0adac00e20fde7218b1d`: exact source SHA matched; the unchanged pure capacity solver region was transpiled and executed in six isolated assertions (fixed-pool shortfall/sufficient, reported capacity, unbounded resource, invalid cost rejection and bottleneck owner), all 6 passed.
- These are real **isolated source executions**, not Vitest, whole-repository `tsc`, `runSelectedMapAudit()`, installed native LevelDB or live Minecraft. The GitHub connector still cannot materialize the entire 2656-file / ~15.2 MB repository into this ChatGPT container, so do not treat this targeted transfer as a full source checkout.

Prefer this bounded capability for immediately falsifiable pure parser/solver contracts within ChatGPT Chat. Escalate only exact functions requiring an unavailable imported module or complete repository; report those proofs as NOT EXECUTED without recommending Work, a new cloud service or the user's PC.


### Source snapshot handoff (manual, not a test receipt)

The existing `.github/workflows/package-source.yml` runs **packaging-only** on pushes to `Local` (and retains manual dispatch) so ChatGPT Chat can retrieve a current exact-commit archive without the GitHub connector needing workflow-dispatch permission. It uses `npm ci --ignore-scripts`, restores only the already-pinned optional `@8crafter/leveldb-zlib` lifecycle binding, verifies an isolated temporary LevelDB readback, records whether that native capability actually worked, and produces a checksum-protected TAR snapshot with a 30-day `lazy-developer-portable` GitHub artifact. The archive holds GitHub repository source and dependencies, not the user's Google Drive `.mcworld`. Package success proves transport preparation only. Its nonblocking `canonicalAuditEntrypoint` provenance records whether the exact TypeScript source module and handoff export loaded in Node, without invoking a map audit or Vitest; a failed import MUST stay `loadable=false` even though the full source remains downloadable for repair. A failed/unsupported native smoke stays explicitly unavailable, never counted as world-DB coverage or an audit PASS. The broad `Verify` / Repository Policy CI suites remain disabled.

ChatGPT Chat obtains the package by reading the exact-HEAD `Package Source Snapshot` workflow run and downloading its `lazy-developer-portable` GitHub artifact with the existing GitHub connector. The downloaded artifact ZIP contains `repository.tar.gz`, `repository.sha256` and `provenance.json`. Materialize the ZIP into this conversation's tool container, check the TAR SHA-256, reject unsafe member paths/symlinks, compare embedded/external provenance, exact branch/commit, package-lock SHA-256, Node version/architecture and target `.mcworld` SHA-256, then extract to a temporary, read-only audit workspace. Do not ever call the source archive a mounted checkout until actual bytes are present. Record `nativeLevelDb.available=false` as incomplete world-DB capability even when source analysis can proceed. Source-package generation is automatic after a `Local` push; download into ChatGPT is still an explicit tool action during a user-requested check. If no matching complete workflow artifact exists, report the precise blocker instead of using stale bytes.


### Verified ChatGPT source/dependency runtime handoff (2026-10-14)

A GitHub connector file read is not a checkout, and the ChatGPT container cannot resolve github.com/npmjs.org directly. A **completed GitHub Actions artifact download through the connected GitHub tool does materialize into the conversation container**. This has been verified with an exact source and `node_modules` archive, not only postulated. The isolated historical on-demand handoff was hosted in the dedicated `chatgpt-runtime-transfer-20261014` branch. That earlier 2026-10-14 handoff used an on-demand transfer workflow. The current `Local` branch uses packaging-only pushes for fresh source transport; the broad `Verify` workflow is suspended. The connected `download_workflow_artifact` action remains the supported way to materialize an existing artifact into ChatGPT Chat. The existing full verification receipt is on a separate temporary `chatgpt-runtime-handoff-20261014` branch; both package only repository source/dependencies, never original `.mcworld` inputs.

Transfer boundary: inspect `provenance.json`; verify the `repository.tar.gz` SHA256 from `repository.sha256`; verify `package-lock.json` against the provenance lock SHA256; inspect entries for unsafe paths and extract the portable archive. Node 22.16 / npm 10.9 / TypeScript 5.8.3 / Vitest 3.2.7 ran in the actual ChatGPT container after handoff. Run `npm run typecheck`, `npm run bug-report-ui:build`, and targeted `./node_modules/.bin/vitest run <file> ...` in that directory. A future new Local SHA requires a **new exact-source handoff**; do not silently reuse an older archive as HEAD evidence. A portable snapshot omits `.git`: repository policy scripts using `git ls-files` require reconstruction of a local Git index; such an index does NOT reproduce the original commit identity.

Proof at 2026-10-14 original Local SHA `c4d029e63950...`: GitHub Actions successfully installed packages and built the portable archive. ChatGPT extracted the archive with matched checksum and directly executed original project tests. The first full test suite reported 529 passed / 179 failed test files and 2456 passed / 360 failed individual tests; this is **real execution evidence**, not closure. First typecheck found syntax errors; after repair, the compiler exposed 655 additional type errors across 193 files. Targeted parser, arena extraction, report-file, cross-domain and causal-link tests then passed **78/78** after bounded source/test fixes; UI Vite build passed. EVALUATE/PROVE/REPORT and live Minecraft remain separately unproven.

## Verification lanes

Use the strongest evidence available for the exact claim without turning a higher execution context into a mandatory dependency.

```text
policy/docs change      → REMOTE_GITHUB structural/source review
source contract         → REMOTE_GITHUB exact-head source + affected tests/contracts review
executed typecheck/test → only if directly callable in current ChatGPT tools, or evidenced by an existing exact-head GitHub run; otherwise NOT EXECUTED
artifact execution      → only if directly supported by current ChatGPT tools; otherwise UNKNOWN
Minecraft import/open   → only if directly supported by current ChatGPT tools; otherwise UNKNOWN
gameplay/runtime        → actual live execution evidence, otherwise UNKNOWN
```

### Audit timing diagnosis (same production entrypoint)

The existing selected-map audit now records actual per-invocation wall-clock durations for initial ZIP fingerprint/extraction, each prepared working-copy copy, each LevelDB read or snapshot reuse, and source indexing (parsed versus reused), with full per-pass inspection elapsed time already reported by the canonical demand-reconciliation owner. These measurements are **observations**, not a guarantee that the game was executed or that a speedup occurred. The optional `npm run audit -- <selected.mcworld> --brief --timings` appends one `AUDIT_TIMINGS` JSON line to standard error. This keeps the canonical JSON/brief/handoff standard output, audit revision, report admission and exit status unchanged; no second report/cache/CI workflow is introduced. Report assembly is not included in `inspectionElapsedMs`; the separate `auditCallElapsedMs` covers the full `runSelectedMapAudit()` call only. Archive preparation is counted once and not multiplied by the number of reconciliation passes. A native LevelDB failure remains an incomplete scan even if its elapsed time is measured.

### One-run risk-based test selection (no new CI)

The existing `tooling/repository/run-tests.mjs` remains the **single test runner**; AI chooses its smallest defensible test set from exact GitHub `Local` source changes and the present risk. The full `test-inventory.json` still owns all five lanes and every source test, even when only a subset is executed. When actual repo code and dependencies are available to ChatGPT, use:

- **Development:** `--affected --plan [--base-sha exact-commit] <changed/source-or-bound-data ...>` gives a read-only list of statically connected tests, following import/export edges (including type-only, transitive and barrel references). Remove `--plan` to execute that set; `--focus <test...>` remains available for a source-specific test chosen with stronger evidence.
- **Integration:** `--affected --integration [--plan] [--base-sha exact-commit] <changed/source-or-bound-data ...>` retains those tests and adds the entire existing acceptance lane. It includes safety tests reachable through the source-import graph. If permissions, destructive mutation, serialization, runtime integration or other dynamic coupling makes that graph insufficient, AI additionally selects the existing safety/runtime/regression lane or full suite as warranted.
- **Release:** `--full` runs every discoverable test (Vitest plus the existing native tests). The broader repository and target-map proof requirements remain separate. A narrowed check is never claimed as complete test-suite or gameplay coverage.

`--affected` accepts existing TS/JS source, statically referenced resources inside `engine/fixtures/` (literal imports or `new URL(..., import.meta.url)`), and version-1 knowledge catalog JSON in `engine/knowledge/` or `engine/contracts/engineering/catalogs/`. Knowledge changes use the **existing** knowledge–detector bindings. Without an old revision, path-only selection conservatively includes all registered proof tests (removed claims might otherwise disappear). With `--base-sha <exact-40-character-commit>` the existing runner reads the immutable earlier catalog via `git show` and selects tests bound to changed, added or removed claim IDs. Changed catalog-level source/metadata selects the complete union of claims from both versions. Missing old IDs in the current registry, malformed source or an inaccessible SHA fail closed; no change to one supplied path still selects its catalog tests. Current claims must all have bound IDs; proof paths must remain in the canonical test inventory. Each changed fixture must have its own statically connected test. A registered proof is a test-selection hint, **not evidence of actual detector consumption or Minecraft behavior**. Missing/deleted source, ownership/config/other JSON, unbound catalogs, dynamic fixture loads and zero mapped tests **fail closed** to source review and explicit `--focus`, lane or `--full` as appropriate. `--plan` selects without executing. A measured planning duration covers inventory discovery, source/AST traversal and dependency selection, **not** test execution or an observed speedup. The runner, test inventory, frozen expectations and disabled CI remain authoritative and unchanged.

Remote source completion and executable validation are different proof levels. Evidence-context labels such as `LOCAL_ARTIFACT`, `LOCAL_MINECRAFT`, and `LIVE_MINECRAFT` describe required proof capabilities, **not** instructions to use the user's PC. Missing executable evidence must remain an explicit proof ceiling, never a requirement for local-PC access, npm installation, local data, or user-operated testing.

## Distribution boundary

Build/package commands may produce artifacts only in ignored/generated output locations. They must not overwrite original user artifacts.

Release/promotion to `main` is separate from ordinary development.

## CI principles

- read-only permissions by default;
- bounded timeout;
- pinned major/trusted actions;
- exact-head evidence;
- no commit-back;
- no secrets for ordinary verification;
- no full expensive workflow on every trivial Local edit unless a specific invariant requires it.

Focused workflows are evidence tools, not parallel readiness authorities.

## Source hygiene audit

`DEV.cmd audit` reports possible unreferenced production source files and production external-package usage.

The audit is intentionally non-blocking. A zero-inbound file or apparently unused dependency is a review candidate, not deletion permission. Dynamic loading, generated entrypoints, runtime adapters, or test-only support can make a candidate legitimate.

Promote a hygiene rule into `verify:repository` only after the repository baseline proves that the rule has low false-positive risk.

## Optional local readiness

For developers who choose a local checkout, `DEV.cmd finalize-local` may run `npm run verify:local-ready` as the repository's optional local executable verification suite.

This is an optional stronger-proof path. It does not define whether ChatGPT remote GitHub work is complete, and remote work must never be left artificially pending solely because this local command was not executed.

## Dependency execution policy

Production source may import external packages declared in `dependencies` or `optionalDependencies`; a package in `optionalDependencies` must be loaded at the point of use and unavailable-package errors must produce explicit UNKNOWN/failed coverage, never successful evidence. Test/build-only packages belong in `devDependencies`.

npm 10.9.2 does **not** enforce `package.json#allowScripts`; it cannot be cited as install-script protection. For both manual GitHub verification workflows, the portable source package and `DEV.cmd setup`, use `npm ci --ignore-scripts --no-audit --no-fund`. Do **not** also omit optional dependencies: esbuild relies on an optional platform binary, while the optional native LevelDB reader remains unavailable until a separate deliberately authorized installation actually succeeds. This safe-install policy is a source contract; package installation, esbuild boot, typecheck, Vitest and native LevelDB have not been executed at this exact commit. Running a native installation with lifecycle scripts requires separate review and cannot silently convert failed native coverage into success.

## Public API surface audit

`DEV.cmd audit` also reports cross-owner imports that bypass another module's `src/index.ts` entrypoint.

The audit is non-blocking while legacy deep imports remain. Migrate one semantic owner at a time, then promote only that proven owner boundary into a blocking rule. This preserves internal refactor freedom without forcing a repository-wide import rewrite.

## Public API debt ratchet

`tooling/repository/public-api-baseline.json` records the current count of cross-owner deep imports per target owner.

The public API audit fails only when an owner exceeds its recorded baseline. Existing debt may remain temporarily, but it cannot increase. After a migration reduces an owner's count, lower that owner's baseline in the same logical change.

Never raise a baseline merely to make CI green; a baseline increase requires an intentional architecture decision.