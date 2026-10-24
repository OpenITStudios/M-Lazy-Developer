# Engine

Source contracts for deterministic Minecraft Bedrock/Education analysis and repair. M-Lazy-Developer operates through **ChatGPT Chat**, with selected `.mcworld` inputs from accessible Google Drive links and canonical knowledge/code on GitHub `Local`. This directory establishes source ownership, not executed audit or Minecraft-runtime proof.

## Physical directory responsibilities

These are actual directories under `engine/`. Each owns one distinct kind of source or evidence; **none** is a new workflow stage.

| Directory | Owns | Does not own |
|---|---|---|
| `adapters/` | Native/archive format translation | Gameplay diagnosis |
| `analyzers/` | Read-only evidence and authored-source semantics | Authorized mutation |
| `packages/` | Reusable typed behavior, reasoning, repair and cross-owner composition | Duplicate parsers or data catalogs |
| `design/` | Game Design vocabulary/schema system | Current selected-map Game Design |
| `knowledge/` | Minecraft platform fact catalogs | Executable runtime proof |
| `rules/` | Versioned executable platform capability rules | Descriptive knowledge duplicates |
| `schemas/` | Serialized format/schema contracts | Runtime logic |
| `contracts/` | Global engineering and verification constraints | Map-specific authored intent |
| `fixtures/` | Reduced reproducible inputs | Current gameplay truth |
| `reliability/` | Corpus, regression/history and reliability catalogs | Current-map authority |
| `runtime/` | Runtime harnesses and experimental proof infrastructure | Unverified static inference |

`engine/ownership.json` is the machine-readable source for the seven **logical groups** (`core`, `analysis`, `policy-data`, `quality`, `runtime-proof`, `engineering-governance`, `design-system`). They are labels for the physical directories above, not folders to create. `engine/packages/ownership.json` separately groups packages by responsibility; do not physically duplicate packages under those group names.

For the user-facing audit flow `TARGET → DISCOVERY → UNDERSTAND → FORMALIZE → EVALUATE → PROVE → REPORT`, resolve the stage through [Implementation Map](../docs/system/implementation-map.md) and the existing selected-map workflow. Stages are navigation routes; analyzers and packages retain their single canonical implementation owners.

## Engine routing

```text
selected artifact bytes
→ artifact/archive + adapters (identity and format translation)
→ read-only analyzers (source and native evidence)
→ project model + semantic IR/graph + gameplay understanding
→ diagnostics, counterproof and bounded proof requirements
→ one orchestrated selected-map audit → report projection
```

`engine/packages/orchestrator/` coordinates these owners throughout the audit; it is not a last processing step after repair. `FORMALIZE` owns the evidence-bounded model and state/ownership contracts; cross-system and stress conditions belong within `EVALUATE`, not in a separate `STRESS` stage. An approved BUG or design change follows the separate repair-admission → repair/preservation → validation/package path. Audit alone never mutates the selected map.

Authority/data owners inform the pipeline without becoming runtime proof:

```text
project Game Design + design system + knowledge + rules + contracts + schemas
        ↓
analysis / compatibility / diagnosis
```

Runtime proof and quality evidence remain separate from semantic authority:

```text
fixtures + reliability + runtime
→ evidence / regression / falsification
→ never implicit source-of-truth promotion
```

## Boundary

- `apps/` consumes stable engine package APIs.
- `tooling/` verifies and operates the repository; it does not own Minecraft semantics.
- `engine/adapters` translates representations.
- `engine/analyzers` derives evidence without mutation.
- `engine/packages/orchestrator` is the normal cross-owner composition boundary.
- Current map Game Design is derived from the exact selected artifact; project workspace records may persist that derived view but never replace the artifact as gameplay authority. `engine/design` owns only the reusable design system. `engine/knowledge` owns platform facts; `engine/contracts` owns engineering constraints; `rules` and `schemas` remain executable policy/structure owners.
- `engine/fixtures` and `reliability` protect quality but do not define gameplay semantics.
- `engine/runtime` provides bounded runtime proof.
- Research under `experiments/` is non-authoritative and must not become a production dependency.

Logical owner names remain `packages/*`, `analyzers/*`, and `adapters/*` in dependency/audit reports even though their physical paths are namespaced under `engine/`.
