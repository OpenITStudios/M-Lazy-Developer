// Owner-local source consolidation. Original cases are preserved verbatim.
import { describe, expect, it, vi } from "vitest";
import { GitHubBugReportConflictError, GitHubBugReportStore } from "./github-report-store.js";
import { handleBugReportStoreRequest } from "./github-report-handler.js";

// Original tooling/bug-report-ui/github-report-store.test.ts [65b98533018a3fa1b1a4ea1680d3157632f1ffb8]
{
function report() {
  return {
    schema: "m-bedrock-bug-report/v2" as const,
    map: {
      name: "A",
      mapVersion: "1.0.0",
      drive: "https://drive.google.com/file/d/map/view",
      baseVersion: "1.26.20",
      testedVersion: "1.26.20",
    },
    repairBy: "developer" as const,
    bugs: [{
      id: "BUG-A-001",
      fixed: true,
      severity: "minor" as const,
      category: "ui-feedback" as const,
      foundBy: "tester" as const,
      title: "Join feedback remains visible",
      problem: "The join prompt remains visible after the player leaves the join area.",
      expected: "The join prompt disappears after leaving the join area.",
      observed: "The join prompt remains visible outside the join area.",
      reproduction: [
        "Enter the join area until the prompt appears.",
        "Leave the join area.",
        "Confirm the join prompt remains visible outside the area.",
      ],
    }],
  };
}

describe("GitHubBugReportStore", () => {
  it("accepts exact no-op saves without creating a Git revision", async () => {
    const encoded = Buffer.from(
      JSON.stringify(report()),
      "utf8",
    ).toString("base64");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          type: "file",
          path: "workspace/projects/attack-challenge/report/bug-report.json",
          sha: "abc",
          content: encoded,
          encoding: "base64",
        }),
        { status: 200 },
      ));

    const store = new GitHubBugReportStore({
      owner: "MIVUBI-STD",
      repository: "M-Lazy-Developer",
      branch: "Local",
      token: "secret",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await expect(
      store.saveReport(
        "workspace/projects/attack-challenge/report/bug-report.json",
        report(),
        "abc",
      ),
    ).resolves.toEqual({
      revision: "abc",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuses to overwrite a changed report", async () => {
    const encoded = Buffer.from(
      JSON.stringify(report()),
      "utf8",
    ).toString("base64");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          type: "file",
          path: "workspace/projects/attack-challenge/report/bug-report.json",
          sha: "newer",
          content: encoded,
          encoding: "base64",
        }),
        { status: 200 },
      ));

    const store = new GitHubBugReportStore({
      owner: "MIVUBI-STD",
      repository: "M-Lazy-Developer",
      branch: "Local",
      token: "secret",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await expect(
      store.saveReport(
        "workspace/projects/attack-challenge/report/bug-report.json",
        report(),
        "older",
      ),
    ).rejects.toBeInstanceOf(
      GitHubBugReportConflictError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects paths outside the report directory", async () => {
    const store = new GitHubBugReportStore({
      owner: "MIVUBI-STD",
      repository: "M-Lazy-Developer",
      branch: "Local",
      token: "secret",
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });

    await expect(
      store.saveReport(
        "../outside.json",
        report(),
        "abc",
      ),
    ).rejects.toThrow("canonical project/level report/bug-report.json");
  });
  it("rejects any canonical issue mutation through generic save", async () => {
    const current = report();
    const encoded = Buffer.from(
      JSON.stringify(current),
      "utf8",
    ).toString("base64");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          type: "file",
          path: "workspace/projects/attack-challenge/report/bug-report.json",
          sha: "abc",
          content: encoded,
          encoding: "base64",
        }),
        { status: 200 },
      ));

    const store = new GitHubBugReportStore({
      owner: "MIVUBI-STD",
      repository: "M-Lazy-Developer",
      branch: "Local",
      token: "secret",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const changed = {
      ...current,
      bugs: current.bugs.map((bug) => ({
        ...bug,
        severity: "major" as const,
        issueType:
          "DESIGN_MISMATCH" as const,
      })),
    };

    await expect(
      store.saveReport(
        "workspace/projects/attack-challenge/report/bug-report.json",
        changed,
        "abc",
      ),
    ).rejects.toThrow(
      /cannot modify canonical issue facts/i,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects generic fixed-state changes and reserves them for closed repair completion", async () => {
    const current = report();
    const open = {
      ...current,
      bugs: current.bugs.map((bug) => ({
        ...bug,
        fixed: false,
      })),
    };
    const encoded = Buffer.from(
      JSON.stringify(open),
      "utf8",
    ).toString("base64");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          type: "file",
          path: "workspace/projects/attack-challenge/report/bug-report.json",
          sha: "abc",
          content: encoded,
          encoding: "base64",
        }),
        { status: 200 },
      ));

    const store = new GitHubBugReportStore({
      owner: "MIVUBI-STD",
      repository: "M-Lazy-Developer",
      branch: "Local",
      token: "secret",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await expect(
      store.saveReport(
        "workspace/projects/attack-challenge/report/bug-report.json",
        current,
        "abc",
      ),
    ).rejects.toThrow(
      /closed repair completion/i,
    );
  });

});
}

