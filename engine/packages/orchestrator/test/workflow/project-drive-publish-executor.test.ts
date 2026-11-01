// Consolidated same-owner development family, original lexical bodies preserved.
import { describe, expect, it } from "vitest";
import { executeProjectDrivePublishPlan } from "../../src/workflow/project-drive-publish-executor.js";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { projectApprovedBugReportToHistoricalRegressions, syncApprovedProjectIssueHistory } from "../../src/workflow/project-history-sync.js";
import { approveAuditProjectAndPersist } from "../../src/workflow/project-publication-workflow.js";
import { assertProjectRecordWritable, loadProjectRecord, upsertProjectRecord } from "../../src/workflow/project-record-store.js";

// Source engine/packages/orchestrator/test/project-drive-publish-executor.test.ts; blob 6afe5f5f9a31fe069f8945c77c5e7ff0317a15c6
{
describe("project Drive publish executor", () => {
  it("records fingerprint mismatch as failed instead of published", async () => {
    const result =
      await executeProjectDrivePublishPlan(
        {
          schemaVersion: 1,
          projectId: "defense-v2",
          snapshotFingerprint:
            "sha256:snapshot",
          items: [{
            kind: "bug-report",
            destinationRole:
              "project-root",
            sourcePath:
              "workspace/reports/report.json",
            fingerprint:
              "sha256:approved",
            destinationFolderId:
              "drive-folder",
          }],
        },
        {
          upload: async () => ({
            fileId: "file-1",
            fileName: "report.json",
            fingerprint:
              "sha256:different",
          }),
        },
      );

    expect(result.files).toEqual([]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.reason)
      .toContain("fingerprint");
  });

  it("returns verified uploaded files for receipt creation", async () => {
    const result =
      await executeProjectDrivePublishPlan(
        {
          schemaVersion: 1,
          projectId: "defense-v2",
          snapshotFingerprint:
            "sha256:snapshot",
          items: [{
            kind: "map-audit-report",
            destinationRole:
              "project-root",
            sourcePath:
              "workspace/projects/defense-v2/output/audit.html",
            fingerprint:
              "sha256:audit",
            destinationFolderId:
              "drive-folder",
          }],
        },
        {
          upload: async () => ({
            fileId: "file-audit",
            fileName: "audit.html",
            fingerprint:
              "sha256:audit",
          }),
        },
      );

    expect(result.failed).toEqual([]);
    expect(result.files).toEqual([{
      kind: "map-audit-report",
      destinationRole:
        "project-root",
      fileId: "file-audit",
      fileName: "audit.html",
      fingerprint: "sha256:audit",
    }]);
  });
});
}

