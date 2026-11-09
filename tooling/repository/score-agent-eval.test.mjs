import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scoreAgentEvalRuns } from "./score-agent-eval.mjs";

const fixed = (c) => c.repeat(64);
function run(id, caseId, role, pass) {
  return {
    runId: id, caseId,
    selectedLane: pass
      ? (caseId.startsWith("dev-")
          ? "m-bedrock-system-improvement" : "m-bedrock-map-testing")
      : (caseId.startsWith("dev-")
          ? "m-bedrock-map-testing" : "m-bedrock-system-improvement"),
    model: "pinned-evaluator",
    latencyMs: role === "baseline" ? 100 : 90,
    inputTokens: 10, outputTokens: 5,
  };
}
function makePayload(base = false, candidate = true) {
  const runs = [
    run("b1", "audit-id-01", "baseline", base),
    run("c1", "audit-id-01", "candidate", candidate),
    run("b2", "dev-id-01", "baseline", base),
    run("c2", "dev-id-01", "candidate", candidate),
  ];
  const runEvidence = runs.map((r, i) => ({
    runId: r.runId,
    inputFingerprint: fixed(r.caseId.startsWith("dev-") ? "b" : "a"),
    harnessFingerprint: fixed(i % 2 === 0 ? "1" : "2"),
    executionStatus: "executed",
    executionEvidenceSha256: fixed(String(i + 3)),
  }));
  const pairs = [
    {baselineRunId: "b1", candidateRunId: "c1"},
    {baselineRunId: "b2", candidateRunId: "c2"},
  ];
  const contrast = { id: "controlled", changedComponents: ["tool-guidance"],
    pairs, proposedLesson: {
      cue: "repeated task routing error",
      operation: "clarify the smallest required tool guidance",
    },
  };
  return {
    runs: {schemaVersion: 1, runs},
    contrast: {schemaVersion: 1, policy: "agent-eval-harness-contrasts",
      runEvidence, contrasts: [contrast]},
  };
}
/** Real ephemeral JSON receipt files, never repository fixtures or saved map
 * evidence. Tests verify integrity/mirroring only, not executor attestation.
 */
