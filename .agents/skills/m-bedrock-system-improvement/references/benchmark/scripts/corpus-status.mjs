import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// This is a metadata inventory, not an executed benchmark or proof that the
// declared external world or expectation is independently verified.
const readinessMeaning =
  "MANIFEST_STATUS_AND_MISSING_SENTINEL_ONLY_NOT_EXECUTED_OR_SCORED";
const forms = [
  "DECLARED_MAP_ARTIFACT",
  "DECLARED_REDUCED_FIXTURE",
  "REFERENCE_OR_FORM_UNVERIFIED",
];
function declaredForm(item) {
  if (
    (typeof item.artifactFile === "string" &&
      item.artifactFile.trim().length > 0) ||
    (item.externalArtifact !== undefined && item.externalArtifact !== null)
  ) return forms[0];
  if (item.readiness?.minimizedFixture === "present" &&
      typeof item.sourceRef === "string" &&
      item.sourceRef.trim().length > 0) return forms[1];
  return forms[2];
}
const newCounts = () => ({ cases: 0, ready: 0, candidate: 0, blocked: 0 });

const manifests = [
  "engine/reliability/corpus/calibration.json",
  "engine/reliability/corpus/acceptance.json",
  "engine/reliability/corpus/regressions.json",
];

const summary = {
  schemaVersion: 1,
  evidenceBoundary: readinessMeaning,
  /** Case form is inferred from metadata, never proof that a file ran. */
  declaredCaseForms: Object.fromEntries(forms.map(form => [form, newCounts()])),
  manifests: [],
  totals: {
    cases: 0,
    ready: 0,
    candidate: 0,
    blocked: 0,
    positiveEvidence: 0,
    negativeEvidence: 0,
    unspecifiedEvidence: 0,
  },
};

for (const path of manifests) {
  const data = JSON.parse(readFileSync(resolve(path), "utf8"));
  const cases = Array.isArray(data.cases) ? data.cases : [];
  const perForm = Object.fromEntries(forms.map(form => [form, newCounts()]));
  const rows = cases.map((item) => {
    const readiness = item.readiness ?? {};
    const missing = Object.entries(readiness)
      .filter(([, value]) => value === "missing")
      .map(([key]) => key);

    const status =
      item.status === "ready" && missing.length === 0
        ? "ready"
        : item.status === "blocked"
          ? "blocked"
          : "candidate";

    summary.totals.cases += 1;
    summary.totals[status] += 1;

    const form = declaredForm(item);
    for (const counts of [summary.declaredCaseForms[form], perForm[form]]) {
      counts.cases += 1;
      counts[status] += 1;
    }

    const evidenceRole =
      item.evidenceRole === "negative"
        ? "negative"
        : item.evidenceRole === "positive"
          ? "positive"
          : "unspecified";

    if (evidenceRole === "negative") {
      summary.totals.negativeEvidence += 1;
    } else if (evidenceRole === "positive") {
      summary.totals.positiveEvidence += 1;
    } else {
      summary.totals.unspecifiedEvidence += 1;
    }

    return {
      id: item.id,
      status,
      readinessBasis: readinessMeaning,
      declaredForm: form,
      missing,
      sourceRef: item.sourceRef ?? null,
      evidenceRole,
    };
  });

  summary.manifests.push({
    id: data.id,
    lane: data.lane,
    declaredCaseForms: perForm,
    cases: rows,
  });
}

process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
