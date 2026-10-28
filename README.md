# Lazy-Developer

**M-Lazy-Developer is a Minecraft Bedrock/Education map-checking system operated through ChatGPT Chat.** The user provides a Google Drive link to a selected `.mcworld`; ChatGPT reads that accessible map with available tools, analyzes game mechanics and possible bugs, and reports supported findings and precise unknowns. GitHub `Local` stores the canonical source, knowledge, policies and development history. Exact repository TypeScript execution is a separate proof tier and is never inferred from source files.

The working goal is to inspect `.mcworld` evidence (scripts, functions, manifests, NBT/LevelDB, structures and spatial data when accessible), reconstruct authored game design, distinguish intended behavior from credible defects, and preserve precisely scoped proof limits. ChatGPT can perform supported analysis without running a repository program. Source commits do not prove TypeScript execution or live Minecraft gameplay.

## Branch authority

```text
Local → active development / working authority
main  → stable / release authority
```

## Start here

Primary repository workflow is remote GitHub work through the repository policies:

```text
AGENTS.md
→ GITHUB_RULES.md
→ canonical source/docs owner
→ bounded GitHub read/write
→ remote source verification
→ STOP
```

A local checkout is **not required** for normal ChatGPT/GitHub repository work.

`DEV.cmd` and npm scripts are optional local-developer conveniences only. They may provide stronger executable proof when a developer intentionally uses a local checkout, but they are not a completion prerequisite for remote repository work.

Documentation starts at [docs/README.md](docs/README.md).

## Choose one operator flow

These are two **ChatGPT Chat task modes**. Both reuse the same canonical GitHub knowledge/source authority; neither mode implies that repository TypeScript code has executed.

| User request | Mode | Route | Result |
|---|---|---|---|
| Improve system, detectors, knowledge, Skills/Probe, UI or repository | **IMPROVE SYSTEM** | `AGENTS.md` → `.agents/skills/m-bedrock-system-improvement/SKILL.md` → owning code/source | One bounded verified source change and Local commit |
| Understand and test one supplied map | **TEST MAP** | `AGENTS.md` → `.agents/skills/m-bedrock-map-testing/SKILL.md` → selected-map evidence | LOAD → UNDERSTAND → TEST → REPORT with supported findings and explicit proof limits |

TEST MAP never edits engine source. A capability gap requires an explicitly authorized IMPROVE SYSTEM task. Benchmark is a restricted validation operation within IMPROVE SYSTEM; working-copy repair is a separate approved TEST MAP suboperation, not a third lane.

**For ChatGPT:** supply the `Local` repository URL and describe the intended outcome. Repository inspection alone is read-only. Normal repository development uses GitHub directly without `DEV.cmd`, a local checkout, or automatic CI.

## Root file ownership and navigation

The root is a small entry and tooling-contract boundary, **not** another location for engine behavior, working state, or duplicated documentation. Keep files here only when their existing repository-wide consumers require the location.

| Path | Exactly one responsibility | Where to go for detail |
|---|---|---|
| `README.md` | Human starting point and routes into established owners | Domain README, not duplicate implementation guides |
| `AGENTS.md` | Agent mode selection, task routing and repository invariants | Selected skill and domain owner |
| `GITHUB_RULES.md` | GitHub change, verification, commit and handoff policy | Exact GitHub/source owner |
| `CONTEXT.md` | Stable product facts only | No work status or planning |
| `CONTRIBUTING.md` | Contribution conventions | `docs/system/development-discipline.md` for engineering decisions |
| `SECURITY.md` | Repository-wide trust and sensitive-input boundaries | Concrete engine security owner |
| `package.json` | Node package metadata and script entrypoints | `tooling/` for executable tooling |
| `package-lock.json` | Locked npm dependency graph | `package.json` |
| `tsconfig.json` | TypeScript project configuration | Owning source modules |
| `toolchain.json` | Canonical pinned developer/runtime tool versions | `tooling/windows-toolchain/` |
| `.node-version` | Node version selector for supporting tooling | `toolchain.json` |
| `VERSION` | Product version string | `package.json` is package metadata; versions must remain coherent |
| `DEV.cmd` | Optional Windows-local launcher only | `tooling/windows-toolchain/dev.ps1` |
| `.editorconfig` | Editor whitespace/format behavior | No engine semantics |
| `.gitattributes` | Git path/attribute behavior | No engine semantics |
| `.gitignore` | Untracked-file exclusion rules | No artifact source authority |

