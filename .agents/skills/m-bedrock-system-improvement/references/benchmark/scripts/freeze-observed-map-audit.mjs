import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const [artifactPath, auditOutputPath, frozenOutputPath] = process.argv.slice(2);
if (!artifactPath || !auditOutputPath || !frozenOutputPath) {
  throw new Error(
    "Usage: node freeze-observed-map-audit.mjs <artifact.mcworld> <audit-output.json> <frozen-output.json>",
  );
}

const artifact = resolve(artifactPath);
const auditPath = resolve(auditOutputPath);
const outputPath = resolve(frozenOutputPath);
const audit = JSON.parse(readFileSync(auditPath, "utf8"));
if (
  audit.schemaVersion !== 2 ||
  typeof audit.artifactId !== "string" ||
  !audit.artifactId.trim() ||
  audit.evidenceScope?.mode !== "selected-map-version-only" ||
  audit.evidenceScope?.archiveSourcesUsed !== false ||
  audit.gameplayFlowBasis !== "AUDIT_CHECKLIST_NOT_OBSERVED_GAMEPLAY" ||
  !audit.control ||
  !Array.isArray(audit.bugs) ||
  !Array.isArray(audit.designMismatches)
) {
  throw new Error(
    "Observed output must have canonical MapAuditOutputV2 structure; " +
    "a static oracle, dev inspection or partial projection is not an audit result. " +
    "Matching structure alone does not verify execution provenance.",
  );
}
const sha256 = createHash("sha256")
  .update(readFileSync(artifact))
  .digest("hex");
// A shaped V2 report does not prove it was produced for these archive bytes.
// Only the selected-map source fingerprint can bind the two for evaluation.
if (!/^[a-f0-9]{64}$/.test(audit.artifactFingerprint ?? "") ||
    audit.artifactFingerprint !== sha256) {
  throw new Error(
    "Refusing to freeze audit output: selected-map report SHA-256 does not " +
    "match the supplied artifact bytes (or is absent). Re-run the canonical " +
    "audit for this exact artifact; do not transplant another version's report.",
  );
}
const gitCommit = execFileSync(
  "git",
  ["rev-parse", "HEAD"],
  { encoding: "utf8" },
).trim();

const frozen = {
  schemaVersion: 1,
  kind: "selected-map-audit-observed-output",
  artifact: {
    label: basename(artifact),
    sha256,
  },
  execution: {
    gitCommit,
    gitCommitRole: "FREEZE_ENVIRONMENT_ONLY_NOT_AUDIT_EXECUTION_PROOF",
    frozenAt: new Date().toISOString(),
    command: "npm run audit -- <artifact>",
    artifactBinding: "EXACT_SELECTED_ARTIFACT_SHA256_MATCH",
    proofLimit: "Report matches the selected archive bytes. This alone does " +
      "not attest that the audit ran on this Git commit, establish blind " +
      "expectation independence, or prove Minecraft runtime behavior.",
  },
  observed: audit,
};

writeFileSync(
  outputPath,
  JSON.stringify(frozen, null, 2) + "\n",
  "utf8",
);
process.stdout.write(
  JSON.stringify({
    artifact: frozen.artifact,
    gitCommit,
    artifactBinding: frozen.execution.artifactBinding,
    proofLimit: frozen.execution.proofLimit,
    outputPath,
  }, null, 2) + "\n",
);
