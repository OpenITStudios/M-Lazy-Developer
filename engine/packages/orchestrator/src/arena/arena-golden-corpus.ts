import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { KnowledgeCatalog } from "../../../knowledge/src/index.js";
import type {
  InspectDirectoryResult,
  InspectTargetProfile,
} from "../core/types.js";
import { inspectArtifact } from "../inspection/inspect-artifact.js";
import { loadArenaRegionContractsFile } from "./arena-region-contract-load.js";
import type {
  ArenaReplicaProofQualityStatus,
} from "./arena-replica-proof-quality.js";
import type {
  ArenaProofConclusion,
} from "./arena-proof-conclusion.js";
import type {
  ArenaLayoutReconciliationStatus,
} from "./arena-layout-reconciliation.js";

export interface ArenaGoldenAssertions {
  arenaCount?: number;
  layoutStatus?: ArenaLayoutReconciliationStatus;
  proofConclusion?: ArenaProofConclusion;
  minCoverageRatio?: number;
  capacityOk?: boolean;
  requirePackIdentityDrift?: boolean;
  releaseStatus?: "unavailable" | "consistent" | "conflict";
  replicaStatuses?: Readonly<Record<string, ArenaReplicaProofQualityStatus>>;
  maxLifecycleUnresolved?: number;
  maxCleanupUnresolved?: number;
  maxSharedGlobalState?: number;
  maxPartitionProofRequired?: number;
  maxGlobalStateUnleased?: number;
  maxGlobalStateUnaudited?: number;
  maxRepairLocalizationUnresolved?: number;
  proofMode?: "progressive" | "full";
  stressStatus?: "planned" | "unavailable";
  nominalStressPlayers?: number;
  voxelStatus?: string;
  blockEntityStatus?: string;
  entityPopulationStatus?: string;
  actorPopulationStatus?: string;
  tickStateStatus?: string;
  structureInstanceStatus?: string;
}

export interface ArenaGoldenApproval {
  status: "approved";
  approvedBy: string;
  approvedAt: string;
  sourceFingerprint?: string;
}

export interface ArenaGoldenCase {
  id: string;
  label: string;
  artifactFile: string;
  regionContractsFile?: string;
  assertions: ArenaGoldenAssertions;
  approval?: ArenaGoldenApproval;
  note?: string;
}

export interface ArenaGoldenManifest {
  schemaVersion: 1;
  id: string;
  requireApproval?: boolean;
  cases: readonly ArenaGoldenCase[];
}

export interface ArenaGoldenObservation {
  arenaCount?: number;
  detectionBasis?: "topology" | "script-config" | "reconciled";
  layoutStatus?: ArenaLayoutReconciliationStatus;
  proofConclusion?: ArenaProofConclusion;
  coverageRatio?: number;
  capacityOk?: boolean;
  packIdentityDrift: boolean;
  releaseStatus: "unavailable" | "consistent" | "conflict";
  replicaStatuses: Readonly<Record<string, ArenaReplicaProofQualityStatus>>;
  lifecycleUnresolved: number;
  cleanupUnresolved: number;
  sharedGlobalState: number;
  partitionProofRequired: number;
  globalStateUnleased: number;
  globalStateUnaudited: number;
  repairLocalizationUnresolved: number;
  proofMode?: "progressive" | "full";
  stressStatus: "planned" | "unavailable";
  nominalStressPlayers?: number;
  voxelStatus?: string;
  blockEntityStatus?: string;
  entityPopulationStatus?: string;
  actorPopulationStatus?: string;
  tickStateStatus?: string;
  structureInstanceStatus?: string;
}

export interface ArenaGoldenCaseReport {
  id: string;
  label: string;
  assertionFailures: readonly string[];
  observation: ArenaGoldenObservation;
  note?: string;
}