The root folders have distinct responsibilities: `apps/` stores optional CLI/report-interface source; `engine/` stores analysis/semantic implementation source; `docs/` durable descriptions; `planning/` future intent; `workspace/` active project artifacts; `tooling/` developer operations; `experiments/` bounded research; `.agents/` agent procedures; and `.github/` GitHub service configuration. None replaces ChatGPT Chat as the operator.

### Find work by flow, edit only its owner

| Intended task | First route | Authoritative destination |
|---|---|---|
| Improve the system | `AGENTS.md` → development skill | `docs/system/implementation-map.md` → owning source |
| Audit a selected map | `AGENTS.md` → TEST MAP skill | `runSelectedMapAudit()`; LOAD → UNDERSTAND → TEST → REPORT (internal checkpoint/proof owners retained) |
| Repair an approved defect | Approved TEST MAP repair suboperation | Authorized repair owner and preservation contract |
| Change a report or presentation | Report contract and projection owner | One current report authority; HTML/JSON are derived |
| Learn a Minecraft behavior | Knowledge router and `engine/knowledge/ownership.json` | One canonical catalog claim or executable domain owner |
| Resume an unfinished task | Relevant work commits and `planning/` | Current source plus explicitly verified unresolved work |

**One source → one meaning → one authoritative output** means a workflow stage is a navigation address, not a new implementation folder. Existing API barrels do not own semantics; compatibility re-exports must not be used for new internal imports. Keep a required root file in place rather than moving it merely to make the tree look smaller.

## Repository map

```text
apps/          optional CLI/report-interface source; ChatGPT Chat remains the operator
engine/        Bedrock analysis, reasoning, validation, repair, and machine knowledge source
docs/          durable human-facing documentation
planning/      development, operations, and project work intent
workspace/     working artifacts, project continuity, current reports, and derived publication
experiments/   bounded non-authoritative research
tooling/       repository/developer/build/verification tooling
.agents/       bounded agent procedures, permissions, schemas, and evals
```

The repository root is intentionally sparse. New top-level domains require a durable repository-wide responsibility.

## Product flow

```text
Artifact
→ safe ingest
→ normalized project model
→ semantic/gameplay understanding
→ diagnosis
→ authorized repair / modification
→ validation
→ deterministic package/output
→ report / evidence projection
```

Architecture and ownership:
- [Architecture](docs/system/architecture.md)
- [Authority Model](docs/system/authority-model.md)
- [Implementation Map](docs/system/implementation-map.md)
- [Canonical Naming](docs/system/canonical-naming.md)

## Selected-map gameplay audit

**Current operator:** ChatGPT Chat retrieves an accessible selected `.mcworld` (including from a Google Drive link), examines it read-only with available tools, consults canonical GitHub source/knowledge, and reports evidence and uncertainty. The audit reasoning order remains:

```text
Selected Minecraft artifact
→ ChatGPT: TARGET → DISCOVERY → UNDERSTAND → FORMALIZE
→ ChatGPT: EVALUATE → PROVE → evidence-scoped REPORT
```

The repository also defines `runSelectedMapAudit()` and a TypeScript CLI as an **optional programmatic implementation contract**. Only if the exact code is actually executed can its `SelectedMapAuditRun`, `MapAuditOutputV2`, audit revision, or generated handoff be claimed as observed. A manual ChatGPT audit follows equivalent evidence/uncertainty principles but **must not fabricate those engine-produced receipts**.

Canonical owners:
- [Master Selected-Map Audit Workflow](docs/analysis/master-selected-map-audit-workflow.md)
- [Mandatory Gameplay Audit Procedure](docs/analysis/mandatory-audit-procedure.md)
- [Bug-Finding Coverage System](docs/analysis/bug-finding-coverage.md)