// Source engine/packages/orchestrator/test/project-history-sync.test.ts; blob 1c9c1892059476dd0fc40d4a8e6e2989b8747d20
{
describe("project historical issue projection", () => {
  it("projects canonical approved bugs into searchable historical incidents", () => {
    const records =
      projectApprovedBugReportToHistoricalRegressions({
        projectId: "defense-v2",
        report: {
          schema: "m-bedrock-bug-report/v2",
          map: {
            name: "Defense",
            mapVersion: "2.0.0",
            drive:
              "https://drive.google.com/example",
            baseVersion: "2.0.0",
            testedVersion: "2.0.0",
          },
          repairBy: "developer",
          bugs: [{
            id: "BUG-001",
            fixed: false,
            severity: "major",
            category: "multiplayer-session",
            foundBy: "ai",
            title: "Arena state leaks",
            problem:
              "Arena-local state is shared.",
            expected:
              "Each arena owns isolated state.",
            observed:
              "Two arenas can write the same state.",
            reproduction: [
              "Start two arenas.",
              "Observe shared state.",
            ],
          }],
        },
        reportPath:
          "workspace/reports/Defense-v2.0.0-BugReport.json",
        artifactFingerprint:
          "sha256:defense",
      });

    expect(records).toHaveLength(1);
    expect(records[0]?.id)
      .toBe("reg_defense_2_0_0_bug_001");
    expect(
      records[0]?.canonicalIssueId,
    ).toBe(
      "reg_defense_2_0_0_bug_001",
    );
    expect(records[0]?.domain)
      .toBe("multiplayer");
    expect(records[0]?.discoveredBy)
      .toBe("approved-ai");
    expect(
      records[0]?.provenance
        ?.artifactFingerprint,
    ).toBe("sha256:defense");
    expect(
      records[0]?.provenance?.projectId,
    ).toBe("defense-v2");
    expect(records[0]?.issueType).toBe("BUG");
  });

  it("preserves design mismatch type in historical learning", () => {
    const records =
      projectApprovedBugReportToHistoricalRegressions({
        projectId: "arena-capacity",
        report: {
          schema: "m-bedrock-bug-report/v2",
          map: {
            name: "Arena Map",
            mapVersion: "1.0.0",
            drive:
              "https://drive.google.com/example",
            baseVersion: "1.0.0",
            testedVersion: "1.0.0",
          },
          repairBy: "developer",
          bugs: [{
            id: "DM-001",
            fixed: false,
            severity: "major",
            category: "multiplayer-session",
            foundBy: "ai",
            issueType: "DESIGN_MISMATCH",
            title: "Visible capacity exceeds concurrency",
            problem:
              "Players see more arenas than can run concurrently.",
            expected:
              "Presented capacity matches playable capacity.",
            observed:
              "Additional ready arenas are queued.",
            reproduction: [
              "Start the supported number of arenas.",
              "Start one additional visible arena and observe it queue.",
            ],
          }],
        },
        reportPath:
          "workspace/reports/Arena-v1.0.0-BugReport.json",
        artifactFingerprint:
          "sha256:arena",
      });

    expect(records[0]?.issueType)
      .toBe("DESIGN_MISMATCH");
    expect(
      records[0]?.provenance?.issueType,
    ).toBe("DESIGN_MISMATCH");
    expect(records[0]?.triggerTags)
      .toContain("design-mismatch");
  });

  it("allows remote-only history sync from the exact persisted canonical report", async () => {
    const root =
      await mkdtemp(
        join(
          tmpdir(),
          "m-bedrock-history-",
        ),
      );
    try {
      const reportPath =
        "workspace/reports/Defense-v2.0.0-BugReport.json";
      await mkdir(
        join(
          root,
          "workspace/reports",
        ),
        { recursive: true },
      );
      await mkdir(
        join(
          root,
          "engine/reliability/catalogs",
        ),
        { recursive: true },
      );
      await writeFile(
        join(
          root,
          "engine/reliability/catalogs/regressions.json",
        ),
        JSON.stringify(
          {
            schemaVersion: 1,
            regressions: [],
          },
          null,
          2,
        ) + "\n",
        "utf8",
      );
      const report = {
        schema: "m-bedrock-bug-report/v2" as const,
        map: {
          name: "Defense",
          mapVersion: "2.0.0",
          drive:
            "https://drive.google.com/file/d/world-1/view",
          baseVersion: "2.0.0",
          testedVersion: "2.0.0",
        },
        repairBy: "developer" as const,
        bugs: [{
          id: "BUG-001",
          fixed: false,
          severity: "major" as const,
          category:
            "multiplayer-session" as const,
          foundBy: "ai" as const,
          issueType: "BUG" as const,
          title: "Arena state leaks",
          problem:
            "Arena-local state is shared.",
          expected:
            "Each arena owns isolated state.",
          observed:
            "Two arenas can write the same state.",
          reproduction: [
            "Start two arenas.",
            "Observe shared state.",
          ],
        }],
      };
      await writeFile(
        join(root, reportPath),
        JSON.stringify(report, null, 2) +
          "\n",
        "utf8",
      );

      const result =
        await syncApprovedProjectIssueHistory({
          repositoryRoot: root,
          project: {
            schemaVersion: 1,
            projectId: "defense-v2",
            projectName: "Defense",
            taskClass: "DIAGNOSE",
            revision: 1,
            artifact: {
              artifactId:
                "drive:world-1",
              artifactFingerprint:
                "sha256:defense",
              version: "2.0.0",
            },
            work: {},
            knowledge: {
              bugReportPath: reportPath,
            },
            publication: {
              drive: {
                schemaVersion: 1,
                projectId:
                  "defense-v2",
                mapFolder: {
                  folderId: "folder-1",
                },
                currentWorld: {
                  fileId: "world-1",
                  fileName:
                    "Defense.mcworld",
                  artifactFingerprint:
                    "sha256:defense",
                  version: "2.0.0",
                },
              },
            },
          },
          report,
          reportPath,
        });

      expect(
        result.historicalRegressionIds,
      ).toEqual([
        "reg_defense_2_0_0_bug_001",
      ]);
    } finally {
      await rm(
        root,
        {
          recursive: true,
          force: true,
        },
      );
    }
  });

  it("rejects history sync when incoming report differs from persisted canonical state", async () => {
    const root =
      await mkdtemp(
        join(
          tmpdir(),
          "m-bedrock-history-",
        ),
      );
    try {
      const reportPath =
        "workspace/reports/A-v1.0.0-BugReport.json";
      await mkdir(
        join(root, "workspace/reports"),
        { recursive: true },
      );
      await mkdir(
        join(
          root,
          "engine/reliability/catalogs",
        ),
        { recursive: true },
      );
      await writeFile(
        join(
          root,
          "engine/reliability/catalogs/regressions.json",
        ),
        JSON.stringify(
          {
            schemaVersion: 1,
            regressions: [],
          },
          null,
          2,
        ) + "\n",
        "utf8",
      );
      const persisted = {
        schema:
          "m-bedrock-bug-report/v2" as const,
        map: {
          name: "A",
          mapVersion: "1.0.0",
          drive:
            "https://drive.google.com/file/d/world-a/view",
          baseVersion: "1.0.0",
          testedVersion: "1.0.0",
        },
        repairBy: "developer" as const,
        bugs: [{
          id: "BUG-A",
          fixed: false,
          severity: "major" as const,
          category: "game-flow" as const,
          foundBy: "ai" as const,
          title: "A",
          problem: "A fails.",
          expected: "A works.",
          observed: "A fails.",
        }],
      };
      await writeFile(
        join(root, reportPath),
        JSON.stringify(
          persisted,
          null,
          2,
        ) + "\n",
        "utf8",
      );

      await expect(
        syncApprovedProjectIssueHistory({
          repositoryRoot: root,
          project: {
            schemaVersion: 1,
            projectId: "a",
            projectName: "A",
            taskClass: "DIAGNOSE",
            revision: 1,
            artifact: {
              artifactId:
                "drive:world-a",
              artifactFingerprint:
                "sha256:a",
              version: "1.0.0",
            },
            work: {},
            knowledge: {
              bugReportPath:
                reportPath,
            },
            publication: {
              drive: {
                schemaVersion: 1,
                projectId: "a",
                mapFolder: {
                  folderId: "folder-a",
                },
                currentWorld: {
                  fileId: "world-a",
                  fileName: "A.mcworld",
                  artifactFingerprint:
                    "sha256:a",
                  version: "1.0.0",
                },
              },
            },
          },
          report: {
            ...persisted,
            bugs: [{
              ...persisted.bugs[0]!,
              observed:
                "Different actual result.",
            }],
          },
          reportPath,
        }),
      ).rejects.toThrow(
        /does not match the persisted canonical/i,
      );
    } finally {
      await rm(
        root,
        {
          recursive: true,
          force: true,
        },
      );
    }
  });
});
}

