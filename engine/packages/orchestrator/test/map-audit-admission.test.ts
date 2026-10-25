import { describe, expect, it } from "vitest";
import {
  assessSelectedMapAuditAdmission,
  canProjectIndependentAuditEvidence,
  canAdmitAuditIssueLanes,
  operatorMapTestStageFor,
} from "../src/map-audit-admission.js";
import type {
  MandatoryAuditProcedureReceipt,
} from "../src/inspection/mandatory-audit-procedure.js";
import { selectedMapReportIdentityIssues } from "../src/map-audit-identity.js";

function procedure(
  blockingCheckpointIds: readonly string[],
): MandatoryAuditProcedureReceipt {
  const checkpoints = [
    {
      id: "A1",
      block: "TARGET" as const,
      label: "Selected Artifact Integrity",
    },
    {
      id: "A2",
      block: "DISCOVERY" as const,
      label: "Gameplay Surface Discovery",
    },
    {
      id: "A7",
      block: "UNDERSTAND" as const,
      label: "Gameplay Model Closure",
    },
    {
      id: "C1",
      block: "EVALUATE" as const,
      label: "Cross-system gameplay checks",
    },
    {
      id: "D1",
      block: "PROVE" as const,
      label: "Causal contradiction proof",
    },
    {
      id: "B1",
      block: "FORMALIZE" as const,
      label: "Source-grounded formalization",
    },
    {
      id: "E1",
      block: "REPORT" as const,
      label: "Report projection",
    },
  ].map((item) => ({
    ...item,
    status:
      blockingCheckpointIds.includes(item.id)
        ? "OPEN" as const
        : "CLOSED" as const,
    reasonCode:
      blockingCheckpointIds.includes(item.id)
        ? "PROCEDURE_BLOCKED" as const
        : "COMPLETE" as const,
    blocksPublication:
      blockingCheckpointIds.includes(item.id),
    obligations: [],
    evidenceIds: [],
    outputIds: [],
    reason: item.label,
  }));

  return {
    schemaVersion: 1,
    policy: "mandatory-gameplay-audit-procedure",
    checkpoints,
    blocks: [],
    status:
      blockingCheckpointIds.length > 0
        ? "OPEN"
        : "CLOSED",
    stateRegistry: [],
    ownershipRegistry: [],
    progressionContracts: [],
    blockingCheckpointIds,
    reasons: [],
  };
}

