import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const [manifestPath, caseId] = process.argv.slice(2);
if (!manifestPath || !caseId) {
  throw new Error("Usage: node check-case-ready.mjs <manifest.json> <case-id>");
}

const data = JSON.parse(readFileSync(resolve(manifestPath), "utf8"));
const item = (data.cases ?? []).find((entry) => entry.id === caseId);

if (!item) {
  throw new Error(`case not found: ${caseId}`);
}

const errors = [];
const readiness = item.readiness ?? {};

for (const [key, value] of Object.entries(readiness)) {
  if (value === "missing") {
    errors.push(`${key} is missing`);
  }
}

// Completeness of metadata is not readiness. Validate the frozen contract
// through the existing canonical expectation validator, without creating
// a second scoring schema or changing any approved expectation.
const expectationFile = readiness.frozenExpectation;
if (typeof expectationFile !== "string" ||
    !expectationFile.trim() || expectationFile === "missing") {
  errors.push("readiness.frozenExpectation must point to an existing expectation");
} else {
  const expectedPath = resolve(expectationFile);
  if (!existsSync(expectedPath)) {
    errors.push("frozen expectation file does not exist: " + expectationFile);
  } else {
    let expectation;
    try {
      expectation = JSON.parse(readFileSync(expectedPath, "utf8"));
    } catch (error) {
      errors.push("frozen expectation is not readable JSON: " + String(error));
    }
    if (expectation) {
      // Corpus case IDs may use legacy aliases (e.g. underscore IDs), while
      // the expectation ID is owned by its explicit canonical filename.
      // Compare against that filename instead of inventing an ID migration.
      if (expectation.id !== basename(expectedPath, ".json")) {
        errors.push("frozen expectation ID does not match its filename");
      }
      if (expectation.lane !== data.lane) {
        errors.push("frozen expectation lane does not match corpus lane");
      }
      if (readiness.artifactFingerprint &&
          readiness.artifactFingerprint !== "missing" &&
          expectation.artifact?.sha256 !== readiness.artifactFingerprint) {
        errors.push("frozen expectation SHA-256 does not match corpus fingerprint");
      }
      const validator = fileURLToPath(
        new URL("./validate-expectation.mjs", import.meta.url),
      );
      const result = spawnSync(
        process.execPath, [validator, expectedPath],
        { encoding: "utf8", maxBuffer: 1024 * 1024 },
      );
      if (result.error) {
        errors.push("expectation validator could not run: " +
          result.error.message);
      } else if (result.status !== 0) {
        errors.push(
          "frozen expectation fails benchmark contract: " +
          (result.stderr || result.stdout).trim().replaceAll("\n", "; "),
        );
      }
    }
  }
}

const externalArtifact = item.externalArtifact;
if (externalArtifact !== undefined) {
  if (externalArtifact.provider !== "google-drive") {
    errors.push("externalArtifact.provider must be google-drive");
  }
  if (
    typeof externalArtifact.fileId !== "string" ||
    externalArtifact.fileId.length === 0
  ) {
    errors.push("externalArtifact.fileId is required");
  }
  if (
    typeof externalArtifact.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(externalArtifact.sha256)
  ) {
    errors.push("externalArtifact.sha256 must be a lowercase SHA-256");
  }
  if (
    readiness.artifactFingerprint !== undefined &&
    readiness.artifactFingerprint !== "missing" &&
    readiness.artifactFingerprint !== externalArtifact.sha256
  ) {
    errors.push("external artifact SHA-256 does not match readiness.artifactFingerprint");
  }
} else if (!item.sourceRef) {
  errors.push("sourceRef is required");
} else {
  const [sourcePath] = String(item.sourceRef).split("#");
  if (!sourcePath || !existsSync(resolve(sourcePath))) {
    errors.push(`sourceRef does not resolve: ${item.sourceRef}`);
  }
}

if (data.lane === "acceptance" && data.policy?.blindEvaluationRequired !== true) {
  errors.push("acceptance case requires blindEvaluationRequired=true");
}

if (errors.length > 0) {
  for (const error of errors) {
    process.stderr.write(`- ${error}\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write(JSON.stringify({
    caseId,
    lane: data.lane,
    promotable: true
  }, null, 2) + "\n");
}
