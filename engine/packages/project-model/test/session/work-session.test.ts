import {
  describe,
  expect,
  it,
} from "vitest";
import {
  advanceWorkSessionCheckpoint,
  createWorkSessionCheckpoint,
  workSessionIsBlocked,
} from "../../src/session/work-session.js";

describe("work session checkpoint", () => {
  it("advances monotonically while accumulating references", () => {
    const created =
      createWorkSessionCheckpoint({
        sessionId: "session:1",
        goal: "diagnose arena",
        artifact: {
          artifactId: "map",
          artifactFingerprint: "fp",
        },
      });

    const understood =
      advanceWorkSessionCheckpoint(
        created,
        {
          stage: "understood",
          semanticNodeIds: [
            "node:arena",
          ],
          nextActions: [
            "collect runtime evidence",
          ],
        },
      );

    expect(understood.revision)
      .toBe(2);
    expect(
      understood.references
        .semanticNodeIds,
    ).toEqual(["node:arena"]);
  });

  it("preserves next-action priority order while removing duplicates", () => {
    const created =
      createWorkSessionCheckpoint({
        sessionId:
          "session:ordered-actions",
        goal: "diagnose",
        artifact: {
          artifactId: "map",
          artifactFingerprint: "fp",
        },
        nextActions: [
          "run semantic check",
          "collect runtime evidence",
          "run semantic check",
        ],
      });

    expect(created.nextActions)
      .toEqual([
        "run semantic check",
        "collect runtime evidence",
      ]);

    const updated =
      advanceWorkSessionCheckpoint(
        created,
        {
          stage: "new",
          nextActions: [
            "inspect affected graph",
            "patch candidate",
          ],
        },
      );

    expect(updated.nextActions)
      .toEqual([
        "inspect affected graph",
        "patch candidate",
      ]);
  });

  it("rejects silent artifact rebasing", () => {
    const created =
      createWorkSessionCheckpoint({
        sessionId: "session:1",
        goal: "diagnose arena",
        artifact: {
          artifactId: "map",
          artifactFingerprint: "fp",
        },
      });

    expect(() =>
      advanceWorkSessionCheckpoint(
        created,
        {
          stage: "understood",
          artifactFingerprint:
            "different",
        },
      )
    ).toThrow(/fingerprint changed/);
  });

  it("keeps blockers separate from lifecycle progress", () => {
    const created =
      createWorkSessionCheckpoint({
        sessionId: "session:blocked",
        goal: "diagnose arena",
        artifact: {
          artifactId: "map",
          artifactFingerprint: "fp",
        },
        blockers: [
          "runtime evidence required",
        ],
      });

    expect(created.stage)
      .toBe("new");
    expect(
      workSessionIsBlocked(
        created,
      ),
    ).toBe(true);

    const stillNew =
      advanceWorkSessionCheckpoint(
        created,
        {
          stage: "new",
          blockers: [],
        },
      );

    expect(stillNew.stage)
      .toBe("new");
    expect(
      workSessionIsBlocked(
        stillNew,
      ),
    ).toBe(false);
  });

  it("does not create a new revision for a no-op update", () => {
    const created =
      createWorkSessionCheckpoint({
        sessionId: "session:noop",
        goal: "diagnose",
        artifact: {
          artifactId: "map",
          artifactFingerprint: "fp",
        },
      });

    const same =
      advanceWorkSessionCheckpoint(
        created,
        {
          stage: "new",
        },
      );

    expect(same)
      .toBe(created);
    expect(same.revision)
      .toBe(1);
  });

  it("rejects invalid lifecycle jumps", () => {
    const created =
      createWorkSessionCheckpoint({
        sessionId: "session:1",
        goal: "diagnose arena",
        artifact: {
          artifactId: "map",
          artifactFingerprint: "fp",
        },
      });

    expect(() =>
      advanceWorkSessionCheckpoint(
        created,
        {
          stage: "patched",
        },
      )
    ).toThrow(/Invalid work session/);
  });
});
