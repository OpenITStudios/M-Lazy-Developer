import type {
  RetrievalResult,
  SectionRetrievalResult,
} from "../../../analysis-planner/src/index.js";
import {
  evaluateKnowledgeApplicabilityV2,
  runtimeConstraintFromLegacyKnowledgeApplicability,
  type KnowledgeApplicabilityDecision,
} from "../../../knowledge/src/index.js";
import type { SemanticIr } from "../../../semantic-ir/src/index.js";
import {
  validateMinecraftRuntimeProfile,
  type MinecraftRuntimeProfile,
} from "../../../runtime-profile/src/index.js";
import type {
  KnowledgeApplicability,
  KnowledgeClassification,
  KnowledgeRelationKind,
  KnowledgeSource,
} from "../../../knowledge/src/index.js";

// A retrieval result is evidence for investigation, never a claim of runtime
// behavior or target-version applicability.
export interface RetrievedKnowledgeContext {
  readonly kind: "fact" | "relation";
  readonly subject: string;
  readonly summary: string;
  readonly classification: KnowledgeClassification | "unspecified";
  readonly applicability: KnowledgeApplicability;
  readonly applicabilityStatus: "NOT_EVALUATED";
  readonly sourceIds: readonly string[];
  readonly sources: readonly KnowledgeSource[];
  readonly capabilityTags?: readonly string[];
  readonly riskSurfaces?: readonly string[];
  readonly diagnosticHints?: readonly string[];
  readonly relation?: {
    readonly kind: KnowledgeRelationKind;
    readonly object: string;
    readonly diagnosticHint?: string;
    readonly causalConsequences?: readonly string[];
  };
}

export type KnowledgeTargetApplicability =
  | KnowledgeApplicabilityDecision
  | {
      readonly state: "not-evaluated";
      readonly reasons: readonly string[];
      readonly missing: readonly string[];
    };

export interface CompiledResourceContextItem {
  readonly id: string;
  readonly class: string;
  readonly domain: string;
  readonly role?: string;
  readonly authority: string;
  readonly path: string;
  readonly locator?: string;
  readonly score: number;
  readonly reasons: readonly string[];
  readonly knowledge?: RetrievedKnowledgeContext;
  /** Applicability to a supplied profile; NOT Minecraft runtime proof. */
  readonly targetApplicability?: KnowledgeTargetApplicability;
}

export interface CompiledResourceContext {
  readonly items: readonly CompiledResourceContextItem[];
  readonly omitted: number;
  readonly knowledgeContent?: {
    readonly status: "COMPLETE" | "PARTIAL";
    readonly missingResourceIds: readonly string[];
  };
}

function positiveMaximum(value: number | undefined): number {
  if (value === undefined) return 12;
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("Resource Context maximum must be a positive integer.");
  }
  return Math.min(value, 50);
}

export function compileResourceContext(
  selection: readonly RetrievalResult[] | undefined,
  maximum?: number,
  knowledgeByResourceId?: Readonly<Record<string, RetrievedKnowledgeContext>>,
  targetProfile?: MinecraftRuntimeProfile,
): CompiledResourceContext | undefined {
  if (selection === undefined) return undefined;
  if (targetProfile !== undefined) {
    const issues = validateMinecraftRuntimeProfile(targetProfile);
    if (issues.length > 0) {
      throw new Error("Invalid Knowledge target runtime profile: " + issues.join("; "));
    }
  }

  const limit = positiveMaximum(maximum);
  const selected = selection.slice(0, limit);
  const items = selected.map((result) => {
    const knowledge = result.resource.class === "KNOWLEDGE"
      ? knowledgeByResourceId?.[result.resource.id]
      : undefined;
    const targetApplicability: KnowledgeTargetApplicability | undefined =
      knowledge === undefined
        ? undefined
        : targetProfile === undefined
          ? {
              state: "not-evaluated",
              reasons: ["No selected Minecraft runtime profile was supplied."],
              missing: ["runtime-profile"],
            }
          : evaluateKnowledgeApplicabilityV2(
              runtimeConstraintFromLegacyKnowledgeApplicability(
                knowledge.applicability,
              ),
              targetProfile,
            );
    return {
      id: result.resource.id,
      class: result.resource.class,
      domain: result.resource.domain,
      ...(result.resource.role === undefined
        ? {}
        : { role: result.resource.role }),
      authority: result.resource.authority,
      path: result.resource.path,
      ...(result.resource.locator === undefined
        ? {}
        : { locator: result.resource.locator }),
      score: result.score.total,
      reasons: [...result.reasons],
      ...(knowledge === undefined ? {} : { knowledge }),
      ...(targetApplicability === undefined ? {} : { targetApplicability }),
    };
  });
  const missingKnowledgeIds = knowledgeByResourceId === undefined
    ? []
    : selected
        .filter((result) =>
          result.resource.class === "KNOWLEDGE" &&
          knowledgeByResourceId[result.resource.id] === undefined
        )
        .map((result) => result.resource.id);

  return {
    items,
    omitted: Math.max(0, selection.length - items.length),
    ...(knowledgeByResourceId === undefined
      ? {}
      : {
          knowledgeContent: {
            status: missingKnowledgeIds.length === 0 ? "COMPLETE" as const : "PARTIAL" as const,
            missingResourceIds: missingKnowledgeIds,
          },
        }),
  };
}