The TypeScript CLI source specifies that `npm run audit -- <selected.mcworld>`, **if genuinely executed**, would emit the Map Audit V2 JSON defined by the source contracts; its presence in GitHub is not evidence of a completed run. The optional `--handoff` view exports a bounded source-grounded AI investigation packet with artifact fingerprint, audit revision, task IDs, knowledge references and proof constraints. `--handoff-offset N` pages through existing tasks. Responses in the existing `GameplayDefectResolution` shape can be applied through `--responses <answers.json>`, on the SAME audit entrypoint and SAME canonical proof gate. This is an explicit exchange for a ChatGPT-capable caller, not autonomous model execution or a second report. Non-causal obligations cannot be closed from model text. The optional `--brief` view renders **Game Understanding → Findings → Next Investigations** from the exact same audit output and model task packets. When a knowledge catalog is supplied (the production CLI already loads it), source-grounded investigation packets can include a few matched Minecraft facts/relations with original source URLs and declared edition scope. These are **retrieved references**, not evidence that a detector consumed a fact or that Minecraft gameplay was observed. An unmatched mechanic remains a valid map mechanic, not a forced database category. It is a bounded human-facing projection, not a second audit run/report contract. Source-derived journey candidates are **not observed gameplay**, and a blocked/zero-finding audit never proves the absence of bugs. The engineering CLI `npm run cli --` is a separate development utility and does not implement an `audit` command. The optional `--compact` flag removes only JSON whitespace, and `--gzip` streams a gzip-compressed form of the same canonical audit or handoff JSON to standard output (redirect it to a `.json.gz` file). Decompression preserves the same report fields, obligations, fingerprint and blocking proof; neither flag makes a blocked audit pass. These machine-output flags are not available for `--brief`.

The exact selected map artifact is current gameplay authority. Historical evidence and user/client symptoms may guide search but never replace current-artifact proof.

**Developer source reference:** The CLI now reads the pinned `experiments/developer-practice-signals.json` snapshot in the standard selected-map audit. This is a curated index of the two original developer ZIPs: 22 source-pinned skill methodologies (16 map-interpretation candidates and six development-only), with linked module/test/probe provenance. An investigation receives at most two hints **only** when its current selected-map Intent source, typed Semantic IR witness and question domain match. The developer ZIP is authoritative for its author's methods and source examples—not for the selected map's intended design, independently verified Minecraft platform behavior or live proof. The external modules and probe packs are not installed or executed by this integration. The canonical owners and methodology update procedure remain in [Developer-Practice Context](docs/analysis/developer-practice-context.md).


## Project state and planning

```text
planning/                    what should be worked on
workspace/projects/          map-centric project continuity
  <project>/report/          canonical current Bug Report V2 / Developer Notes
  <project>/output/          derived current HTML + JSON tracker output
  <project>/archive/vX.Y.Z/  intentionally retained historical report/output
  <project>/levels/          level-scoped report/output/archive for multi-level games
engine/reliability/history/  historical execution evidence
engine/reliability/corpus/   reusable/frozen evaluation material
```

See [workspace/README.md](workspace/README.md) and [planning/README.md](planning/README.md).

## Core invariants

- one responsibility → one canonical owner;
- original artifacts remain immutable;
- mutations occur through authorized working-copy transactions;
- derived output never becomes a second source of truth;
- static/package/runtime proof remain distinct;
- historical reliability evidence is search pressure, not current gameplay truth;
- interfaces stay thin; Bedrock semantics belong to `engine/`;
- reuse/delete an existing owner before creating a new abstraction.

## Toolchain

Canonical toolchain policy is [toolchain.json](toolchain.json).

Optional developer/build **source configuration** is owned by `tooling/windows-toolchain/`. Its baseline is Node 22.16.0 / npm 10.9.2 to match the ChatGPT execution environment, while package engines also support Node 24. This pin is not a ChatGPT source-checking prerequisite or proof of installed dependencies, executed repository checks, or gameplay testing.

Historical audit/run evidence belongs in `engine/reliability/history/`; reusable evaluation material belongs in `engine/reliability/corpus/`; superseded implementation detail remains in Git history.