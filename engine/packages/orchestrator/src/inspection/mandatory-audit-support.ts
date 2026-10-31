import type { SemanticIr } from "../../../semantic-ir/src/index.js";
import type { GameplayIntentModel } from "../../../gameplay-intent/src/index.js";
import type { GameplayDiscoveryClosure } from "./gameplay-discovery-closure.js";

export type MandatoryAuditBlock =
  | "TARGET"
  | "DISCOVERY"
  | "UNDERSTAND"
  | "FORMALIZE"
  | "EVALUATE"
  | "PROVE"
  | "REPORT";

export type MandatoryAuditCheckpointStatus =
  | "CLOSED"
  | "PARTIAL"
  | "OPEN"
  | "NOT_APPLICABLE";

export type MandatoryAuditCheckpointReasonCode =
  | "COMPLETE"
  | "NOT_APPLICABLE_PROVEN"
  | "RUNTIME_PROOF_REQUIRED"
  | "DISCOVERY_INCOMPLETE"
  | "SCOPE_INCOMPLETE"
  | "OBLIGATION_INCOMPLETE"
  | "KNOWLEDGE_GAP"
  | "CAPABILITY_GAP"
  | "PROCEDURE_BLOCKED";

export interface MandatoryAuditObligation {
  readonly id: string;
  readonly required: boolean;
  readonly satisfied: boolean;
  readonly evidenceIds: readonly string[];
  readonly reason: string;
}

export interface MandatoryAuditCheckpointReceipt {
  readonly id: string;
  readonly block: MandatoryAuditBlock;
  readonly label: string;
  readonly status: MandatoryAuditCheckpointStatus;
  readonly reasonCode: MandatoryAuditCheckpointReasonCode;
  readonly blocksPublication: boolean;
  readonly obligations: readonly MandatoryAuditObligation[];
  readonly evidenceIds: readonly string[];
  readonly outputIds: readonly string[];
  /** Applicable preset identities for investigation, not source/proof receipts. */
  readonly investigationScenarioIds?: readonly string[];
  readonly reason: string;
}

export interface MandatoryAuditBlockClosure {
  readonly block: MandatoryAuditBlock;
  readonly status: Exclude<
    MandatoryAuditCheckpointStatus,
    "NOT_APPLICABLE"
  >;
  readonly checkpointIds: readonly string[];
  readonly openCheckpointIds: readonly string[];
  readonly partialCheckpointIds: readonly string[];
}

export interface MandatoryAuditStateRecord {
  readonly surfaceId: string;
  readonly surfaceKind: string;
  readonly key: string;
  readonly declaredScope:
    | "player"
    | "entity"
    | "arena"
    | "round"
    | "world"
    | "unknown";
  readonly persistenceScope:
    | "player"
    | "entity"
    | "arena"
    | "session"
    | "world"
    | "unknown";
  readonly lifetime:
    | "round"
    | "match"
    | "player-session"
    | "world"
    | "unknown";
  readonly persistent: boolean;
  readonly staleRisk:
    | "bounded"
    | "possible"
    | "unknown";
  readonly readRegions: readonly string[];
  readonly writeRegions: readonly string[];
  readonly clearRegions: readonly string[];
  readonly authorityContractIds: readonly string[];
}

export interface MandatoryAuditOwnershipRecord {
  readonly stateSurfaceId: string;
  readonly authorityStatus:
    | "explicit-contract"
    | "single-writer-observed"
    | "multi-writer-unresolved"
    | "no-writer";
  readonly authorityContractId?: string;
  readonly authoritySurfaceId?: string;
  readonly mirrorSurfaceIds: readonly string[];
  readonly declaredScope:
    | "player"
    | "entity"
    | "arena"
    | "round"
    | "world"
    | "unknown";
  readonly purpose?: string;
  readonly observedWriterRegionIds: readonly string[];
}

