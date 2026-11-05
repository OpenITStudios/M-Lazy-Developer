import { readFileSync } from "node:fs";

const routing = JSON.parse(
  readFileSync(".agents/evals/skill-routing.json", "utf8"),
);
const procedure = JSON.parse(
  readFileSync(".agents/evals/skill-procedure.json", "utf8"),
);

function stats(values) {
  const xs = values.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (!xs.length) return null;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance =
    xs.reduce((sum, value) => sum + (value - mean) ** 2, 0) / xs.length;
  return {
    n: xs.length,
    mean,
    stddev: Math.sqrt(variance),
    min: Math.min(...xs),
    max: Math.max(...xs),
  };
}


/** Optional, read-only Harness²-style contrast over the EXISTING frozen
 * routing/procedure corpus. Neither the run receipts nor edited harness
 * components are independently authenticated here; do not publish learned
 * rules or infer Minecraft correctness from this scorer.
 */
function scoreHarnessContrasts(payload, contrastInput, routingById, procedureById) {
  // Agent eval runs retain their existing immutable schema. This optional
  // sidecar owns only paired-run transport metadata, not another corpus,
  // score authority, engine execution, or persistent experience store.
  if (!contrastInput || contrastInput.schemaVersion !== 1 ||
      contrastInput.policy !== "agent-eval-harness-contrasts" ||
      !Array.isArray(contrastInput.contrasts) ||
      contrastInput.contrasts.length > 20 ||
      !Array.isArray(contrastInput.runEvidence) ||
      contrastInput.runEvidence.length > 200) {
    throw new Error("Agent harness contrasts require bounded versioned input and run evidence.");
  }
  const runsById = new Map();
  for (const run of payload.runs) {
    if (typeof run.runId !== "string" || !run.runId.trim() ||
        runsById.has(run.runId)) {
      throw new Error("Harness contrast requires unique nonempty runId for every run.");
    }
    runsById.set(run.runId, run);
  }
  const sha256 = (value) => typeof value === "string" &&
    /^[a-f0-9]{64}$/.test(value);
  const evidenceByRunId = new Map();
  for (const evidence of contrastInput.runEvidence) {
    if (!evidence || typeof evidence.runId !== "string" ||
        !evidence.runId.trim() || evidenceByRunId.has(evidence.runId) ||
        !runsById.has(evidence.runId)) {
      throw new Error("Contrast evidence must cite one unique current agent-eval runId.");
    }
    evidenceByRunId.set(evidence.runId, evidence);
  }
  const quality = (run) => {
    const route = routingById.get(run.caseId);
    const procedureCase = procedureById.get(run.caseId);
    if (!route && !procedureCase) return null;
    const checks = [];
    if (route) {
      for (const [key, actual] of [
        ["expectedLane", "selectedLane"],
        ["expectedSkill", "selectedSkill"],
        ["expectedTaskClass", "selectedTaskClass"],
        ["expectedOperation", "selectedOperation"],
        ["expectedKnowledgeDomain", "selectedKnowledgeDomain"],
      ]) {
        if (route[key] !== undefined) checks.push(run[actual] === route[key]);
      }
      const selected = [run.selectedLane, run.selectedSkill].filter(Boolean);
      for (const forbidden of route.forbidden ?? []) {
        checks.push(!selected.includes(forbidden));
      }
    } else if (procedureCase.lane) {
      checks.push(run.selectedLane === procedureCase.lane);
    }
    if (procedureCase) {
      if (run.assertions === null || typeof run.assertions !== "object" ||
          Array.isArray(run.assertions)) return null;
      for (const assertion of procedureCase.assertions ?? []) {
        if (typeof run.assertions[assertion] !== "boolean") return null;
        checks.push(run.assertions[assertion] === true);
      }
    }
    return checks.length === 0 ? null :
      { passed: checks.filter(Boolean).length, total: checks.length };
  };
  const observed = [];
  const seenIds = new Set();
  for (const contrast of contrastInput.contrasts) {
    if (!contrast || typeof contrast.id !== "string" ||
        !contrast.id.trim() || seenIds.has(contrast.id) ||
        !Array.isArray(contrast.changedComponents) ||
        contrast.changedComponents.length === 0 ||
        contrast.changedComponents.length > 8 ||
        contrast.changedComponents.some(x => typeof x !== "string" || !x.trim()) ||
        new Set(contrast.changedComponents).size !== contrast.changedComponents.length ||
        !Array.isArray(contrast.pairs) || contrast.pairs.length === 0 ||
        contrast.pairs.length > 20) {
      throw new Error("Malformed, duplicate or unbounded agent harness contrast.");
    }
    seenIds.add(contrast.id);
    const used = new Set();
    const usedReceiptHashes = new Set();
    const pairs = [];
    const deficits = [];
    const modelIds = new Set();
    const baseHarnesses = new Set();
    const candidateHarnesses = new Set();
    const caseIds = new Set();
    let improvements = 0, regressions = 0, unchanged = 0;
    let latencyCompared = 0, latencyDelta = 0, tokenCompared = 0, tokenDelta = 0;
    for (const pair of contrast.pairs) {
      const baseline = runsById.get(pair?.baselineRunId);
      const candidate = runsById.get(pair?.candidateRunId);
      if (!baseline || !candidate || baseline === candidate ||
          used.has(baseline.runId) || used.has(candidate.runId)) {
        throw new Error("Harness contrast pairs must reference distinct, existing and unused run IDs.");
      }
      used.add(baseline.runId);
      used.add(candidate.runId);
      const issue = [];
      const baseEvidence = evidenceByRunId.get(baseline.runId);
      const candidateEvidence = evidenceByRunId.get(candidate.runId);
      if (baseline.caseId !== candidate.caseId) {
        issue.push("different canonical evaluation cases");
      }
      if (!sha256(baseEvidence?.inputFingerprint) ||
          baseEvidence.inputFingerprint !== candidateEvidence?.inputFingerprint) {
        issue.push("missing or mismatched exact task input fingerprint");
      }
      if (!sha256(baseEvidence?.harnessFingerprint) ||
          !sha256(candidateEvidence?.harnessFingerprint) ||
          baseEvidence.harnessFingerprint === candidateEvidence.harnessFingerprint) {
        issue.push("missing or identical harness fingerprints");
      }
      if (baseEvidence?.executionStatus !== "executed" ||
          candidateEvidence?.executionStatus !== "executed" ||
          !sha256(baseEvidence?.executionEvidenceSha256) ||
          !sha256(candidateEvidence?.executionEvidenceSha256) ||
          baseEvidence.executionEvidenceSha256 === candidateEvidence.executionEvidenceSha256) {
        issue.push("missing independent execution receipt identifiers");
      }
      if (typeof baseline.model !== "string" || !baseline.model.trim() ||
          baseline.model !== candidate.model) {
        issue.push("model not pinned to the same executor configuration");
      }
      if (sha256(baseEvidence?.executionEvidenceSha256) &&
          sha256(candidateEvidence?.executionEvidenceSha256)) {
        if (usedReceiptHashes.has(baseEvidence.executionEvidenceSha256) ||
            usedReceiptHashes.has(candidateEvidence.executionEvidenceSha256)) {
          issue.push("reused rollout receipt cannot count as independent replication");
        }
        usedReceiptHashes.add(baseEvidence.executionEvidenceSha256);
        usedReceiptHashes.add(candidateEvidence.executionEvidenceSha256);
      }
      const baseQuality = quality(baseline);
      const nextQuality = quality(candidate);
      if (!baseQuality || !nextQuality ||
          baseQuality.total !== nextQuality.total) {
        issue.push("incomplete independently specified routing/procedure expectations");
      }
      if (issue.length === 0) {
        modelIds.add(baseline.model);
        baseHarnesses.add(baseEvidence.harnessFingerprint);
        candidateHarnesses.add(candidateEvidence.harnessFingerprint);
        caseIds.add(baseline.caseId);
        const delta = nextQuality.passed - baseQuality.passed;
        if (delta > 0) improvements++;
        else if (delta < 0) regressions++;
        else unchanged++;
        if (Number.isFinite(baseline.latencyMs) && baseline.latencyMs >= 0 &&
            Number.isFinite(candidate.latencyMs) && candidate.latencyMs >= 0) {
          latencyCompared++;
          latencyDelta += candidate.latencyMs - baseline.latencyMs;
        }
        if ([baseline.inputTokens, baseline.outputTokens,
             candidate.inputTokens, candidate.outputTokens].every(
               x => Number.isSafeInteger(x) && x >= 0)) {
          tokenCompared++;
          tokenDelta += candidate.inputTokens + candidate.outputTokens -
            baseline.inputTokens - baseline.outputTokens;
        }
      } else {
        deficits.push({ baselineRunId: baseline.runId,
          candidateRunId: candidate.runId, reasons: issue });
      }
      pairs.push({
        caseId: baseline.caseId,
        baselineRunId: baseline.runId,
        candidateRunId: candidate.runId,
        ...(baseQuality === null ? {} : { baselineScore: baseQuality }),
        ...(nextQuality === null ? {} : { candidateScore: nextQuality }),
        comparable: issue.length === 0,
        reasons: issue,
      });
    }
    const comparable = deficits.length === 0 && modelIds.size === 1 &&
      baseHarnesses.size === 1 && candidateHarnesses.size === 1 &&
      contrast.pairs.length >= 2 && contrast.changedComponents.length === 1;
    const verdict = !comparable
      ? "confounded"
      : improvements >= 2 && regressions === 0
        ? "helped"
        : regressions >= 2 && improvements === 0
          ? "hurt"
          : improvements === 0 && regressions === 0
            ? "no observed effect"
            : "confounded";
    const canProposeLesson = verdict === "helped" && caseIds.size >= 2 &&
      contrast.proposedLesson &&
      typeof contrast.proposedLesson.cue === "string" &&
      contrast.proposedLesson.cue.trim() &&
      typeof contrast.proposedLesson.operation === "string" &&
      contrast.proposedLesson.operation.trim();
    observed.push({
      id: contrast.id,
      changedComponents: [...contrast.changedComponents],
      verdict,
      caseCount: caseIds.size,
      pairCount: pairs.length,
      comparablePairs: pairs.length - deficits.length,
      improvements, regressions, unchanged,
      pairs,
      ...(latencyCompared === pairs.length
        ? { meanCandidateMinusBaselineLatencyMs: latencyDelta / pairs.length }
        : {}),
      ...(tokenCompared === pairs.length
        ? { meanCandidateMinusBaselineTokens: tokenDelta / pairs.length }
        : {}),
      reasons: [
        ...(deficits.length ? ["Some pairs have unproven identity, model, execution or expectation boundaries."] : []),
        ...(modelIds.size > 1 || baseHarnesses.size > 1 || candidateHarnesses.size > 1
          ? ["Contrasts must retain one model and one baseline/candidate harness identity."] : []),
        ...(contrast.pairs.length < 2 ? ["A single pair cannot isolate a repeatable effect."] : []),
        ...(contrast.changedComponents.length !== 1
          ? ["Multiple changed components prevent per-component attribution."] : []),
        ...(improvements > 0 && regressions > 0
          ? ["Mixed positive/negative changes are confounded."] : []),
        "Only provided execution receipt identifiers and frozen skill-eval expectations were compared; this scorer does not authenticate rollout artifacts or evaluate Minecraft gameplay.",
      ],
      transferableLesson: canProposeLesson
        ? { status: "REVIEWABLE_CANDIDATE_NOT_ADOPTED",
            cue: contrast.proposedLesson.cue.trim(),
            operation: contrast.proposedLesson.operation.trim(),
            supportingCaseIds: [...caseIds].sort() }
        : { status: "NO_EVIDENCE_SUPPORTED_LESSON" },
      proofBoundary: "DECLARED_AGENT_EVAL_RECEIPTS_NOT_VERIFIED_MINECRAFT_OR_CAUSAL_EFFECT",
    });
  }
  return observed;
}

