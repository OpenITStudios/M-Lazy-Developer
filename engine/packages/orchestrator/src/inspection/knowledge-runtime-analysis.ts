import type { DiagnosticFinding } from "../../../diagnostics/src/index.js";
import {
  assessKnowledgeRelations,
  validationPlanFromAssessments,
  type EffectiveKnowledgeProfile,
  type KnowledgeCatalog,
  type ValidationCase,
} from "../../../knowledge/src/index.js";
import {
  groupRuntimeEvidenceByScope,
  type RuntimeEvidenceRecord,
  type RuntimeEvidenceSnapshot,
} from "../../../project-model/src/index.js";
import type { ManifestModel } from "../../../../analyzers/manifest/src/index.js";
import { manifestRuntimeEvidence } from "../../../../analyzers/manifest/src/index.js";
import type { ParsedFunction } from "../../../../analyzers/functions/src/index.js";
import { functionRuntimeEvidence } from "../../../../analyzers/functions/src/index.js";
import type { ParsedScriptFile } from "../../../../analyzers/scripts/src/index.js";
import { scriptRuntimeEvidence } from "../../../../analyzers/scripts/src/index.js";
import type { ParsedEntityDefinition } from "../../../../analyzers/entities/src/index.js";
import { entityRuntimeEvidence } from "../../../../analyzers/entities/src/index.js";
import {
  knowledgeRuntimeDiagnostics,
} from "../../../../analyzers/diagnostics/src/index.js";
import { mergeRuntimeEvidenceRecords } from "../../../../analyzers/diagnostics/src/index.js";
import type { InspectTargetProfile } from "../core/types.js";

export interface InspectionKnowledgeProfileResolution {
  profile?: EffectiveKnowledgeProfile;
  conflicts: readonly string[];
  source: "target" | "education-metadata" | "unresolved";
}

export interface ApplicablePlatformKnowledgeClaim {
  readonly relationId: string;
  readonly domain: string;
  readonly kind: string;
  readonly subject: string;
  readonly object: string;
  readonly status: "satisfied" | "violation" | "unknown";
  readonly message: string;
  readonly knowledgeSourceIds: readonly string[];
  readonly evidenceSourceIds: readonly string[];
  readonly sources: readonly {
    id: string;
    title: string;
    url: string;
    authority: string;
  }[];
}

export interface KnowledgeRuntimeAnalysis {
  enabled: boolean;
  profileResolved: boolean;
  profileSource: InspectionKnowledgeProfileResolution["source"];
  profileConflicts: readonly string[];
  evidenceRecords: number;
  violations: number;
  evidenceGaps: number;
  validationCases: readonly ValidationCase[];
  platformClaims: readonly ApplicablePlatformKnowledgeClaim[];
  diagnostics: readonly DiagnosticFinding[];
}

export function resolveInspectionKnowledgeProfile(
  target: InspectTargetProfile,
  manifests: readonly ManifestModel[],
): InspectionKnowledgeProfileResolution {
  const conflicts: string[] = [];
  const modules = new Map<string, string>();
  const conflictedModules = new Set<string>();
  let educationMetadata = false;

  for (const manifest of manifests) {
    const evidence = manifestRuntimeEvidence(manifest);
    if (evidence.records.some((record) => record.predicate === "education-metadata")) {
      educationMetadata = true;
    }
    for (const [name, version] of Object.entries(evidence.scriptModules)) {
      const existing = modules.get(name);
      if (existing !== undefined && existing !== version) {
        conflicts.push(
          "Conflicting script module versions for " + name + ": " + existing + " vs " + version,
        );
        conflictedModules.add(name);
        modules.delete(name);
        continue;
      }
      if (!conflictedModules.has(name)) modules.set(name, version);
    }
  }

  const edition = target.edition ?? (educationMetadata ? "education" : undefined);
  if (!edition) {
    return {
      conflicts: [...new Set(conflicts)].sort(),
      source: "unresolved",
    };
  }

  const scriptModules = Object.fromEntries(
    [...modules.entries()].sort(([a], [b]) => a.localeCompare(b)),
  );
  const profile: EffectiveKnowledgeProfile = {
    edition,
    ...(target.version === undefined ? {} : { minecraftVersion: target.version }),
    ...(target.experiments === undefined ? {} : { experiments: target.experiments }),
    ...(Object.keys(scriptModules).length === 0 ? {} : { scriptModules }),
  };

  return {
    profile,
    conflicts: [...new Set(conflicts)].sort(),
    source: target.edition !== undefined ? "target" : "education-metadata",
  };
}

const PLATFORM_KNOWLEDGE_DOMAINS = new Set([
  "chunks",
  "script-api",
  "compatibility",
  "education-runtime",
  "education",
  "entity-runtime",
  "multiplayer",
  "event-ordering",
  "world-state",
  "world-mutation",
  "persistence",
]);