export interface MandatoryAuditProgressionRecord {
  readonly subjectId: string;
  readonly kind: "objective" | "phase" | "outcome";
  readonly inboundEdgeIds: readonly string[];
  readonly outboundEdgeIds: readonly string[];
  readonly entryEdgeIds: readonly string[];
  readonly dependencyEdgeIds: readonly string[];
  readonly stateResourceSubjectIds: readonly string[];
  readonly effectEdgeIds: readonly string[];
  readonly transitionEdgeIds: readonly string[];
  readonly terminalEdgeIds: readonly string[];
}

export interface MandatoryAuditProcedureReceipt {
  readonly schemaVersion: 1;
  readonly policy: "mandatory-gameplay-audit-procedure";
  readonly checkpoints: readonly MandatoryAuditCheckpointReceipt[];
  readonly blocks: readonly MandatoryAuditBlockClosure[];
  readonly status: "CLOSED" | "PARTIAL" | "OPEN";
  readonly stateRegistry: readonly MandatoryAuditStateRecord[];
  readonly ownershipRegistry: readonly MandatoryAuditOwnershipRecord[];
  readonly progressionContracts: readonly MandatoryAuditProgressionRecord[];
  readonly blockingCheckpointIds: readonly string[];
  readonly reasons: readonly string[];
}

export function mandatoryAuditReceipt(
  id: string,
  block: MandatoryAuditBlock,
  label: string,
  status: MandatoryAuditCheckpointStatus,
  reason: string,
  evidenceIds: readonly string[] = [],
  outputIds: readonly string[] = [],
  options: {
    readonly reasonCode?: MandatoryAuditCheckpointReasonCode;
    readonly blocksPublication?: boolean;
    readonly obligations?: readonly MandatoryAuditObligation[];
    readonly investigationScenarioIds?: readonly string[];
  } = {},
): MandatoryAuditCheckpointReceipt {
  const obligations = options.obligations ?? [];
  const unsatisfiedRequired = obligations.some(
    (item) => item.required && !item.satisfied,
  );
  const effectiveStatus =
    status === "CLOSED" && unsatisfiedRequired
      ? "PARTIAL"
      : status;
  return {
    id,
    block,
    label,
    status: effectiveStatus,
    reasonCode:
      options.reasonCode ??
      (effectiveStatus === "NOT_APPLICABLE"
        ? "NOT_APPLICABLE_PROVEN"
        : effectiveStatus === "CLOSED"
          ? "COMPLETE"
          : "OBLIGATION_INCOMPLETE"),
    blocksPublication:
      options.blocksPublication ??
      (
        effectiveStatus === "OPEN" ||
        (
          effectiveStatus === "PARTIAL" &&
          (options.reasonCode ?? "OBLIGATION_INCOMPLETE") !==
            "RUNTIME_PROOF_REQUIRED"
        )
      ),
    obligations,
    reason,
    evidenceIds: [...new Set(evidenceIds)].sort(),
    outputIds: [...new Set(outputIds)].sort(),
    ...(options.investigationScenarioIds?.length
      ? { investigationScenarioIds:
          [...new Set(options.investigationScenarioIds)].sort() }
      : {}),
  };
}

export function mandatoryAuditObligation(
  id: string,
  required: boolean,
  satisfied: boolean,
  reason: string,
  evidenceIds: readonly string[] = [],
): MandatoryAuditObligation {
  return {
    id,
    required,
    satisfied,
    reason,
    evidenceIds: [...new Set(evidenceIds)].sort(),
  };
}

export function positiveNotApplicable(
  discovery: GameplayDiscoveryClosure,
  hasSemanticDemand: boolean,
  hasRuntimeSignal: boolean,
): boolean {
  return (
    discovery.status === "COMPLETE" &&
    discovery.semanticUnderstandingGaps === 0 &&
    discovery.discoveryChallengeIds.length === 0 &&
    discovery.gameplayIntentUnknownIds.length === 0 &&
    (discovery.unresolvedSourceLinkIds?.length ?? 0) === 0 &&
    !hasSemanticDemand &&
    !hasRuntimeSignal
  );
}