/**
 * Strict, read-only selection of developer-origin reference hints inside the
 * existing Resource Context owner. The JSON companion is loaded explicitly
 * by the operator/caller; no hidden ZIP scan, new registry, game rule,
 * authored Intent edge, issue classification or runtime assertion is created.
 *
 * A matching sourceSignal is a lookup cue, NOT evidence that a mechanic
 * executed or the suggested gameplay relation is true.
 */
export interface DeveloperPracticeReferenceData {
  readonly authority: "REFERENCE";
  readonly usagePolicy: "CONTEXT_HINT_ONLY_NOT_GAME_DESIGN_OR_DEFECT_PROOF";
  readonly sourceSnapshot: { readonly archiveSha256: string };
  readonly sourceFiles: readonly {
    readonly id: string;
    readonly path: string;
    readonly sha256: string;
    readonly auditUsage?: string;
  }[];
  /** Exact source-file identities from developer ZIP; never imports or executable dependencies. */
  readonly codeInventory?: {
    readonly codeModules: readonly {
      readonly path: string;
      readonly sha256: string;
      readonly ownerSkill: string;
      readonly usage: string;
    }[];
    readonly unitTests: readonly {
      readonly path: string;
      readonly sha256: string;
      readonly usage: string;
    }[];
    readonly probePackSources?: readonly {
      readonly path: string;
      readonly sha256: string;
      readonly kind: string;
      readonly ownerSkill?: string;
    }[];
  };
  /** Scope-limited, historical upstream test reports (not map evidence). */
  readonly probeEvidence?: readonly {
    readonly id: string;
    readonly sourcePath: string;
    readonly sourceSha256: string;
    readonly status: string;
    readonly summary: string;
    readonly relatedSkillIds: readonly string[];
    readonly fixtureSources?: readonly {
      readonly path: string;
      readonly sha256: string;
    }[];
  }[];
  readonly patterns: readonly {
    readonly id: string;
    readonly sourceId: string;
    readonly kind: string;
    readonly status: string;
    readonly domains: readonly string[];
    readonly sourceSignals: readonly string[];
    readonly question: string;
    readonly candidateRelations: readonly string[];
    readonly negativeControl: string;
    readonly versionApplicability: string;
    readonly prohibits: string;
    /** Example module source from developer ZIP, not selected-map identity. */
    readonly referenceCode?: {
      readonly path: string;
      readonly sha256: string;
      readonly symbols: readonly string[];
    };
  }[];
}

export interface SelectedArtifactReferenceSignal {
  /** Exact selected-source observation, not a query string or a ZIP claim. */
  readonly evidenceId: string;
  readonly artifactId: string;
  readonly sourcePath: string;
  /** A recognized symbol/semantic cue. Exact token comparison only. */
  readonly signal: string;
}