// Source engine/packages/orchestrator/test/project-publication-workflow.test.ts; blob e9d811ed33a9bcbced70b0077882460fce0633e4
{
describe("project audit publication boundary", () => {
  it("keeps audit completion authority in SelectedMapAuditRun", async () => {
    const project: any = {
      schemaVersion: 1,
      projectId: "defense-v2",
      projectName: "Defense V2",
      taskClass: "DIAGNOSE",
      revision: 2,
      artifact: {
        artifactId: "map:defense-v2",
        artifactFingerprint: "sha256:map",
      },
      work: {
        sessionId: "session:1",
        workSessionRevision: 2,
      },
      knowledge: {
        bugReportPath:
          "workspace/reports/Defense-v2-BugReport.json",
      },
      publication: {
        drive: {
          schemaVersion: 1,
          projectId: "defense-v2",
          mapFolder: {
            folderId: "drive-folder",
          },
        },
      },
    };

    await expect(
      approveAuditProjectAndPersist({
        repositoryRoot: "/tmp/repo",
        workspace: {
          root: "/tmp/project",
          source: "/tmp/project/source",
          design: "/tmp/project/design",
          working: "/tmp/project/working",
          output: "/tmp/project/output",
          evidence: "/tmp/project/evidence",
          patches: "/tmp/project/patches",
          state: "/tmp/project/state",
        },
        project,
        deliverables: [{
          kind: "bug-report",
          path:
            "workspace/reports/Defense-v2-BugReport.json",
          fingerprint: "sha256:report",
          destinationRole:
            "project-root",
        }],
        report: {
          schema: "m-bedrock-bug-report/v2",
          map: {
            name: "Defense",
            mapVersion: "2",
            drive:
              "https://drive.google.com/example",
            baseVersion: "2",
            testedVersion: "2",
          },
          repairBy: "developer",
          bugs: [{
            id: "BUG-001",
            fixed: false,
            severity: "major",
            category: "game-flow",
            foundBy: "ai",
            title: "Broken progression",
            problem: "Progression can stop.",
            expected: "Progression completes.",
            observed: "Progression stops.",
          }],
        },
        reportPath:
          "workspace/reports/Defense-v2-BugReport.json",
        audit: {
          currentStage: "PROVE",
          auditRevision: "audit:1",
          identity: {
            artifactFingerprint: "sha256:map",
          },
        } as any,
      }),
    ).rejects.toThrow(
      "Audit project approval requires SelectedMapAuditRun currentStage COMPLETE.",
    );
  });
});
}


