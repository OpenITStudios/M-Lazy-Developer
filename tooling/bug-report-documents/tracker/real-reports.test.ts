import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseBugReportV2Json,
  projectBugReportClientDocument,
  reviewBugReportClientDocument,
} from "../../../engine/packages/bug-report/src/index.js";
import { projectClientDocumentToTracker, type DeveloperNoteRegistry, type ProjectRegistry } from "./project.js";
import { renderBugTrackerHtml } from "./render-html.js";
import { exportBugTracker, verifyPublishedBugTracker } from "./export.js";
import { trackerIssueIds, validateBugTrackerDocument } from "./validate.js";

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