export interface ArenaGoldenCorpusReport {
  schemaVersion: 1;
  corpusId: string;
  cases: readonly ArenaGoldenCaseReport[];
  casesWithFailures: number;
  totalAssertionFailures: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseAssertions(
  raw: unknown,
  caseId: string,
): ArenaGoldenAssertions {
  if (!isRecord(raw)) {
    throw new Error(
      "Arena golden case " + caseId + " assertions must be an object.",
    );
  }

  const output: ArenaGoldenAssertions = {};

  if (raw.arenaCount !== undefined) {
    if (
      typeof raw.arenaCount !== "number" ||
      !Number.isInteger(raw.arenaCount) ||
      raw.arenaCount < 1
    ) {
      throw new Error(
        "Arena golden case " + caseId + " arenaCount must be a positive integer.",
      );
    }
    output.arenaCount = raw.arenaCount;
  }

  if (raw.layoutStatus !== undefined) {
    if (
      ![
        "unavailable",
        "script-only",
        "topology-only",
        "consistent",
        "conflict",
      ].includes(String(raw.layoutStatus))
    ) {
      throw new Error(
        "Arena golden case " + caseId + " has invalid layoutStatus.",
      );
    }
    output.layoutStatus =
      raw.layoutStatus as ArenaLayoutReconciliationStatus;
  }

  if (raw.proofConclusion !== undefined) {
    if (
      ![
        "complete-proof",
        "bounded-proof",
        "no-proof",
        "partition-fallback",
      ].includes(String(raw.proofConclusion))
    ) {
      throw new Error(
        "Arena golden case " + caseId + " has invalid proofConclusion.",
      );
    }
    output.proofConclusion =
      raw.proofConclusion as ArenaProofConclusion;
  }

  if (raw.minCoverageRatio !== undefined) {
    if (
      typeof raw.minCoverageRatio !== "number" ||
      raw.minCoverageRatio < 0 ||
      raw.minCoverageRatio > 1
    ) {
      throw new Error(
        "Arena golden case " + caseId + " minCoverageRatio must be between 0 and 1.",
      );
    }
    output.minCoverageRatio = raw.minCoverageRatio;
  }

  if (raw.capacityOk !== undefined) {
    if (typeof raw.capacityOk !== "boolean") {
      throw new Error(
        "Arena golden case " + caseId + " capacityOk must be boolean.",
      );
    }
    output.capacityOk = raw.capacityOk;
  }

  if (raw.requirePackIdentityDrift !== undefined) {
    if (typeof raw.requirePackIdentityDrift !== "boolean") {
      throw new Error(
        "Arena golden case " + caseId + " requirePackIdentityDrift must be boolean.",
      );
    }
    output.requirePackIdentityDrift = raw.requirePackIdentityDrift;
  }

  if (raw.releaseStatus !== undefined) {
    if (
      raw.releaseStatus !== "unavailable" &&
      raw.releaseStatus !== "consistent" &&
      raw.releaseStatus !== "conflict"
    ) {
      throw new Error(
        "Arena golden case " + caseId + " has invalid releaseStatus.",
      );
    }
    output.releaseStatus = raw.releaseStatus;
  }

  if (raw.replicaStatuses !== undefined) {
    if (!isRecord(raw.replicaStatuses)) {
      throw new Error(
        "Arena golden case " + caseId + " replicaStatuses must be an object.",
      );
    }
    const statuses: Record<string, ArenaReplicaProofQualityStatus> = {};
    for (const [arenaId, status] of Object.entries(raw.replicaStatuses)) {
      if (
        ![
          "complete-proof",
          "bounded-proof",
          "diverged",
          "incomplete-proof",
          "budget-exceeded",
          "no-proof",
        ].includes(String(status))
      ) {
        throw new Error(
          "Arena golden case " + caseId + " has invalid replica status for " + arenaId + ".",
        );
      }
      statuses[arenaId] = status as ArenaReplicaProofQualityStatus;
    }
    output.replicaStatuses = statuses;
  }

  for (const key of [
    "maxLifecycleUnresolved",
    "maxCleanupUnresolved",
    "maxSharedGlobalState",
    "maxPartitionProofRequired",
    "maxGlobalStateUnleased",
    "maxGlobalStateUnaudited",
    "maxRepairLocalizationUnresolved",
    "nominalStressPlayers",
  ] as const) {
    const value = raw[key];
    if (value === undefined) continue;
    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < 0
    ) {
      throw new Error(
        "Arena golden case " + caseId + " " + key + " must be a non-negative integer.",
      );
    }
    output[key] = value;
  }

  if (raw.proofMode !== undefined) {
    if (
      raw.proofMode !== "progressive" &&
      raw.proofMode !== "full"
    ) {
      throw new Error(
        "Arena golden case " + caseId + " has invalid proofMode.",
      );
    }
    output.proofMode = raw.proofMode;
  }

  if (raw.stressStatus !== undefined) {
    if (
      raw.stressStatus !== "planned" &&
      raw.stressStatus !== "unavailable"
    ) {
      throw new Error(
        "Arena golden case " + caseId + " has invalid stressStatus.",
      );
    }
    output.stressStatus = raw.stressStatus;
  }

