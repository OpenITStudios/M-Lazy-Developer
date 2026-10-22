import { createHash } from "node:crypto";
import {
  parseScriptFile,
} from "../../../../analyzers/scripts/src/index.js";
import type {
  RepairSourceTransformHint,
  SourceRef,
} from "../../../project-model/src/index.js";
import type {
  RepairTransformHintProposal,
} from "./script-transform-hint-realizer.js";
import {
  proveAndBindScriptTransformPostcondition,
} from "./script-transform-postcondition.js";
import {
  buildInspectionSemanticIr,
} from "../diagnosis/semantic-ir-stage.js";

export interface ScriptTransformSemanticImpactProof {
  status: "proven" | "blocked";
  beforeFingerprint?: string;
  afterFingerprint?: string;
  proofFingerprint?: string;
  reasons: readonly string[];
}

function canonical(
  value: unknown,
): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (
    value !== null &&
    typeof value === "object"
  ) {
    return Object.fromEntries(
      Object.entries(
        value as Record<string, unknown>,
      )
        .sort(([a], [b]) =>
          a.localeCompare(b)
        )
        .map(([key, child]) => [
          key,
          canonical(child),
        ]),
    );
  }
  return value;
}

function fingerprint(value: unknown): string {
  return createHash("sha256")
    .update(
      JSON.stringify(canonical(value)),
    )
    .digest("hex");
}

function normalizedSource(
  source: SourceRef | undefined,
): unknown {
  if (!source) return null;
  return {
    artifactId: source.artifactId,
    relativePath: source.relativePath,
    lineStart:
      source.range?.lineStart ?? null,
    jsonPointer:
      source.jsonPointer ?? null,
  };
}

function structuralProjection(
  identifier: string,
  text: string,
  source: SourceRef,
): unknown {
  const parsed = parseScriptFile(
    identifier,
    text,
    source,
  );
  const ir = buildInspectionSemanticIr({
    parsedScripts: [{ parsed }],
    parsedFunctions: [],
  });

  return {
    executionRegions:
      ir.execution.regions.map((region) => ({
        kind: region.kind,
        ownerId: region.ownerId,
        label: region.label,
        source: normalizedSource(
          region.source,
        ),
      })),
    executionEdges:
      ir.execution.edges.map((edge) => ({
        from: edge.from,
        kind: edge.kind,
        targetLabel: edge.targetLabel,
        resolution: edge.resolution,
        to: edge.to ?? null,
        source: normalizedSource(
          edge.source,
        ),
        scheduler: edge.scheduler ?? null,
      })),
    stateSurfaces:
      ir.state.surfaces.map((surface) => ({
        ref: surface.ref,
      })),
    stateOperations:
      ir.state.operations.map((operation) => ({
        executionRegionId:
          operation.executionRegionId,
        surfaceId: operation.surfaceId,
        operation: operation.operation,
        source: normalizedSource(
          operation.source,
        ),
        targetHint:
          operation.targetHint ?? null,
      })),
    authorityBindings:
      ir.state.authorityBindings.map(
        (binding) => ({
          contract: binding.contract,
          authoritySurfaceId:
            binding.authoritySurfaceId,
          mirrorSurfaceIds:
            [...binding.mirrorSurfaceIds].sort(),
        }),
      ),
    temporalRelations:
      ir.temporal.relations.map((relation) => ({
        from: relation.from,
        targetLabel: relation.targetLabel,
        resolution: relation.resolution,
        to: relation.to ?? null,
        kind: relation.kind,
        source: normalizedSource(
          relation.source,
        ),
      })),
  };
}

export function proveScriptTransformSemanticImpact(
  identifier: string,
  originalText: string,
  transformedText: string,
  source: SourceRef,
): ScriptTransformSemanticImpactProof {
  let before: unknown;
  let after: unknown;

  try {
    before = structuralProjection(
      identifier,
      originalText,
      source,
    );
    after = structuralProjection(
      identifier,
      transformedText,
      source,
    );
  } catch (error) {
    return {
      status: "blocked",
      reasons: [
        "Semantic impact proof could not build comparable pre/post Semantic IR: " +
          String(error),
      ],
    };
  }

  const beforeFingerprint =
    fingerprint(before);
  const afterFingerprint =
    fingerprint(after);

  if (beforeFingerprint !== afterFingerprint) {
    return {
      status: "blocked",
      beforeFingerprint,
      afterFingerprint,
      reasons: [
        "Post-transform Semantic IR changed outside guard metadata; execution/state topology is not structurally equivalent.",
      ],
    };
  }

  return {
    status: "proven",
    beforeFingerprint,
    afterFingerprint,
    proofFingerprint:
      fingerprint({
        identifier,
        source,
        beforeFingerprint,
        afterFingerprint,
      }),
    reasons: [
      "Pre/post transformed source preserves execution regions, execution edges, state surfaces, state operations, authority bindings, and temporal topology.",
    ],
  };
}


export type BoundScriptTransformSemanticProof =
  | {
      status: "bound";
      proposal: RepairTransformHintProposal;
      postconditionProofFingerprint: string;
      semanticImpactProofFingerprint: string;
    }
  | {
      status: "blocked";
      reasons: readonly string[];
    };

export function bindScriptTransformSemanticImpactProof(
  proposal: RepairTransformHintProposal,
  proof: ScriptTransformSemanticImpactProof,
): BoundScriptTransformSemanticProof {
  const existing =
    proposal.strategy.postTransformProof;
  const reasons: string[] = [];

  if (existing === undefined) {
    reasons.push(
      "Semantic impact proof cannot be bound before the post-transform guard proof.",
    );
  }
  if (
    proof.status !== "proven" ||
    !proof.proofFingerprint?.trim()
  ) {
    reasons.push(
      "Pre/post semantic-impact proof is not proven.",
    );
  }

  if (reasons.length > 0 || existing === undefined) {
    return {
      status: "blocked",
      reasons,
    };
  }

  return {
    status: "bound",
    proposal: {
      ...proposal,
      strategy: {
        ...proposal.strategy,
        postTransformProof: {
          ...existing,
          semanticImpactFingerprint:
            proof.proofFingerprint!,
        },
      },
    },
    postconditionProofFingerprint:
      existing.proofFingerprint,
    semanticImpactProofFingerprint:
      proof.proofFingerprint!,
  };
}

export function proveAndBindCompleteScriptTransform(
  proposal: RepairTransformHintProposal,
  identifier: string,
  originalText: string,
  source: SourceRef,
  hint: RepairSourceTransformHint,
): BoundScriptTransformSemanticProof {
  const postcondition =
    proveAndBindScriptTransformPostcondition(
      proposal,
      identifier,
      originalText,
      source,
      hint,
    );

  if (postcondition.status !== "bound") {
    return {
      status: "blocked",
      reasons: postcondition.reasons,
    };
  }

  if (
    postcondition.proof.status !== "proven" ||
    postcondition.proof.transformedText === undefined
  ) {
    return {
      status: "blocked",
      reasons: [
        "Post-transform proof did not produce an isolated transformed source snapshot.",
      ],
    };
  }

  const impact = proveScriptTransformSemanticImpact(
    identifier,
    originalText,
    postcondition.proof.transformedText,
    source,
  );

  return bindScriptTransformSemanticImpactProof(
    postcondition.proposal,
    impact,
  );
}