function platformClaimsForSnapshot(
  catalog: KnowledgeCatalog,
  profile: EffectiveKnowledgeProfile,
  snapshot: RuntimeEvidenceSnapshot,
): ApplicablePlatformKnowledgeClaim[] {
  const relationById = new Map(
    (catalog.relations ?? []).map((relation) => [
      relation.id,
      relation,
    ]),
  );
  const sourceById = new Map(
    catalog.sources.map((source) => [
      source.id,
      source,
    ]),
  );
  const claims = new Map<string, ApplicablePlatformKnowledgeClaim>();

  for (const [, records] of groupRuntimeEvidenceByScope(snapshot)) {
    const { map } = mergeRuntimeEvidenceRecords(records);
    for (const assessment of assessKnowledgeRelations(
      catalog,
      profile,
      map,
    )) {
      const relation = relationById.get(assessment.relationId);
      if (
        relation === undefined ||
        !PLATFORM_KNOWLEDGE_DOMAINS.has(relation.domain) ||
        relation.classification === "project-policy" ||
        relation.classification === "open-assumption"
      ) {
        continue;
      }

      const sources = assessment.knowledgeSourceIds
        .map((id) => sourceById.get(id))
        .filter(
          (source): source is NonNullable<typeof source> =>
            source !== undefined &&
            source.authority !== "project-policy",
        )
        .map((source) => ({
          id: source.id,
          title: source.title,
          url: source.url,
          authority: source.authority,
        }))
        .sort((a, b) => a.id.localeCompare(b.id));

      if (
        assessment.knowledgeSourceIds.length > 0 &&
        sources.length === 0
      ) {
        continue;
      }

      const claim: ApplicablePlatformKnowledgeClaim = {
        relationId: assessment.relationId,
        domain: relation.domain,
        kind: assessment.kind,
        subject: assessment.subject,
        object: assessment.object,
        status: assessment.status,
        message: assessment.message,
        knowledgeSourceIds:
          [...assessment.knowledgeSourceIds].sort(),
        evidenceSourceIds:
          [...assessment.evidenceSourceIds].sort(),
        sources,
      };
      const key = [
        claim.relationId,
        claim.status,
        claim.subject,
        claim.object,
        claim.evidenceSourceIds.join(","),
      ].join("|");
      claims.set(key, claim);
    }
  }

  const statusRank = {
    violation: 0,
    unknown: 1,
    satisfied: 2,
  } as const;

  return [...claims.values()]
    .sort((a, b) =>
      statusRank[a.status] - statusRank[b.status] ||
      a.domain.localeCompare(b.domain) ||
      a.relationId.localeCompare(b.relationId)
    )
    .slice(0, 32);
}

function validationCasesForSnapshot(
  catalog: KnowledgeCatalog,
  profile: EffectiveKnowledgeProfile,
  snapshot: RuntimeEvidenceSnapshot,
): ValidationCase[] {
  const cases: ValidationCase[] = [];
  for (const [scopeKey, records] of groupRuntimeEvidenceByScope(snapshot)) {
    const { map } = mergeRuntimeEvidenceRecords(records);
    for (const item of validationPlanFromAssessments(
      assessKnowledgeRelations(catalog, profile, map),
    )) {
      cases.push({
        ...item,
        id: item.id + "::" + scopeKey,
      });
    }
  }

  return cases.sort((a, b) => a.id.localeCompare(b.id));
}

export function analyzeKnowledgeRuntime(
  catalog: KnowledgeCatalog | undefined,
  target: InspectTargetProfile,
  manifests: readonly ManifestModel[],
  functions: readonly ParsedFunction[],
  extraEvidence: readonly RuntimeEvidenceRecord[] = [],
  scripts: readonly ParsedScriptFile[] = [],
  entities: ReadonlyArray<{
    entity: ParsedEntityDefinition;
    externalRootEvents?: readonly string[];
  }> = [],
): KnowledgeRuntimeAnalysis {
  if (!catalog) {
    return {
      enabled: false,
      profileResolved: false,
      profileSource: "unresolved",
      profileConflicts: [],
      evidenceRecords: 0,
      violations: 0,
      evidenceGaps: 0,
      validationCases: [],
      platformClaims: [],
      diagnostics: [],
    };
  }

  const resolution = resolveInspectionKnowledgeProfile(target, manifests);
  const records: RuntimeEvidenceRecord[] = [
    ...manifests.flatMap((manifest) => manifestRuntimeEvidence(manifest).records),
    ...functions.flatMap(functionRuntimeEvidence),
    ...scripts.flatMap(scriptRuntimeEvidence),
    ...entities.flatMap((item) =>
      entityRuntimeEvidence(item.entity, item.externalRootEvents ?? [])
    ),
    ...extraEvidence,
  ];

  if (!resolution.profile) {
    return {
      enabled: true,
      profileResolved: false,
      profileSource: resolution.source,
      profileConflicts: resolution.conflicts,
      evidenceRecords: records.length,
      violations: 0,
      evidenceGaps: 0,
      validationCases: [],
      platformClaims: [],
      diagnostics: [],
    };
  }

  const snapshot: RuntimeEvidenceSnapshot = { schemaVersion: 1, records };
  const diagnostics = knowledgeRuntimeDiagnostics({
    catalog,
    profile: resolution.profile,
    snapshot,
  });
  const validationCases = validationCasesForSnapshot(
    catalog,
    resolution.profile,
    snapshot,
  );
  const platformClaims = platformClaimsForSnapshot(
    catalog,
    resolution.profile,
    snapshot,
  );

  return {
    enabled: true,
    profileResolved: true,
    profileSource: resolution.source,
    profileConflicts: resolution.conflicts,
    evidenceRecords: records.length,
    violations: diagnostics.filter((item) => item.code === "KNOWLEDGE_RELATION_VIOLATION").length,
    evidenceGaps: diagnostics.filter((item) => item.code === "KNOWLEDGE_EVIDENCE_GAP").length,
    validationCases,
    platformClaims,
    diagnostics,
  };
}