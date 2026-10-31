import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseBugReportV2Json, reviewBugReportCopy, reviewBugReportReadiness, projectBugReportClientDocument, reviewBugReportClientDocument } from "../src/index.js";

// Source-preserved golden report contract: golden-tester-report.test.ts
{
const fixturePath = fileURLToPath(
  new URL(
    "../fixtures/golden-tester-report-v2.json",
    import.meta.url,
  ),
);

describe("golden tester report", () => {
  it("remains schema-valid, tester-ready, and copy-ready", async () => {
    const source = await readFile(fixturePath, "utf8");
    const parsed = parseBugReportV2Json(source);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(
      reviewBugReportReadiness(parsed.report.bugs),
    ).toEqual([]);
    expect(
      reviewBugReportCopy(parsed.report.bugs),
    ).toEqual([]);

    expect(
      parsed.report.bugs.map((bug) => bug.severity),
    ).toEqual([
      "blocker",
      "major",
      "minor",
    ]);
  });
});
}
// Source-preserved golden report contract: golden-client-document.test.ts
{
const reportFixturePath = fileURLToPath(
  new URL(
    "../fixtures/golden-tester-report-v2.json",
    import.meta.url,
  ),
);

const documentFixturePath = fileURLToPath(
  new URL(
    "../fixtures/golden-client-document-v1.json",
    import.meta.url,
  ),
);

describe("golden client document", () => {
  it("remains a deterministic projection of the golden canonical report", async () => {
    const [reportSource, expectedSource] =
      await Promise.all([
        readFile(reportFixturePath, "utf8"),
        readFile(documentFixturePath, "utf8"),
      ]);

    const parsed =
      parseBugReportV2Json(reportSource);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const document =
      projectBugReportClientDocument(
        parsed.report,
      );

    expect(
      reviewBugReportClientDocument(document),
    ).toEqual([]);
    expect(document).toEqual(
      JSON.parse(expectedSource),
    );
  });
});
}