  for (const key of [
    "voxelStatus",
    "blockEntityStatus",
    "entityPopulationStatus",
    "actorPopulationStatus",
    "tickStateStatus",
    "structureInstanceStatus",
  ] as const) {
    const value = raw[key];
    if (value === undefined) continue;
    if (!nonEmptyString(value)) {
      throw new Error(
        "Arena golden case " + caseId + " " + key + " must be non-empty.",
      );
    }
    output[key] = value;
  }

  const allowed = new Set([
    "arenaCount",
    "layoutStatus",
    "proofConclusion",
    "minCoverageRatio",
    "capacityOk",
    "requirePackIdentityDrift",
    "releaseStatus",
    "replicaStatuses",
    "maxLifecycleUnresolved",
    "maxCleanupUnresolved",
    "maxSharedGlobalState",
    "maxPartitionProofRequired",
    "maxGlobalStateUnleased",
    "maxGlobalStateUnaudited",
    "maxRepairLocalizationUnresolved",
    "proofMode",
    "stressStatus",
    "nominalStressPlayers",
    "voxelStatus",
    "blockEntityStatus",
    "entityPopulationStatus",
    "actorPopulationStatus",
    "tickStateStatus",
    "structureInstanceStatus",
  ]);
  for (const key of Object.keys(raw)) {
    if (!allowed.has(key)) {
      throw new Error(
        "Arena golden case " + caseId + " has unsupported assertion: " + key,
      );
    }
  }

  return output;
}

export function parseArenaGoldenManifest(
  input: unknown,
): ArenaGoldenManifest {
  if (!isRecord(input)) {
    throw new Error("Arena golden manifest must be an object.");
  }
  if (input.schemaVersion !== 1) {
    throw new Error("Arena golden manifest schemaVersion must be 1.");
  }
  if (!nonEmptyString(input.id)) {
    throw new Error("Arena golden manifest id must be non-empty.");
  }
  if (
    input.requireApproval !== undefined &&
    typeof input.requireApproval !== "boolean"
  ) {
    throw new Error(
      "Arena golden manifest requireApproval must be boolean when provided.",
    );
  }
  if (!Array.isArray(input.cases)) {
    throw new Error("Arena golden manifest cases must be an array.");
  }

  const ids = new Set<string>();
  const cases = input.cases.map((raw, index): ArenaGoldenCase => {
    if (!isRecord(raw)) {
      throw new Error("Arena golden case " + index + " must be an object.");
    }
    if (!nonEmptyString(raw.id)) {
      throw new Error("Arena golden case " + index + " requires id.");
    }
    if (ids.has(raw.id)) {
      throw new Error("Duplicate arena golden case id: " + raw.id);
    }
    ids.add(raw.id);

    if (!nonEmptyString(raw.label) || !nonEmptyString(raw.artifactFile)) {
      throw new Error(
        "Arena golden case " + raw.id + " requires label and artifactFile.",
      );
    }
    if (
      raw.regionContractsFile !== undefined &&
      !nonEmptyString(raw.regionContractsFile)
    ) {
      throw new Error(
        "Arena golden case " + raw.id + " regionContractsFile must be non-empty.",
      );
    }
    if (raw.note !== undefined && !nonEmptyString(raw.note)) {
      throw new Error(
        "Arena golden case " + raw.id + " note must be non-empty.",
      );
    }

    let approval: ArenaGoldenApproval | undefined;
    if (raw.approval !== undefined) {
      if (!isRecord(raw.approval)) {
        throw new Error(
          "Arena golden case " + raw.id + " approval must be an object.",
        );
      }
      if (
        raw.approval.status !== "approved" ||
        !nonEmptyString(raw.approval.approvedBy) ||
        !nonEmptyString(raw.approval.approvedAt)
      ) {
        throw new Error(
          "Arena golden case " + raw.id + " approval requires status=approved, approvedBy, and approvedAt.",
        );
      }
      if (
        raw.approval.sourceFingerprint !== undefined &&
        !nonEmptyString(raw.approval.sourceFingerprint)
      ) {
        throw new Error(
          "Arena golden case " + raw.id + " approval sourceFingerprint must be non-empty when provided.",
        );
      }
      approval = {
        status: "approved",
        approvedBy:
          raw.approval.approvedBy,
        approvedAt:
          raw.approval.approvedAt,
        ...(raw.approval.sourceFingerprint === undefined
          ? {}
          : {
              sourceFingerprint:
                raw.approval.sourceFingerprint,
            }),
      };
    }

    return {
      id: raw.id,
      label: raw.label,
      artifactFile: raw.artifactFile,
      ...(raw.regionContractsFile === undefined
        ? {}
        : { regionContractsFile: raw.regionContractsFile }),
      assertions: parseAssertions(raw.assertions, raw.id),
      ...(approval === undefined
        ? {}
        : { approval }),
      ...(raw.note === undefined ? {} : { note: raw.note }),
    };
  });

  return {
    schemaVersion: 1,
    id: input.id,
    ...(input.requireApproval === undefined
      ? {}
      : {
          requireApproval:
            input.requireApproval,
        }),
    cases,
  };
}

