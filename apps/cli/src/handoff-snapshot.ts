import { createHash } from "node:crypto";
import { lstat, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type {
  SelectedMapAuditHandoffSnapshot,
} from "../../../engine/packages/orchestrator/src/map-audit-pipeline.js";

const SOURCE_SHA = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const MAX_SNAPSHOT_BYTES = 256 * 1024 * 1024;

interface SnapshotTransport {
  readonly schemaVersion: 1;
  readonly policy: "selected-map-handoff-derived-transport";
  readonly sourceCommit: string;
  readonly snapshot: SelectedMapAuditHandoffSnapshot;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizeHash(value: string): string {
  const hash = value.replace(/^sha256:/i, "").toLowerCase();
  if (!SHA256.test(hash)) {
    throw new Error("Expected an exact selected-map SHA-256 fingerprint");
  }
  return hash;
}

function validateCommit(value: string): void {
  if (!SOURCE_SHA.test(value)) {
    throw new Error("Handoff snapshot requires exact --expected-source-sha");
  }
}

/** Scratch output only. A generated snapshot must never pollute portable
 * tracked source or become a source of gameplay/approval authority. */
function scratchPath(path: string): string {
  const target = resolve(path);
  const within = relative(process.cwd(), target);
  if (!within.startsWith("..") && !isAbsolute(within)) {
    throw new Error("Handoff snapshots must live outside the source tree");
  }
  return target;
}

/** Exact byte checksum is returned separately, so a later untrusted input
 * cannot silently substitute different navigation or proof statuses. */
export async function writeHandoffSnapshot(
  path: string,
  snapshot: SelectedMapAuditHandoffSnapshot,
  sourceCommit: string,
): Promise<{ sha256: string; bytes: number }> {
  validateCommit(sourceCommit);
  const target = scratchPath(path);
  const transport: SnapshotTransport = {
    schemaVersion: 1,
    policy: "selected-map-handoff-derived-transport",
    sourceCommit,
    snapshot,
  };
  const bytes = Buffer.from(JSON.stringify(transport) + "\n", "utf8");
  if (bytes.length > MAX_SNAPSHOT_BYTES) {
    throw new Error("Handoff snapshot exceeds maximum transport size");
  }
  await writeFile(target, bytes, { flag: "wx", mode: 0o600 });
  return { sha256: sha256(bytes), bytes: bytes.length };
}

/** Read-only replay of an independently checksummed navigation snapshot.
 * This never validates a model response: that requires a fresh canonical audit.
 */
export async function readHandoffSnapshot(
  path: string,
  input: {
    readonly sourceCommit: string;
    readonly artifactFingerprint: string;
    readonly snapshotSha256: string;
  },
): Promise<SelectedMapAuditHandoffSnapshot> {
  validateCommit(input.sourceCommit);
  const expectedMapHash = normalizeHash(input.artifactFingerprint);
  if (!SHA256.test(input.snapshotSha256)) {
    throw new Error("--handoff-snapshot-sha256 must be an exact SHA-256 digest");
  }
  const target = scratchPath(path);
  const file = await lstat(target);
  if (!file.isFile() || file.size <= 0 || file.size > MAX_SNAPSHOT_BYTES) {
    throw new Error("Invalid handoff snapshot file or size");
  }
  const bytes = await readFile(target);
  if (sha256(bytes) !== input.snapshotSha256) {
    throw new Error("Handoff snapshot bytes differ from the pinned digest");
  }
  const parsed: unknown = JSON.parse(bytes.toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Malformed handoff snapshot envelope");
  }
  const transport = parsed as Partial<SnapshotTransport>;
  const snapshot = transport.snapshot;
  if (transport.schemaVersion !== 1 ||
      transport.policy !== "selected-map-handoff-derived-transport" ||
      transport.sourceCommit !== input.sourceCommit ||
      snapshot?.schemaVersion !== 1 ||
      snapshot.policy !== "selected-map-audit-handoff-snapshot" ||
      typeof snapshot.auditRevision !== "string" ||
      snapshot.auditRevision.length === 0 ||
      !["BLOCKED", "READY_FOR_REVIEW"].includes(snapshot.auditStatus) ||
      !Array.isArray(snapshot.taskRows) ||
      snapshot.artifactFingerprint !== expectedMapHash ||
      snapshot.shared?.artifactFingerprint !== expectedMapHash ||
      snapshot.shared?.auditRevision !== snapshot.auditRevision ||
      snapshot.shared?.policy !== "selected-map-audit-model-handoff" ||
      snapshot.shared?.proofBoundary !==
        "MODEL_RESPONSE_IS_UNTRUSTED_UNTIL_CANONICAL_ENGINE_ADMISSION" ||
      snapshot.taskRows.some(row =>
        !row || typeof row !== "object" ||
        !row.task || row.task.auditRevision !== snapshot.auditRevision ||
        typeof row.resolutionEligible !== "boolean")) {
    throw new Error("Handoff snapshot identity or proof boundary is invalid");
  }
  return snapshot;
}