export interface MandatoryAuditPersistenceProjection {
  readonly propertyId: string;
  readonly growth: string;
  readonly scope:
    | "player"
    | "entity"
    | "arena"
    | "session"
    | "world"
    | "unknown";
  readonly lifetime:
    | "round"
    | "match"
    | "player-session"
    | "world"
    | "unknown";
}

export function deriveMandatoryStateRegistry(
  ir: SemanticIr,
  persistence:
    readonly MandatoryAuditPersistenceProjection[] = [],
): readonly MandatoryAuditStateRecord[] {
  const persistenceByKey = new Map(
    persistence.map((item) => [
      item.propertyId,
      item,
    ]),
  );

  return ir.state.surfaces.map((surface) => {
    const operations = ir.state.operations.filter(
      (operation) => operation.surfaceId === surface.id,
    );
    const regionsFor = (...kinds: string[]) =>
      [...new Set(
        operations
          .filter((operation) =>
            kinds.includes(operation.operation)
          )
          .map((operation) => operation.executionRegionId),
      )].sort();
    const bindings = ir.state.authorityBindings
      .filter((binding) =>
        binding.authoritySurfaceId === surface.id ||
        binding.mirrorSurfaceIds.includes(surface.id)
      );
    const authorityContractIds =
      bindings.map((binding) => binding.contract.id).sort();
    const declaredScopes = [
      ...new Set(
        bindings
          .map((binding) => binding.contract.scope)
          .filter(
            (value): value is NonNullable<typeof value> =>
              value !== undefined,
          ),
      ),
    ];
    const persisted =
      surface.ref.kind === "dynamic-property"
        ? persistenceByKey.get(surface.ref.key)
        : undefined;
    const writes = regionsFor("write");
    const clears = regionsFor("clear", "delete");
    const persistent =
      surface.ref.kind === "dynamic-property" ||
      persisted !== undefined;
    const staleRisk =
      writes.length === 0
        ? "bounded" as const
        : clears.length > 0
          ? "bounded" as const
          : persistent &&
              (
                persisted === undefined ||
                persisted.scope === "world" ||
                persisted.lifetime === "world" ||
                persisted.growth === "append-without-clear"
              )
            ? "possible" as const
            : "unknown" as const;

    return {
      surfaceId: surface.id,
      surfaceKind: surface.ref.kind,
      key: surface.ref.key,
      declaredScope:
        declaredScopes.length === 1
          ? declaredScopes[0]!
          : "unknown",
      persistenceScope:
        persisted?.scope ?? "unknown",
      lifetime:
        persisted?.lifetime ?? "unknown",
      persistent,
      staleRisk,
      readRegions: regionsFor("read", "enumerate", "size"),
      writeRegions: writes,
      clearRegions: clears,
      authorityContractIds,
    };
  });
}

export function deriveMandatoryOwnershipRegistry(
  ir: SemanticIr,
): readonly MandatoryAuditOwnershipRecord[] {
  return ir.state.surfaces.map((surface) => {
    const binding = ir.state.authorityBindings.find(
      (item) =>
        item.authoritySurfaceId === surface.id ||
        item.mirrorSurfaceIds.includes(surface.id),
    );
    const writers = [
      ...new Set(
        ir.state.operations
          .filter(
            (operation) =>
              operation.surfaceId === surface.id &&
              operation.operation === "write",
          )
          .map((operation) => operation.executionRegionId),
      ),
    ].sort();

    return {
      stateSurfaceId: surface.id,
      authorityStatus:
        binding !== undefined
          ? "explicit-contract"
          : writers.length === 0
            ? "no-writer"
            : writers.length === 1
              ? "single-writer-observed"
              : "multi-writer-unresolved",
      ...(binding === undefined
        ? {}
        : {
            authorityContractId: binding.contract.id,
            authoritySurfaceId: binding.authoritySurfaceId,
            purpose: binding.contract.purpose,
          }),
      mirrorSurfaceIds:
        binding === undefined
          ? []
          : [...binding.mirrorSurfaceIds].sort(),
      declaredScope:
        binding?.contract.scope ?? "unknown",
      observedWriterRegionIds: writers,
    };
  });
}