export function assertArenaGoldenApprovals(
  manifest: ArenaGoldenManifest,
): void {
  if (manifest.requireApproval !== true) {
    return;
  }

  const missing =
    manifest.cases
      .filter(
        (item) =>
          item.approval?.status !==
          "approved",
      )
      .map((item) => item.id)
      .sort();

  if (missing.length > 0) {
    throw new Error(
      "Arena golden corpus requires approved cases before execution. Missing approval: " +
        missing.join(", ") +
        ".",
    );
  }
}

export function observeArenaGolden(
  result: InspectDirectoryResult,
): ArenaGoldenObservation {
  const arenaCount =
    result.arenaAnalysis.spatialLayout !== undefined
      ? 1 + result.arenaAnalysis.spatialLayout.replicas.length
      : result.arenaAnalysis.discovery !== undefined
        ? 1 + result.arenaAnalysis.discovery.replicas.length
        : undefined;

  return {
    ...(arenaCount === undefined ? {} : { arenaCount }),
    ...(result.arenaAnalysis.spatialLayout === undefined
      ? {}
      : { detectionBasis: result.arenaAnalysis.spatialLayout.basis }),
    ...(result.arenaAnalysis.layoutReconciliation === undefined
      ? {}
      : { layoutStatus: result.arenaAnalysis.layoutReconciliation.status }),
    ...(result.arenaAnalysis.proofConclusion === undefined
      ? {}
      : { proofConclusion: result.arenaAnalysis.proofConclusion.conclusion }),
    ...(result.arenaAnalysis.proofCoverage === undefined
      ? {}
      : { coverageRatio: result.arenaAnalysis.proofCoverage.coverageRatio }),
    ...(result.arenaAnalysis.capacity?.report === undefined
      ? {}
      : { capacityOk: result.arenaAnalysis.capacity.report.ok }),
    packIdentityDrift: result.diagnostics.some(
      (finding) => finding.code === "PACK_IDENTITY_DRIFT",
    ),
    releaseStatus: result.releaseIdentity.status,
    replicaStatuses: Object.fromEntries(
      (result.arenaAnalysis.replicaProofQuality ?? []).map((item) => [
        item.arenaId,
        item.status,
      ]),
    ),
    lifecycleUnresolved:
      result.arenaAnalysis.lifecycle?.unresolved ?? 0,
    cleanupUnresolved:
      result.arenaAnalysis.cleanupSurfaces?.unresolved ?? 0,
    sharedGlobalState:
      result.arenaAnalysis.stateIsolation?.sharedGlobal ?? 0,
    partitionProofRequired:
      result.arenaAnalysis.stateIsolation
        ?.partitionProofRequired ?? 0,
    globalStateUnleased:
      result.arenaAnalysis.globalState
        ?.unleasedArenaMutations ?? 0,
    globalStateUnaudited:
      result.arenaAnalysis.globalState
        ?.unauditedArenaMutations ?? 0,
    repairLocalizationUnresolved:
      result.arenaAnalysis.repairLocalization
        ?.unresolved ?? 0,
    ...(result.arenaAnalysis.proofExecution === undefined
      ? {}
      : {
          proofMode:
            result.arenaAnalysis.proofExecution.mode,
        }),
    stressStatus:
      result.arenaAnalysis.stressPlan?.status ??
      "unavailable",
    ...(result.arenaAnalysis.stressPlan?.matrix === undefined
      ? {}
      : {
          nominalStressPlayers:
            result.arenaAnalysis.stressPlan.matrix
              .totalNominalPlayers,
        }),
    ...(result.arenaAnalysis.voxelProof === undefined
      ? {}
      : {
          voxelStatus:
            result.arenaAnalysis.voxelProof.status,
        }),
    ...(result.arenaAnalysis.blockEntityProof === undefined
      ? {}
      : {
          blockEntityStatus:
            result.arenaAnalysis.blockEntityProof.status,
        }),
    ...(result.arenaAnalysis.entityPopulationProof === undefined
      ? {}
      : {
          entityPopulationStatus:
            result.arenaAnalysis.entityPopulationProof.status,
        }),
    ...(result.arenaAnalysis.actorPopulationProof === undefined
      ? {}
      : {
          actorPopulationStatus:
            result.arenaAnalysis.actorPopulationProof.status,
        }),
    ...(result.arenaAnalysis.tickStateProof === undefined
      ? {}
      : {
          tickStateStatus:
            result.arenaAnalysis.tickStateProof.status,
        }),
    ...(result.arenaAnalysis.structureInstanceProof === undefined
      ? {}
      : {
          structureInstanceStatus:
            result.arenaAnalysis.structureInstanceProof.status,
        }),
  };
}