function withReceipts(pair, check) {
  const directory = mkdtempSync(join(tmpdir(), "m-lazy-agent-eval-"));
  try {
    for (const evidence of pair.contrast.runEvidence) {
      const run = pair.runs.runs.find(r => r.runId === evidence.runId);
      if (!run) throw new Error("Missing run in test setup");
      const observed = Object.fromEntries([
        "selectedLane", "selectedSkill", "selectedTaskClass",
        "selectedOperation", "selectedKnowledgeDomain", "assertions",
      ].filter(key => Object.hasOwn(run, key)).map(key => [key, run[key]]));
      const receipt = {
        schemaVersion: 1, policy: "agent-eval-execution-receipt",
        runId: run.runId, caseId: run.caseId, model: run.model,
        inputFingerprint: evidence.inputFingerprint,
        harnessFingerprint: evidence.harnessFingerprint,
        executionStatus: evidence.executionStatus,
        observed,
        metrics: { latencyMs: run.latencyMs, inputTokens: run.inputTokens,
          outputTokens: run.outputTokens },
      };
      evidence.receiptFile = run.runId + ".json";
      const bytes = Buffer.from(JSON.stringify(receipt) + "\n", "utf8");
      writeFileSync(join(directory, evidence.receiptFile), bytes);
      evidence.executionEvidenceSha256 =
        createHash("sha256").update(bytes).digest("hex");
    }
    return check(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
function reflect(pair, mutate) {
  return withReceipts(pair, directory => {
    mutate?.(pair, directory);
    return scoreAgentEvalRuns(pair.runs, pair.contrast, {
      receiptDirectory: directory,
    }).contrastReviews[0];
  });
}

test("replicated independent cases yield reviewable lesson, not automatic adoption", () => {
  const r = reflect(makePayload());
  assert.equal(r.verdict, "helped");
  assert.equal(r.improvements, 2);
  assert.equal(r.caseCount, 2);
  assert.equal(r.transferableLesson.status, "REVIEWABLE_CANDIDATE_NOT_ADOPTED");
  assert.equal(r.proofBoundary,
    "FILE_HASH_AND_OBSERVATION_MATCH_NOT_EXECUTION_ATTESTATION_OR_MINECRAFT_PROOF");
  assert.equal(r.comparablePairs, 2);
});

test("regression and equal quality stay distinct from efficiency claims", () => {
  assert.equal(reflect(makePayload(true, false)).verdict, "hurt");
  const equal = reflect(makePayload(true, true));
  assert.equal(equal.verdict, "no observed effect");
  assert.ok(equal.meanCandidateMinusBaselineLatencyMs < 0);
  assert.equal(equal.transferableLesson.status, "NO_EVIDENCE_SUPPORTED_LESSON");
});

test("single pairs, multiple changes and mixed outcomes are confounded", () => {
  const x = makePayload();
  x.contrast.contrasts[0].changedComponents.push("skills");
  assert.equal(reflect(x).verdict, "confounded");
  x.contrast.contrasts[0].changedComponents = ["tool-guidance"];
  x.contrast.contrasts[0].pairs.pop();
  assert.equal(reflect(x).verdict, "confounded");
  x.contrast.contrasts[0].pairs.push(
    {baselineRunId: "b2", candidateRunId: "c2"});
  x.runs.runs[2].selectedLane = "m-bedrock-system-improvement";
  x.runs.runs[3].selectedLane = "m-bedrock-map-testing";
  assert.equal(reflect(x).verdict, "confounded");
});

test("one regression and one unchanged pair retains baseline rather than being unclassified", () => {
  const x = makePayload(true, true);
  x.runs.runs[1].selectedLane = "m-bedrock-system-improvement";
  const r = reflect(x);
  assert.equal(r.verdict, "hurt");
  assert.equal(r.regressions, 1);
  assert.equal(r.unchanged, 1);
  assert.equal(r.regressedOracleChecks, 2);
  assert.equal(r.candidateDisposition, "KEEP_BASELINE");
});

test("a net score gain cannot erase a previously passing frozen assertion", () => {
  const x = makePayload();
  x.runs.runs[0].caseId = "improve-system-source";
  x.runs.runs[1].caseId = "improve-system-source";
  x.runs.runs[0].selectedLane = "m-bedrock-system-improvement";
  x.runs.runs[1].selectedLane = "m-bedrock-system-improvement";
  const names = [
    "single existing source owner",
    "no target write during system improvement",
    "Skills/Probe source and report versions separated",
    "no unsupported gameplay proof",
    "GitHub Local commit verified",
  ];
  x.runs.runs[0].assertions = Object.fromEntries(
    names.map((name, i) => [name, i < 2]));
  x.runs.runs[1].assertions = Object.fromEntries(
    names.map((name, i) => [name, i >= 1 && i <= 3]));
  const r = reflect(x);
  // The procedure-lane assertion is a sixth frozen check on this case.
  assert.equal(r.pairs[0].baselineScore.passed, 3);
  assert.equal(r.pairs[0].candidateScore.passed, 4);
  assert.equal(r.pairs[0].regressedOracleChecks, 1);
  assert.equal(r.regressedOracleChecks, 1);
  assert.equal(r.improvements, 1);
  assert.equal(r.regressions, 1);
  assert.equal(r.verdict, "confounded");
  assert.equal(r.candidateDisposition, "KEEP_BASELINE");
  assert.equal(r.transferableLesson.status, "NO_EVIDENCE_SUPPORTED_LESSON");
});

test("unexecuted receipts, changed task or repeated evidence never help", () => {
  const x = makePayload();
  x.contrast.runEvidence[0].executionStatus = "source-reviewed";
  assert.equal(reflect(x).verdict, "confounded");
  x.contrast.runEvidence[0].executionStatus = "executed";
  x.contrast.runEvidence[0].inputFingerprint = fixed("c");
  assert.equal(reflect(x).verdict, "confounded");
  x.contrast.runEvidence[0].inputFingerprint = fixed("a");
  assert.equal(reflect(x, pair => {
    pair.contrast.runEvidence[2].executionEvidenceSha256 =
      pair.contrast.runEvidence[0].executionEvidenceSha256;
  }).verdict, "confounded");
});

test("unscored procedure case and duplicate IDs fail closed", () => {
  const x = makePayload();
  x.runs.runs[0].caseId = "improve-system-source";
  x.runs.runs[1].caseId = "improve-system-source";
  assert.equal(reflect(x).verdict, "confounded");
  x.runs.runs[0].runId = "c1";
  // This is an input-identity rejection, before receipt file setup.
  assert.throws(() => scoreAgentEvalRuns(x.runs, x.contrast),
    /unique nonempty runId/);
});

test("missing receipt directory and absent receipt bytes never earn a verdict", () => {
  const x = makePayload();
  const direct = scoreAgentEvalRuns(x.runs, x.contrast).contrastReviews[0];
  assert.equal(direct.verdict, "confounded");
  assert.ok(direct.pairs[0].reasons.some(reason =>
    reason.includes("receipt directory")));
  const missing = reflect(makePayload(), (_pair, directory) =>
    rmSync(join(directory, "b1.json")));
  assert.equal(missing.verdict, "confounded");
  assert.ok(missing.pairs[0].reasons.some(reason =>
    reason.includes("unavailable")));
});

test("checksum tampering and unsafe filenames fail closed", () => {
  const altered = reflect(makePayload(), (_pair, directory) =>
    writeFileSync(join(directory, "b1.json"), "{}\n"));
  assert.equal(altered.verdict, "confounded");
  assert.ok(altered.pairs[0].reasons.some(reason =>
    reason.includes("SHA-256")));
  const unsafe = reflect(makePayload(), pair => {
    pair.contrast.runEvidence[0].receiptFile = "../another.json";
  });
  assert.equal(unsafe.verdict, "confounded");
  assert.ok(unsafe.pairs[0].reasons.some(reason =>
    reason.includes("unsafe direct-child")));
});

test("a matching file hash cannot override a contradictory recorded observation", () => {
  const result = reflect(makePayload(), (pair, directory) => {
    const path = join(directory, "c1.json");
    const data = JSON.parse(readFileSync(path, "utf8"));
    data.observed.selectedLane = "m-bedrock-system-improvement";
    const bytes = Buffer.from(JSON.stringify(data) + "\n");
    writeFileSync(path, bytes);
    pair.contrast.runEvidence[1].executionEvidenceSha256 =
      createHash("sha256").update(bytes).digest("hex");
  });
  assert.equal(result.verdict, "confounded");
  assert.ok(result.pairs[0].reasons.some(reason =>
    reason.includes("observations disagree")));
});

test("a receipt symlink is rejected without dereferencing it", () => {
  const x = makePayload();
  const review = reflect(x, (_pair, directory) => {
    rmSync(join(directory, "b1.json"));
    try {
      symlinkSync(join(directory, "b2.json"), join(directory, "b1.json"));
    } catch (error) {
      // Windows without symlink permission must still reject the missing
      // receipt; never claim to have tested symlink handling in that case.
      if (error?.code !== "EPERM" && error?.code !== "EACCES") throw error;
    }
  });
  assert.equal(review.verdict, "confounded");
  assert.ok(review.pairs[0].reasons.some(reason =>
    reason.includes("symlink") || reason.includes("unavailable")));
});

test("omitted procedure assertions count as failures instead of disappearing", () => {
  const caseId = "improve-system-source";
  const missing = scoreAgentEvalRuns({schemaVersion: 1, runs: [{
    caseId, runId: "missing", selectedLane: "m-bedrock-system-improvement",
  }]});
  assert.equal(missing.procedure.assertions, 5);
  assert.equal(missing.procedure.passed, 0);
  assert.equal(missing.procedure.passRate, 0);

  const partial = scoreAgentEvalRuns({schemaVersion: 1, runs: [{
    caseId, runId: "partial", selectedLane: "m-bedrock-system-improvement",
    assertions: {"single existing source owner": true},
  }]});
  assert.equal(partial.procedure.assertions, 5);
  assert.equal(partial.procedure.passed, 1);
  assert.equal(partial.procedure.passRate, 0.2);
});

test("procedure claims cannot pass under the wrong active work lane", () => {
  const assertions = {
    "single existing source owner": true,
    "no target write during system improvement": true,
    "Skills/Probe source and report versions separated": true,
    "no unsupported gameplay proof": true,
    "GitHub Local commit verified": true,
  };
  const wrongLane = scoreAgentEvalRuns({schemaVersion: 1, runs: [{
    runId: "wrong", caseId: "improve-system-source",
    selectedLane: "m-bedrock-map-testing", assertions,
  }]});
  assert.equal(wrongLane.procedure.assertions, 5);
  assert.equal(wrongLane.procedure.passed, 0);
  assert.equal(wrongLane.procedure.passRate, 0);
  const rightLane = scoreAgentEvalRuns({schemaVersion: 1, runs: [{
    runId: "right", caseId: "improve-system-source",
    selectedLane: "m-bedrock-system-improvement", assertions,
  }]});
  assert.equal(rightLane.procedure.assertions, 5);
  assert.equal(rightLane.procedure.passed, 5);
});

test("a forbidden selected skill cannot earn routing accuracy credit", () => {
  const result = scoreAgentEvalRuns({schemaVersion: 1, runs: [{
    caseId: "audit-id-01", runId: "forbidden",
    selectedLane: "m-bedrock-map-testing",
    selectedSkill: "m-bedrock-system-improvement",
  }]});
  assert.equal(result.routing.eligible, 1);
  assert.equal(result.routing.forbiddenViolations, 1);
  assert.equal(result.routing.correct, 0);
  assert.equal(result.routing.accuracy, 0);
});

test("existing single-file eval scorer remains backward compatible", () => {
  const result = scoreAgentEvalRuns({schemaVersion: 1, runs: [{
    caseId: "audit-id-01", runId: "legacy",
    selectedLane: "m-bedrock-map-testing",
  }]});
  assert.equal(result.routing.correct, 1);
  assert.equal("contrastReviews" in result, false);
});

test("invalid agent-eval performance values are rejected before scoring", () => {
  const valid = {
    schemaVersion: 1,
    runs: [{
      caseId: "audit-id-01",
      runId: "counter-check",
      selectedLane: "m-bedrock-map-testing",
      latencyMs: 120,
      inputTokens: 100,
      outputTokens: 40,
    }],
  };
  assert.equal(scoreAgentEvalRuns(valid).routing.accuracy, 1);

  for (const [field, value] of [
    ["latencyMs", -1],
    ["latencyMs", Infinity],
    ["latencyMs", NaN],
    ["latencyMs", "100"],
    ["inputTokens", -2],
    ["inputTokens", 1.5],
    ["inputTokens", Number.MAX_SAFE_INTEGER + 1],
    ["outputTokens", null],
    ["outputTokens", -1],
  ]) {
    const runWithInvalidMetric = {
      ...valid.runs[0],
      [field]: value,
    };
    assert.throws(() => scoreAgentEvalRuns({
      schemaVersion: 1,
      runs: [runWithInvalidMetric],
    }), new RegExp(field));
  }

  const noCounters = scoreAgentEvalRuns({
    schemaVersion: 1,
    runs: [{
      caseId: "audit-id-01",
      runId: "without-counters",
      selectedLane: "m-bedrock-map-testing",
    }],
  });
  assert.equal(noCounters.routing.accuracy, 1);
  assert.equal(noCounters.performance.latencyMs, null);
  assert.equal(noCounters.performance.totalTokens, null);
});

test("streaming statistics handle 150,000 recorded evaluation runs", () => {
  const runs = Array.from({length: 150_000}, (_, index) => ({
    runId: "stress-" + index,
    caseId: "audit-id-01",
    selectedLane: "m-bedrock-map-testing",
    latencyMs: 1200,
    inputTokens: 1000,
    outputTokens: 300,
  }));
  const scored = scoreAgentEvalRuns({schemaVersion: 1, runs});
  assert.equal(scored.routing.accuracy, 1);
  assert.deepEqual(scored.performance.latencyMs, {
    n: runs.length, mean: 1200, stddev: 0, min: 1200, max: 1200,
  });
  assert.deepEqual(scored.performance.totalTokens, {
    n: runs.length, mean: 1300, stddev: 0, min: 1300, max: 1300,
  });
});

test("streaming statistics retain variance and reject overflowing token totals", () => {
  const runs = [1, 3, 5, 7].map((latencyMs, index) => ({
    runId: "var-" + index,
    caseId: "audit-id-01",
    selectedLane: "m-bedrock-map-testing",
    latencyMs,
    inputTokens: 50,
    outputTokens: index,
  }));
  const scored = scoreAgentEvalRuns({schemaVersion: 1, runs});
  assert.equal(scored.performance.latencyMs.mean, 4);
  assert.equal(scored.performance.latencyMs.stddev, Math.sqrt(5));
  assert.equal(scored.performance.latencyMs.min, 1);
  assert.equal(scored.performance.latencyMs.max, 7);
  assert.equal(scored.performance.totalTokens.min, 50);
  assert.equal(scored.performance.totalTokens.max, 53);
  assert.throws(() => scoreAgentEvalRuns({schemaVersion: 1, runs: [{
    ...runs[0], inputTokens: Number.MAX_SAFE_INTEGER, outputTokens: 1,
  }]}), /total token counter/);
});
