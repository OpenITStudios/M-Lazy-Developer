import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const [artifactPath, auditOutputPath, frozenOutputPath, executionReceiptPath,
  unexpected] = process.argv.slice(2);
if (!artifactPath || !auditOutputPath || !frozenOutputPath || unexpected) {
  throw new Error(
    "Usage: node freeze-observed-map-audit.mjs <artifact.mcworld> <audit-output.json> <frozen-output.json> [cli-execution-receipt.json]",
  );
}

const artifact = resolve(artifactPath);
const auditPath = resolve(auditOutputPath);
const outputPath = resolve(frozenOutputPath);
const auditBytes = readFileSync(auditPath);
const audit = JSON.parse(auditBytes.toString("utf8"));
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
// The .git directory does not exist in a verified portable source package.
// When available, use the canonical CLI's bound execution sidecar instead
// of treating the HEAD of a separate freezing process as audit provenance.
const receiptBytes = executionReceiptPath === undefined
  ? undefined : readFileSync(resolve(executionReceiptPath));
const receipt = receiptBytes === undefined
  ? undefined : JSON.parse(receiptBytes.toString("utf8"));
if (receipt !== undefined) {
  const reportDigest = createHash("sha256").update(auditBytes).digest("hex");
  if (receipt.schemaVersion !== 1 ||
      receipt.policy !== "selected-map-canonical-audit-execution-receipt" ||
      receipt.canonicalEntrypoint !== "apps/cli/src/audit.ts:runSelectedMapAudit" ||
      receipt.canonicalOutput !== "map-audit-output-v2-json" ||
      !/^[a-f0-9]{40}$/.test(receipt.sourceCommit ?? "") ||
      !/^[a-f0-9]{64}$/.test(receipt.auditRevision ?? "") ||
      receipt.selectedArtifactSha256 !== sha256 ||
      receipt.artifactId !== audit.artifactId ||
      receipt.auditStatus !== audit.control.status ||
      receipt.outputSha256 !== reportDigest ||
      receipt.exitCode !== (audit.control.status === "BLOCKED" ? 2 : 0) ||
      receipt.proofBoundary !==
        "EXACT_PORTABLE_SOURCE_AND_MAP_BOUND_CLI_INVOCATION_NOT_INDEPENDENT_EXECUTOR_ATTESTATION") {
    throw new Error(
      "Canonical CLI receipt fails current artifact, output byte, " +
      "source revision or exit-status binding.",
    );
  }
}
const gitCommit = receipt === undefined
  ? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
  : receipt.sourceCommit;

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
    ...(receipt === undefined ? {} : {
      canonicalAuditReceipt: {
        policy: receipt.policy,
        sourceCommit: receipt.sourceCommit,
        selectedArtifactSha256: receipt.selectedArtifactSha256,
        artifactId: receipt.artifactId,
        auditRevision: receipt.auditRevision,
        outputSha256: receipt.outputSha256,
        auditStatus: receipt.auditStatus,
        exitCode: receipt.exitCode,
        receiptSha256: createHash("sha256").update(receiptBytes).digest("hex"),
        proofBoundary:
          "BOUND_CLI_RECEIPT_BYTES_NOT_INDEPENDENT_AUDIT_EXECUTOR_ATTESTATION",
      },
    }),
    proofLimit: receipt === undefined
      ? "Report matches archive bytes, but the freezer's Git HEAD is not audit execution provenance."
      : "The verified CLI receipt matches this map and output byte-for-byte. This does not independently attest execution origin, blind reviewer independence or Minecraft gameplay.",
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