export function evaluateArenaGoldenAssertions(
  observation: ArenaGoldenObservation,
  assertions: ArenaGoldenAssertions,
): string[] {
  const failures: string[] = [];

  if (
    assertions.arenaCount !== undefined &&
    observation.arenaCount !== assertions.arenaCount
  ) {
    failures.push(
      "arenaCount: expected " +
        assertions.arenaCount +
        ", observed " +
        String(observation.arenaCount),
    );
  }

  if (
    assertions.layoutStatus !== undefined &&
    observation.layoutStatus !== assertions.layoutStatus
  ) {
    failures.push(
      "layoutStatus: expected " +
        assertions.layoutStatus +
        ", observed " +
        String(observation.layoutStatus),
    );
  }

  if (
    assertions.proofConclusion !== undefined &&
    observation.proofConclusion !== assertions.proofConclusion
  ) {
    failures.push(
      "proofConclusion: expected " +
        assertions.proofConclusion +
        ", observed " +
        String(observation.proofConclusion),
    );
  }

  if (
    assertions.minCoverageRatio !== undefined &&
    (
      observation.coverageRatio === undefined ||
      observation.coverageRatio < assertions.minCoverageRatio
    )
  ) {
    failures.push(
      "coverageRatio: expected at least " +
        assertions.minCoverageRatio +
        ", observed " +
        String(observation.coverageRatio),
    );
  }

  if (
    assertions.capacityOk !== undefined &&
    observation.capacityOk !== assertions.capacityOk
  ) {
    failures.push(
      "capacityOk: expected " +
        assertions.capacityOk +
        ", observed " +
        String(observation.capacityOk),
    );
  }

  if (
    assertions.requirePackIdentityDrift !== undefined &&
    observation.packIdentityDrift !== assertions.requirePackIdentityDrift
  ) {
    failures.push(
      "packIdentityDrift: expected " +
        assertions.requirePackIdentityDrift +
        ", observed " +
        observation.packIdentityDrift,
    );
  }

  if (
    assertions.releaseStatus !== undefined &&
    observation.releaseStatus !== assertions.releaseStatus
  ) {
    failures.push(
      "releaseStatus: expected " +
        assertions.releaseStatus +
        ", observed " +
        observation.releaseStatus,
    );
  }

  for (const [arenaId, expected] of Object.entries(
    assertions.replicaStatuses ?? {},
  )) {
    const actual = observation.replicaStatuses[arenaId];
    if (actual !== expected) {
      failures.push(
        "replicaStatuses." +
          arenaId +
          ": expected " +
          expected +
          ", observed " +
          String(actual),
      );
    }
  }

  const maximums: Array<[
    keyof Pick<
      ArenaGoldenAssertions,
      | "maxLifecycleUnresolved"
      | "maxCleanupUnresolved"
      | "maxSharedGlobalState"
      | "maxPartitionProofRequired"
      | "maxGlobalStateUnleased"
      | "maxGlobalStateUnaudited"
      | "maxRepairLocalizationUnresolved"
    >,
    number,
  ]> = [
    ["maxLifecycleUnresolved", observation.lifecycleUnresolved],
    ["maxCleanupUnresolved", observation.cleanupUnresolved],
    ["maxSharedGlobalState", observation.sharedGlobalState],
    ["maxPartitionProofRequired", observation.partitionProofRequired],
    ["maxGlobalStateUnleased", observation.globalStateUnleased],
    ["maxGlobalStateUnaudited", observation.globalStateUnaudited],
    ["maxRepairLocalizationUnresolved", observation.repairLocalizationUnresolved],
  ];

  for (const [key, actual] of maximums) {
    const expected = assertions[key];
    if (
      expected !== undefined &&
      actual > expected
    ) {
      failures.push(
        key +
          ": expected at most " +
          expected +
          ", observed " +
          actual,
      );
    }
  }

  if (
    assertions.proofMode !== undefined &&
    observation.proofMode !== assertions.proofMode
  ) {
    failures.push(
      "proofMode: expected " +
        assertions.proofMode +
        ", observed " +
        String(observation.proofMode),
    );
  }

  if (
    assertions.stressStatus !== undefined &&
    observation.stressStatus !== assertions.stressStatus
  ) {
    failures.push(
      "stressStatus: expected " +
        assertions.stressStatus +
        ", observed " +
        observation.stressStatus,
    );
  }

  if (
    assertions.nominalStressPlayers !== undefined &&
    observation.nominalStressPlayers !==
      assertions.nominalStressPlayers
  ) {
    failures.push(
      "nominalStressPlayers: expected " +
        assertions.nominalStressPlayers +
        ", observed " +
        String(observation.nominalStressPlayers),
    );
  }

  const statusAssertions: Array<[
    keyof Pick<
      ArenaGoldenAssertions,
      | "voxelStatus"
      | "blockEntityStatus"
      | "entityPopulationStatus"
      | "actorPopulationStatus"
      | "tickStateStatus"
      | "structureInstanceStatus"
    >,
    string | undefined,
  ]> = [
    ["voxelStatus", observation.voxelStatus],
    ["blockEntityStatus", observation.blockEntityStatus],
    ["entityPopulationStatus", observation.entityPopulationStatus],
    ["actorPopulationStatus", observation.actorPopulationStatus],
    ["tickStateStatus", observation.tickStateStatus],
    ["structureInstanceStatus", observation.structureInstanceStatus],
  ];

  for (const [key, actual] of statusAssertions) {
    const expected = assertions[key];
    if (
      expected !== undefined &&
      actual !== expected
    ) {
      failures.push(
        key +
          ": expected " +
          expected +
          ", observed " +
          String(actual),
      );
    }
  }

  return failures.sort();
}

