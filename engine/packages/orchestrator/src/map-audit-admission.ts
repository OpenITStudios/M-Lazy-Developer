import type {
  MandatoryAuditProcedureReceipt,
} from "./inspection/mandatory-audit-procedure.js";

export type SelectedMapAuditStage =
  | "TARGET"
  | "DISCOVERY"
  | "UNDERSTAND"
  | "FORMALIZE"
  | "EVALUATE"
  | "PROVE"
  | "REPORT";


/** Four operator stages group existing ordered internal evidence checkpoints.
 * This is a read-only presentation projection, not a replacement stage
 * machine, changed checkpoint ID, alternate workflow or proof promotion.
 */
export type OperatorMapTestStage = "LOAD" | "UNDERSTAND" | "TEST" | "REPORT";
export function operatorMapTestStageFor(
  stage: SelectedMapAuditStage | "COMPLETE",
): OperatorMapTestStage {
  if (stage === "TARGET" || stage === "DISCOVERY") return "LOAD";
  if (stage === "UNDERSTAND" || stage === "FORMALIZE") return "UNDERSTAND";
  if (stage === "EVALUATE" || stage === "PROVE") return "TEST";
  return "REPORT";
}

export interface SelectedMapAuditAdmissionInput {
  readonly mandatoryAuditProcedure:
    MandatoryAuditProcedureReceipt | undefined;
}

export interface SelectedMapAuditAdmissionIssue {
  readonly stage: SelectedMapAuditStage;
  readonly code:
    | "MISSING_PROCEDURE"
    | "PROCEDURE_BLOCKED";
  readonly message: string;
}

export interface SelectedMapAuditAdmission {
  readonly policy: "selected-map-audit-ordered-admission";
  readonly status: "READY" | "BLOCKED";
  readonly firstBlockingStage?: SelectedMapAuditStage;
  readonly issues: readonly SelectedMapAuditAdmissionIssue[];
}

export const SELECTED_MAP_AUDIT_STAGE_ORDER:
  readonly SelectedMapAuditStage[] = [
    "TARGET",
    "DISCOVERY",
    "UNDERSTAND",
    "FORMALIZE",
    "EVALUATE",
    "PROVE",
    "REPORT",
  ];

export function selectedMapAuditStageForCheckpoint(
  checkpointId: string,
): SelectedMapAuditStage {
  if (checkpointId === "A1") return "TARGET";
  if (checkpointId === "A2") return "DISCOVERY";
  if (checkpointId.startsWith("A")) return "UNDERSTAND";
  if (checkpointId.startsWith("B")) return "FORMALIZE";
  if (checkpointId.startsWith("C")) return "EVALUATE";
  if (checkpointId.startsWith("D")) return "PROVE";
  return "REPORT";
}

/**
 * Authorizes scoped evidence projections, NOT audit closure or publication.
 * A verified target and structurally accounted Discovery can expose
 * independently supported findings despite unresolved semantic obligations.
 * Admission remains blocked until every publication checkpoint closes.
 */
export function canProjectIndependentAuditEvidence(
  procedure: MandatoryAuditProcedureReceipt | undefined,
): boolean {
  if (procedure === undefined ||
      procedure.blockingCheckpointIds.includes("A1")) return false;
  const target = procedure.checkpoints.filter((item) => item.id === "A1");
  const discovery = procedure.checkpoints.filter((item) => item.id === "A2");
  return target.length === 1 &&
    target[0]?.block === "TARGET" &&
    target[0]?.status === "CLOSED" &&
    target[0]?.blocksPublication === false &&
    discovery.length === 1 &&
    discovery[0]?.block === "DISCOVERY" &&
    (discovery[0]?.status === "CLOSED" ||
      discovery[0]?.status === "PARTIAL");
}

/**
 * Authorizes candidate/proposed issue-set grouping after stage admission.
 * Independently supported findings may be displayed earlier by the selected
 * audit pipeline using canProjectIndependentAuditEvidence() and the existing
 * per-finding PROVE projection gates. This check never controls partial
 * report visibility or overrides whole-audit publication readiness.
 */
export function canAdmitAuditIssueLanes(
  admission: SelectedMapAuditAdmission,
  procedure: MandatoryAuditProcedureReceipt | undefined,
): boolean {
  if (!canProjectIndependentAuditEvidence(procedure)) return false;
  return admission.status === "READY" ||
    admission.firstBlockingStage === "PROVE" ||
    admission.firstBlockingStage === "REPORT";
}

