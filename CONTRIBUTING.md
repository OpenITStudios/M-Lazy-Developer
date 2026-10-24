# Contributing to Lazy-Developer

## Branch model

```text
Local → active development
main  → stable/release
```

Normal work targets `Local`. Promotion to `main` is deliberate.

## Execution routes

**M-Lazy-Developer runs as a map-checking workflow in ChatGPT Chat.** Selected `.mcworld` inputs may come from accessible Google Drive links; GitHub `Local` owns source, knowledge, policies and commits. The user does not need a local checkout, Node/npm, `DEV.cmd`, CI, or user-run commands for source-verifiable work. Report executable code evidence only when that code actually ran.

- **SYSTEM DEVELOPMENT:** improve the repository in its canonical owner and deliver one bounded logical commit; follow `AGENTS.md` and `docs/system/development-discipline.md`.
- **MAP BUG AUDIT:** inspect one selected map directly through ChatGPT and canonical source/evidence contracts; do not modify the source engine in that mode or claim `runSelectedMapAudit()` ran unless it actually did.

`DEV.cmd` remains an **optional Windows-local developer convenience** only, delegated to `tooling/windows-toolchain/dev.ps1`. It supports setup, doctor, check, test, inspect and finalize-local for intentional local work. Do not create a second root task runner or treat local commands as remote GitHub completion gates.

## Before changing code

1. Identify the semantic owner.
2. Define expected behavior and non-goals.
3. Read only evidence that can change the decision.
4. Define the cheapest meaningful verification.
5. Keep one logical outcome bounded to its owners.

## TypeScript conventions

- strict TypeScript remains enabled;
- preserve `exactOptionalPropertyTypes`;
- prefer explicit domain types over stringly-typed mutation;
- avoid giant managers/services/utils buckets;
- constructors/functions receive dependencies explicitly;
- do not introduce mutable global state;
- adapters stay thin;
- parsers preserve unknown data when lossless behavior matters;
- errors at trust boundaries must be actionable and fail closed;
- avoid unnecessary full-file loads for large artifact paths where streaming is available.

## Tests

Test behavior and durable invariants, not implementation trivia.

Preferred hierarchy:

```text
pure unit
→ reduced fixture
→ package/roundtrip
→ local Minecraft
→ live gameplay
```

Use the cheapest proof that can falsify the changed claim.

## Repository hygiene

Do not commit:

- user/client worlds or proprietary production artifacts;
- extracted local workspaces;
- node_modules/build/cache state;
- logs/crash reports;
- secrets/environment credentials;
- temporary profiler/export/debug captures.

Reduced fixtures must be minimal and safe to redistribute.

## Commit discipline

Use categorized logical commits such as:

```text
feat(archive): add bounded entry streaming
fix(graph): preserve unresolved structure reference
refactor(repair): isolate transaction application
test(topology): cover translated arena outlier
docs(system): clarify semantic ownership
```

Do not split by file, tool call, or discovery order.

## STOP

When the requested outcome and relevant proof are complete, stop. Do not add speculative framework or adjacent cleanup.
