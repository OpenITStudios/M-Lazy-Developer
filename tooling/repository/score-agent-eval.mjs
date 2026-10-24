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

export function scoreAgentEvalRuns(payload) {
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
  };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll("\\","/"))) {
  const path = process.argv[2];
  if (!path) throw new Error("Usage: node score-agent-eval.mjs <runs.json>");
  const payload = JSON.parse(readFileSync(path, "utf8"));
  process.stdout.write(JSON.stringify(scoreAgentEvalRuns(payload), null, 2) + "\n");
}
