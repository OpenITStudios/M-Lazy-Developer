# Reliability Catalogs

Repository-owned durable reliability knowledge.

For overall routing, start at `engine/reliability/README.md`.

```text
regressions.json
failure-patterns.json
coverage.json
capability-proof-bindings.json
capability-truth/
map-knowledge/
map-fingerprints/
minecraft-updates/
```

## Ownership

- `regressions.json` stores minimized **historical failure knowledge**, never full private maps.
- `failure-patterns.json` stores reusable failure abstractions backed by regression cases.
- `coverage.json` is a **source capability and known-limit index**, not
  a test/benchmark result. `partial` means narrow source capability
  is present, not an exact-HEAD PASS; `unknown` means decisive proof
  is missing, not necessarily that no related analyzer exists.
  `proofPaths` must point to retained source/test files, but are
  locators rather than executed receipts. Coverage domain/lane
  categories are independent of repository `functionalArea` and
  selected-map issue `failureDomain`.
- `knowledge-detector-bindings.json` records **declarations of related analyzer/proof paths**, not effective knowledge consumption. Declaration-only edges must not influence Resource Graph ranking or imply analyzer/test execution.
- A new factual claim may be a useful searchable reference without receiving a permanent detector binding. Do not add bindings merely to satisfy accounting coverage. Run the existing `audit-knowledge-consumption.mjs` to inspect declared paths, source-ID mentions, and catalog-API hints; these are static signals, NOT demonstrated detection success.
- `capability-proof-bindings.json` binds capabilities to explicit proof artifacts.
- `capability-truth/` records generated capability/proof state.
- `map-knowledge/` stores durable evidence-backed map architecture/gameplay/risk knowledge.
- `map-fingerprints/` stores exact inspection-derived compatibility/reliability identity.
- `minecraft-updates/` stores curated semantic update deltas with source/confidence.

## Cross-map learning closure

Every durable regression incident must contribute to at least one reusable failure pattern in `failure-patterns.json`.

```text
approved/current issue
→ historical regression incident
→ generalized invariant/failure pattern
→ detector/proof change only when a real gap is proven
→ minimized fixture + frozen benchmark expectation when executable evidence is available
```

Rules:

- generalize the semantic failure, never the map name, symbol name, or one implementation detail;
- one failure pattern may be supported by many maps and one regression may support more than one pattern;
- do not create one pattern per issue when an existing invariant explains it;
- historical patterns raise search pressure and retest priority only; they never prove a defect in another map;
- catalog validation fails closed when a durable regression has no failure-pattern learning coverage.

## Regression naming boundary

Three regression-related owners intentionally exist:

```text
catalogs/regressions.json
  = durable historical bug knowledge

../corpus/regressions.json
  = executable/frozen benchmark manifest

../../fixtures/regressions/
  = minimized reproducible fixture content
```

Do not merge these concepts and do not create a fourth regression owner.

Catalogs influence retest prioritization, so incomplete or duplicate durable records must fail validation rather than being silently accepted.
