# Detection Gap Classification

Use from **Detection Development** after receiving a Detection Gap handoff.

Classify the first missing reusable capability:

| Gap | First owner |
|---|---|
| `ingest-gap` | archive/native adapter |
| `parser-gap` | parser/normalizer |
| `semantic-gap` | analyzer / semantic model |
| `platform-knowledge-gap` | Platform Knowledge |
| `platform-rule-gap` | Platform Rule / compatibility |
| `design-grounding-gap` | Game Design Spec / Gameplay Intent |
| `behavior-contract-gap` | Behavior Contract model/compiler |
| `diagnostic-gap` | diagnostic inference |
| `proof-gap` | proof/evidence composition |
| `runtime-harness-gap` | runtime probe/harness |
| `reporting-gap` | report projection/contract |

## First-owner test

Ask in order:

1. Can we read the evidence?
2. Can we normalize it?
3. Can we assign Minecraft/game semantics?
4. Do we know platform behavior for the target version?
5. Do we know map expectation?
6. Can the target constraint be represented?
7. Can we compare expected vs actual?
8. Is proof strength sufficient?
9. Can required runtime evidence be collected?
10. Can the proven result be represented?

Fix the first **No**.
