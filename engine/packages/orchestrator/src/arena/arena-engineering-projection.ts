import type {
  DiagnosticFinding,
} from "../../../diagnostics/src/index.js";
import type {
  ArenaResetClosureAssessment,
} from "./arena-reset-closure-analysis.js";
import { deriveArenaRuntimeAdapterRequirements } from "../arena/arena-runtime-adapter-requirements.js";
import type {
  InspectArtifactResult,
} from "../inspection/inspect-artifact.js";

export interface ArenaEngineeringReplicaProjection {
  arenaId: string;
  proofQuality?: string;
  effectiveCoverageRatio?: number;
  comparedBlocks?: number;
  unresolvedBlocks?: number;
  voxel?: string;
  blockEntity?: string;
  entityPopulation?: string;
  actorPopulation?: string;
  tickState?: string;
  structureInstances?: string;
}

export interface ArenaEngineeringProjection {
  schemaVersion: 1;
  artifact: {
    id: string;
    fingerprint: string;
    target: InspectArtifactResult["targetCompatibility"];
  };
  architecture: {
    detected: boolean;
    basis?: string;
    count?: number;
    layoutStatus?: string;
    proofConclusion?: string;
    proofCoverageRatio?: number;
  };
  capacity: {
    requestedConcurrentArenas?: number;
    perArenaPlayerCapacity?: number;
    declaredMaxConcurrentPlayers?: number;
    safeConcurrentArenas?: number | null;
    ok?: boolean;
    limitingResourceIds: readonly string[];
    unresolvedScriptBackend: boolean;
  };
  lifecycle: {
    terminalCandidates: number;
    proven: number;
    partial: number;
    unresolved: number;
    /** Distinct source-reachable terminal paths, not executed resets. */
    sourceReachableTerminalPaths: number;
  };
  cleanup: {
    acquiredSurfaces: number;
    exactProven: number;
    partial: number;
    unresolved: number;
  };
  /** Canonical source-only reuse gate, not a live arena readiness claim. */
  reset: {
    status: ArenaResetClosureAssessment["status"] | "not-assessed";
    reuseEligibility: ArenaResetClosureAssessment["reuseEligibility"] | "not-assessed";
    blockers: readonly string[];
    warnings: readonly string[];
    sourceWitnesses: readonly {
      kind: string;
      executionRegion: string;
      path: string;
      line?: number;
      /** Source expression only, not a resolved arena/generation identity. */
      arenaArgument?: {
        syntax: "string-literal" | "identifier" | "property-access";
        expression: string;
      };
    }[];
  };
  globalState: {
    arenaScopedMutations: number;
    pairedLeaseEvidence: number;
    partialLeaseEvidence: number;
    unleasedArenaMutations: number;
    unauditedArenaMutations: number;
  };
  isolation: {
    isolated: number;
    partitionProofRequired: number;
    sharedGlobal: number;
    unknown: number;
  };
  fidelity: {
    nativeSpatial?: string;
    voxel?: string;
    blockEntity?: string;
    entityPopulation?: string;
    actorPopulation?: string;
    tickState?: string;
    structureInstances?: string;
  };
  replicas: readonly ArenaEngineeringReplicaProjection[];
  proofExecution: {
    mode?: "progressive" | "full";
    executedLayers: readonly string[];
    skippedLayers: readonly string[];
    decisions: readonly {
      layer: string;
      action: "execute" | "skip";
      reason: string;
    }[];
  };
  repeatedRunValidation: {
    runCounts: readonly number[];
    stages: number;
  };
  stress: {
    status: "planned" | "unavailable";
    totalNominalPlayers?: number;
    scenarios?: number;
    byKind?: Readonly<Record<string, number>>;
    reasons: readonly string[];
  };
  repairBridge: {
    deterministicRepairs: number;
    proposalOnly: number;
    unresolved: number;
    items: readonly {
      kind: string;
      arenaId: string;
      status: string;
      sourcePath?: string;
      line?: number;
      transactionId?: string;
      reasons: readonly string[];
    }[];
  };
  runtimeAdapter: ReturnType<
    typeof deriveArenaRuntimeAdapterRequirements
  >;
  repairLocalization: {
    localized: number;
    unresolved: number;
    items: readonly {
      kind: string;
      arenaId: string;
      unresolved: boolean;
      candidates: readonly {
        path: string;
        line?: number;
        authoredKind: string;
        strength: string;
      }[];
      reasons: readonly string[];
    }[];
  };
  diagnostics: readonly {
    id: string;
    code: DiagnosticFinding["code"];
    severity: DiagnosticFinding["severity"];
    message: string;
  }[];
  unresolved: readonly string[];
}