export function assessSelectedMapAuditAdmission(
  input: SelectedMapAuditAdmissionInput,
): SelectedMapAuditAdmission {
  const issues: SelectedMapAuditAdmissionIssue[] = [];
  const procedure = input.mandatoryAuditProcedure;

  if (procedure === undefined) {
    issues.push({
      stage: "TARGET",
      code: "MISSING_PROCEDURE",
      message:
        "Mandatory Audit Procedure receipt is missing; ordered audit admission cannot be established.",
    });
  } else {
    // The procedure owns checkpoint identities. Duplicate non-foundational
    // IDs or a stage that contradicts the ID must never manufacture READY,
    // even when the denormalized blocking list is empty.
    const seenCheckpointIds = new Set<string>();
    for (const checkpoint of procedure.checkpoints) {
      const expectedStage = selectedMapAuditStageForCheckpoint(checkpoint.id);
      if (seenCheckpointIds.has(checkpoint.id)) {
        issues.push({
          stage: expectedStage,
          code: "PROCEDURE_BLOCKED",
          message: "Mandatory Audit Procedure duplicates checkpoint ID " +
            checkpoint.id + ".",
        });
      }
      seenCheckpointIds.add(checkpoint.id);
      if (checkpoint.block !== expectedStage) {
        issues.push({
          stage: expectedStage,
          code: "PROCEDURE_BLOCKED",
          message: "Mandatory Audit Procedure checkpoint " +
            checkpoint.id + " belongs to " + expectedStage +
            ", not " + checkpoint.block + ".",
        });
      }
    }

    for (const checkpointId of procedure.blockingCheckpointIds) {
      const checkpoint = procedure.checkpoints.find(
        (item) => item.id === checkpointId,
      );
      issues.push({
        stage:
          checkpoint?.block ??
          selectedMapAuditStageForCheckpoint(checkpointId),
        code: "PROCEDURE_BLOCKED",
        message:
          "Mandatory Audit Procedure checkpoint " +
          checkpointId +
          " blocks continuation.",
      });
    }

    // Guard the derived blocking index against stale or inconsistent
    // checkpoint projections. Publication authority belongs to the actual
    // checkpoint, not merely to the denormalized list of its IDs.
    for (const checkpoint of procedure.checkpoints) {
      if (
        !checkpoint.blocksPublication ||
        procedure.blockingCheckpointIds.includes(checkpoint.id)
      ) continue;
      issues.push({
        stage: checkpoint.block,
        code: "PROCEDURE_BLOCKED",
        message:
          "Mandatory Audit Procedure checkpoint " +
          checkpoint.id +
          " blocks continuation but is missing from the blocking index.",
      });
    }

    // Every mandatory audit stage must be represented before READY. A
    // truncated receipt cannot advertise completion merely because its
    // derived blocking index is empty. The ordered stage contract already
    // owns these names; do not introduce a second checkpoint registry.
    for (const stage of SELECTED_MAP_AUDIT_STAGE_ORDER) {
      if (procedure.checkpoints.some((checkpoint) => checkpoint.block === stage)) {
        continue;
      }
      issues.push({
        stage,
        code: "PROCEDURE_BLOCKED",
        message: "Mandatory Audit Procedure has no checkpoint for " +
          stage + "; audit admission is incomplete.",
      });
    }

    // The two foundational receipts must exist exactly once with their
    // original stage authority. An empty or truncated procedure must never
    // become READY just because its derived blocking list is also empty.
    for (const [checkpointId, stage] of [
      ["A1", "TARGET"],
      ["A2", "DISCOVERY"],
    ] as const) {
      const found = procedure.checkpoints.filter(
        (checkpoint) => checkpoint.id === checkpointId,
      );
      if (
        found.length === 1 &&
        found[0]?.block === stage &&
        found[0]?.status === "CLOSED"
      ) continue;
      if (procedure.blockingCheckpointIds.includes(checkpointId)) continue;
      issues.push({
        stage,
        code: "PROCEDURE_BLOCKED",
        message:
          "Mandatory Audit Procedure checkpoint " + checkpointId +
          " must have one CLOSED " + stage +
          " receipt before audit admission.",
      });
    }
  }

  const firstBlockingStage = SELECTED_MAP_AUDIT_STAGE_ORDER.find((stage) =>
    issues.some((issue) => issue.stage === stage)
  );

  return {
    policy: "selected-map-audit-ordered-admission",
    status: issues.length === 0 ? "READY" : "BLOCKED",
    ...(firstBlockingStage === undefined
      ? {}
      : { firstBlockingStage }),
    issues,
  };
}
