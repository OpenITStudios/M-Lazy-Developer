import { test } from "node:test";
import assert from "node:assert/strict";
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
function reflect(pair) {
  return scoreAgentEvalRuns(pair.runs, pair.contrast).contrastReviews[0];
}

test("replicated independent cases yield reviewable lesson, not automatic adoption", () => {
  const r = reflect(makePayload());
  assert.equal(r.verdict, "helped");
  assert.equal(r.improvements, 2);
  assert.equal(r.caseCount, 2);
  assert.equal(r.transferableLesson.status, "REVIEWABLE_CANDIDATE_NOT_ADOPTED");
  assert.equal(r.proofBoundary,
    "DECLARED_AGENT_EVAL_RECEIPTS_NOT_VERIFIED_MINECRAFT_OR_CAUSAL_EFFECT");
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

test("unexecuted receipts, changed task or repeated evidence never help", () => {
  const x = makePayload();
  x.contrast.runEvidence[0].executionStatus = "source-reviewed";
  assert.equal(reflect(x).verdict, "confounded");
  x.contrast.runEvidence[0].executionStatus = "executed";
  x.contrast.runEvidence[0].inputFingerprint = fixed("c");
  assert.equal(reflect(x).verdict, "confounded");
  x.contrast.runEvidence[0].inputFingerprint = fixed("a");
  x.contrast.runEvidence[2].executionEvidenceSha256 =
    x.contrast.runEvidence[0].executionEvidenceSha256;
  assert.equal(reflect(x).verdict, "confounded");
});

test("unscored procedure case and duplicate IDs fail closed", () => {
  const x = makePayload();
  x.runs.runs[0].caseId = "improve-system-source";
  x.runs.runs[1].caseId = "improve-system-source";
  assert.equal(reflect(x).verdict, "confounded");
  x.runs.runs[0].runId = "c1";
  assert.throws(() => reflect(x), /unique nonempty runId/);
});

test("existing single-file eval scorer remains backward compatible", () => {
  const result = scoreAgentEvalRuns({schemaVersion: 1, runs: [{
    caseId: "audit-id-01", runId: "legacy",
    selectedLane: "m-bedrock-map-testing",
  }]});
  assert.equal(result.routing.correct, 1);
  assert.equal("contrastReviews" in result, false);
});
