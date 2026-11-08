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
  const taskRows: SelectedMapAuditHandoffSnapshot["taskRows"] =
    Array.from({ length: 26 }, (_, i) => ({
      task: {
        schemaVersion: 1,
        policy: "bounded-audit-model-task",
        id: "task:" + i,
        auditRevision: REVISION,
        kind: "AUDIT_OBLIGATION",
        stage: "UNDERSTAND",
        unresolvedObligationIds: ["obligation:" + i],
      } as SelectedMapAuditHandoffSnapshot["taskRows"][number]["task"],
      resolutionEligible: false,
    }));
  const investigationRows: SelectedMapAuditHandoffSnapshot["investigationRows"] =
    Array.from({ length: 4 }, (_, batch) => ({
      stage: "UNDERSTAND" as const,
      source: "discovery-challenge",
      validationGroupKey: "shared:source",
      sharedQuestion: "Trace authored source",
      sharedMissingProof: "Still unresolved",
      members: taskRows.slice(batch * 8, batch * 8 + 8).map((row, offset) => ({
        taskOffset: batch * 8 + offset,
        taskId: row.task.id,
        obligationId: row.task.unresolvedObligationIds[0]!,
        individualReason: "Source question",
        evidenceIds: [], omittedEvidenceIds: 0,
      })),
      proofBoundary: "SHARED_SOURCE_REVIEW_NOT_SHARED_PROOF_OR_MODEL_RESPONSE" as const,
    }));
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
      diagnosisNavigation: {
        issueFirstFocus: {
          policy: "issue-first-source-navigation",
          auditRevision: REVISION,
          mandatoryFirstBlockingStage: "DISCOVERY",
          canonicalTaskCount: 26,
          eligibleSourceGroups: 0,
          suggestions: [],
          omittedSourceGroups: 0,
          proofBoundary: "READ_ONLY_NAVIGATION_NOT_AUDIT_ADMISSION",
        },
      } as SelectedMapAuditHandoffSnapshot["shared"]["diagnosisNavigation"],
      proofBoundary: "MODEL_RESPONSE_IS_UNTRUSTED_UNTIL_CANONICAL_ENGINE_ADMISSION",
    },
    taskRows,
    investigationRows,
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
    expect(pageSelectedMapAuditHandoffSnapshot(restored, 0, 12, 0))
      .toMatchObject({ investigationBatchCount: 4, investigationBatchOffset: 0,
        nextInvestigationBatchOffset: null });
    const selectedBatch = pageSelectedMapAuditHandoffSnapshot(restored, 0, 12, 1);
    expect(selectedBatch.investigationBatches).toHaveLength(3);
    expect(selectedBatch.investigationBatches[0]?.members[0]?.taskOffset).toBe(8);
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

  it("rejects a digest-matched batch that omits or impersonates a canonical task", async () => {
    const path = await snapshotFile();
    await writeHandoffSnapshot(path, fixture(), SOURCE_SHA);
    const record = JSON.parse((await readFile(path)).toString("utf8"));
    record.snapshot.investigationRows[0].members[0].taskId = "forged-task";
    let bytes = Buffer.from(JSON.stringify(record));
    await writeFile(path, bytes);
    await expect(readHandoffSnapshot(path, {
      sourceCommit: SOURCE_SHA, artifactFingerprint: MAP_SHA,
      snapshotSha256: hash(bytes),
    })).rejects.toThrow("batch task identity");
    record.snapshot.investigationRows[0].members[0].taskId = "task:0";
    record.snapshot.investigationRows.pop();
    bytes = Buffer.from(JSON.stringify(record));
    await writeFile(path, bytes);
    await expect(readHandoffSnapshot(path, {
      sourceCommit: SOURCE_SHA, artifactFingerprint: MAP_SHA,
      snapshotSha256: hash(bytes),
    })).rejects.toThrow("omit canonical tasks");
  });


  it("rejects checksum-matched focus recommendations that impersonate a task", async () => {
    const path = await snapshotFile();
    const original = fixture();
    const fake = {
      ...original,
      shared: {
        ...original.shared,
        diagnosisNavigation: {
          ...original.shared.diagnosisNavigation,
          issueFirstFocus: {
            ...original.shared.diagnosisNavigation.issueFirstFocus,
            eligibleSourceGroups: 1,
            suggestions: [{
              taskId: "forged-task", taskOffset: 2,
              category: "SOURCE_BOUND_OBLIGATION",
              obligationId: "obligation:2",
              sourceLocators: ["scripts/round.ts:15:2"],
              nextCheck: "Trace source",
              missingProof: ["Exact caller"],
              proof: "SOURCE_REVIEW_HINT_NOT_BUG_PROOF" as const,
            }],
          },
        },
      },
    };
    await writeHandoffSnapshot(path, fake as SelectedMapAuditHandoffSnapshot, SOURCE_SHA);
    const bytes = await readFile(path);
    await expect(readHandoffSnapshot(path, {
      sourceCommit: SOURCE_SHA, artifactFingerprint: MAP_SHA,
      snapshotSha256: hash(bytes),
    })).rejects.toThrow(/focus task identity/);
  });


  it("rejects forged source-call hops even when snapshot checksum is recomputed", async () => {
    const path = await snapshotFile();
    const original = fixture();
    const task = original.taskRows[2]!.task;
    const suggestion = {
      taskId: task.id, taskOffset: 2, category: "SOURCE_BOUND_OBLIGATION",
      obligationId: task.unresolvedObligationIds[0],
      sourceLocators: ["scripts/chunks/entry.js:12:3"],
      nextCheck: "Trace source", missingProof: ["Exact source"],
      sourceHops: [{
        edgeId: "edge:source", callerLocator: "scripts/chunks/entry.js:12:3",
        calleeLocator: "scripts/chunks/store.js:81:4",
        proof: "RESOLVED_SOURCE_CALL_NOT_RUNTIME_OR_BUG_PROOF",
      }],
      omittedSourceHops: 0,
      proof: "SOURCE_REVIEW_HINT_NOT_BUG_PROOF",
    } as const;
    const fixtureWithHop = {
      ...original, shared: {
        ...original.shared, diagnosisNavigation: {
          ...original.shared.diagnosisNavigation,
          issueFirstFocus: {
            ...original.shared.diagnosisNavigation.issueFirstFocus,
            eligibleSourceGroups: 1, suggestions: [suggestion],
          },
        },
      },
    } as SelectedMapAuditHandoffSnapshot;
    await writeHandoffSnapshot(path, fixtureWithHop, SOURCE_SHA);
    const load = async () => {
      const bytes = await readFile(path);
      return readHandoffSnapshot(path, {
        sourceCommit: SOURCE_SHA, artifactFingerprint: MAP_SHA,
        snapshotSha256: hash(bytes),
      });
    };
    expect((await load()).shared.diagnosisNavigation.issueFirstFocus
      .suggestions[0]?.sourceHops?.[0]?.calleeLocator)
      .toBe("scripts/chunks/store.js:81:4");

    const record = JSON.parse((await readFile(path)).toString("utf8"));
    const hop = record.snapshot.shared.diagnosisNavigation.issueFirstFocus
      .suggestions[0].sourceHops[0];
    for (const malformed of [
      { ...hop, callerLocator: "scripts/chunks/unrelated.js:12:3" },
      { ...hop, proof: "SOURCE_CALL_IS_BUG_PROOF" },
      { ...hop, calleeLocator: "scripts/chunks/store.js" },
    ]) {
      record.snapshot.shared.diagnosisNavigation.issueFirstFocus
        .suggestions[0].sourceHops[0] = malformed;
      await writeFile(path, Buffer.from(JSON.stringify(record)));
      await expect(load()).rejects.toThrow(/source-call navigation/);
    }
    record.snapshot.shared.diagnosisNavigation.issueFirstFocus
      .suggestions[0].sourceHops = [
        hop, { ...hop, edgeId: "edge:contradicting",
          calleeLocator: "scripts/chunks/other.js:19:2" },
      ];
    await writeFile(path, Buffer.from(JSON.stringify(record)));
    await expect(load()).rejects.toThrow(/source-call navigation/);
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
