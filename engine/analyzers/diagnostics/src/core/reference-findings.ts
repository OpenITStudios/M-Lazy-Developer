import type { SemanticEdge } from "../../../../packages/graph/src/index.js";
import type { SourceRef } from "../../../../packages/project-model/src/index.js";
import { createDiagnostic } from "../../../../packages/diagnostics/src/index.js";
import type { DiagnosticFinding } from "../../../../packages/diagnostics/src/index.js";

/** Optional source-reference route hints never change issue severity or proof. */
export interface ReferenceDiagnosticRoute {
  readonly classification: "entity-authored-chain" | "no-entity-chain-observed";
  readonly proofCeiling: "SOURCE_REFERENCES_ONLY";
  readonly rootEntityId?: string;
  readonly rootReferencePath?: string;
  readonly rootReferencePointer?: string;
  /** Publisher snapshot is reference-only, not a verified runtime table. */
  readonly publishedVanillaSample?: {
    readonly referencePath: string;
    readonly publisher: "Mojang/bedrock-samples";
    readonly commit: string;
    readonly proof: "PUBLISHED_SAMPLE_ONLY_VERSION_AND_RUNTIME_UNVERIFIED";
  };
  readonly rootActivation?: {
    readonly scope: "base" | "component-group";
    readonly groupId?: string;
    readonly status: "BASE_COMPONENT_DECLARED" | "GROUP_ADD_EVENT_DECLARED" |
      "NO_LOCAL_GROUP_ADD_EVENT_OBSERVED" | "UNSUPPORTED_EVENT_PROGRAM" |
      "GROUP_ACTIVATION_UNASSESSED" | "NO_NET_GROUP_ADD_AFTER_EVENT";
    readonly sourceEventIds?: readonly string[];
    readonly sourceEventPointers?: readonly string[];
    readonly sourceEventPaths?: readonly {
      readonly eventId: string;
      readonly sourcePath: readonly string[];
      readonly conditioned: boolean;
      readonly spawnHookCandidate: boolean;
    }[];
  };
  readonly sourceSpawnRequests?: readonly {
    readonly source: SourceRef;
    readonly executionRegion: string;
  }[];
}

export function referenceDiagnostics(
  edges: readonly SemanticEdge[],
  sourceRoutes?: ReadonlyMap<string, ReferenceDiagnosticRoute>,
): DiagnosticFinding[] {
  const findings: DiagnosticFinding[] = [];

  for (const edge of edges) {
    if (edge.status === "unresolved") {
      findings.push(createDiagnostic({
        code: "UNRESOLVED_REFERENCE",
        severity: "medium",
        message: `Unresolved ${edge.type} reference: ${edge.targetIdentifier}`,
        source: edge.evidence.source,
        relatedNodeIds: [edge.from],
        data: {
          edgeId: edge.id, targetIdentifier: edge.targetIdentifier, edgeType: edge.type,
          ...(sourceRoutes?.get(edge.id) === undefined ? {} : {
            sourceRoute: sourceRoutes.get(edge.id),
          }),
        },
      }));
    }

    if (edge.status === "ambiguous") {
      findings.push(createDiagnostic({
        code: "AMBIGUOUS_REFERENCE",
        severity: "medium",
        message: `Ambiguous ${edge.type} reference: ${edge.targetIdentifier}`,
        source: edge.evidence.source,
        relatedNodeIds: [edge.from, ...(edge.candidates ?? [])],
        data: {
          edgeId: edge.id, candidates: edge.candidates ?? [],
          ...(sourceRoutes?.get(edge.id) === undefined ? {} : {
            sourceRoute: sourceRoutes.get(edge.id),
          }),
        },
      }));
    }
  }

  return findings;
}