function arenaDiagnostics(
  source: InspectArtifactResult,
) {
  return source.diagnostics
    .filter((item) =>
      item.code.startsWith("ARENA_") ||
      item.code.startsWith("WORLDSTATE_")
    )
    .map((item) => ({
      id: item.id,
      code: item.code,
      severity: item.severity,
      message: item.message,
    }));
}

function replicaIds(
  source: InspectArtifactResult,
): string[] {
  const ids = new Set<string>();
  for (const item of
    source.arenaAnalysis.replicaProofQuality ?? []) {
    ids.add(item.arenaId);
  }
  for (const proof of [
    source.arenaAnalysis.voxelProof,
    source.arenaAnalysis.blockEntityProof,
    source.arenaAnalysis.entityPopulationProof,
    source.arenaAnalysis.actorPopulationProof,
    source.arenaAnalysis.tickStateProof,
    source.arenaAnalysis.structureInstanceProof,
  ]) {
    for (const replica of proof?.replicas ?? []) {
      ids.add(replica.arenaId);
    }
  }
  return [...ids].sort();
}

function statusFor(
  proof:
    | { replicas: readonly { arenaId: string; status: string }[] }
    | undefined,
  arenaId: string,
): string | undefined {
  return proof?.replicas.find(
    (item) => item.arenaId === arenaId,
  )?.status;
}

