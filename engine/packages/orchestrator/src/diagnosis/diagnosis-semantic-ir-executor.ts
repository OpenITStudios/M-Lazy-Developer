import { createHash } from "node:crypto";
import type {
  DiagnosisCapabilityExecutor,
  DiagnosisExecutorRequest,
} from "../../../diagnosis-pipeline/src/index.js";
import type {
  StateAuthorityContract,
} from "../../../project-model/src/index.js";
import {
  buildInspectionSemanticIr,
  type InspectionSemanticIrInput,
} from "./semantic-ir-stage.js";
import type {
  InspectionSourceIndex,
} from "../inspection/inspect-source-index.js";

export const SEMANTIC_IR_EXECUTOR_REVISION =
  "semantic-ir-executor:2";

export interface SemanticIrDiagnosisPayload {
  sourceIndex: InspectionSourceIndex;
  stateAuthorityContracts?: readonly StateAuthorityContract[];
}

function isSourceIndex(
  value: unknown,
): value is InspectionSourceIndex {
  if (
    value === null ||
    typeof value !== "object"
  ) {
    return false;
  }

  const record =
    value as Record<string, unknown>;

  return (
    Array.isArray(record.parsedFunctions) &&
    Array.isArray(record.parsedScripts) &&
    record.coverage !== undefined
  );
}

function parsePayload(
  payload: unknown,
): SemanticIrDiagnosisPayload | undefined {
  if (
    payload === null ||
    typeof payload !== "object"
  ) {
    return undefined;
  }

  const record =
    payload as Record<string, unknown>;

  if (!isSourceIndex(record.sourceIndex)) {
    return undefined;
  }

  if (
    record.stateAuthorityContracts !== undefined &&
    !Array.isArray(
      record.stateAuthorityContracts,
    )
  ) {
    return undefined;
  }

  return {
    sourceIndex: record.sourceIndex,
    ...(record.stateAuthorityContracts === undefined
      ? {}
      : {
          stateAuthorityContracts:
            record.stateAuthorityContracts as
              readonly StateAuthorityContract[],
        }),
  };
}

function semanticEvidenceId(
  value: unknown,
): string {
  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        executorRevision:
          SEMANTIC_IR_EXECUTOR_REVISION,
        value,
      }),
    )
    .digest("hex");

  return "semantic-ir:" + digest;
}

export function createSemanticIrDiagnosisExecutor():
  DiagnosisCapabilityExecutor {
  return {
    executorId: "diagnosis.semantic-ir",
    executorRevision:
      SEMANTIC_IR_EXECUTOR_REVISION,

    async execute(
      request: DiagnosisExecutorRequest,
    ) {
      if (
        request.capabilityId !==
        "diagnosis.semantic-ir"
      ) {
        return {
          status: "blocked",
          reasons: [
            "Semantic-IR executor received the wrong diagnosis capability id.",
          ],
        };
      }

      const payload =
        parsePayload(request.payload);

      if (!payload) {
        return {
          status: "blocked",
          reasons: [
            "Semantic-IR diagnosis payload must contain a valid source-index output.",
          ],
        };
      }

      if (!payload.sourceIndex.coverage.complete) {
        return {
          status: "blocked",
          output: payload.sourceIndex,
          reasons: [
            "Semantic-IR construction is blocked because source-index coverage is incomplete.",
          ],
        };
      }

      const input: InspectionSemanticIrInput = {
        parsedFunctions:
          payload.sourceIndex.parsedFunctions,
        parsedScripts:
          payload.sourceIndex.parsedScripts,
        ...(payload.stateAuthorityContracts === undefined
          ? {}
          : {
              stateAuthorityContracts:
                payload.stateAuthorityContracts,
            }),
      };

      try {
        const output =
          buildInspectionSemanticIr(input);

        return {
          status: "completed",
          output,
          evidence: [{
            level: "semantic",
            quality: "usable",
            traits: ["semantic-model"],
            evidenceIds: [
              semanticEvidenceId(output),
            ],
          }],
          reasons: [
            "Semantic IR was built from the already indexed source model without re-reading source files.",
          ],
        };
      } catch (error) {
        return {
          status: "blocked",
          reasons: [
            "Semantic-IR construction failed validation.",
            error instanceof Error
              ? error.message
              : String(error),
          ],
        };
      }
    },
  };
}