export async function runArenaGoldenCorpus(
  manifest: ArenaGoldenManifest,
  artifactRoot: string,
  target: InspectTargetProfile = {},
  knowledgeCatalog?: KnowledgeCatalog,
): Promise<ArenaGoldenCorpusReport> {
  assertArenaGoldenApprovals(manifest);

  const reports: ArenaGoldenCaseReport[] = [];

  for (const item of manifest.cases) {
    const caseTarget: InspectTargetProfile = {
      ...target,
    };
    if (item.regionContractsFile) {
      caseTarget.arenaRegionContracts =
        await loadArenaRegionContractsFile(
          resolve(artifactRoot, item.regionContractsFile),
        );
    }

    if (caseTarget.arenaProofMode === undefined) {
      caseTarget.arenaProofMode = "full";
    }

    const result = await inspectArtifact(
      resolve(artifactRoot, item.artifactFile),
      caseTarget,
      knowledgeCatalog,
    );
    const observation = observeArenaGolden(result);
    const assertionFailures =
      evaluateArenaGoldenAssertions(
        observation,
        item.assertions,
      );

    reports.push({
      id: item.id,
      label: item.label,
      assertionFailures,
      observation,
      ...(item.note === undefined ? {} : { note: item.note }),
    });
  }

  return {
    schemaVersion: 1,
    corpusId: manifest.id,
    cases: reports,
    casesWithFailures: reports.filter(
      (item) => item.assertionFailures.length > 0,
    ).length,
    totalAssertionFailures: reports.reduce(
      (sum, item) => sum + item.assertionFailures.length,
      0,
    ),
  };
}

export async function runArenaGoldenCorpusFromFile(
  manifestPath: string,
  artifactRoot?: string,
  target: InspectTargetProfile = {},
  knowledgeCatalog?: KnowledgeCatalog,
): Promise<ArenaGoldenCorpusReport> {
  const manifest = parseArenaGoldenManifest(
    JSON.parse(await readFile(manifestPath, "utf8")) as unknown,
  );
  return runArenaGoldenCorpus(
    manifest,
    artifactRoot ?? dirname(resolve(manifestPath)),
    target,
    knowledgeCatalog,
  );
}