export function buildArenaEngineeringProjection(
  source: InspectArtifactResult,
): ArenaEngineeringProjection {
  const arena = source.arenaAnalysis;
  const runtimeAdapter =
    deriveArenaRuntimeAdapterRequirements(
      source,
    );
  const capacity = arena.capacity;
  const stress = arena.stressPlan;
  const layout = arena.spatialLayout;
  const proofQuality = new Map(
    (arena.replicaProofQuality ?? []).map(
      (item) => [item.arenaId, item],
    ),
  );

  const replicas = replicaIds(source).map(
    (arenaId): ArenaEngineeringReplicaProjection => {
      const quality = proofQuality.get(arenaId);
      const voxel = statusFor(arena.voxelProof, arenaId);
      const blockEntity = statusFor(arena.blockEntityProof, arenaId);
      const entityPopulation = statusFor(arena.entityPopulationProof, arenaId);
      const actorPopulation = statusFor(arena.actorPopulationProof, arenaId);
      const tickState = statusFor(arena.tickStateProof, arenaId);
      const structureInstances = statusFor(arena.structureInstanceProof, arenaId);
      return {
        arenaId,
        ...(quality === undefined
          ? {}
          : {
              proofQuality: quality.status,
              effectiveCoverageRatio:
                quality.effectiveArenaCoverageRatio,
              comparedBlocks:
                quality.comparedBlocks,
              unresolvedBlocks:
                quality.unresolvedBlocks,
            }),
        ...(voxel === undefined ? {} : { voxel }),
        ...(blockEntity === undefined ? {} : { blockEntity }),
        ...(entityPopulation === undefined ? {} : { entityPopulation }),
        ...(actorPopulation === undefined ? {} : { actorPopulation }),
        ...(tickState === undefined ? {} : { tickState }),
        ...(structureInstances === undefined ? {} : { structureInstances }),
      };
    },
  );

  const unresolved: string[] = [];
  if (!layout) {
    unresolved.push(
      "Arena spatial layout is unresolved.",
    );
  }
  if (!arena.regionPlan) {
    unresolved.push(
      "Arena physical region plan is unresolved.",
    );
  }
  if (
    capacity?.evidence.perArenaPlayerCapacity ===
    undefined
  ) {
    unresolved.push(
      "Per-arena player capacity is unresolved.",
    );
  }
  if (
    capacity?.evidence
      .scriptTickingAreaManagerReferenced &&
    !capacity.evidence
      .scriptTickingAreaCapacityResolved
  ) {
    unresolved.push(
      "Script API ticking-area capacity is detected but unresolved.",
    );
  }
  if (
    arena.lifecycle &&
    arena.lifecycle.unresolved > 0
  ) {
    unresolved.push(
      `${arena.lifecycle.unresolved} lifecycle terminal candidate(s) remain unresolved.`,
    );
  }
  if (
    arena.cleanupSurfaces &&
    arena.cleanupSurfaces.unresolved > 0
  ) {
    unresolved.push(
      `${arena.cleanupSurfaces.unresolved} cleanup surface assessment(s) remain unresolved.`,
    );
  }
  if (arena.resetClosure && arena.resetClosure.status !== "complete") {
    unresolved.push(
      "Arena reset/reuse source closure remains " + arena.resetClosure.status +
      (arena.resetClosure.blockers.length > 0
        ? ": " + arena.resetClosure.blockers.join(", ") : "") + ".",
    );
  }
  if ((arena.resetClosure?.surfaces.baselinePositiveProofMissing ?? 0) > 0) {
    unresolved.push(
      "World-reset requests lack attributable same-arena, same-generation VERIFY_EMPTY evidence; " +
      "source argument expressions do not prove a runtime arena ID or readiness.",
    );
  }
  if (
    arena.globalState &&
    arena.globalState.unleasedArenaMutations > 0
  ) {
    unresolved.push(
      `${arena.globalState.unleasedArenaMutations} arena-scoped world-global mutation(s) have no paired lease evidence.`,
    );
  }

  if (
    arena.stateIsolation &&
    (
      arena.stateIsolation.sharedGlobal > 0 ||
      arena.stateIsolation
        .partitionProofRequired > 0 ||
      arena.stateIsolation.unknown > 0
    )
  ) {
    unresolved.push(
      "Cross-arena state isolation still has shared/global or unproven partitioned surfaces.",
    );
  }

  return {
    schemaVersion: 1,
    artifact: {
      id: source.artifactId,
      fingerprint: source.fingerprint,
      target: source.targetCompatibility,
    },
    architecture: {
      detected: arena.autoDetected,
      ...(layout === undefined
        ? {}
        : {
            basis: layout.basis,
            count:
              1 + layout.replicas.length,
          }),
      ...(arena.layoutReconciliation === undefined
        ? {}
        : {
            layoutStatus:
              arena.layoutReconciliation.status,
          }),
      ...(arena.proofConclusion === undefined
        ? {}
        : {
            proofConclusion:
              arena.proofConclusion.conclusion,
          }),
      ...(arena.proofCoverage === undefined
        ? {}
        : {
            proofCoverageRatio:
              arena.proofCoverage.coverageRatio,
          }),
    },
    capacity: {
      ...(capacity?.evidence
          .requestedConcurrentArenas === undefined
        ? {}
        : {
            requestedConcurrentArenas:
              capacity.evidence
                .requestedConcurrentArenas,
          }),
      ...(capacity?.evidence
          .perArenaPlayerCapacity === undefined
        ? {}
        : {
            perArenaPlayerCapacity:
              capacity.evidence
                .perArenaPlayerCapacity,
          }),
      ...(capacity?.evidence
          .declaredMaxConcurrentPlayers === undefined
        ? {}
        : {
            declaredMaxConcurrentPlayers:
              capacity.evidence
                .declaredMaxConcurrentPlayers,
          }),
      ...(capacity?.report === undefined
        ? {}
        : {
            safeConcurrentArenas:
              capacity.report.safeConcurrentArenas,
            ok: capacity.report.ok,
          }),
      limitingResourceIds:
        capacity?.report?.limitingResourceIds ?? [],
      unresolvedScriptBackend:
        capacity?.evidence
          .scriptTickingAreaManagerReferenced === true &&
        capacity.evidence
          .scriptTickingAreaCapacityResolved === false,
    },
    lifecycle: {
      terminalCandidates:
        arena.lifecycle?.terminalCandidates ?? 0,
      proven: arena.lifecycle?.proven ?? 0,
      partial: arena.lifecycle?.partial ?? 0,
      unresolved:
        arena.lifecycle?.unresolved ?? 0,
      sourceReachableTerminalPaths:
        arena.lifecycle?.terminalEntryPaths?.filter(
          (item) => item.status === "source-reachable",
        ).length ?? 0,
    },
    cleanup: {
      acquiredSurfaces:
        arena.cleanupSurfaces
          ?.acquiredSurfaces ?? 0,
      exactProven:
        arena.cleanupSurfaces?.exactProven ?? 0,
      partial:
        arena.cleanupSurfaces?.partial ?? 0,
      unresolved:
        arena.cleanupSurfaces?.unresolved ?? 0,
    },
    reset: {
      status: arena.resetClosure?.status ?? "not-assessed",
      reuseEligibility: arena.resetClosure?.reuseEligibility ?? "not-assessed",
      blockers: [...(arena.resetClosure?.blockers ?? [])],
      warnings: [...(arena.resetClosure?.warnings ?? [])],
      sourceWitnesses: (arena.resetClosure?.sourceWitnesses ?? [])
        .map(item => ({
          kind: item.kind,
          executionRegion: item.executionRegion,
          path: item.source.relativePath,
          ...(item.source.range?.lineStart === undefined ? {} : {
            line: item.source.range.lineStart,
          }),
          ...(item.arenaArgument === undefined ? {} : {
            arenaArgument: { ...item.arenaArgument },
          }),
        })),
    },
    globalState: {
      arenaScopedMutations:
        arena.globalState
          ?.arenaScopedMutations ?? 0,
      pairedLeaseEvidence:
        arena.globalState
          ?.pairedLeaseEvidence ?? 0,
      partialLeaseEvidence:
        arena.globalState
          ?.partialLeaseEvidence ?? 0,
      unleasedArenaMutations:
        arena.globalState
          ?.unleasedArenaMutations ?? 0,
      unauditedArenaMutations:
        arena.globalState
          ?.unauditedArenaMutations ?? 0,
    },
    isolation: {
      isolated:
        arena.stateIsolation?.isolated ?? 0,
      partitionProofRequired:
        arena.stateIsolation
          ?.partitionProofRequired ?? 0,
      sharedGlobal:
        arena.stateIsolation?.sharedGlobal ?? 0,
      unknown:
        arena.stateIsolation?.unknown ?? 0,
    },
    fidelity: {
      ...(arena.nativeSpatial === undefined
        ? {}
        : {
            nativeSpatial:
              arena.nativeSpatial.status,
          }),
      ...(arena.voxelProof === undefined
        ? {}
        : { voxel: arena.voxelProof.status }),
      ...(arena.blockEntityProof === undefined
        ? {}
        : {
            blockEntity:
              arena.blockEntityProof.status,
          }),
      ...(arena.entityPopulationProof === undefined
        ? {}
        : {
            entityPopulation:
              arena.entityPopulationProof.status,
          }),
      ...(arena.actorPopulationProof === undefined
        ? {}
        : {
            actorPopulation:
              arena.actorPopulationProof.status,
          }),
      ...(arena.tickStateProof === undefined
        ? {}
        : {
            tickState:
              arena.tickStateProof.status,
          }),
      ...(arena.structureInstanceProof === undefined
        ? {}
        : {
            structureInstances:
              arena.structureInstanceProof.status,
          }),
    },
    replicas,
    proofExecution: {
      ...(arena.proofExecution === undefined
        ? {}
        : { mode: arena.proofExecution.mode }),
      executedLayers:
        arena.proofExecution?.executedLayers ?? [],
      skippedLayers:
        arena.proofExecution?.skippedLayers ?? [],
      decisions:
        arena.proofExecution?.decisions ?? [],
    },
    repeatedRunValidation: {
      runCounts:
        arena.repeatedRunPlan?.runCounts ?? [],
      stages:
        arena.repeatedRunPlan?.stages.length ?? 0,
    },
    stress:
      stress?.status === "planned" &&
      stress.matrix !== undefined
        ? {
            status: "planned",
            totalNominalPlayers:
              stress.matrix.totalNominalPlayers,
            scenarios:
              stress.matrix.scenarios.length,
            byKind: stress.matrix.byKind,
            reasons: stress.reasons,
          }
        : {
            status: "unavailable",
            reasons:
              stress?.reasons ?? [
                "Arena stress plan has not been derived.",
              ],
          },
    runtimeAdapter,
    repairBridge: {
      deterministicRepairs:
        arena.repairBridge
          ?.deterministicRepairs ?? 0,
      proposalOnly:
        arena.repairBridge
          ?.proposalOnly ?? 0,
      unresolved:
        arena.repairBridge
          ?.unresolved ?? 0,
      items:
        arena.repairBridge?.items.map(
          (item) => ({
            kind: item.kind,
            arenaId: item.arenaId,
            status: item.status,
            ...(item.sourcePath === undefined
              ? {}
              : {
                  sourcePath:
                    item.sourcePath,
                }),
            ...(item.line === undefined
              ? {}
              : { line: item.line }),
            ...(item.transactionId === undefined
              ? {}
              : {
                  transactionId:
                    item.transactionId,
                }),
            reasons: item.reasons,
          }),
        ) ?? [],
    },
    repairLocalization: {
      localized:
        arena.repairLocalization?.localized ?? 0,
      unresolved:
        arena.repairLocalization?.unresolved ?? 0,
      items:
        arena.repairLocalization?.items.map(
          (item) => ({
            kind: item.kind,
            arenaId: item.arenaId,
            unresolved: item.unresolved,
            candidates: item.candidates
              .slice(0, 8)
              .map((candidate) => ({
                path:
                  candidate.source.relativePath,
                ...(candidate.source.range
                  ?.lineStart === undefined
                  ? {}
                  : {
                      line:
                        candidate.source.range
                          .lineStart,
                    }),
                authoredKind:
                  candidate.authoredKind,
                strength:
                  candidate.strength,
              })),
            reasons: item.reasons,
          }),
        ) ?? [],
    },
    diagnostics: arenaDiagnostics(source),
    unresolved,
  };
}
