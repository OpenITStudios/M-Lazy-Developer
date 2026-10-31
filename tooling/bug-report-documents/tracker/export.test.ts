// Source-preserving tracker feature suite; original cases in isolated blocks.
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { BugTrackerDocument, TrackerIssue } from "./model.js";
import { exportBugTracker, verifyPublishedBugTracker } from "./export.js";
import { renderBugTrackerHtml } from "./render-html.js";
import type { BugReportClientDocument } from "../../../engine/packages/bug-report/src/document/model.js";
import { projectClientDocumentToTracker, resolveSourceBinding, validateDeveloperNoteRegistry } from "./project.js";
import type { DeveloperNoteRegistry, ProjectRegistry } from "./project.js";
import { trackerIssueIds, validateBugTrackerDocument } from "./validate.js";
import { auditBugTrackerInformation } from "./quality.js";
import { parseBugReportV2Json, projectBugReportClientDocument, reviewBugReportClientDocument } from "../../../engine/packages/bug-report/src/index.js";
import { Script, runInNewContext } from "node:vm";
import { validateWorkspaceVersions } from "./workspace-version.js";

// Original tooling/bug-report-documents/tracker/export.test.ts; blob 417783b7c7d82be8dd9a4c13ec28eae1be87cb0d
{
const fixture: BugTrackerDocument = {
  schema: "m-bedrock-bug-tracker/v1",
  title: "Bug Tracker Report",
  games: [{
    name: "Export Fixture",
    levels: [{
      level: null,
      version: "1.0.0",
      source: {
        projectId: "export-fixture",
        artifactId: "drive:fixture",
        artifactFingerprint: "sha256:fixture",
        version: "1.0.0",
        driveFolder: "https://drive.google.com/drive/folders/folder",
        worldFile: "https://drive.google.com/file/d/fixture/view",
        worldFilename: "Export Fixture v1.0.0.mcworld",
      },
      issues: [{
        id: "BUG-EXPORT-001",
        type: "BUG",
        severity: "MAJOR",
        verification: "VERIFIED",
        title: "Export issue",
        issue: "The export fixture has one gameplay issue.",
        reproduction: ["Trigger the export fixture."],
        observed: "The wrong result appears.",
        expected: "The expected result appears.",
      }],
      devNotes: [{
        id: "DEV-EXPORT-001",
        type: "DEV_NOTE",
        title: "Export developer note",
        problem: "A concrete release condition needs attention.",
        action: "Correct the existing release owner.",
        evidence: { source: "fixture" },
        severity: null,
      }],
    }],
  }],
};

describe("Bug Tracker export boundary", () => {
  it("writes JSON and HTML with exactly the same canonical IDs", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bug-tracker-export-"));
    try {
      await exportBugTracker(fixture, dir, renderBugTrackerHtml);
      const [json, html] = await Promise.all([
        readFile(join(dir, "bug-tracker.json"), "utf8"),
        readFile(join(dir, "bug-tracker.html"), "utf8"),
      ]);
      expect(json).toContain('"BUG-EXPORT-001"');
      expect(json).toContain('"DEV-EXPORT-001"');
      expect(html).toContain('data-issue-id="BUG-EXPORT-001"');
      expect(html).toContain('data-issue-id="DEV-EXPORT-001"');
      expect(html).toContain('id="saveHtml"');
      expect(html).toContain('id="saveJson"');
      expect(html).toContain('id="importJson"');
      expect(html).toContain('id="resetData"');
      expect(html).toContain('id="workspace-snapshot"');
      expect(html).toContain('class="files"');
      expect(html).toContain('class="pics"');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("publishes complete files from staging and removes staging artifacts", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bug-tracker-staged-"));
    try {
      await writeFile(join(dir, "bug-tracker.json"), "outdated json", "utf8");
      await writeFile(join(dir, "bug-tracker.html"), "outdated html", "utf8");
      await exportBugTracker(fixture, dir, renderBugTrackerHtml);
      await expect(
        verifyPublishedBugTracker(fixture, dir, renderBugTrackerHtml),
      ).resolves.toBeUndefined();
      const entries = await readdir(dir);
      expect(entries.sort()).toEqual(["bug-tracker.html", "bug-tracker.json"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects invalid nested JSON shapes before changing published files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bug-tracker-malformed-"));
    try {
      await writeFile(join(dir, "bug-tracker.json"), "original json", "utf8");
      await writeFile(join(dir, "bug-tracker.html"), "original html", "utf8");
      const level = fixture.games[0]!.levels[0]!;
      const badSource: BugTrackerDocument = {
        ...fixture,
        games: [{ ...fixture.games[0]!, levels: [{
          ...level, source: { ...level.source, artifactFingerprint: "" },
        }] }],
      };
      await expect(exportBugTracker(badSource, dir, renderBugTrackerHtml))
        .rejects.toThrow(/source.artifactFingerprint is required/);
      const badSteps: BugTrackerDocument = {
        ...fixture,
        games: [{ ...fixture.games[0]!, levels: [{
          ...level, issues: [{
            ...level.issues[0]!, reproduction: "not a list" as unknown as string[],
          }],
        }] }],
      };
      await expect(exportBugTracker(badSteps, dir, renderBugTrackerHtml))
        .rejects.toThrow(/reproduction must be a list/);
      const badNote: BugTrackerDocument = {
        ...fixture,
        games: [{ ...fixture.games[0]!, levels: [{
          ...level, devNotes: [{
            ...level.devNotes[0]!, evidence: [] as unknown as Record<string, unknown>,
          }],
        }] }],
      };
      await expect(exportBugTracker(badNote, dir, renderBugTrackerHtml))
        .rejects.toThrow(/evidence must be an object/);
      const empty: BugTrackerDocument = {
        ...fixture, games: [],
      };
      await expect(exportBugTracker(empty, dir, renderBugTrackerHtml))
        .rejects.toThrow(/At least one game/);
      expect(await readFile(join(dir, "bug-tracker.json"), "utf8")).toBe("original json");
      expect(await readFile(join(dir, "bug-tracker.html"), "utf8")).toBe("original html");
      expect((await readdir(dir)).sort()).toEqual(["bug-tracker.html", "bug-tracker.json"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects loss of new tester result and finding-filter controls", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bug-tracker-filter-contract-"));
    try {
      await expect(exportBugTracker(
        fixture, dir,
        document => renderBugTrackerHtml(document)
          .replace('id="findingSearch"', 'id="missingFindingSearch"'),
      )).rejects.toThrow(/functional contract/);
      await expect(exportBugTracker(
        fixture, dir,
        document => renderBugTrackerHtml(document)
          .replace('id="retestPassed"', 'id="missingRetestPassed"'),
      )).rejects.toThrow(/functional contract/);
      await expect(readdir(dir)).resolves.toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("checks the entire embedded canonical report instead of accepting matching IDs alone", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bug-tracker-parity-"));
    try {
      await expect(exportBugTracker(
        fixture, dir,
        (document) => renderBugTrackerHtml(document)
          .replace('"title":"Export issue"', '"title":"Outdated issue title"'),
      )).rejects.toThrow(/HTML\/JSON document parity/);
      await expect(readFile(join(dir, "bug-tracker.json"), "utf8"))
        .rejects.toThrow();
      await expect(readFile(join(dir, "bug-tracker.html"), "utf8"))
        .rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects inconsistent report and source artifact versions before writing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bug-tracker-version-"));
    try {
      const source = fixture.games[0]!.levels[0]!;
      const mismatched: BugTrackerDocument = {
        ...fixture,
        games: [{
          ...fixture.games[0]!,
          levels: [{
            ...source,
            source: { ...source.source, version: "9.9.9" },
          }],
        }],
      };
      await expect(
        exportBugTracker(mismatched, dir, renderBugTrackerHtml),
      ).rejects.toThrow(/does not match source artifact version/);
      await expect(readFile(join(dir, "bug-tracker.json"), "utf8"))
        .rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("checks saved HTML and JSON against the current canonical renderer without writing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bug-tracker-current-"));
    try {
      await exportBugTracker(fixture, dir, renderBugTrackerHtml);
      const htmlPath = join(dir, "bug-tracker.html");
      const jsonPath = join(dir, "bug-tracker.json");
      const html = await readFile(htmlPath, "utf8");
      const json = await readFile(jsonPath, "utf8");
      await expect(
        verifyPublishedBugTracker(fixture, dir, renderBugTrackerHtml),
      ).resolves.toBeUndefined();

      // Old HTML still has the same canonical issue IDs and map version.
      await writeFile(htmlPath, html.replace('class="lane-nav"', 'class="old-lane-nav"'), "utf8");
      await expect(
        verifyPublishedBugTracker(fixture, dir, renderBugTrackerHtml),
      ).rejects.toThrow(/bug-tracker\.html/);
      expect(await readFile(htmlPath, "utf8")).toContain("old-lane-nav");
      expect(await readFile(jsonPath, "utf8")).toBe(json);

      await writeFile(htmlPath, html, "utf8");
      await writeFile(jsonPath, json.replace('"Export issue"', '"Old Export issue"'), "utf8");
      await expect(
        verifyPublishedBugTracker(fixture, dir, renderBugTrackerHtml),
      ).rejects.toThrow(/bug-tracker\.json/);
      expect(await readFile(jsonPath, "utf8")).toContain("Old Export issue");

      // A changed canonical source also invalidates previously published bytes.
      await writeFile(jsonPath, json, "utf8");
      const changed: BugTrackerDocument = {
        ...fixture,
        games: [{
          ...fixture.games[0]!,
          levels: [{
            ...fixture.games[0]!.levels[0]!,
            issues: fixture.games[0]!.levels[0]!.issues.map(
              issue => ({ ...issue, issue: "Updated expected provenance statement." }),
            ),
          }],
        }],
      };
      await expect(
        verifyPublishedBugTracker(changed, dir, renderBugTrackerHtml),
      ).rejects.toThrow(/stale or inconsistent/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("reports missing publication outputs without creating any files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bug-tracker-incomplete-"));
    try {
      await expect(
        verifyPublishedBugTracker(fixture, dir, renderBugTrackerHtml),
      ).rejects.toThrow(/publication is incomplete/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects a renderer that drops a canonical UI capability", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bug-tracker-export-"));
    try {
      await expect(
        exportBugTracker(
          fixture,
          dir,
          (document) => renderBugTrackerHtml(document).replace('id="saveHtml"', 'id="missingSaveHtml"'),
        ),
      ).rejects.toThrow(/functional contract/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects a renderer that drops a canonical ID", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bug-tracker-export-"));
    try {
      await expect(
        exportBugTracker(
          fixture,
          dir,
          (document) => renderBugTrackerHtml(document).replace(
            'data-issue-id="DEV-EXPORT-001"',
            'data-dropped-id="DEV-EXPORT-001"',
          ),
        ),
      ).rejects.toThrow(/issue-ID parity/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects a renderer that invents an extra ID", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bug-tracker-export-"));
    try {
      await expect(
        exportBugTracker(
          fixture,
          dir,
          (document) => renderBugTrackerHtml(document) + '<div data-issue-id="INVENTED"></div>',
        ),
      ).rejects.toThrow(/issue-ID parity/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
}

// Original tooling/bug-report-documents/tracker/project.test.ts; blob 906888a05f76233ada552ecadfec0b6cb156457a
{
const registry: ProjectRegistry = { projects: [{
  projectId: "fixture-map",
  projectName: "Fixture Map",
  artifact: { artifactId: "drive:fixture-world", artifactFingerprint: "sha256:fixture", version: "1.0.0" },
  knowledge: { bugReportPath: "workspace/reports/Fixture-Map-v1.0.0-BugReport.json" },
  publication: { drive: { mapFolder: { folderId: "fixture-folder" }, currentWorld: { fileId: "fixture-world", fileName: "Fixture Map v1.0.0.mcworld", version: "1.0.0" } } },
}] };

const developerNotes: DeveloperNoteRegistry = {
  schema: "m-bedrock-dev-notes/v1",
  notes: [{
    id: "DEV-FIXTURE-001",
    projectId: "fixture-map",
    type: "DEV_NOTE",
    title: "Fixture Developer Note",
    problem: "A concrete release condition needs developer attention.",
    action: "Correct the existing release owner.",
    evidence: { source: "fixture" },
    severity: null,
  }],
};

const client: BugReportClientDocument = {
  schema: "m-bedrock-bug-report-client-document/v1",
  title: "Fixture Map — Bug Report",
  subtitle: "fixture",
  map: { name: "Fixture Map", mapVersion: "1.0.0", testedVersion: "fixture" },
  summary: { visibleIssues: 1, openIssues: 1, fixedIssues: 0, blocker: 0, major: 1, minor: 0, statement: "fixture" },
  severityLegend: [],
  issues: [{
    number: 1, id: "BUG-FIXTURE-001", issueType: "BUG", severity: "major", status: "open", category: "player-state",
    title: "Fixture issue", issue: "A visible player-state failure occurs.",
    reproduction: ["Enter the fixture.", "Confirm the wrong result."],
    observed: "The wrong result is visible.", expected: "The expected result is visible.",
    recommendedResolution: "Restore the expected state.",
  }],
};

describe("Bug Tracker integration", () => {
  it("binds report facts to Project Registry source authority", () => {
    const source = resolveSourceBinding(registry, "Fixture Map", "1.0.0");
    expect(source.worldFilename).toBe("Fixture Map v1.0.0.mcworld");
    expect(source.bugReportPath).toContain("Fixture-Map");
  });
  it("projects and renders the same unique issue IDs", () => {
    const tracker = projectClientDocumentToTracker(client, registry, developerNotes);
    validateBugTrackerDocument(tracker);
    expect(trackerIssueIds(tracker)).toEqual(["BUG-FIXTURE-001", "DEV-FIXTURE-001"]);
    expect(renderBugTrackerHtml(tracker)).toContain('data-issue-id="BUG-FIXTURE-001"');
    expect(renderBugTrackerHtml(tracker)).toContain('data-issue-id="DEV-FIXTURE-001"');
    expect(renderBugTrackerHtml(tracker)).toContain("DEV NOTES");
  });
  it("fails closed when registry identity is ambiguous", () => {
    const ambiguous: ProjectRegistry = { projects: [...registry.projects, registry.projects[0]!] };
    expect(() => resolveSourceBinding(ambiguous, "Fixture Map", "1.0.0")).toThrow(/exactly one/);
  });

  it("fails closed when Project Registry current-world version disagrees with artifact authority", () => {
    const broken: ProjectRegistry = {
      projects: [{
        ...registry.projects[0]!,
        publication: {
          drive: {
            mapFolder: { folderId: "fixture-folder" },
            currentWorld: { fileId: "fixture-world", fileName: "Fixture Map v0.9.0.mcworld", version: "0.9.0" },
          },
        },
      }],
    };
    expect(() => resolveSourceBinding(broken, "Fixture Map", "1.0.0")).toThrow(/version binding mismatch/);
  });

  it("fails closed when Project Registry current-world file disagrees with artifact authority", () => {
    const broken: ProjectRegistry = {
      projects: [{
        ...registry.projects[0]!,
        publication: {
          drive: {
            mapFolder: { folderId: "fixture-folder" },
            currentWorld: { fileId: "other-world", fileName: "Fixture Map v1.0.0.mcworld", version: "1.0.0" },
          },
        },
      }],
    };
    expect(() => resolveSourceBinding(broken, "Fixture Map", "1.0.0")).toThrow(/artifact binding mismatch/);
  });

  it("rejects malformed Developer Note authority before projection", () => {
    const duplicate: DeveloperNoteRegistry = {
      ...developerNotes,
      notes: [...developerNotes.notes, developerNotes.notes[0]!],
    };
    expect(() => validateDeveloperNoteRegistry(duplicate)).toThrow(/Duplicate Developer Note ID/);

    const wrongSeverity = {
      ...developerNotes,
      notes: [{ ...developerNotes.notes[0]!, severity: "major" }],
    } as unknown as DeveloperNoteRegistry;
    expect(() => validateDeveloperNoteRegistry(wrongSeverity)).toThrow(/severity must be null/);
  });

  it("rejects Developer Notes bound to an unknown project", () => {
    const orphan: DeveloperNoteRegistry = {
      ...developerNotes,
      notes: [{ ...developerNotes.notes[0]!, projectId: "missing-project" }],
    };
    expect(() => projectClientDocumentToTracker(client, registry, orphan)).toThrow(/unknown Project Registry project/);
  });
});
}

// Original tooling/bug-report-documents/tracker/quality.test.ts; blob 8ef6d49bf5c4da1dfbd73bbe28ef341e9c3f4914
{
const baseIssue: TrackerIssue = {
  id: "BUG-QUALITY-001",
  type: "BUG",
  severity: "MAJOR",
  verification: "VERIFIED",
  title: "Quality fixture",
  issue: "A player-visible problem exists.",
  reproduction: ["Perform the in-game action.", "Observe the resulting state."],
  observed: "The resulting state is wrong because the owned runtime path does not reconcile it.",
  expected: "The resulting state is correct.",
  resolution: "Reconcile the state in the existing owner.",
  technicalAnalysis: "The existing owner omits the required reconciliation.",
};

function document(issue: TrackerIssue): BugTrackerDocument {
  return {
    schema: "m-bedrock-bug-tracker/v1",
    title: "Bug Tracker Report",
    games: [{
      name: "Quality Fixture",
      levels: [{
        level: null,
        version: "1.0.0",
        source: {
          projectId: "quality-fixture",
          artifactId: "drive:fixture",
          artifactFingerprint: "sha256:fixture",
          version: "1.0.0",
          driveFolder: "https://drive.google.com/drive/folders/folder",
          worldFile: "https://drive.google.com/file/d/file/view",
          worldFilename: "Quality Fixture v1.0.0.mcworld",
        },
        issues: [issue],
        devNotes: [],
      }],
    }],
  };
}

describe("Bug Tracker information quality", () => {
  it("accepts a concise actionable issue without requiring extra ceremony", () => {
    expect(auditBugTrackerInformation(document(baseIssue))).toEqual([]);
  });

  it("reports missing information without inventing replacements", () => {
    const sparse: TrackerIssue = {
      id: baseIssue.id,
      type: baseIssue.type,
      severity: baseIssue.severity,
      verification: baseIssue.verification,
      title: baseIssue.title,
      issue: baseIssue.issue,
      reproduction: [],
      observed: "",
      expected: "",
    };
    expect(auditBugTrackerInformation(document(sparse)).map((x) => x.code)).toEqual([
      "NO_TEST_STEPS",
      "NO_EXPECTED",
      "NO_TECHNICAL_EXPLANATION",
      "NO_RECOMMENDED_FIX",
    ]);
  });

  it("flags self-confirming reproduction wording", () => {
    const issue = {
      ...baseIssue,
      reproduction: ["Start the match.", "Confirm the bug still happens."],
    };
    expect(auditBugTrackerInformation(document(issue)).map((x) => x.code))
      .toContain("SELF_CONFIRMING_TEST_STEP");
  });
});
}

// Original tooling/bug-report-documents/tracker/real-reports.test.ts; blob 199dbbb214cce0f868d9f4fc02059789560a0e09
{
const cases = [
  "attack-challenge",
  "defense-challenge",
  "composite-challenge",
  "the-circuit",
  "build-and-decode",
] as const;

describe("Golden Tracker real approved-report parity", () => {
  for (const testCase of cases) {
    it(testCase, async () => {
      const projectRoot = resolve("workspace/projects", testCase);
      const [source, projectSource] = await Promise.all([
        readFile(resolve(projectRoot, "report/bug-report.json"), "utf8"),
        readFile(resolve(projectRoot, "project.json"), "utf8"),
      ]);
      let developerNotesSource = '{"schema":"m-bedrock-dev-notes/v1","notes":[]}';
      try {
        developerNotesSource = await readFile(
          resolve(projectRoot, "report/developer-notes.json"),
          "utf8",
        );
      } catch {}
      const localDeveloperNotes = JSON.parse(developerNotesSource) as {
        schema: "m-bedrock-dev-notes/v1";
        notes: readonly Omit<DeveloperNoteRegistry["notes"][number], "projectId">[];
      };
      const parsed = parseBugReportV2Json(source);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;

      const client = projectBugReportClientDocument(parsed.report, {
        includeFixed: true,
        includeMinor: true,
      });
      expect(reviewBugReportClientDocument(client)).toEqual([]);

      const tracker = projectClientDocumentToTracker(
        client,
        { projects: [JSON.parse(projectSource)] } as ProjectRegistry,
        {
          schema: localDeveloperNotes.schema,
          notes: localDeveloperNotes.notes.map((note) => ({
            ...note,
            projectId: testCase,
          })),
        } as DeveloperNoteRegistry,
      );
      validateBugTrackerDocument(tracker);
      const ids = trackerIssueIds(tracker);
      const html = renderBugTrackerHtml(tracker);

      expect(ids.length).toBe(client.issues.length + tracker.games.flatMap((game) => game.levels.flatMap((level) => level.devNotes)).length);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) {
        expect(html).toContain('data-issue-id="' + id + '"');
      }
      expect(html).toContain("Drive Folder ↗");
      expect(html).toContain("World File ↗");
      expect(html).not.toContain('<details class="map" open');
      expect(html).toContain("Save as HTML");
      expect(html).toContain('id="workspace-snapshot"');
      expect(html).toContain('class="files"');

      // Real approved project input → canonical tracker → published HTML/JSON.
      // Runtime acceptance only if this actual Vitest case executes.
      const publicationDir = await mkdtemp(join(tmpdir(), "real-tracker-"));
      try {
        await exportBugTracker(tracker, publicationDir, renderBugTrackerHtml);
        await expect(
          verifyPublishedBugTracker(tracker, publicationDir, renderBugTrackerHtml),
        ).resolves.toBeUndefined();
        const [publishedJson, publishedHtml] = await Promise.all([
          readFile(join(publicationDir, "bug-tracker.json"), "utf8"),
          readFile(join(publicationDir, "bug-tracker.html"), "utf8"),
        ]);
        expect(JSON.parse(publishedJson)).toEqual(tracker);
        const embedded = publishedHtml.match(
          /<script id="report-data" type="application\/json">([\s\S]*?)<\/script>/,
        );
        expect(embedded).not.toBeNull();
        expect(JSON.parse(embedded![1]!)).toEqual(tracker);
        expect(publishedHtml).toContain('id="saveHtml" type="button" class="save-primary"');
        expect(publishedHtml).toContain('id="findingSearch"');
        expect(publishedHtml).toContain('id="retestPassed"');
      } finally {
        await rm(publicationDir, { recursive: true, force: true });
      }

      const developerNoteCount = tracker.games.flatMap((game) =>
        game.levels.flatMap((level) => level.devNotes),
      ).length;

      // Derive source parity from the current canonical Developer Notes.
      // A new, valid note must not cause a stale hard-coded count failure
      // or disappear from the tester/developer handoff.
      const authoredNoteIds = localDeveloperNotes.notes.map((note) => note.id).sort();
      const projectedNoteIds = tracker.games.flatMap((game) =>
        game.levels.flatMap((level) => level.devNotes.map((note) => note.id)),
      ).sort();
      expect(developerNoteCount).toBe(authoredNoteIds.length);
      expect(projectedNoteIds).toEqual(authoredNoteIds);

      if (testCase === "the-circuit") {
        expect(html).toContain("DEV-CIR-FORTIFY-WAVE-PREVIEW");
        expect(html).toContain("DEV-CIR-BLOCK-BREAK-FEEDBACK");
        expect(html).toContain("DEV NOTE");
        expect(html).toContain("REFERENCE");
        const noteStart = html.indexOf('data-issue-id="DEV-CIR-FORTIFY-WAVE-PREVIEW"');
        const noteEnd = html.indexOf("</article>", noteStart);
        expect(noteStart).toBeGreaterThanOrEqual(0);
        expect(noteEnd).toBeGreaterThan(noteStart);
        expect(html.slice(noteStart, noteEnd)).not.toContain("Mark fixed");
      }

      if (testCase === "defense-challenge") {
        expect(html).toContain("<h3>DEVELOPER NOTES");
        expect(client.issues.every((issue) => issue.whyThisIsBug?.trim())).toBe(true);
        expect(client.issues.every((issue) => issue.impact?.trim())).toBe(true);
        expect(html).toContain("WHY THIS IS A BUG");
        expect(html).toContain("IMPACT");
        expect(html).toContain("<dt>Artifact Version</dt>");
        expect(html).toContain("<dt>Source</dt>");
        expect(html).toContain("<dt>Finding</dt>");
        expect(html).toContain("Action Required");
      }

      if (testCase === "build-and-decode") {
        expect(client.issues.length).toBe(2);
        expect(client.issues.every((issue) => issue.issueType === "DESIGN_MISMATCH")).toBe(true);
        expect(client.issues.every((issue) => issue.severity === "minor")).toBe(true);
        expect(html).toContain("BUG-BAD-FINAL-RESULT-PRESENTATION");
        expect(html).toContain("BUG-BAD-LAST-ROUND-NEXT-ROUND");
      }
    });
  }
});
}

// Original tooling/bug-report-documents/tracker/render-html.test.ts; blob 6bfdeb47466ca596644c623a1b1594a1a8a4bcbd
{
const fixture: BugTrackerDocument = {
  schema: "m-bedrock-bug-tracker/v1",
  title: "Bug Tracker Report",
  games: [{
    name: "Golden Fixture",
    levels: [{
      level: 1,
      version: "1.0.0",
      source: {
        projectId: "golden-fixture",
        artifactId: "drive:file",
        artifactFingerprint: "sha256:fixture",
        version: "1.0.0",
        driveFolder: "https://drive.google.com/drive/folders/folder",
        worldFile: "https://drive.google.com/file/d/file/view",
        worldFilename: "Golden Fixture v1.0.0.mcworld",
      },
      devNotes: [{
        id: "DEV-GOLDEN-001",
        type: "DEV_NOTE",
        title: "Fixture developer note",
        problem: "The fixture preserves the Developer Notes lane.",
        action: "Keep the Developer Notes lane after gameplay findings.",
        evidence: { source: "fixture" },
        severity: null,
      }],
      issues: [{
        id: "BUG-GOLDEN-001",
        type: "BUG",
        severity: "MAJOR",
        verification: "NEEDS_VERIFY",
        title: "Fixture issue",
        issue: "The fixture demonstrates the locked issue-card hierarchy.",
        whyThisIsBug: "The fixture intentionally violates its expected visible-result contract.",
        impact: "A reader can see how the defect changes the fixture result.",
        reproduction: ["Enter the fixture.", "Observe the wrong visible result."],
        observed: "The wrong result remains visible.",
        expected: "The expected result should be visible.",
        resolution: "Restore the expected fixture result.",
      }],
    }],
  }],
};

describe("Golden Bug Tracker renderer", () => {
  it("renders the locked hierarchy and mandatory source controls", () => {
    validateBugTrackerDocument(fixture);
    const html = renderBugTrackerHtml(fixture);
    expect(html).toContain("Bug Tracker Report");
    expect(html).toContain("MAP REPORT");
    expect(html).not.toContain(">Maps<");
    expect(html).not.toContain("Expand Map ↓");
    expect(html).toContain("Needs Validation");
    expect(html).toContain("DEVELOPER NOTES");
    expect(html).toContain("LEVEL 1");
    expect(html).toContain('id="map-level-1"');
    expect(html).toContain('<nav class="lane-nav" aria-label="Finding sections">');
    expect(html).toContain('href="#map-level-1-bugs"');
    expect(html).toContain('href="#map-level-1-notes"');
    expect(html).not.toContain('href="#map-level-1-design"');
    expect(html).toContain("Drive Folder ↗");
    expect(html).toContain("World File ↗");
    expect(html).toContain("Test / Details ↓");
    expect(html).toContain("Collapse ↑");
    expect(html).toContain("NEEDS VALIDATION");
    expect(html).toContain("WHY THIS IS A BUG");
    expect(html).toContain("IMPACT");
    expect(html).toContain("The fixture intentionally violates its expected visible-result contract.");
    expect(html).toContain("A reader can see how the defect changes the fixture result.");
    expect(html).toContain("TEST IN-GAME");
    expect(html).toContain("EXPECTED");
    expect(html).toContain("Technical Details ↓");
    expect(html).toContain("Technical Analysis");
    expect(html).not.toContain("Why It Happens / Technical Analysis");
    expect(html).toContain("OBSERVED / EVIDENCE");
    expect(html).toContain('class="behavior-comparison" aria-label="Expected and recorded observation"');
    expect(html).toContain("Recorded evidence; not a live tester result.");
    expect(html).toContain("After-Fix Retest Results");
    expect(html).toContain('id="findingSearch"');
    expect(html).toContain('id="severityFilter"');
    expect(html).toContain('id="resultFilter"');
    expect(html).toContain("Finding evidence still needs validation");
    expect(html).toContain("<dt>Source</dt>");
    expect(html).toContain("<dd>fixture</dd>");
    expect(html).toContain("Action Required");
    expect(html).toContain("Recommended Fix");
    expect(html).toContain("TEST RESULT");
    expect(html).toContain("Needs Validation: 1 · Retest Ready: 0 · No Guided Procedure: 0");
    expect(html).toContain("VALIDATE EVIDENCE FIRST");
    expect(html).toContain('data-test-ready="false"');
    expect(html).toContain("Passed means Expected behavior is restored");
    expect(html).toContain('data-result="SUCCESS" disabled aria-disabled="true"');
    expect(html).toContain("✓ PASSED");
    expect(html).toContain("✕ FAILED");
    expect(html).toContain("Tester Notes");
    expect(html).toContain("Save as HTML");
    expect(html).toContain("Save JSON");
    expect(html).not.toContain("Export");
    expect(html).toContain("Evidence <span>· Optional</span>");
    expect(html).toContain("Optional notes");
    expect(html.indexOf("TEST RESULT")).toBeLessThan(html.indexOf("Technical Details ↓"));
    expect(html).not.toContain("Mark fixed");
    expect(html).toContain('data-issue-id="BUG-GOLDEN-001"');
    expect(html).not.toContain("<details class=\"map\"");
    expect(html.indexOf("BUGS")).toBeLessThan(html.indexOf("DEVELOPER NOTES"));
  });

  it("emits JavaScript that browsers can parse for tester controls and Load JSON", () => {
    const html = renderBugTrackerHtml(fixture);
    const interactiveScript = html.split("<script>").at(-1)?.split("</script>")[0];
    expect(interactiveScript).toBeDefined();
    expect(() => new Script(interactiveScript!)).not.toThrow();
    expect(interactiveScript).toContain('const reader = new FileReader();');
    expect(html).toContain('<button id="saveHtml" type="button" class="save-primary">Save as HTML</button>');
    expect(html).toContain('<button id="saveButton" type="button" aria-expanded="false"');
    expect(interactiveScript).toContain('snapshot.dataset.copyId =');
    expect(interactiveScript).toContain('location.pathname + ":" + COPY_ID');
  });

  it("escapes exported snapshots and isolates each saved HTML copy", () => {
    const html = renderBugTrackerHtml(fixture);
    const script = html.split("<script>").at(-1)?.split("</script>")[0];
    expect(script).toBeDefined();
    const helper = script!.match(/function serializeWorkspace\(value\) \{[\s\S]*?\n\}/)?.[0];
    expect(helper).toBeDefined();
    const notes = "</ScRiPt><script>unsafe()</script>";
    const portable = runInNewContext(
      helper + "\nserializeWorkspace({ 'BUG-GOLDEN-001': { notes } })",
      { notes },
    ) as string;
    expect(portable.toLowerCase()).not.toContain("</script>");
    expect(JSON.parse(portable)["BUG-GOLDEN-001"].notes).toBe(notes);
    expect(script).toContain("entry.fixed === true");
    expect(script).toContain("localStorage.setItem(KEY, JSON.stringify(WS))");
    expect(script).toContain("const cached = localStorage.getItem(KEY)");
    expect(script).toContain("const next = Object.hasOwn(imported, id)");
    expect(script).toContain("const persisted = save(); // Keep an explicit empty override");
    expect(script).not.toContain("location.reload()");
  });

  it("preserves exact canonical report text when embedded HTML contains script-like data", () => {
    const level = fixture.games[0]!.levels[0]!;
    const malicious = "</ScRiPt><script>alert(1)</script>";
    const document: BugTrackerDocument = {
      ...fixture,
      games: [{
        ...fixture.games[0]!,
        levels: [{
          ...level,
          issues: [{ ...level.issues[0]!, issue: malicious }],
        }],
      }],
    };
    const html = renderBugTrackerHtml(document);
    expect(html).not.toContain(malicious);
    const embedded = html.match(/<script id="report-data" type="application\/json">([\s\S]*?)<\/script>/);
    expect(embedded).toBeDefined();
    const recovered = JSON.parse(embedded![1]!);
    expect(recovered.games[0].levels[0].issues[0].issue).toBe(malicious);
  });

  it("validates imported tester results and screenshots without changing issue authority", () => {
    const script = renderBugTrackerHtml(fixture).split("<script>").at(-1)?.split("</script>")[0];
    expect(script).toBeDefined();
    const source = script!.split("function normalizeTesterState(value) {")[1]?.split("\nlet WS =")[0];
    expect(source).toBeDefined();
    const normalize = runInNewContext(
      "(function normalizeTesterState(value) {" + source + ")",
      { IDS: new Set(["BUG-GOLDEN-001", "DEV-GOLDEN-001"]), NOTE_IDS: new Set(["DEV-GOLDEN-001"]) },
    ) as (input: unknown) => Record<string, unknown>;
    expect(JSON.parse(JSON.stringify(normalize({
      "BUG-GOLDEN-001": { fixed: true, notes: "old tester", attachments: [] },
    })))["BUG-GOLDEN-001"]).toEqual({ result: "SUCCESS", notes: "old tester", attachments: [] });
    expect(() => normalize({ "OTHER-MAP": { result: "FAILED" } })).toThrow();
    expect(() => normalize({ "DEV-GOLDEN-001": { result: "SUCCESS" } })).toThrow();
    expect(() => normalize({ "BUG-GOLDEN-001": {
      notes: "evidence", attachments: [{
        name: "invalid.svg", type: "image/svg+xml", data: "data:image/svg+xml;base64,PHN2Zz4=",
      }],
    } })).toThrow();
  });

  it("renders a combined briefing with column-major map navigation", () => {
    const second = {
      ...fixture.games[0]!,
      name: "Second Fixture",
      levels: fixture.games[0]!.levels.map((level) => ({
        ...level,
        source: { ...level.source, projectId: "second-fixture", artifactId: "drive:second" },
        issues: level.issues.map((issue) => ({ ...issue, id: "BUG-SECOND-001" })),
        devNotes: level.devNotes.map((note) => ({ ...note, id: "DEV-SECOND-001" })),
      })),
    };
    const combined: BugTrackerDocument = { ...fixture, games: [fixture.games[0]!, second] };
    const html = renderBugTrackerHtml(combined);
    expect(html).toContain(">Maps<");
    expect(html).toContain("Expand Map ↓");
    expect(html).toContain("grid-auto-flow:column");
    expect(html).toContain('id="game-1-level-1-bugs"');
    expect(html).toContain('id="game-2-level-1-bugs"');
    expect(html).toContain('href="#game-1-level-1-notes"');
    expect(html).toContain('href="#game-2-level-1-notes"');
    expect(html).toContain("data-map-link=\"1\"");
    expect(html).toContain("data-map-link=\"2\"");
  });

  it("navigates single-map levels and nonempty finding lanes without synthetic level IDs", () => {
    const first = fixture.games[0]!.levels[0]!;
    const second = {
      ...first,
      level: 3,
      version: "1.0.0",
      issues: [{
        ...first.issues[0]!,
        id: "DM-LEVEL-3",
        type: "DESIGN_MISMATCH" as const,
      }],
      devNotes: [],
      source: {
        ...first.source,
        projectId: "level-3",
        artifactId: "drive:level-3",
      },
    };
    const doc: BugTrackerDocument = {
      ...fixture,
      games: [{ ...fixture.games[0]!, levels: [first, second] }],
    };
    const html = renderBugTrackerHtml(doc);
    expect(html).toContain('<nav class="level-nav" aria-label="Levels">');
    expect(html).toContain('href="#map-level-1">Level 1</a>');
    expect(html).toContain('href="#map-level-2">Level 3</a>');
    expect(html).toContain('href="#map-level-1-bugs"');
    expect(html).toContain('href="#map-level-1-notes"');
    expect(html).not.toContain('href="#map-level-1-design"');
    expect(html).toContain('href="#map-level-2-design"');
    expect(html).not.toContain('href="#map-level-2-bugs"');
    expect(html).not.toContain(">Maps<");
    expect(html).not.toContain('id="game-1-level-1"');
    expect(html).toContain('data-issue-id="BUG-GOLDEN-001"');
    expect(html).toContain('data-issue-id="DM-LEVEL-3"');
    expect(html).toContain('data-issue-id="DEV-GOLDEN-001"');
    expect(html).toContain("@media(max-width:700px)");
    expect(html).toContain(".problem{font-size:14px");
    expect(html).toContain(".issue h4,.devnote h4{font-size:17px");
    expect(html).toContain("a:focus-visible");
  });

  it("does not display null level as a numbered level or fabricate section links", () => {
    const level = fixture.games[0]!.levels[0]!;
    const map: BugTrackerDocument = {
      ...fixture,
      games: [{ ...fixture.games[0]!, levels: [{
        ...level, level: null, issues: [], devNotes: [],
      }] }],
    };
    const html = renderBugTrackerHtml(map);
    expect(html).toContain('<span class="level-badge">MAP</span>');
    expect(html).not.toContain("LEVEL null");
    expect(html).not.toContain('class="lane-nav"');
    expect(html).not.toContain('class="level-nav"');
    expect(html).not.toContain(">Maps<");
    expect(html).not.toContain('data-issue-id="BUG-GOLDEN-001"');
  });

  it("uses the authored level ID, not display position, for sparse levels", () => {
    const level = fixture.games[0]!.levels[0]!;
    const sparse: BugTrackerDocument = {
      ...fixture,
      games: [{
        ...fixture.games[0]!,
        levels: [{ ...level, level: 3 }],
      }],
    };
    const html = renderBugTrackerHtml(sparse);
    expect(html).toContain("LEVEL 3");
    expect(html).not.toContain("LEVEL 1");
  });

  it("preserves unknown information as absent UI instead of inventing content", () => {
    const level = fixture.games[0]!.levels[0]!;
    const sparseIssue = {
      ...level.issues[0]!,
      reproduction: [],
      observed: "",
      expected: "",
    };
    delete sparseIssue.resolution;
    const sparse: BugTrackerDocument = {
      ...fixture,
      games: [{
        ...fixture.games[0]!,
        levels: [{
          ...level,
          issues: [sparseIssue],
        }],
      }],
    };
    const html = renderBugTrackerHtml(sparse);
    expect(html).not.toContain("TEST IN-GAME");
    expect(html).not.toContain("EXPECTED");
    expect(html).not.toContain("Recommended Fix");
    expect(html).toContain('data-test-ready="false"');
    expect(html).toContain("VALIDATE EVIDENCE FIRST");
    expect(html).toContain("Guided retest unavailable");
    expect(html).toContain('data-result="SUCCESS" disabled aria-disabled="true"');
    expect(html).toContain('data-result="FAILED" disabled aria-disabled="true"');
  });

  it("separates mismatch rationale, unavailable retest, and browser-save failure", () => {
    const level = fixture.games[0]!.levels[0]!;
    const mismatch = {
      ...level.issues[0]!,
      id: "DM-GOLDEN-NO-TEST",
      type: "DESIGN_MISMATCH" as const,
      verification: "VERIFIED" as const,
      reproduction: [],
      expected: "",
    };
    const modified: BugTrackerDocument = {
      ...fixture,
      games: [{ ...fixture.games[0]!, levels: [{ ...level, issues: [mismatch] }] }],
    };
    const html = renderBugTrackerHtml(modified);
    expect(html).toContain("WHY THIS IS A MISMATCH");
    expect(html).toContain("RETEST PROCEDURE NOT READY");
    expect(html).toContain('data-test-ready="false"');
    expect(html).toContain('data-result="SUCCESS" disabled aria-disabled="true"');
    expect(html).toContain("This tester result never marks a canonical bug Fixed");
    expect(html).toContain("Not yet saved locally");
    const script = html.split("<script>").at(-1)?.split("</script>")[0];
    expect(script).toBeDefined();
    expect(script).toContain("localStorage.setItem(KEY, JSON.stringify(WS))");
    expect(script).toContain("markSaveFailed();");
    expect(script).toContain("Invalid or different-map Bug Tracker JSON");
    expect(script).toContain("Screenshot held in memory");
  });

  it("uses shared copy-quality rules for legacy HTML guided retest readiness", () => {
    const level = fixture.games[0]!.levels[0]!;
    const correct = { ...level.issues[0]!, verification: "VERIFIED" as const };
    const rejected = [
      { ...correct, id: "BUG-GOLDEN-CODE",
        reproduction: ["Inspect the session function.", "Confirm the gate remains closed."] },
      { ...correct, id: "BUG-GOLDEN-VAGUE",
        reproduction: ["Join the arena with 2 players.", "Confirm the bug is visible."] },
      { ...correct, id: "BUG-GOLDEN-BLANK",
        reproduction: ["", "Confirm the gate remains closed."] },
    ];
    const changed: BugTrackerDocument = {
      ...fixture,
      games: [{ ...fixture.games[0]!, levels: [{ ...level, issues: [correct, ...rejected] }] }],
    };
    const html = renderBugTrackerHtml(changed);
    expect(html).toContain("Needs Validation: 0 · Retest Ready: 1 · No Guided Procedure: 3");
    for (const item of rejected) {
      const start = html.indexOf('data-issue-id="' + item.id + '"');
      const finish = html.indexOf("</article>", start);
      expect(start, item.id).toBeGreaterThanOrEqual(0);
      const card = html.slice(start, finish);
      expect(card).toContain('data-test-ready="false"');
      expect(card).toContain("RETEST PROCEDURE NOT READY");
      expect(card).toContain("Guided retest unavailable");
      expect(card).toContain('data-result="SUCCESS" disabled aria-disabled="true"');
      expect(card).toContain('data-result="FAILED" disabled aria-disabled="true"');
    }
    const goodStart = html.indexOf('data-issue-id="' + correct.id + '"');
    const goodEnd = html.indexOf("</article>", goodStart);
    expect(html.slice(goodStart, goodEnd)).toContain('data-test-ready="true"');
    expect(html).toContain("Test In-Game must describe player actions");
    expect(html).toContain("Test In-Game must describe a concrete action");
  });

  it("keeps validation, after-fix retest, and missing instructions separate", () => {
    const level = fixture.games[0]!.levels[0]!;
    const pending = level.issues[0]!;
    const verified = { ...pending, verification: "VERIFIED" as const, id: "BUG-VALID-01" };
    const noSteps = { ...verified, id: "BUG-VALID-02", reproduction: [] };
    const noObservation = { ...verified, id: "BUG-VALID-03", observed: "" };
    const report: BugTrackerDocument = {
      ...fixture,
      games: [{ ...fixture.games[0]!, levels: [
        { ...level, issues: [pending, verified, noSteps, noObservation] },
      ] }],
    };
    const html = renderBugTrackerHtml(report);
    expect(html).toContain("Needs Validation: 1 · Retest Ready: 1 · No Guided Procedure: 2");
    const card = (id: string) => {
      const i = html.indexOf('data-issue-id="' + id + '"');
      expect(i).toBeGreaterThanOrEqual(0);
      return html.slice(i, html.indexOf("</article>", i));
    };
    expect(card(pending.id)).toContain("VALIDATE EVIDENCE FIRST");
    expect(card(pending.id)).toContain('data-result="SUCCESS" disabled');
    expect(card(pending.id)).toContain("Record observations in Tester Notes");
    expect(card(verified.id)).toContain('data-test-ready="true"');
    expect(card(verified.id)).not.toContain('data-result="SUCCESS" disabled');
    expect(card(noSteps.id)).toContain("RETEST PROCEDURE NOT READY");
    expect(card(noSteps.id)).toContain("Test In-Game requires a concrete tester-visible route");
    expect(card(noObservation.id)).toContain("Observed failure evidence has not been provided.");
    expect(html).not.toContain("SOURCE-ONLY");
    expect(html).toContain('data-issue-id="DEV-GOLDEN-001"');
  });

  it("renders precise developer evidence without implying a proven fix", () => {
    const level = fixture.games[0]!.levels[0]!;
    const issue = {
      ...level.issues[0]!,
      id: "BUG-DEV-CONTEXT",
      verification: "VERIFIED" as const,
      technicalAnalysis: "Source suggests a possible cause; runtime settlement is unobserved.",
      relevantCode: [{ file: "BP/<entities>/mob.json", reason: "Inspect terminal behavior." }],
      mustPreserve: ["Arena identity"],
    };
    const note = { ...level.devNotes[0]!,
      evidence: {
        artifactVersion: "1.0.0",
        source: "BP/scripts/<loader>.js",
        finding: "Only the selected source contains this hook.",
        nestedState: { enabled: false, count: 2 },
      },
    };
    const report: BugTrackerDocument = { ...fixture,
      games: [{ ...fixture.games[0]!, levels: [{ ...level, issues: [issue], devNotes: [note] }] }],
    };
    const html = renderBugTrackerHtml(report);
    const beginning = html.indexOf('data-issue-id="BUG-DEV-CONTEXT"');
    const card = html.slice(beginning, html.indexOf("</article>", beginning));
    expect(card).toContain("Technical Analysis");
    expect(card).toContain("Recommended Fix");
    expect(card).toContain("Must Preserve");
    expect(card).toContain("Technical Analysis explains the recorded evidence");
    expect(card).not.toContain("Why It Happens / Technical Analysis");
    expect(card).toContain('<ul class="source-list">');
    expect(card).toContain("&lt;entities&gt;");
    expect(card).not.toContain("<entities>");
    const devStart = html.indexOf('data-issue-id="DEV-GOLDEN-001"');
    const dev = html.slice(devStart, html.indexOf("</article>", devStart));
    expect(dev).toContain("<dt>Artifact Version</dt>");
    expect(dev).toContain("<dt>Source</dt>");
    expect(dev).toContain("<dt>Finding</dt>");
    expect(dev).toContain("<dt>Nested State</dt>");
    expect(dev).toContain("&lt;loader&gt;");
    expect(dev).toContain("Action Required");
    expect(dev).not.toContain('data-result="SUCCESS"');
  });

  it("isolates tester workspace per exact map artifact and version", () => {
    const html = renderBugTrackerHtml(fixture);
    expect(html).toContain("const SCOPE = scopeOf(REPORT);");
    expect(html).toContain('const KEY = "m-bedrock-bug-tracker-workspace-v1:" + SCOPE');
    expect(html).toContain('location.pathname + ":" + COPY_ID');
    expect(html).toContain("JSON.stringify(payload.canonical) !== JSON.stringify(REPORT)");
    expect(html).toContain("level.source.artifactFingerprint");
    expect(html).toContain("level.source.version");
  });

  it("keeps tester outcomes distinct from verification and derives progress from workspace", () => {
    const level = fixture.games[0]!.levels[0]!;
    const report: BugTrackerDocument = {
      ...fixture,
      games: [{ ...fixture.games[0]!, levels: [{
        ...level,
        issues: [{
          ...level.issues[0]!, id: "BUG-READY-001",
          verification: "VERIFIED" as const,
        }, level.issues[0]!],
      }] }],
    };
    const html = renderBugTrackerHtml(report);
    expect(html).toContain('id="retestPassed">0</b>');
    expect(html).toContain('id="retestFailed">0</b>');
    expect(html).toContain('id="retestUntested">0</b>');
    expect(html).toContain('data-issue-id="BUG-READY-001"');
    expect(html).toContain('data-test-ready="true"');
    expect(html).toContain("Tester results only · Not a canonical Fixed status");
    const script = html.split("<script>").at(-1)?.split("</script>")[0];
    expect(script).toContain('const ready = testerCards.filter(card => card.dataset.testReady === "true")');
    expect(script).toContain('state(card.dataset.issueId).result === "SUCCESS"');
    expect(script).toContain('state(card.dataset.issueId).result === "FAILED"');
    expect(script).toContain("testerCards.length - ready.length");
    expect(script).toContain("refreshPresentation();");
    expect(script).toContain('if (active && !game.hidden) game.querySelector(".map").open = true');
    expect(script).toContain('result === "all" || (!developerNote && result === outcome)');
    expect(script).toContain('group.hidden = ![...group.querySelectorAll(".issue")]');
    expect(script).not.toContain("REPORT.games[0].levels[0].issues[0].verification =");
  });

  it("puts source-observed evidence beside expected without duplicating it", () => {
    const html = renderBugTrackerHtml(fixture);
    const start = html.indexOf('data-issue-id="BUG-GOLDEN-001"');
    const card = html.slice(start, html.indexOf("</article>", start));
    expect(card.indexOf("TEST IN-GAME")).toBeLessThan(card.indexOf("EXPECTED"));
    expect(card.indexOf("EXPECTED")).toBeLessThan(card.indexOf("OBSERVED / EVIDENCE"));
    expect(card.indexOf("OBSERVED / EVIDENCE")).toBeLessThan(card.indexOf("TEST RESULT"));
    expect(card.indexOf("TEST RESULT")).toBeLessThan(card.indexOf("Technical Details ↓"));
    expect(card.match(/The wrong result remains visible\./g)).toHaveLength(1);
    expect(card).toContain("Recommended Fix");
    expect(html).toContain('id="clearFilters"');
    expect(html).toContain('id="noFilterMatches"');
    expect(html).toContain("No findings match the current search or filters.");
  });

  it("rejects duplicate issue IDs before rendering", () => {
    const duplicate: BugTrackerDocument = {
      ...fixture,
      games: [...fixture.games, fixture.games[0]!],
    };
    expect(() => validateBugTrackerDocument(duplicate)).toThrow(/Duplicate issue ID/);
  });

  it("rejects missing Drive bindings", () => {
    const level = fixture.games[0]!.levels[0]!;
    const broken: BugTrackerDocument = {
      ...fixture,
      games: [{
        ...fixture.games[0]!,
        levels: [{
          ...level,
          source: { ...level.source, driveFolder: "" },
        }],
      }],
    };
    expect(() => validateBugTrackerDocument(broken)).toThrow(/Drive Folder is required/);
  });
});
}

// Original tooling/bug-report-documents/tracker/workspace-version.test.ts; blob bf428596f165174304362e6a77253c3496708885
{
describe("workspace version layout", () => {
  it("keeps current reports aligned with project and level bindings", async () => {
    await expect(validateWorkspaceVersions()).resolves.toBeUndefined();
  });
});
}