describe("selected-map audit admission", () => {
  it("blocks when the mandatory procedure is missing", () => {
    const result = assessSelectedMapAuditAdmission({
      mandatoryAuditProcedure: undefined,
    });

    expect(result.status).toBe("BLOCKED");
    expect(result.firstBlockingStage).toBe("TARGET");
    expect(result.issues[0]?.code).toBe(
      "MISSING_PROCEDURE",
    );
  });

  it("rejects absent or invalid foundational receipts despite an empty blocking index", () => {
    const completed = procedure([]);
    const without = (checkpointId: string): MandatoryAuditProcedureReceipt => ({
      ...completed,
      checkpoints: completed.checkpoints.filter((item) => item.id !== checkpointId),
    });
    const empty: MandatoryAuditProcedureReceipt = {
      ...completed,
      checkpoints: [],
      blocks: [],
    };

    for (const [name, candidate, stage] of [
      ["empty", empty, "TARGET"],
      ["missing target", without("A1"), "TARGET"],
      ["missing discovery", without("A2"), "DISCOVERY"],
      ["duplicated target", {
        ...completed,
        checkpoints: [completed.checkpoints[0]!, ...completed.checkpoints],
      }, "TARGET"],
      ["wrong discovery stage", {
        ...completed,
        checkpoints: completed.checkpoints.map((item) =>
          item.id === "A2" ? { ...item, block: "UNDERSTAND" as const } : item),
      }, "DISCOVERY"],
      ["target incorrectly open but not indexed", {
        ...completed,
        checkpoints: completed.checkpoints.map((item) =>
          item.id === "A1" ? { ...item, status: "OPEN" as const } : item),
      }, "TARGET"],
    ] as const) {
      const result = assessSelectedMapAuditAdmission({
        mandatoryAuditProcedure: candidate,
      });
      expect(result.status, name).toBe("BLOCKED");
      expect(result.firstBlockingStage, name).toBe(stage);
    }
    expect(assessSelectedMapAuditAdmission({
      mandatoryAuditProcedure: completed,
    }).status).toBe("READY");
  });

  it("cannot admit truncated mandatory stage coverage as READY", () => {
    const complete = procedure([]);
    expect(assessSelectedMapAuditAdmission({
      mandatoryAuditProcedure: complete,
    }).status).toBe("READY");

    for (const stage of [
      "TARGET", "DISCOVERY", "UNDERSTAND",
      "FORMALIZE", "EVALUATE", "PROVE", "REPORT",
    ] as const) {
      const truncated: MandatoryAuditProcedureReceipt = {
        ...complete,
        checkpoints: complete.checkpoints.filter((item) => item.block !== stage),
      };
      const admission = assessSelectedMapAuditAdmission({
        mandatoryAuditProcedure: truncated,
      });
      expect(admission.status, stage).toBe("BLOCKED");
      expect(admission.firstBlockingStage, stage).toBe(stage);
    }

    const noFormalize: MandatoryAuditProcedureReceipt = {
      ...complete,
      checkpoints: complete.checkpoints.filter((item) => item.id !== "B1"),
    };
    expect(canProjectIndependentAuditEvidence(noFormalize)).toBe(true);
    const admission = assessSelectedMapAuditAdmission({
      mandatoryAuditProcedure: noFormalize,
    });
    expect(canAdmitAuditIssueLanes(admission, noFormalize)).toBe(false);
  });

  it("rejects duplicate or wrong-stage nonfoundational checkpoint IDs", () => {
    const complete = procedure([]);
    const C1 = complete.checkpoints.find(item => item.id === "C1")!;
    const E1 = complete.checkpoints.find(item => item.id === "E1")!;
    for (const [description, checkpoints, stage] of [
      ["duplicate C1", [...complete.checkpoints, { ...C1 }], "EVALUATE"],
      ["wrong C1 stage", complete.checkpoints.map(item =>
        item.id === "C1" ? { ...item, block: "PROVE" as const } : item), "EVALUATE"],
      ["wrong E1 stage", complete.checkpoints.map(item =>
        item.id === "E1" ? { ...item, block: "EVALUATE" as const } : item), "REPORT"],
    ] as const) {
      const result = assessSelectedMapAuditAdmission({
        mandatoryAuditProcedure: { ...complete, checkpoints },
      });
      expect(result.status, description).toBe("BLOCKED");
      expect(result.firstBlockingStage, description).toBe(stage);
      expect(result.issues.some(issue =>
        issue.stage === stage && issue.code === "PROCEDURE_BLOCKED"),
      description).toBe(true);
    }
    expect(assessSelectedMapAuditAdmission({
      mandatoryAuditProcedure: complete,
    }).status).toBe("READY");
  });

  it("uses checkpoint-owned stage as the single blocking truth", () => {
    const result = assessSelectedMapAuditAdmission({
      mandatoryAuditProcedure: procedure(["A2"]),
    });

    expect(result.status).toBe("BLOCKED");
    expect(result.firstBlockingStage).toBe("DISCOVERY");
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "PROCEDURE_BLOCKED",
        stage: "DISCOVERY",
      }),
    ]);
  });

  it("admits review only when no mandatory checkpoint blocks", () => {
    const result = assessSelectedMapAuditAdmission({
      mandatoryAuditProcedure: procedure([]),
    });

    expect(result.status).toBe("READY");
    expect(result.firstBlockingStage).toBeUndefined();
    expect(result.issues).toEqual([]);
  });
  it("allows evidence projection with PARTIAL Discovery but still blocks review", () => {
    const base = procedure(["A2"]);
    const partial: MandatoryAuditProcedureReceipt = {
      ...base,
      checkpoints: base.checkpoints.map((item) => item.id === "A2"
        ? { ...item, status: "PARTIAL", reasonCode: "DISCOVERY_INCOMPLETE" }
        : item),
      status: "PARTIAL",
    };

    expect(canProjectIndependentAuditEvidence(partial)).toBe(true);
    const admission = assessSelectedMapAuditAdmission({
      mandatoryAuditProcedure: partial,
    });
    expect(admission.status).toBe("BLOCKED");
    expect(admission.firstBlockingStage).toBe("DISCOVERY");
  });

  it("keeps early evidence but withholds issues until causal proof stage", () => {
    const beforeUnderstanding = procedure(["A7"]);
    const earlyAdmission = assessSelectedMapAuditAdmission({
      mandatoryAuditProcedure: beforeUnderstanding,
    });
    expect(canProjectIndependentAuditEvidence(beforeUnderstanding)).toBe(true);
    expect(earlyAdmission.firstBlockingStage).toBe("UNDERSTAND");
    expect(canAdmitAuditIssueLanes(earlyAdmission, beforeUnderstanding)).toBe(false);

    const beforeStress = procedure(["C1"]);
    const stressAdmission = assessSelectedMapAuditAdmission({
      mandatoryAuditProcedure: beforeStress,
    });
    expect(stressAdmission.firstBlockingStage).toBe("EVALUATE");
    expect(canAdmitAuditIssueLanes(stressAdmission, beforeStress)).toBe(false);

    const proving = procedure(["D1"]);
    const proofAdmission = assessSelectedMapAuditAdmission({
      mandatoryAuditProcedure: proving,
    });
    expect(proofAdmission.firstBlockingStage).toBe("PROVE");
    expect(canAdmitAuditIssueLanes(proofAdmission, proving)).toBe(true);

    const completed = procedure([]);
    const completedAdmission = assessSelectedMapAuditAdmission({
      mandatoryAuditProcedure: completed,
    });
    expect(canAdmitAuditIssueLanes(completedAdmission, completed)).toBe(true);
    expect(canAdmitAuditIssueLanes(completedAdmission, undefined)).toBe(false);
    expect(canAdmitAuditIssueLanes({
      ...completedAdmission,
      status: "BLOCKED",
    }, completed)).toBe(false);
  });

  it("fails closed when a blocking checkpoint is missing from the derived blocking index", () => {
    const base = procedure([]);
    const C9 = {
      ...base.checkpoints[3]!,
      id: "C9",
      block: "EVALUATE" as const,
      label: "Cross-System Scenario Coverage",
      status: "PARTIAL" as const,
      reasonCode: "OBLIGATION_INCOMPLETE" as const,
      blocksPublication: true,
    };
    const inconsistent: MandatoryAuditProcedureReceipt = {
      ...base,
      checkpoints: [...base.checkpoints, C9],
      blockingCheckpointIds: [],
      status: "PARTIAL",
    };
    const rejected = assessSelectedMapAuditAdmission({
      mandatoryAuditProcedure: inconsistent,
    });
    expect(rejected.status).toBe("BLOCKED");
    expect(rejected.firstBlockingStage).toBe("EVALUATE");
    expect(rejected.issues).toEqual([
      expect.objectContaining({
        stage: "EVALUATE",
        code: "PROCEDURE_BLOCKED",
      }),
    ]);

    // Runtime-only residue may legitimately be visible without blocking
    // report publication; do not conflate PARTIAL with blocksPublication.
    const runtimeOnly: MandatoryAuditProcedureReceipt = {
      ...inconsistent,
      checkpoints: inconsistent.checkpoints.map(item => item.id === "C9"
        ? { ...item, reasonCode: "RUNTIME_PROOF_REQUIRED", blocksPublication: false }
        : item),
    };
    const allowed = assessSelectedMapAuditAdmission({
      mandatoryAuditProcedure: runtimeOnly,
    });
    expect(allowed.status).toBe("READY");
    expect(allowed.issues).toEqual([]);
  });

  it("keeps EVALUATE publication blocked after source-only arena formalization closes", () => {
    const base = procedure([]);
    const B4 = {
      ...base.checkpoints[2]!,
      id: "B4",
      block: "FORMALIZE" as const,
      label: "Multi-Arena Contract",
      status: "CLOSED" as const,
      blocksPublication: false,
    };
    const C9 = {
      ...base.checkpoints[3]!,
      id: "C9",
      block: "EVALUATE" as const,
      label: "Cross-System Scenario Coverage",
      status: "OPEN" as const,
      blocksPublication: true,
      reasonCode: "OBLIGATION_INCOMPLETE" as const,
    };
    const receipt: MandatoryAuditProcedureReceipt = {
      ...base,
      checkpoints: [...base.checkpoints, B4, C9],
      blockingCheckpointIds: ["C9"],
      status: "OPEN",
    };
    const admission = assessSelectedMapAuditAdmission({
      mandatoryAuditProcedure: receipt,
    });
    expect(admission.status).toBe("BLOCKED");
    expect(admission.firstBlockingStage).toBe("EVALUATE");
    expect(canProjectIndependentAuditEvidence(receipt)).toBe(true);
    expect(canAdmitAuditIssueLanes(admission, receipt)).toBe(false);
    expect(admission.issues).toEqual([
      expect.objectContaining({
        stage: "EVALUATE",
        code: "PROCEDURE_BLOCKED",
      }),
    ]);
  });

  it("rejects inconsistent foundational authority during independent evidence projection", () => {
    const complete = procedure([]);
    const targetBlocked: MandatoryAuditProcedureReceipt = {
      ...complete,
      // This can arise from an inconsistent derived blocking index.
      // A1's own publication flag must still prohibit projection.
      checkpoints: complete.checkpoints.map(item => item.id === "A1"
        ? { ...item, blocksPublication: true }
        : item),
      blockingCheckpointIds: [],
    };
    expect(canProjectIndependentAuditEvidence(targetBlocked)).toBe(false);

    const wrongTargetStage: MandatoryAuditProcedureReceipt = {
      ...complete,
      checkpoints: complete.checkpoints.map(item => item.id === "A1"
        ? { ...item, block: "PROVE" as const }
        : item),
    };
    expect(canProjectIndependentAuditEvidence(wrongTargetStage)).toBe(false);

    const wrongDiscoveryStage: MandatoryAuditProcedureReceipt = {
      ...complete,
      checkpoints: complete.checkpoints.map(item => item.id === "A2"
        ? { ...item, block: "UNDERSTAND" as const }
        : item),
    };
    expect(canProjectIndependentAuditEvidence(wrongDiscoveryStage)).toBe(false);

    const partialDiscovery: MandatoryAuditProcedureReceipt = {
      ...complete,
      checkpoints: complete.checkpoints.map(item => item.id === "A2"
        ? { ...item, status: "PARTIAL" as const, blocksPublication: true }
        : item),
      blockingCheckpointIds: ["A2"],
      status: "PARTIAL",
    };
    expect(canProjectIndependentAuditEvidence(partialDiscovery)).toBe(true);
  });

  it("never projects evidence without verified TARGET or accounted Discovery", () => {
    expect(canProjectIndependentAuditEvidence(undefined)).toBe(false);
    expect(canProjectIndependentAuditEvidence(procedure(["A1"]))).toBe(false);
    expect(canProjectIndependentAuditEvidence(procedure(["A2"]))).toBe(false);
    expect(canProjectIndependentAuditEvidence(procedure([]))).toBe(true);
    const base = procedure(["A1", "A2"]);
    const partialWithInvalidTarget: MandatoryAuditProcedureReceipt = {
      ...base,
      checkpoints: base.checkpoints.map((item) => item.id === "A2"
        ? { ...item, status: "PARTIAL" }
        : item),
    };
    expect(canProjectIndependentAuditEvidence(partialWithInvalidTarget)).toBe(false);
  });

  it("accepts an authored map release independently from the tested Education context", () => {
    const identity = {
      artifactId: "selected-map",
      artifactFingerprint: "sha256:" + "a".repeat(64),
      levelName: "Attack Challenge",
      releaseVersion: "1.1.1",
      releaseIdentityStatus: "consistent" as const,
    };
    const map = {
      name: "Attack Challenge",
      mapVersion: "1.1.1",
      drive: "https://drive.google.com/file/d/selected-map/view",
      baseVersion: "1.21.130",
      testedVersion: "Source audit + tester feedback on Education 1.26.32",
    };
    expect(selectedMapReportIdentityIssues(identity, map)).toEqual([]);
    expect(selectedMapReportIdentityIssues(identity, {
      ...map,
      mapVersion: "1.1.2",
    })).toEqual([expect.stringContaining("Report mapVersion does not match")]);
  });

  it("groups the seven internal proof stages into exactly four operator stages", () => {
    const pairs = [
      ["TARGET", "LOAD"], ["DISCOVERY", "LOAD"],
      ["UNDERSTAND", "UNDERSTAND"], ["FORMALIZE", "UNDERSTAND"],
      ["EVALUATE", "TEST"], ["PROVE", "TEST"],
      ["REPORT", "REPORT"], ["COMPLETE", "REPORT"],
    ] as const;
    for (const [internal, operator] of pairs) {
      expect(operatorMapTestStageFor(internal)).toBe(operator);
    }
  });
});