{
describe("canonical per-project publication persistence", () => {
  const baseline = {
    schemaVersion: 1,
    projectId: "defense-v2",
    projectName: "Defense V2",
    taskClass: "DIAGNOSE",
    revision: 1,
    artifact: {
      artifactId: "drive:world-1",
      artifactFingerprint: "sha256:map",
      version: "1.0.0",
    },
    publication: {
      drive: {
        mapFolder: { folderId: "folder-1" },
        currentWorld: {
          fileId: "world-1",
          fileName: "Defense v1.0.0.mcworld",
          artifactFingerprint: "sha256:map",
          version: "1.0.0",
        },
      },
    },
  };

  it("reads a canonical minimal record and writes approval only to its project", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-lazy-project-"));
    const path = join(root, "workspace", "projects", "defense-v2", "project.json");
    try {
      await mkdir(join(root, "workspace", "projects", "defense-v2"), {
        recursive: true,
      });
      await writeFile(path, JSON.stringify(baseline));
      const current = await loadProjectRecord(root, "defense-v2");
      expect(current?.publication.drive?.projectId).toBe("defense-v2");
      expect(current?.publication.drive?.currentWorld?.fileId).toBe("world-1");
      if (!current) throw new Error("Expected current project");
      const approved = {
        ...current,
        revision: current.revision + 1,
        publication: {
          ...current.publication,
          approvalSnapshotFingerprint: "sha256:approval",
        },
      };
      await upsertProjectRecord(root, approved);
      const saved = JSON.parse(await readFile(path, "utf8"));
      expect(saved.revision).toBe(2);
      expect(saved.publication.drive.currentWorld.fileId).toBe("world-1");
      expect(saved.publication.approvalSnapshotFingerprint).toBe("sha256:approval");
      await expect(readFile(join(root, "workspace", "project-registry.json")))
        .rejects.toMatchObject({ code: "ENOENT" });
      await expect(assertProjectRecordWritable(root, approved)).resolves.toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects stale revision and conflicting Drive artifact evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-lazy-project-"));
    const dir = join(root, "workspace", "projects", "defense-v2");
    const path = join(dir, "project.json");
    try {
      await mkdir(dir, { recursive: true });
      await writeFile(path, JSON.stringify(baseline));
      const current = await loadProjectRecord(root, "defense-v2");
      if (!current) throw new Error("Expected current project");
      await expect(upsertProjectRecord(root, {
        ...current,
        revision: 3,
      })).rejects.toThrow("exactly one step");
      await expect(upsertProjectRecord(root, {
        ...current,
        revision: 2,
        artifact: {
          ...current.artifact,
          artifactFingerprint: "sha256:changed",
        },
      })).rejects.toThrow("does not match its current Drive world");
      expect(JSON.parse(await readFile(path, "utf8"))).toEqual(baseline);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("refuses to flatten multi-level projects or traverse workspace paths", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-lazy-project-"));
    const dir = join(root, "workspace", "projects", "defense-v2");
    const path = join(dir, "project.json");
    try {
      await mkdir(dir, { recursive: true });
      const multiLevel = {
        schemaVersion: 1,
        projectId: "defense-v2",
        projectName: "Defense V2",
        taskClass: "DIAGNOSE",
        levels: [{ level: 1, artifact: baseline.artifact }],
      };
      await writeFile(path, JSON.stringify(multiLevel));
      await expect(loadProjectRecord(root, "defense-v2"))
        .rejects.toThrow("refusing to flatten");
      await expect(upsertProjectRecord(root, {
        ...baseline,
        revision: 2,
        work: {},
        knowledge: {},
        publication: {},
      })).rejects.toThrow("refusing to flatten");
      await expect(loadProjectRecord(root, "../escape"))
        .rejects.toThrow("Unsafe canonical projectId");
      expect(JSON.parse(await readFile(path, "utf8"))).toEqual(multiLevel);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
}