/**
 * Derive lookup cues ONLY from canonical typed Semantic IR sites in the
 * selected artifact. Never search lexical source text or infer an API
 * receiver/behavior from a filename, alias, or a broad execution trace.
 *
 * Supported cues are intentionally a bounded subset of the developer
 * reference vocabulary. Source signals without a matching typed IR witness
 * abstain until the existing analyzer provides that witness.
 */
export function developerPracticeSignalsFromSemanticIr(
  ir: SemanticIr,
  selectedArtifactId: string,
): readonly SelectedArtifactReferenceSignal[] {
  if (!selectedArtifactId.trim()) return [];
  const cues: SelectedArtifactReferenceSignal[] = [];
  const add = (
    evidenceId: string,
    source: { readonly artifactId: string; readonly relativePath: string },
    signal: string,
  ): void => {
    if (!evidenceId.trim() || source.artifactId !== selectedArtifactId ||
        !source.relativePath.trim()) return;
    cues.push({
      evidenceId,
      artifactId: selectedArtifactId,
      sourcePath: source.relativePath,
      signal,
    });
  };
  const surfaces = new Map(ir.state.surfaces.map(surface =>
    [surface.id, surface.ref] as const));
  for (const operation of ir.state.operations) {
    const surface = surfaces.get(operation.surfaceId);
    if (surface?.kind === "dynamic-property") {
      if (operation.operation === "read") {
        add(operation.id, operation.source, "getDynamicProperty");
      } else if (operation.operation === "write") {
        add(operation.id, operation.source, "setDynamicProperty");
      }
    } else if (surface?.kind === "scoreboard") {
      // Scoreboard is technical state, NOT necessarily an economy or score.
      add(operation.id, operation.source, "scoreboard");
    }
    // Tag operations are already in IR, but current reference patterns lack
    // exact tag operation cues. Do not invent hasTag/addTag from state kind.
  }
  for (const effect of ir.execution.worldEffects ?? []) {
    if (effect.kind === "teleport") {
      // This is a typed/parsing-backed teleport attempt; it does not prove
      // Player.teleport, player arrival or any design requirement.
      add(effect.id, effect.source, "teleport");
    } else if (effect.kind === "audio-feedback" &&
               effect.mechanism === "script-api") {
      // A typed Player/Dimension.playSound source attempt, NOT verified
      // audible delivery, client targeting, win/loss or a game terminal.
      add(effect.id, effect.source, "playSound");
    }
  }
  for (const edge of ir.execution.edges) {
    if (edge.scheduler === "runTimeout" || edge.scheduler === "runInterval") {
      // Scheduler observation comes from the already-authored execution edge.
      add(edge.id, edge.source, "system." + edge.scheduler);
    }
  }
  const unique = new Map(cues.map(cue =>
    [[cue.evidenceId, cue.sourcePath, cue.signal].join("::"), cue] as const));
  return [...unique.values()].sort((a, b) =>
    a.evidenceId.localeCompare(b.evidenceId) ||
    a.signal.localeCompare(b.signal) ||
    a.sourcePath.localeCompare(b.sourcePath));
}

export interface CompiledDeveloperPracticeReferenceContext {
  readonly authority: "REFERENCE";
  readonly status: "INVESTIGATION_HINTS_ONLY";
  readonly selectedArtifactId: string;
  readonly archiveSha256: string;
  readonly items: readonly {
    readonly patternId: string;
    readonly sourceId: string;
    readonly sourcePath: string;
    readonly sourceSha256: string;
    readonly status: "SOURCE_REVIEWED" | "CORROBORATED";
    readonly question: string;
    readonly candidateRelations: readonly string[];
    readonly negativeControl: string;
    readonly versionApplicability: string;
    readonly prohibits: string;
    readonly matchingEvidenceIds: readonly string[];
    readonly matchingSourcePaths: readonly string[];
    readonly matchingSignals: readonly string[];
    readonly referenceCode?: {
      readonly path: string;
      readonly sha256: string;
      readonly symbols: readonly string[];
    };
    /** Relevant companion module source references, never code from the target artifact. */
    readonly codeModules?: readonly {
      readonly path: string;
      readonly sha256: string;
    }[];
    /** Upstream probes are investigation clues only, not bug proof. */
    readonly upstreamProbes?: readonly {
      readonly id: string;
      readonly sourcePath: string;
      readonly status: string;
      readonly summary: string;
      readonly fixtureSources?: readonly { readonly path: string; readonly sha256: string }[];
    }[];
    /** Four installed store module sources are present only in the probe ZIP. */
    readonly probeInstalledModules?: readonly { readonly path: string; readonly sha256: string }[];
  }[];
  readonly omitted: number;
}

