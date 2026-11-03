import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readHandoffSnapshot,
  writeHandoffSnapshot,
} from "../src/handoff-snapshot.js";
import {
  pageSelectedMapAuditHandoffSnapshot,
  type SelectedMapAuditHandoffSnapshot,
} from "../../../engine/packages/orchestrator/src/map-audit-pipeline.js";

const SOURCE_SHA = "a".repeat(40);
const MAP_SHA = "b".repeat(64);
const REVISION = "revision:source-bound";
const hash = (bytes: Buffer): string => createHash("sha256")
  .update(bytes).digest("hex");

function fixture(): SelectedMapAuditHandoffSnapshot {
  return {
    schemaVersion: 1,
    policy: "selected-map-audit-handoff-snapshot",
    artifactFingerprint: MAP_SHA,
    auditRevision: REVISION,
    auditStatus: "BLOCKED",
    shared: {
      schemaVersion: 1,
      policy: "selected-map-audit-model-handoff",
      artifactId: "art:selected",
      artifactFingerprint: MAP_SHA,
      auditRevision: REVISION,
      currentStage: "DISCOVERY",
      allowedNextAction: "RESOLVE_BLOCKING_STAGE",
      gameUnderstanding: {} as SelectedMapAuditHandoffSnapshot["shared"]["gameUnderstanding"],
      diagnosisNavigation: {} as SelectedMapAuditHandoffSnapshot["shared"]["diagnosisNavigation"],
      proofBoundary: "MODEL_RESPONSE_IS_UNTRUSTED_UNTIL_CANONICAL_ENGINE_ADMISSION",
    },
    taskRows: Array.from({ length: 26 }, (_, i) => ({
      task: {
        schemaVersion: 1,
        policy: "bounded-audit-model-task",
        id: "task:" + i,
        auditRevision: REVISION,
        kind: "AUDIT_OBLIGATION",
        stage: "UNDERSTAND",
      } as SelectedMapAuditHandoffSnapshot["taskRows"][number]["task"],
      resolutionEligible: false,
    })),
  };
}

describe("pinned read-only handoff transport", () => {
  const roots: string[] = [];
  afterEach(async () => {
    for (const root of roots.splice(0)) {
      await rm(root, { recursive: true, force: true });
    }
  });

  async function snapshotFile(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "m-lazy-handoff-"));
    roots.push(dir);
    return join(dir, "handoff.json");
  }

  it("replays all tasks without rerunning the engine, preserving BLOCKED and proof eligibility", async () => {
    const path = await snapshotFile();
    const original = fixture();
    const saved = await writeHandoffSnapshot(path, original, SOURCE_SHA);
    expect(saved.sha256).toBe(hash(await readFile(path)));
    const restored = await readHandoffSnapshot(path, {
      sourceCommit: SOURCE_SHA,
      artifactFingerprint: "sha256:" + MAP_SHA,
      snapshotSha256: saved.sha256,
    });
    expect(restored.auditStatus).toBe("BLOCKED");
    expect(restored).toEqual(original);
    expect(pageSelectedMapAuditHandoffSnapshot(restored, 0)).toMatchObject({
      taskCount: 26, offset: 0, nextOffset: 12,
    });
    expect(pageSelectedMapAuditHandoffSnapshot(restored, 12).tasks.map(row => row.task.id))
      .toEqual(Array.from({ length: 12 }, (_, i) => "task:" + (i + 12)));
    expect(pageSelectedMapAuditHandoffSnapshot(restored, 24)).toMatchObject({
      taskCount: 26, offset: 24, nextOffset: null,
    });
    expect(restored.taskRows.every(row => row.resolutionEligible === false)).toBe(true);
  });

  it("rejects changed bytes, stale engine/map SHA and attempts to overwrite snapshots", async () => {
    const path = await snapshotFile();
    const saved = await writeHandoffSnapshot(path, fixture(), SOURCE_SHA);
    await expect(writeHandoffSnapshot(path, fixture(), SOURCE_SHA)).rejects.toThrow();
    await expect(readHandoffSnapshot(path, {
      sourceCommit: "c".repeat(40), artifactFingerprint: MAP_SHA,
      snapshotSha256: saved.sha256,
    })).rejects.toThrow("identity");
    await expect(readHandoffSnapshot(path, {
      sourceCommit: SOURCE_SHA, artifactFingerprint: "c".repeat(64),
      snapshotSha256: saved.sha256,
    })).rejects.toThrow("identity");
    await writeFile(path, Buffer.concat([await readFile(path), Buffer.from(" ")]));
    await expect(readHandoffSnapshot(path, {
      sourceCommit: SOURCE_SHA, artifactFingerprint: MAP_SHA,
      snapshotSha256: saved.sha256,
    })).rejects.toThrow("digest");
  });

  it("rejects a checksum-matched record that changes its evidence boundary", async () => {
    const path = await snapshotFile();
    await writeHandoffSnapshot(path, fixture(), SOURCE_SHA);
    const record = JSON.parse((await readFile(path)).toString("utf8"));
    record.snapshot.shared.proofBoundary = "MODEL_CAN_APPROVE_BUG";
    const altered = Buffer.from(JSON.stringify(record));
    await writeFile(path, altered);
    await expect(readHandoffSnapshot(path, {
      sourceCommit: SOURCE_SHA, artifactFingerprint: MAP_SHA,
      snapshotSha256: hash(altered),
    })).rejects.toThrow("proof boundary");
  });

  it("does not allow a snapshot to become a tracked source file", async () => {
    await expect(writeHandoffSnapshot("apps/cli/src/leak.json", fixture(), SOURCE_SHA))
      .rejects.toThrow("outside the source tree");
    expect(() => pageSelectedMapAuditHandoffSnapshot(fixture(), -1))
      .toThrow("nonnegative");
    expect(() => pageSelectedMapAuditHandoffSnapshot(fixture(), 0, 51))
      .toThrow("1–50");
  });
});
