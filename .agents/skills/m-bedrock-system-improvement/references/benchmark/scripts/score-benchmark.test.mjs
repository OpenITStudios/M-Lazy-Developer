import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scorer = fileURLToPath(new URL("./score-benchmark.mjs", import.meta.url));
const expectationValidator = fileURLToPath(
  new URL("./validate-expectation.mjs", import.meta.url),
);
const SHA = "a".repeat(64);

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "m-bedrock-scored-claims-"));
  const paths = {
    expectation: join(root, "expectation.json"),
    frozen: join(root, "frozen.json"),
    result: join(root, "result.json"),
  };
  const expectation = {
    schemaVersion: 1, id: "claim-oracle", lane: "calibration",
    artifact: { label: "Source-scoped generic map", sha256: SHA },
    target: { edition: "bedrock", minecraftVersion: "1.26.0" },
    expected: { claims: [
      { id: "positive", subject: "Authored state relationship",
        expectedClass: "supported", sourceRefs: ["scripts/main.js:12"],
        proofCeiling: "STATIC VERIFIED" },
      { id: "negative", subject: "Disallowed gameplay identity inference",
        expectedClass: "rejected", sourceRefs: ["scripts/main.js:21"],
        proofCeiling: "STATIC VERIFIED" },
      { id: "unresolved", subject: "Concurrency outcome needs runtime",
        expectedClass: "unknown", sourceRefs: ["scripts/main.js:30"],
        proofCeiling: "LIVE GAME VERIFIED" },
    ] },
    provenance: { frozenBeforeRun: true, source: "independent source review",
      approvedAt: "2026-10-01T10:00:00Z" },
  };
  const frozen = {
    schemaVersion: 1, kind: "selected-map-audit-observed-output",
    artifact: { label: "Source-scoped generic map", sha256: SHA },
    execution: {
      frozenAt: "2026-10-02T10:00:00Z",
      gitCommit: "0".repeat(40),
      gitCommitRole: "FREEZE_ENVIRONMENT_ONLY_NOT_AUDIT_EXECUTION_PROOF",
      artifactBinding: "EXACT_SELECTED_ARTIFACT_SHA256_MATCH",
    },
    observed: {
      schemaVersion: 2, artifactId: "selected:map",
      artifactFingerprint: SHA,
      auditTarget: {
        edition: "bedrock", minecraftVersion: "1.26.0",
        source: "selected-audit-runtime-target-not-live-observation",
      },
      evidenceScope: { mode: "selected-map-version-only",
        selectedArtifact: "Source-scoped map", archiveSourcesUsed: false },
      gameplayFlowBasis: "AUDIT_CHECKLIST_NOT_OBSERVED_GAMEPLAY",
      control: { status: "BLOCKED" },
      gameplayStructure: {
        features: [{ id: "feature:one",
          sourceEvidenceIds: ["src:verified-state"] }],
        sourceFlowCandidates: [{
          sourceSteps: [
            { id: "src:verified-state", kind: "state",
              executionRegionId: "function:join",
              source: { artifactId: "selected:map",
                relativePath: "scripts/main.js",
                range: { lineStart: 12, lineEnd: 12,
                  columnStart: 1, columnEnd: 24 } } },
            { id: "src:negative-control", kind: "state",
              executionRegionId: "function:join",
              source: { artifactId: "selected:map",
                relativePath: "scripts/main.js",
                range: { lineStart: 21, lineEnd: 21,
                  columnStart: 1, columnEnd: 24 } } },
            { id: "src:unrelated", kind: "state",
              executionRegionId: "function:other",
              source: { artifactId: "selected:map",
                relativePath: "scripts/other.js",
                range: { lineStart: 88, lineEnd: 88,
                  columnStart: 1, columnEnd: 25 } } },
          ],
        }],
      },
      bugs: [], designMismatches: [],
    },
  };
  const result = {
    schemaVersion: 1, expectationId: "claim-oracle",
    resultClass: "pass", evaluationScope: "full-map-claim-review",
    metrics: { tp: 1, tn: 1, fp: 0, fn: 0, unknown: 1 },
    fullMapReview: {
      frozenObservationFile: paths.frozen,
      frozenExpectationFile: paths.expectation,
      reviewedBy: "Independent reviewer fixture",
      reviewedAt: "2026-10-03T10:00:00Z",
      decisions: [
        { claimId: "positive", observedClass: "supported",
          reason: "Exact authored state link is present in source evidence.",
          observedEvidenceIds: ["src:verified-state"] },
        { claimId: "negative", observedClass: "rejected",
          reason: "Selected source contradicts the claimed false scope relation.",
          observedEvidenceIds: ["src:negative-control"] },
        { claimId: "unresolved", observedClass: "unknown",
          reason: "Configured source does not establish real client concurrency.",
          observedEvidenceIds: [] },
      ],
    },
  };
  const save = () => {
    writeFileSync(paths.expectation, JSON.stringify(expectation));
    writeFileSync(paths.frozen, JSON.stringify(frozen));
    writeFileSync(paths.result, JSON.stringify(result));
  };
  const run = () => {
    save();
    return spawnSync(process.execPath, [scorer, paths.result],
      { encoding: "utf8" });
  };
  return { expectation, frozen, result, paths, save, run,
    cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test("source-grounded full-map review scores all frozen positive/negative/unknown claims", () => {
  const f = fixture();
  try {
    const done = f.run();
    assert.equal(done.status, 0, done.stderr);
    const scored = JSON.parse(done.stdout);
    assert.equal(scored.metrics.tp, 1);
    assert.equal(scored.metrics.tn, 1);
    assert.equal(scored.metrics.fp, 0);
    assert.equal(scored.metrics.fn, 0);
    assert.equal(scored.metrics.unknown, 1);
    assert.equal(scored.fullMapProof.correctUnknown, 1);
    assert.equal(scored.fullMapProof.sourceGrounding,
      "CLAIM_LOCATOR_AND_SOURCE_STEP_MATCH_REVIEWER_SEMANTICS_NOT_AUTOMATED");
    assert.equal(scored.fullMapProof.scope,
      "FULL_MAP_SOURCE_REVIEW_NOT_RUNTIME_PROOF");
    assert.equal(scored.fullMapProof.auditCommit,
      "NOT_INDEPENDENTLY_ATTESTED_BY_FREEZE_GIT_COMMIT");
  } finally { f.cleanup(); }
});

test("multi-claim expectation validator accepts canonical independent source claims", () => {
  const f = fixture();
  try {
    f.save();
    const checked = spawnSync(process.execPath,
      [expectationValidator, f.paths.expectation],
      { encoding: "utf8" });
    assert.equal(checked.status, 0, checked.stderr);
    assert.match(checked.stdout, /expectation-valid/);
  } finally { f.cleanup(); }
});

test("full-map review refuses raw scores, wrong SHA, target, claim count and forged evidence", () => {
  const scenarios = [
    ["missing review", f => { delete f.result.fullMapReview; }],
    ["other archive SHA", f => { f.frozen.artifact.sha256 = "b".repeat(64); }],
    ["unverified freezer role", f => { delete f.frozen.execution.gitCommitRole; }],
    ["missing canonical report control", f => { delete f.frozen.observed.control; }],
    ["different configured Minecraft version", f => {
      f.frozen.observed.auditTarget.minecraftVersion = "1.25.0";
    }],
    ["incorrect historical chronology", f => {
      f.expectation.provenance.approvedAt = "2026-10-05T10:00:00Z";
    }],
    ["unreviewed frozen claim", f => { f.result.fullMapReview.decisions.pop(); }],
    ["unresolved evidence ID", f => {
      f.result.fullMapReview.decisions[0].observedEvidenceIds = ["src:invented"];
    }],
    ["unrelated existing source evidence", f => {
      f.result.fullMapReview.decisions[0].observedEvidenceIds = ["src:unrelated"];
    }],
    ["negative decision without source counter-evidence", f => {
      f.result.fullMapReview.decisions[1].observedEvidenceIds = [];
    }],
    ["negative decision borrowing the positive claim source", f => {
      f.result.fullMapReview.decisions[1].observedEvidenceIds = ["src:verified-state"];
    }],
    ["current-artifact mismatch in source step", f => {
      f.frozen.observed.gameplayStructure.sourceFlowCandidates[0]
        .sourceSteps[0].source.artifactId = "historical:map";
    }],
    ["duplicate evidence ID with conflicting source sites", f => {
      f.frozen.observed.gameplayStructure.sourceFlowCandidates[0]
        .sourceSteps[2].id = "src:verified-state";
    }],
    ["fabricated aggregate counts", f => { f.result.metrics.tp = 2; }],
    ["mismatched pass classification", f => {
      f.result.fullMapReview.decisions[1].observedClass = "supported";
      f.result.fullMapReview.decisions[1].observedEvidenceIds =
        ["src:verified-state"];
    }],
  ];
  for (const [label, sabotage] of scenarios) {
    const f = fixture();
    try {
      sabotage(f);
      const done = f.run();
      assert.notEqual(done.status, 0, label);
    } finally { f.cleanup(); }
  }
});

test("repeat of the SAME source step across entry flows does not become an ambiguity", () => {
  const f = fixture();
  try {
    const original = f.frozen.observed.gameplayStructure.sourceFlowCandidates[0]
      .sourceSteps[0];
    f.frozen.observed.gameplayStructure.sourceFlowCandidates.push({
      sourceSteps: [{ ...original, source: { ...original.source } }],
    });
    const done = f.run();
    assert.equal(done.status, 0, done.stderr);
    assert.equal(JSON.parse(done.stdout).metrics.tp, 1);
  } finally { f.cleanup(); }
});

test("minified same-line source operations require an unambiguous column-level oracle", () => {
  const f = fixture();
  try {
    const steps = f.frozen.observed.gameplayStructure
      .sourceFlowCandidates[0].sourceSteps;
    steps.push({
      id: "src:other-same-line", kind: "state",
      executionRegionId: "function:other",
      source: {
        artifactId: "selected:map",
        relativePath: "scripts/main.js",
        range: { lineStart: 12, lineEnd: 12,
          columnStart: 80, columnEnd: 100 },
      },
    });
    // The frozen claim only references line 12, which now contains two
    // distinct candidate operations. Choosing either ID must not count TP.
    assert.notEqual(f.run().status, 0);
    f.result.fullMapReview.decisions[0].observedEvidenceIds =
      ["src:other-same-line"];
    assert.notEqual(f.run().status, 0);

    // A narrow, independently approved column locator can distinguish them.
    f.expectation.expected.claims[0].sourceRefs = ["scripts/main.js:12:5"];
    assert.notEqual(f.run().status, 0); // Still citing unrelated operation.
    f.result.fullMapReview.decisions[0].observedEvidenceIds =
      ["src:verified-state"];
    const narrow = f.run();
    assert.equal(narrow.status, 0, narrow.stderr);
    assert.equal(JSON.parse(narrow.stdout).metrics.tp, 1);

    // Explicit line+column ranges use the same inclusive source-site check.
    f.expectation.expected.claims[0].sourceRefs =
      ["scripts/main.js:12:1-12:20"];
    assert.equal(f.run().status, 0);

    // This tests source-location admission only, NOT whether the reviewed
    // gameplay claim actually follows from the cited operation.
    f.expectation.expected.claims[0].sourceRefs = ["scripts/main.js:12:85"];
    assert.notEqual(f.run().status, 0);
  } finally {
    f.cleanup();
  }
});

test("negative counter-evidence is also ambiguous if different steps share a line", () => {
  const f = fixture();
  try {
    f.frozen.observed.gameplayStructure
      .sourceFlowCandidates[0].sourceSteps.push({
        id: "src:other-negative-same-line", kind: "state",
        executionRegionId: "function:other",
        source: {
          artifactId: "selected:map",
          relativePath: "scripts/main.js",
          range: { lineStart: 21, lineEnd: 21,
            columnStart: 60, columnEnd: 90 },
        },
      });
    assert.notEqual(f.run().status, 0);
    f.expectation.expected.claims[1].sourceRefs = ["scripts/main.js:21:5"];
    const narrow = f.run();
    assert.equal(narrow.status, 0, narrow.stderr);
    assert.equal(JSON.parse(narrow.stdout).metrics.tn, 1);
  } finally {
    f.cleanup();
  }
});

test("blind acceptance cannot be inferred from source receipt or reviewer presence", () => {
  const f = fixture();
  try {
    f.expectation.lane = "acceptance";
    const denied = f.run();
    assert.notEqual(denied.status, 0);
    f.result.fullMapReview.blindDeclared = true;
    f.result.fullMapReview.outputFrozenBeforeReveal = true;
    const selfDeclared = f.run();
    assert.equal(selfDeclared.status, 0, selfDeclared.stderr);
    const proof = JSON.parse(selfDeclared.stdout).fullMapProof;
    assert.equal(proof.blindIndependence,
      "REVIEWER_DECLARED_NOT_INDEPENDENTLY_ATTESTED");
  } finally { f.cleanup(); }
});

test("legacy reduced-fixture metric normalization is unchanged", () => {
  const root = mkdtempSync(join(tmpdir(), "m-bedrock-old-benchmark-"));
  try {
    const file = join(root, "legacy.json");
    writeFileSync(file, JSON.stringify({
      schemaVersion: 1, expectationId: "legacy-source",
      resultClass: "pass",
      metrics: { tp: 2, tn: 1, fp: 0, fn: 0, unknown: 0 },
    }));
    const done = spawnSync(process.execPath, [scorer, file],
      { encoding: "utf8" });
    assert.equal(done.status, 0, done.stderr);
    const scored = JSON.parse(done.stdout);
    assert.equal(scored.metrics.precision, 1);
    assert.equal(scored.metrics.recall, 1);
    assert.equal(scored.fullMapProof, undefined);
    assert.equal(scored.benchmarkEvidenceBoundary,
      "AGGREGATE_INPUT_ONLY_NOT_CURRENT_FULL_MAP_EVIDENCE");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