export function scoreAgentEvalRuns(payload, contrastInput) {
  if (payload?.schemaVersion !== 1 || !Array.isArray(payload.runs)) {
    throw new Error("Agent eval payload must use schemaVersion 1 and runs array.");
  }

  const routingById = new Map((routing.cases ?? []).map((item) => [item.id, item]));
  const procedureById = new Map((procedure.cases ?? []).map((item) => [item.id, item]));

  let routingEligible = 0;
  let routingCorrect = 0;
  let forbiddenViolations = 0;
  let procedureAssertions = 0;
  let procedurePassed = 0;
  const caseBuckets = new Map();

  for (const run of payload.runs) {
    const routeCase = routingById.get(run.caseId);
    if (routeCase) {
      routingEligible += 1;
      const laneMatch =
        routeCase.expectedLane === undefined ||
        routeCase.expectedLane === run.selectedLane;
      const skillMatch =
        routeCase.expectedSkill === undefined ||
        routeCase.expectedSkill === run.selectedSkill;
      const taskClassMatch =
        routeCase.expectedTaskClass === undefined ||
        routeCase.expectedTaskClass === run.selectedTaskClass;

      const operationMatch =
        routeCase.expectedOperation === undefined ||
        routeCase.expectedOperation === run.selectedOperation;
      const knowledgeMatch =
        routeCase.expectedKnowledgeDomain === undefined ||
        routeCase.expectedKnowledgeDomain === run.selectedKnowledgeDomain;
      if (laneMatch && skillMatch && taskClassMatch && operationMatch && knowledgeMatch) routingCorrect += 1;

      const selected = [run.selectedLane, run.selectedSkill].filter(Boolean);
      if ((routeCase.forbidden ?? []).some((item) => selected.includes(item))) {
        forbiddenViolations += 1;
      }

      const bucket = caseBuckets.get(run.caseId) ?? [];
      bucket.push(
        run.selectedLane ??
        run.selectedTaskClass ??
        "<none>",
      );
      caseBuckets.set(run.caseId, bucket);
    }

    const procedureCase = procedureById.get(run.caseId);
    if (procedureCase && run.assertions && typeof run.assertions === "object") {
      for (const assertion of procedureCase.assertions ?? []) {
        procedureAssertions += 1;
        if (run.assertions[assertion] === true) procedurePassed += 1;
      }
    }
  }

  const agreements = [...caseBuckets.entries()].map(([caseId, values]) => {
    const counts = new Map();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    const top = [...counts.entries()].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0]))[0];
    return {
      caseId,
      runs: values.length,
      modalSelection: top?.[0],
      agreementRate: values.length === 0 ? null : (top?.[1] ?? 0) / values.length,
      selections: Object.fromEntries([...counts.entries()].sort()),
    };
  }).sort((a,b)=>a.caseId.localeCompare(b.caseId));

  return {
    schemaVersion: 1,
    runs: payload.runs.length,
    routing: {
      eligible: routingEligible,
      correct: routingCorrect,
      accuracy: routingEligible === 0 ? null : routingCorrect / routingEligible,
      forbiddenViolations,
    },
    procedure: {
      assertions: procedureAssertions,
      passed: procedurePassed,
      passRate:
        procedureAssertions === 0 ? null : procedurePassed / procedureAssertions,
    },
    performance: {
      latencyMs: stats(payload.runs.map((item) => item.latencyMs)),
      inputTokens: stats(payload.runs.map((item) => item.inputTokens)),
      outputTokens: stats(payload.runs.map((item) => item.outputTokens)),
      totalTokens: stats(payload.runs.map((item) =>
        typeof item.inputTokens === "number" &&
        typeof item.outputTokens === "number"
          ? item.inputTokens + item.outputTokens
          : undefined
      )),
    },
    agreement: agreements,
    ...(contrastInput === undefined ? {} : {
      contrastReviews: scoreHarnessContrasts(payload, contrastInput, routingById, procedureById),
    }),
  };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll("\\","/"))) {
  const path = process.argv[2];
  if (!path) throw new Error("Usage: node score-agent-eval.mjs <runs.json> [contrasts.json]");
  const payload = JSON.parse(readFileSync(path, "utf8"));
  const contrasts = process.argv[3] === undefined
    ? undefined : JSON.parse(readFileSync(process.argv[3], "utf8"));
  process.stdout.write(JSON.stringify(scoreAgentEvalRuns(payload, contrasts), null, 2) + "\n");
}