// Original tooling/bug-report-ui/github-report-handler.test.ts [816cbe8c9b509c3ff0c6e1b510032ffee8d336b7]
{
function report() {
  return {
    schema: "m-bedrock-bug-report/v2" as const,
    map: {
      name: "Golden",
      mapVersion: "1.0.0",
      drive: "https://drive.google.com/file/d/map/view",
      baseVersion: "1.26.20",
      testedVersion: "1.26.32",
    },
    repairBy: "developer" as const,
    bugs: [{
      id: "BUG-G-001",
      fixed: false,
      severity: "minor" as const,
      category: "ui-feedback" as const,
      foundBy: "tester" as const,
      title: "Join feedback remains visible",
      problem:
        "The join prompt remains visible after the player leaves the join area.",
      expected:
        "The join prompt disappears after leaving the join area.",
      observed:
        "The join prompt remains visible outside the join area.",
      reproduction: [
        "Enter the join area until the prompt appears.",
        "Leave the join area.",
        "Confirm the join prompt remains visible outside the area.",
      ],
    }],
  };
}

function storeStub() {
  return {
    listReports: vi.fn(async () => []),
    loadReport: vi.fn(),
    saveReport: vi.fn(),
    completeClosedRepair: vi.fn(async () => ({ revision: "closed" })),
  } as unknown as GitHubBugReportStore;
}

describe("bug report handler", () => {
  it("does not allow canonical report creation through the presentation API", async () => {
    const store = storeStub();
    const response = await handleBugReportStoreRequest(
      new Request("http://localhost/api/bug-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: "workspace/projects/attack-challenge/report/bug-report.json",
          report: report(),
        }),
      }),
      store,
    );

    expect(response.status).toBe(404);
    expect(store.saveReport).not.toHaveBeenCalled();
  });



  it("routes full lifecycle closure through closed repair persistence", async () => {
    const store = storeStub();
    const response = await handleBugReportStoreRequest(
      new Request("http://localhost/api/bug-report/closed", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: "workspace/projects/attack-challenge/report/bug-report.json",
          bugId: "BUG-G-001",
          repairBy: "developer",
          closure: {
            schemaVersion: 1,
            transactionId: "tx:1",
            scenarioId: "scenario:1",
            disposition: "fixed",
            proofLayerEvidence: {
              transitive: ["e:t"],
              runtime: ["e:r"],
              preservation: ["e:p"],
              package: ["e:pkg"],
            },
            regressionEvidenceIds: ["e:reg"],
            evidenceIds: ["e:t", "e:r", "e:p", "e:pkg", "e:reg"],
          },
          preservation: {
            contractId: "contract:1",
            transactionId: "tx:1",
            passed: true,
            verifiedMustChangeInvariantIds: ["intent:change"],
            verifiedMustPreserveInvariantIds: ["intent:preserve"],
            evidenceIds: ["e:p"],
          },
          expectedRevision: "abc",
        }),
      }),
      store,
    );

    expect(response.status).toBe(200);
    expect(store.completeClosedRepair).toHaveBeenCalledTimes(1);
  });



});
}
