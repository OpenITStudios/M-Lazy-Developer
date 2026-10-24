# Lazy-Developer Stable Context

Last verified stable design facts: 2026-10-12

This file contains only stable repository/product facts. It does not own current work, current proof state, implementation-path detail, or project execution state.

## Product

**M-Lazy-Developer is a Minecraft Bedrock/Education map-checking system operated through ChatGPT Chat.** Users provide an accessible `.mcworld` link from Google Drive; ChatGPT retrieves and examines the selected artifact read-only with available tools, using GitHub `Local` for the canonical source, knowledge, policy and development continuity. Source modules and authored tests are not evidence of executed code or observed gameplay.

Primary lifecycle:

```text
Inspect
→ Understand
→ Diagnose
→ Repair / Modify
→ Validate
→ Package
→ Report
```

The repository owns reusable parsers, semantic reasoning, canonical audit coordination, knowledge and report contracts. Executable-source capabilities are reported as executed only when actually invoked in ChatGPT; future interface speculation is not a product requirement.

## Branch authority

```text
Local → active development / source authority
main  → stable / release authority
```

## Repository domains

```text
apps/          optional CLI/report-interface source; not the ChatGPT operator
engine/        semantic/analysis source and intended executable contracts
docs/          durable human-facing documentation
planning/      development / operations / project work intent
workspace/     working artifacts, project continuity, and current report handoff
experiments/   bounded non-authoritative research
tooling/       repository/build/developer verification tooling
.agents/       bounded agent procedures, permissions, routing, and evals
```

Historical execution evidence belongs in `engine/reliability/history/`.
Reusable evaluation material belongs in `engine/reliability/corpus/`.

## Stable architecture

```text
Artifact
→ safe ingest / archive boundary
→ normalized project model
→ semantic / gameplay understanding
→ diagnosis
→ authorized transactional mutation
→ validation
→ deterministic output
→ report / evidence projection
```

Repository task planning is a separate control-plane concern. It may select affected work and reuse valid results, but it never upgrades semantic/runtime proof or owns Minecraft behavior.

## Execution model

**ChatGPT Chat is the checker interface; GitHub `Local` is the source/knowledge authority; Google Drive supplies accessible selected maps.** Neither user-PC actions nor repository toolchain installation, CI or a VM is a prerequisite for source-verifiable checking. Distinguish source examination, actual repository execution and live Minecraft evidence.

```text
REMOTE_GITHUB
→ canonical owner/source
→ bounded mutation
→ exact-head source/static verification
→ STOP

higher execution context
→ only for claims inherently requiring artifact/Minecraft/runtime execution
```

A genuinely executed script can strengthen a specific source claim if that capability is actually available in ChatGPT. Otherwise label TypeScript/test/runtime claims NOT EXECUTED without blocking independently supportable Minecraft source analysis.

## Engineering invariants

- one semantic owner per responsibility;
- one primary execution path per behavior;
- one persisted fact has one authority;
- original source artifacts are immutable;
- mutations are explicit, transactional, and preconditioned;
- analyzers are read-only;
- unknown content is preserved;
- compatibility/version applicability is explicit;
- Bedrock and Education share one core with edition-specific rules;
- artifact graph, repository task graph, and Minecraft semantic graph remain separate;
- source/static/package/runtime proof levels remain separate;
- historical reliability evidence is search pressure, not current-artifact truth;
- derived projections do not become second state authorities;
- deletion/reuse of an existing owner precedes adding a new abstraction;
- no persistent registry, manager, cache, or state store without a concrete repeated need.

## Selected-map audit invariant

Production audit has one selected artifact and one ordered flow:

```text
runSelectedMapAudit()
→ TARGET
→ DISCOVERY
→ UNDERSTAND
→ FORMALIZE
→ EVALUATE
→ PROVE
→ REPORT
```

The selected current map artifact is the sole current gameplay authority.

Historical reports, older versions, reliability data, user symptoms, and external references may raise search pressure but cannot independently define current Expected/Actual behavior or prove a current defect.

Unresolved work remains explicit as Audit Obligations or bounded runtime proof requirements. Vital Gameplay Knowledge Closure is a read-only projection and never a second workflow or finding owner.

## Toolchain metadata (not the ChatGPT checker)

Optional developer/build compatibility is described by `toolchain.json` and `DEV.cmd`. These declarations do not change the ChatGPT Chat workflow and are not prerequisites or proof of executed audit capabilities.

## Canonical routing

```text
documentation router        → docs/README.md
repository/domain naming    → docs/system/canonical-naming.md
architecture                → docs/system/architecture.md
semantic authority          → docs/system/authority-model.md
implementation ownership    → docs/system/implementation-map.md
development discipline      → docs/system/development-discipline.md
developer operations        → docs/system/development-operations.md
skill routing               → docs/system/skill-routing.md
minimum-sufficient execution→ docs/system/zero-waste-execution.md
current work intent         → planning/
working/project state       → workspace/
historical evidence         → engine/reliability/history/
research                    → experiments/
```

If a detail is owned elsewhere, link to that owner rather than duplicating it here.