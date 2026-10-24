import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  throw new Error("Usage: node validate-expectation.mjs <expectation.json>");
}

const data = JSON.parse(readFileSync(path, "utf8"));
const errors = [];

if (data.schemaVersion !== 1) {
  errors.push("schemaVersion must be 1");
}

if (!["calibration", "acceptance", "regression"].includes(data.lane)) {
  errors.push("lane must be calibration, acceptance, or regression");
}

if (!data.id || typeof data.id !== "string") {
  errors.push("id is required");
}

const artifact = data.artifact ?? {};
if (!artifact.label || typeof artifact.label !== "string") {
  errors.push("artifact.label is required");
}
if (
  typeof artifact.sha256 !== "string" ||
  !/^[a-fA-F0-9]{64}$/.test(artifact.sha256)
) {
  errors.push("artifact.sha256 must be a 64-character SHA-256 hex digest");
}

const target = data.target ?? {};
if (!["bedrock", "education"].includes(target.edition)) {
  errors.push("target.edition must be bedrock or education");
}
if (!target.minecraftVersion || typeof target.minecraftVersion !== "string") {
  errors.push("target.minecraftVersion is required");
}

const expected = data.expected ?? {};
const dispositions = [
  "defect",
  "designed-behavior",
  "ambiguous-intent",
  "insufficient-evidence",
  "runtime-proof-required",
];
const claims = expected.claims;
if (claims === undefined) {
  if (!dispositions.includes(expected.disposition)) {
    errors.push("expected.disposition is invalid");
  }
} else {
  // A multi-claim oracle is not equivalent to one target disposition.
  // Each frozen generic claim requires a specific positive/negative/unknown
  // source basis; an old nonconforming map oracle stays candidate.
  if (!Array.isArray(claims) || claims.length === 0) {
    errors.push("expected.claims must be a nonempty array");
  } else {
    const ids = new Set();
    for (const claim of claims) {
      if (!claim || typeof claim.id !== "string" || !claim.id.trim() ||
          ids.has(claim.id)) {
        errors.push("expected.claims contains missing or duplicate claim id");
        continue;
      }
      ids.add(claim.id);
      if (!["supported", "rejected", "unknown"].includes(claim.expectedClass) ||
          typeof claim.subject !== "string" || !claim.subject.trim() ||
          typeof claim.proofCeiling !== "string" || !claim.proofCeiling.trim() ||
          !Array.isArray(claim.sourceRefs) || !claim.sourceRefs.length ||
          claim.sourceRefs.some(ref => typeof ref !== "string" || !ref.trim())) {
        errors.push("expected.claims " + claim.id + " lacks a grounded class, subject, sourceRef or proof ceiling");
      }
    }
  }
}

if (expected.disposition === "defect" && !expected.domain) {
  errors.push("expected.domain is required for defect expectations");
}

const provenance = data.provenance ?? {};
if (provenance.frozenBeforeRun !== true) {
  errors.push("provenance.frozenBeforeRun must be true");
}
if (!provenance.source || typeof provenance.source !== "string") {
  errors.push("provenance.source is required");
}

if (data.lane === "acceptance" && provenance.frozenBeforeRun !== true) {
  errors.push("acceptance expectations must be frozen before detector execution");
}

if (errors.length > 0) {
  for (const error of errors) {
    process.stderr.write(`- ${error}\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write("expectation-valid\n");
}