/**
 * No observed source identity or no specific interpretation domain means
 * ABSTAIN, not a broad keyword search that floods a selected-map audit.
 * The default maximum of two is a developer-reference context budget, not
 * a threshold for gameplay understanding or defect detection.
 */
export function compileDeveloperPracticeReferenceContext(input: {
  readonly data: DeveloperPracticeReferenceData;
  readonly selectedArtifactId: string;
  /** Canonical source observations, not user-provided lookup labels. */
  readonly semanticIr: SemanticIr;
  readonly domains: readonly string[];
  /** Optional selected-artifact file locators to constrain relevance. */
  readonly sourceLocators?: readonly string[];
  readonly maximum?: number;
}): CompiledDeveloperPracticeReferenceContext | undefined {
  const { data, selectedArtifactId } = input;
  if (data.authority !== "REFERENCE" ||
      data.usagePolicy !== "CONTEXT_HINT_ONLY_NOT_GAME_DESIGN_OR_DEFECT_PROOF" ||
      !/^[a-f0-9]{64}$/.test(data.sourceSnapshot.archiveSha256) ||
      !selectedArtifactId.trim()) return undefined;
  const queryDomains = new Set(input.domains.filter(Boolean));
  const locators = input.sourceLocators?.map(value => value.trim()).filter(Boolean);
  if (input.sourceLocators !== undefined && !locators?.length) return undefined;
  const observed = developerPracticeSignalsFromSemanticIr(
    input.semanticIr, selectedArtifactId,
  ).filter(item => locators === undefined || locators.some(locator =>
    locator === item.sourcePath ||
    locator.startsWith(item.sourcePath + ":") ||
    locator.startsWith(item.sourcePath + "#") ||
    locator.startsWith(item.sourcePath + "@")
  ));
  if (queryDomains.size === 0 || observed.length === 0) return undefined;
  const sourceById = new Map(data.sourceFiles.map(file => [file.id, file]));
  const sorted = (items: readonly string[]) => [...new Set(items)].sort();
  const candidates = data.patterns.flatMap(pattern => {
    if (pattern.status !== "SOURCE_REVIEWED" &&
        pattern.status !== "CORROBORATED") return [];
    if (!pattern.domains.some(domain => queryDomains.has(domain))) return [];
    const source = sourceById.get(pattern.sourceId);
    if (!source || source.auditUsage !== "INTERPRETATION_CANDIDATE" ||
        !/^[a-f0-9]{64}$/.test(source.sha256) ||
        !pattern.question.trim() || !pattern.negativeControl.trim() ||
        !pattern.prohibits.trim()) return [];
    const cue = new Set(pattern.sourceSignals);
    const matches = observed.filter(item => cue.has(item.signal));
    if (matches.length === 0) return [];
    return [{
      patternId: pattern.id,
      sourceId: source.id,
      sourcePath: source.path,
      sourceSha256: source.sha256,
      status: pattern.status as "SOURCE_REVIEWED" | "CORROBORATED",
      question: pattern.question,
      candidateRelations: [...pattern.candidateRelations],
      negativeControl: pattern.negativeControl,
      versionApplicability: pattern.versionApplicability,
      prohibits: pattern.prohibits,
      matchingEvidenceIds: sorted(matches.map(item => item.evidenceId)),
      matchingSourcePaths: sorted(matches.map(item => item.sourcePath)),
      matchingSignals: sorted(matches.map(item => item.signal)),
      ...(data.codeInventory === undefined ? {} : {
        codeModules: data.codeInventory.codeModules
          .filter((item) =>
            item.ownerSkill === source.id &&
            item.usage === "SOURCE_IMPLEMENTATION_REFERENCE" &&
            /^modules\/[a-z0-9-]+\/[a-z0-9-]+\.ts$/.test(item.path) &&
            /^[a-f0-9]{64}$/.test(item.sha256))
          .slice(0, 5)
          .map((item) => ({ path: item.path, sha256: item.sha256 })),
      }),
      ...(data.codeInventory?.probePackSources === undefined ? {} : {
        probeInstalledModules: data.codeInventory.probePackSources
          .filter((item) =>
            item.kind === "PROBE_DATABASE_MODULE" &&
            source.id === "src.bedrock-data-persistence" &&
            /^[a-f0-9]{64}$/.test(item.sha256) &&
            item.ownerSkill === source.id)
          .slice(0, 4)
          .map((item) => ({ path: item.path, sha256: item.sha256 })),
      }),
      ...(data.probeEvidence === undefined ? {} : {
        upstreamProbes: data.probeEvidence
          .filter((item) =>
            item.relatedSkillIds.includes(source.id) &&
            item.status.startsWith("UPSTREAM_REPORTED_") &&
            /^[a-f0-9]{64}$/.test(item.sourceSha256))
          // Favor newer, explicitly scoped developer observations over stale
          // generic early probes; even newer PASS remains only a question.
          .sort((a, b) => b.sourcePath.localeCompare(a.sourcePath))
          .slice(0, 2)
          .map((item) => ({
            id: item.id,
            sourcePath: item.sourcePath,
            status: item.status,
            summary: item.summary,
            ...(item.fixtureSources === undefined ? {} : {
              fixtureSources: item.fixtureSources
                .filter((fixture) => (
                  /^packs\/BP\/scripts\/probe\/probes\/[a-z0-9-]+\.ts$/.test(fixture.path) &&
                  /^[a-f0-9]{64}$/.test(fixture.sha256) &&
                  data.codeInventory?.probePackSources?.some((known) =>
                    known.path === fixture.path && known.sha256 === fixture.sha256)
                ))
                .slice(0, 3)
                .map((fixture) => ({ path: fixture.path, sha256: fixture.sha256 })),
            }),
          })),
      }),
      ...(pattern.referenceCode !== undefined &&
          /^modules\/[a-z0-9-]+\/[a-z0-9-]+\.ts$/.test(pattern.referenceCode.path) &&
          /^[a-f0-9]{64}$/.test(pattern.referenceCode.sha256)
        ? { referenceCode: {
            path: pattern.referenceCode.path,
            sha256: pattern.referenceCode.sha256,
            symbols: sorted(pattern.referenceCode.symbols),
          } }
        : {}),
    }];
  }).sort((a, b) =>
    b.matchingEvidenceIds.length - a.matchingEvidenceIds.length ||
    a.patternId.localeCompare(b.patternId));
  const limit = input.maximum === undefined ? 2 :
    Math.min(2, Math.max(0, Math.floor(input.maximum)));
  return {
    authority: "REFERENCE",
    status: "INVESTIGATION_HINTS_ONLY",
    selectedArtifactId,
    archiveSha256: data.sourceSnapshot.archiveSha256,
    items: candidates.slice(0, limit),
    omitted: Math.max(0, candidates.length - limit),
  };
}

export interface CompiledSectionContextItem {
  readonly id: string;
  readonly documentId: string;
  readonly path: string;
  readonly heading: string;
  readonly anchor: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly score: number;
  readonly reasons: readonly string[];
}

export interface CompiledSectionContext {
  readonly items: readonly CompiledSectionContextItem[];
  readonly omitted: number;
}

export function compileSectionContext(
  selection: readonly SectionRetrievalResult[] | undefined,
  maximum?: number,
): CompiledSectionContext | undefined {
  if (selection === undefined) return undefined;

  const limit = positiveMaximum(maximum);
  const items = selection.slice(0, limit).map((result) => ({
    id: result.section.id,
    documentId: result.section.documentId,
    path: result.section.path,
    heading: result.section.heading,
    anchor: result.section.anchor,
    startLine: result.section.startLine,
    endLine: result.section.endLine,
    score: result.score.total,
    reasons: [...result.reasons],
  }));

  return {
    items,
    omitted: Math.max(0, selection.length - items.length),
  };
}