import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  throw new Error("Usage: node validate-output.mjs <audit.json>");
}

const data = JSON.parse(readFileSync(path, "utf8"));
const dispositions = new Set([
  "defect",
  "designed-behavior",
  "ambiguous-intent",
  "insufficient-evidence",
  "runtime-proof-required",
  "detection-gap",
]);
const ceilings = new Set([
  "STATIC VERIFIED",
  "PACKAGE VERIFIED",
  "LOCAL GAME VERIFIED",
  "LIVE GAME VERIFIED",
  "UNKNOWN",
]);
const surfaceStatuses = new Set([
  "checked",
  "blocked",
  "not-applicable",
]);

const errors = [];

if (data.schemaVersion !== 1) {
  errors.push("schemaVersion must be 1");
}
if (
  typeof data.artifactId !== "string" ||
  !data.artifactId.trim()
) {
  errors.push("artifactId required");
}
if (
  typeof data.mapVersion !== "string" ||
  !data.mapVersion.trim()
) {
  errors.push("mapVersion required");
}

if (
  data.evidenceScope?.mode !==
  "selected-map-version-only"
) {
  errors.push(
    "evidenceScope.mode must be selected-map-version-only",
  );
}
if (
  typeof data.evidenceScope?.selectedArtifact !== "string" ||
  !data.evidenceScope.selectedArtifact.trim()
) {
  errors.push(
    "evidenceScope.selectedArtifact required",
  );
}
if (data.evidenceScope?.archiveSourcesUsed !== false) {
  errors.push(
    "archiveSourcesUsed must be false for normal map audit",
  );
}

if (!Array.isArray(data.candidates)) {
  errors.push("candidates must be array");
}
if (!Array.isArray(data.coverage?.records)) {
  errors.push("coverage.records must be array");
}

const candidateIds = new Set();
for (const candidate of data.candidates ?? []) {
  if (
    typeof candidate.id !== "string" ||
    !candidate.id.trim()
  ) {
    errors.push("candidate id required");
    continue;
  }
  if (candidateIds.has(candidate.id)) {
    errors.push(
      "duplicate candidate id: " + candidate.id,
    );
  }
  candidateIds.add(candidate.id);

  if (!dispositions.has(candidate.disposition)) {
    errors.push(
      "invalid disposition: " + candidate.disposition,
    );
  }
  if (!ceilings.has(candidate.proofCeiling)) {
    errors.push(
      "invalid proof ceiling for " + candidate.id,
    );
  }
  if (
    !Array.isArray(candidate.subjectIds) ||
    candidate.subjectIds.length === 0
  ) {
    errors.push(
      "candidate requires subjectIds: " + candidate.id,
    );
  }

  if (
    candidate.disposition !== "defect" &&
    candidate.severity !== undefined
  ) {
    errors.push(
      "severity only allowed for defect: " +
        candidate.id,
    );
  }

  if (candidate.disposition === "defect") {
    if (
      !["Blocker", "Major", "Minor"].includes(
        candidate.severity,
      )
    ) {
      errors.push(
        "defect requires valid severity: " +
          candidate.id,
      );
    }
    if (
      candidate.expectedAuthority !==
      "selected-artifact"
    ) {
      errors.push(
        "defect expectedAuthority must be selected-artifact: " +
          candidate.id,
      );
    }
    if (
      candidate.counterEvidence !== "cleared"
    ) {
      errors.push(
        "defect requires cleared counter-evidence: " +
          candidate.id,
      );
    }
    if (
      !["blocking", "material"].includes(
        candidate.playerImpact,
      )
    ) {
      errors.push(
        "defect requires material player impact: " +
          candidate.id,
      );
    }
    if (candidate.testerTriggerReady !== true) {
      errors.push(
        "defect requires testerTriggerReady=true: " +
          candidate.id,
      );
    }
  }
}

const records = data.coverage?.records ?? [];
const surfaceIds = new Set();
const referencedCandidateIds = new Set();
const counts = {
  checked: 0,
  blocked: 0,
  "not-applicable": 0,
};

for (const record of records) {
  if (
    typeof record.subjectId !== "string" ||
    !record.subjectId.trim()
  ) {
    errors.push("coverage subjectId required");
    continue;
  }

  if (surfaceIds.has(record.subjectId)) {
    errors.push(
      "duplicate coverage subject: " +
        record.subjectId,
    );
  }
  surfaceIds.add(record.subjectId);

  if (!surfaceStatuses.has(record.status)) {
    errors.push(
      "invalid coverage status for " +
        record.subjectId,
    );
  } else {
    counts[record.status] += 1;
  }

  if (
    record.status === "blocked" &&
    (
      typeof record.reason !== "string" ||
      !record.reason.trim()
    )
  ) {
    errors.push(
      "blocked coverage requires reason: " +
        record.subjectId,
    );
  }

  for (const candidateId of record.candidateIds ?? []) {
    if (!candidateIds.has(candidateId)) {
      errors.push(
        "coverage references unknown candidate " +
          candidateId +
          " from " +
          record.subjectId,
      );
    }
    referencedCandidateIds.add(candidateId);
  }
}

for (const candidate of data.candidates ?? []) {
  for (const subjectId of candidate.subjectIds ?? []) {
    if (!surfaceIds.has(subjectId)) {
      errors.push(
        "candidate " +
          candidate.id +
          " references unaccounted subject " +
          subjectId,
      );
    }
  }
  if (
    candidate.id &&
    !referencedCandidateIds.has(candidate.id)
  ) {
    errors.push(
      "candidate is not mapped to any coverage record: " +
        candidate.id,
    );
  }
}

if (data.coverage?.disposition !== "accounted") {
  errors.push(
    "coverage.disposition must be accounted",
  );
}
if (
  data.coverage?.scope !==
  "discovered-surfaces-only"
) {
  errors.push(
    "coverage.scope must be discovered-surfaces-only",
  );
}
if (
  data.coverage?.discoveryCompleteness !==
  "not-proven"
) {
  errors.push(
    "coverage.discoveryCompleteness must be not-proven",
  );
}
if (
  Array.isArray(data.coverage?.missingSubjectIds) &&
  data.coverage.missingSubjectIds.length > 0
) {
  errors.push(
    "coverage missingSubjectIds must be empty",
  );
}
if (
  data.coverage?.totalSurfaces !== records.length
) {
  errors.push(
    "coverage totalSurfaces must equal coverage.records length",
  );
}
if (data.coverage?.checked !== counts.checked) {
  errors.push(
    "coverage checked count does not match records",
  );
}
if (data.coverage?.blocked !== counts.blocked) {
  errors.push(
    "coverage blocked count does not match records",
  );
}
if (
  data.coverage?.notApplicable !==
  counts["not-applicable"]
) {
  errors.push(
    "coverage notApplicable count does not match records",
  );
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(
  "Map audit output contract passed: " +
    records.length +
    " discovered gameplay surface(s) accounted, " +
    candidateIds.size +
    " candidate(s) mapped.",
);
