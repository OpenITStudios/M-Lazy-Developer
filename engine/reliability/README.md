# Reliability

Canonical owner for durable quality evidence that supports retest, benchmark, release, and Minecraft-update decisions.

**Current baseline:** Previous real-map audit records, map-derived patterns and per-map profiles have been cleared from the active Local branch. Generic engine evidence remains. Older Git commits are not current-map audit inputs.

## Structure

```text
engine/reliability/
├── catalogs/   durable reliability knowledge and capability/coverage state
├── corpus/     frozen benchmark manifests for calibration, blind acceptance, and regression evaluation
└── history/    append-oriented execution/campaign history
```

## Ownership boundaries

### catalogs/

Durable knowledge that survives individual benchmark runs.

Examples:

- historical regression metadata;
- reusable failure pattern knowledge;
- evidence-backed per-map engineering knowledge;
- capability proof bindings;
- knowledge → detector/proof coverage bindings (`catalogs/knowledge-detector-bindings.json`);
- coverage state;
- map fingerprints;
- Minecraft update intelligence.

`catalogs/regressions.json` is **historical failure knowledge**, not an executable benchmark manifest.

### corpus/

Frozen evaluation inputs and expectations.

```text
calibration.json
acceptance.json
regressions.json
```

`corpus/regressions.json` is the **benchmark regression manifest** that points to approved evidence/fixtures. It does not replace the historical regression catalog.

### history/

Append-oriented execution evidence. History records what happened during campaigns/runs; it does not define expected behavior.

## Related evidence

Reduced reproducible files belong in:

```text
engine/fixtures/regressions/
```

That directory owns the actual minimized fixture content.

The relationship is:

```text
historical bug knowledge
  → catalogs/regressions.json

reusable failure abstractions
  → catalogs/failure-patterns.json

knowledge-consumption coverage
  → catalogs/knowledge-detector-bindings.json

per-map engineering knowledge
  → catalogs/map-knowledge/

approved benchmark expectation
  → corpus/regressions.json

minimal reproducible artifact
  → fixtures/regressions/

execution result over time
  → history/
```

Do not create another reliability, benchmark, regression, or corpus owner elsewhere.

## Approved issue history ingestion

Current issue truth remains owned by canonical Bug Report V2.

Once an audit project has passed readiness, approved current-version bugs may be projected into:

```text
engine/reliability/catalogs/regressions.json
```

through the canonical project publication workflow.

The historical projection records stable incident identity, map/version, Bug ID, artifact fingerprint, Expected/Observed behavior, reproduction when available, search tags, and provenance back to the canonical report.

Rules:

- historical projection never replaces Bug Report V2;
- legacy regression records are preserved rather than normalized/backfilled speculatively;
- a stable historical ID conflict is fail-closed;
- repeated regression incidents may later support `failure-patterns.json`, but every incident is not automatically promoted into a reusable pattern;
- historical knowledge raises search pressure only and cannot prove a defect in another/current artifact.

## Proof rule

Reliability evidence informs confidence and prioritization. It does not redefine map Game Design, Minecraft platform semantics, or runtime truth.