export function deriveMandatoryProgressionContracts(
  intent: GameplayIntentModel,
): readonly MandatoryAuditProgressionRecord[] {
  return intent.nodes
    .filter((node) =>
      node.kind === "objective" ||
      node.kind === "phase" ||
      node.kind === "outcome"
    )
    .map((node) => {
      const inbound = intent.edges.filter(
        (edge) =>
          edge.to === node.id &&
          edge.status !== "hypothesis",
      );
      const outbound = intent.edges.filter(
        (edge) =>
          edge.from === node.id &&
          edge.status !== "hypothesis",
      );
      const incident = [...inbound, ...outbound];
      const stateResourceSubjectIds = [
        ...new Set(
          incident.flatMap((edge) => {
            const otherId =
              edge.from === node.id
                ? edge.to
                : edge.from;
            const other = intent.nodes.find(
              (item) => item.id === otherId,
            );
            return other !== undefined &&
              (
                other.kind === "state" ||
                other.kind === "resource"
              )
              ? [other.id]
              : [];
          }),
        ),
      ].sort();

      return {
        subjectId: node.id,
        kind:
          node.kind as
            | "objective"
            | "phase"
            | "outcome",
        inboundEdgeIds:
          inbound.map((edge) => edge.id).sort(),
        outboundEdgeIds:
          outbound.map((edge) => edge.id).sort(),
        entryEdgeIds:
          inbound
            .filter((edge) =>
              edge.kind === "produces" ||
              edge.kind === "transitions-to" ||
              edge.kind === "recovers-to" ||
              edge.kind === "participates-in"
            )
            .map((edge) => edge.id)
            .sort(),
        dependencyEdgeIds:
          incident
            .filter((edge) =>
              edge.kind === "requires" ||
              edge.kind === "valid-during" ||
              edge.kind === "scoped-to" ||
              edge.kind === "owns"
            )
            .map((edge) => edge.id)
            .sort(),
        stateResourceSubjectIds,
        effectEdgeIds:
          outbound
            .filter((edge) =>
              edge.kind === "produces" ||
              edge.kind === "consumes" ||
              edge.kind === "resets" ||
              edge.kind === "persists"
            )
            .map((edge) => edge.id)
            .sort(),
        transitionEdgeIds:
          outbound
            .filter((edge) =>
              edge.kind === "transitions-to" ||
              edge.kind === "recovers-to"
            )
            .map((edge) => edge.id)
            .sort(),
        terminalEdgeIds:
          incident
            .filter((edge) =>
              edge.kind === "wins-by" ||
              edge.kind === "loses-by"
            )
            .map((edge) => edge.id)
            .sort(),
      };
    });
}

export function mandatoryAuditBlockClosure(
  block: MandatoryAuditBlock,
  checkpoints: readonly MandatoryAuditCheckpointReceipt[],
): MandatoryAuditBlockClosure {
  const relevant = checkpoints.filter((item) => item.block === block);
  const open = relevant.filter((item) => item.status === "OPEN");
  const partial = relevant.filter((item) => item.status === "PARTIAL");
  return {
    block,
    status:
      open.length > 0
        ? "OPEN"
        : partial.length > 0
          ? "PARTIAL"
          : "CLOSED",
    checkpointIds: relevant.map((item) => item.id),
    openCheckpointIds: open.map((item) => item.id),
    partialCheckpointIds: partial.map((item) => item.id),
  };
}
