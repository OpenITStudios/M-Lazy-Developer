import {
  mkdtemp,
  rm,
} from "node:fs/promises";
import {
  join,
} from "node:path";
import {
  tmpdir,
} from "node:os";
import {
  describe,
  expect,
  it,
} from "vitest";
import {
  createWorkSessionCheckpoint,
  projectWorkspaceLayout,
} from "../../project-model/src/index.js";
import {
  loadSemanticProofClaimStore,
  loadWorkSessionCheckpoint,
  parseSemanticProofClaimStore,
  parseWorkSessionCheckpoint,
  saveWorkSessionCheckpoint,
  upsertSemanticProofClaim,
} from "../src/index.js";

describe("durable zero-waste state stores", () => {
  it("roundtrips a work session checkpoint atomically", async () => {
    const root =
      await mkdtemp(
        join(
          tmpdir(),
          "m-bedrock-session-",
        ),
      );

    try {
      const workspace =
        projectWorkspaceLayout(
          root,
          "project",
        );
      const checkpoint =
        createWorkSessionCheckpoint({
          sessionId: "s1",
          goal: "diagnose",
          artifact: {
            artifactId: "a",
            artifactFingerprint:
              "fp",
          },
        });

      await saveWorkSessionCheckpoint(
        workspace,
        checkpoint,
      );

      expect(
        await loadWorkSessionCheckpoint(
          workspace,
        ),
      ).toEqual(checkpoint);
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

  it("rejects unknown persisted fields at canonical state boundaries", async () => {
    expect(() =>
      parseWorkSessionCheckpoint({
        schemaVersion: 1,
        sessionId: "s",
        goal: "g",
        artifact: {
          artifactId: "a",
          artifactFingerprint: "fp",
        },
        stage: "new",
        revision: 1,
        references: {
          completedCapabilityIds: [],
          evidenceIds: [],
          semanticNodeIds: [],
          proofClaimIds: [],
          validationScenarioIds: [],
        },
        nextActions: [],
        blockers: [],
        hiddenAuthority: true,
      })
    ).toThrow(
      /structurally invalid/,
    );

    expect(() =>
      parseSemanticProofClaimStore({
        schemaVersion: 1,
        claims: [],
        hiddenAuthority: true,
      })
    ).toThrow(
      /structurally invalid/,
    );
  });

  it("rejects corrupt durable state instead of accepting empty references", async () => {
    const root =
      await mkdtemp(
        join(
          tmpdir(),
          "m-bedrock-invalid-state-",
        ),
      );

    try {
      const workspace =
        projectWorkspaceLayout(
          root,
          "project",
        );

      await expect(
        saveWorkSessionCheckpoint(
          workspace,
          {
            schemaVersion: 1,
            sessionId: "s",
            goal: "g",
            artifact: {
              artifactId: "a",
              artifactFingerprint: "fp",
            },
            stage: "new",
            revision: 1,
            references: {
              completedCapabilityIds: [""],
              evidenceIds: [],
              semanticNodeIds: [],
              proofClaimIds: [],
              validationScenarioIds: [],
            },
            nextActions: [],
            blockers: [],
          },
        ),
      ).rejects.toThrow(
        /structurally invalid/,
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

  it("refuses to clobber a different active work session", async () => {
    const root =
      await mkdtemp(
        join(
          tmpdir(),
          "m-bedrock-session-clobber-",
        ),
      );

    try {
      const workspace =
        projectWorkspaceLayout(
          root,
          "project",
        );

      await saveWorkSessionCheckpoint(
        workspace,
        createWorkSessionCheckpoint({
          sessionId: "s1",
          goal: "first",
          artifact: {
            artifactId: "a",
            artifactFingerprint: "fp",
          },
        }),
      );

      await expect(
        saveWorkSessionCheckpoint(
          workspace,
          createWorkSessionCheckpoint({
            sessionId: "s2",
            goal: "second",
            artifact: {
              artifactId: "a",
              artifactFingerprint: "fp",
            },
          }),
        ),
      ).rejects.toThrow(
        /Refusing to overwrite active work session/,
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

  it("refuses to rebind the same session id to a different artifact fingerprint", async () => {
    const root =
      await mkdtemp(
        join(
          tmpdir(),
          "m-bedrock-session-rebind-",
        ),
      );

    try {
      const workspace =
        projectWorkspaceLayout(
          root,
          "project",
        );

      await saveWorkSessionCheckpoint(
        workspace,
        createWorkSessionCheckpoint({
          sessionId: "same",
          goal: "first",
          artifact: {
            artifactId: "a",
            artifactFingerprint: "fp-a",
          },
        }),
      );

      await expect(
        saveWorkSessionCheckpoint(
          workspace,
          createWorkSessionCheckpoint({
            sessionId: "same",
            goal: "second",
            artifact: {
              artifactId: "a",
              artifactFingerprint: "fp-b",
            },
          }),
        ),
      ).rejects.toThrow(
        /different artifact identity or fingerprint/,
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

  it("upserts semantic proof claims without duplicating ids", async () => {
    const root =
      await mkdtemp(
        join(
          tmpdir(),
          "m-bedrock-proof-",
        ),
      );

    try {
      const workspace =
        projectWorkspaceLayout(
          root,
          "project",
        );

      await upsertSemanticProofClaim(
        workspace,
        {
          schemaVersion: 1,
          claimId: "claim:1",
          claimRevision: "1",
          kind: "static",
          basisNodeIds: [
            "node:1",
          ],
          basisFingerprint:
            "basis-a",
          evidenceIds: [
            "e:1",
          ],
        },
      );

      await upsertSemanticProofClaim(
        workspace,
        {
          schemaVersion: 1,
          claimId: "claim:1",
          claimRevision: "2",
          kind: "static",
          basisNodeIds: [
            "node:1",
          ],
          basisFingerprint:
            "basis-b",
          evidenceIds: [
            "e:2",
          ],
        },
      );

      const store =
        await loadSemanticProofClaimStore(
          workspace,
        );

      expect(store.claims)
        .toHaveLength(1);
      expect(
        store.claims[0]
          ?.claimRevision,
      ).toBe("2");
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
