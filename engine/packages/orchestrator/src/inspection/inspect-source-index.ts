import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { join, posix } from "node:path";
import {
  FUNCTION_PARSER_REVISION,
  parseMcFunction,
} from "../../../../analyzers/functions/src/index.js";
import {
  SCRIPT_PARSER_REVISION,
  parseScriptFile,
  sourceMapReferenceFromScript,
  bundledSourceSectionsFromScript,
  parseSourceMapV3,
  bindGeneratedPosition,
} from "../../../../analyzers/scripts/src/index.js";
import type { ParsedScriptFile } from "../../../../analyzers/scripts/src/index.js";
import {
  ENTITY_PARSER_REVISION,
  parseEntityDefinition,
} from "../../../../analyzers/entities/src/index.js";
import { parseDialogueDocument } from "../../../../analyzers/dialogue/src/index.js";
import { dialogueDocumentDiagnostics } from "../../../../analyzers/diagnostics/src/index.js";
import { embeddedStructureCommandDiagnostics } from "../../../../analyzers/diagnostics/src/index.js";
import { commandChainDiagnostics } from "../../../../analyzers/diagnostics/src/index.js";
import {
  structureInvariantDiagnostics,
  structureParseFailedDiagnostic,
} from "../../../../analyzers/diagnostics/src/index.js";
import {
  MCSTRUCTURE_PARSER_REVISION,
  type McStructureFootprintSource,
  compactMcStructureFootprintSource,
  extractMcStructureFootprint,
  parseMcStructure,
} from "../../../../adapters/mcstructure/src/index.js";
import { deriveMcStructureSemantics } from "../../../../adapters/mcstructure/src/index.js";
import { extractStructureRuntimeContent } from "../../../../adapters/mcstructure/src/index.js";
import { analyzeCommandBlockChains } from "../../../../adapters/mcstructure/src/index.js";
import { SemanticGraph } from "../../../graph/src/index.js";
import type { SemanticNode } from "../../../graph/src/index.js";
import type { DiagnosticFinding } from "../../../diagnostics/src/index.js";
import type {
  ComponentKind,
  FileInventoryEntry,
} from "../../../project-model/src/index.js";
import { semanticNodeId } from "../../../project-model/src/index.js";
import { analyzeEmbeddedStructureCommands } from "./embedded-structure-commands.js";
import {
  functionIdentifier,
  scriptIdentifier,
  structureIdentifier,
} from "./inspect-identifiers.js";
import {
  assessStructureTransitionResidue,
  type StructureTransitionResidueAssessment,
} from "./structure-transition-residue.js";

export interface InspectionSourceParseFailure {
  relativePath: string;
  kind:
    | "function"
    | "script"
    | "entity"
    | "structure"
    | "dialogue"
    | "translation"
    | "item"
    | "loot_table"
    | "recipe"
    | "block"
    | "spawn_rule"
    | "animation"
    | "animation_controller";
  reason: string;
}

export interface InspectionSourceCoverage {
  /** Every file in the physical selected-map inventory, not just gameplay sources. */
  physicalFiles: number;
  /** Physical paths and relevant source dispositions form a complete census. */
  physicalInventoryAccounted: boolean;
  relevantFiles: number;
  indexedFiles: number;
  parseFailures: readonly InspectionSourceParseFailure[];
  unsupportedRelevantFiles: readonly string[];
  /**
   * Gameplay-sensitive sources that are structurally indexed but still lack
   * domain semantics. Indexed/source-accounted is not equivalent to
   * semantically understood.
   */
  semanticUnderstandingGaps: readonly string[];
  /** One source-accounting disposition for every relevant selected-artifact file. */
  fileOutcomes: readonly {
    relativePath: string;
    status: "indexed" | "semantic-gap" | "parse-failure" | "unsupported";
  }[];
  complete: boolean;
}

export interface InspectionTickFunctionRegistration {
  source: { artifactId: string; relativePath: string };
  functions: readonly string[];
}

/** Read-only recovery aid. A .map file can be supplied by a publisher and
 * must never replace the actual selected archive's generated source proof.
 */
export interface InspectionScriptSourceMapNavigation {
  readonly generatedPath: string;
  readonly mapPath?: string;
  readonly status: "mapped" | "unavailable" | "invalid";
  readonly sites: readonly {
    generatedLocator: string;
    originalLocator: string;
    symbol: string;
  }[];
  readonly omittedSites: number;
  /** Claimed original filenames from generated source comments; NOT
   * validated source maps or reliable original file/line provenance.
   */
  readonly claimedSourceSections?: readonly {
    readonly generatedLocator: string;
    /** 1-based position in the selected generated bundle, not original TS. */
    readonly generatedLine: number;
    readonly claimedOriginalPath: string;
  }[];
  readonly omittedSourceSections?: number;
  readonly reason?: string;
}

export interface InspectionSourceIndex {
  graph: SemanticGraph;
  nodes: SemanticNode[];
  parsedFunctions: Array<{
    node: SemanticNode;
    parsed: ReturnType<typeof parseMcFunction>;
  }>;
  parsedScripts: Array<{
    node: SemanticNode;
    parsed: ParsedScriptFile;
    text?: string;
  }>;
  /** Only present when a selected script explicitly references a source map. */
  scriptSourceMapNavigation: InspectionScriptSourceMapNavigation[];
  parsedEntities: Array<{
    node: SemanticNode;
    parsed: ReturnType<typeof parseEntityDefinition>;
  }>;
  parsedDialogueDocuments: ReturnType<
    typeof parseDialogueDocument
  >[];
  parsedStructureModels: Array<{
    identifier: string;
    node: SemanticNode;
    size?: { x: number; y: number; z: number };
    semantics: ReturnType<
      typeof deriveMcStructureSemantics
    >;
    footprint?: ReturnType<
      typeof extractMcStructureFootprint
    >;
    /** Source-only compact indices; footprint cells are created only when an
     * applicable authored structure transition actually needs geometry.
     */
    footprintSource?: McStructureFootprintSource;
    embeddedCommands: ReturnType<
      typeof analyzeEmbeddedStructureCommands
    >;
    containerItems: ReturnType<
      typeof extractStructureRuntimeContent
    >["containerItems"];
    transitionResidue?:
      StructureTransitionResidueAssessment;
    queuedTickPositions: number;
  }>;
  parsedStructures: number;
  /** Cold, source-local read/decode/semantic cost; not game runtime. */
  structureParseWork?: {
    readonly attemptedFiles: number;
    readonly sourceBytes: number;
    readonly elapsedMs: number;
  };
  tickFunctionRegistrations: InspectionTickFunctionRegistration[];
  diagnostics: DiagnosticFinding[];
  coverage: InspectionSourceCoverage;
}

const OWNED_GAMEPLAY_JSON_DIRECTORIES:
  Readonly<Record<string, ComponentKind>> = {
    animation_controllers: "animation_controller",
    animations: "animation",
    blocks: "block",
    items: "item",
    loot_tables: "loot_table",
    recipes: "recipe",
    spawn_rules: "spawn_rule",
  };

function ownedGameplayJsonKind(
  relativePath: string,
): ComponentKind | undefined {
  const normalized =
    relativePath.replaceAll("\\", "/").toLowerCase();
  if (!normalized.endsWith(".json")) return undefined;

  const segments = normalized.split("/");
  const behaviorPackScoped =
    segments.includes("behavior_packs") ||
    segments.includes("behavior_pack");
  const resourcePackScoped =
    segments.includes("resource_packs") ||
    segments.includes("resource_pack");
  if (resourcePackScoped && !behaviorPackScoped) return undefined;

  for (const segment of segments) {
    const kind =
      OWNED_GAMEPLAY_JSON_DIRECTORIES[segment];
    if (kind === undefined) continue;
    if (
      (
        segment === "animation_controllers" ||
        segment === "animations" ||
        segment === "blocks" ||
        segment === "items"
      ) &&
      !behaviorPackScoped
    ) {
      continue;
    }
    return kind;
  }
  return undefined;
}

function gameplayJsonIdentifier(
  relativePath: string,
): string {
  return relativePath
    .replaceAll("\\", "/")
    .replace(/\.json$/i, "");
}

const GAMEPLAY_STRONG_JSON_DIRECTORIES = new Set([
  "features",
  "feature_rules",
  "loot_tables",
  "recipes",
  "spawn_rules",
  "trading",
]);

const BEHAVIOR_PACK_GAMEPLAY_JSON_DIRECTORIES = new Set([
  "animation_controllers",
  "animations",
  "blocks",
  "items",
]);

function isGameplaySensitiveUnownedSource(
  relativePath: string,
): boolean {
  const normalized =
    relativePath.replaceAll("\\", "/").toLowerCase();
  if (!normalized.endsWith(".json")) return false;

  const segments = normalized.split("/");
  if (ownedGameplayJsonKind(relativePath) !== undefined) {
    return false;
  }

  const resourcePackScoped =
    segments.includes("resource_packs") ||
    segments.includes("resource_pack");
  const behaviorPackScoped =
    segments.includes("behavior_packs") ||
    segments.includes("behavior_pack");
  if (resourcePackScoped && !behaviorPackScoped) return false;

  if (
    segments.some((segment) =>
      GAMEPLAY_STRONG_JSON_DIRECTORIES.has(segment)
    )
  ) {
    return true;
  }

  if (!behaviorPackScoped) return false;
  if (
    segments.some((segment) =>
      BEHAVIOR_PACK_GAMEPLAY_JSON_DIRECTORIES.has(segment)
    )
  ) return true;

  // Unknown JSON families in a behavior pack must not disappear solely
  // because their directory has never been registered as a mechanic.
  // Keep manifests, script tooling, and localization out of gameplay evidence.
  const packRootIndex = segments.findIndex((segment) =>
    segment === "behavior_packs" || segment === "behavior_pack"
  );
  const withinPack = segments.slice(packRootIndex + 2);
  return withinPack.length >= 2 &&
    !["scripts", "texts", "config"].includes(withinPack[0]!) &&
    withinPack[withinPack.length - 1] !== "manifest.json";
}

export async function indexInspectionSources(
  root: string,
  artifactId: string,
  files: readonly FileInventoryEntry[],
): Promise<InspectionSourceIndex> {
  const graph = new SemanticGraph();
  const nodes: SemanticNode[] = [];
  const parsedFunctions: InspectionSourceIndex["parsedFunctions"] = [];
  const parsedScripts: InspectionSourceIndex["parsedScripts"] = [];
  const scriptSourceMapNavigation: InspectionScriptSourceMapNavigation[] = [];
  const physicalByPath = new Map(files.map(item =>
    [item.relativePath.replaceAll("\\", "/"), item] as const));
  const parsedEntities: InspectionSourceIndex["parsedEntities"] = [];
  const parsedDialogueDocuments:
    InspectionSourceIndex["parsedDialogueDocuments"] = [];
  const parsedStructureModels:
    InspectionSourceIndex["parsedStructureModels"] = [];
  const diagnostics: DiagnosticFinding[] = [];
  const parseFailures: InspectionSourceParseFailure[] = [];
  const unsupportedRelevantFiles: string[] = [];
  const semanticUnderstandingGaps: string[] = [];
  let relevantFiles = 0;
  const relevantPaths: string[] = [];
  let indexedFiles = 0;
  let parsedStructures = 0;
  const structureParseWork = {
    attemptedFiles: 0, sourceBytes: 0, elapsedMs: 0,
  };
  const tickFunctionRegistrations: InspectionTickFunctionRegistration[] = [];

  for (const file of files) {
    const fnId = functionIdentifier(file.relativePath);
    if (fnId) {
      relevantFiles += 1;
      relevantPaths.push(file.relativePath);
      const node: SemanticNode = {
        id: semanticNodeId("function", "project", file.relativePath),
        identity: {
          kind: "function",
          scope: "project",
          identifier: fnId,
        },
        kind: "function",
        identifier: fnId,
        ...(file.contentHash === undefined
          ? {}
          : { contentHash: file.contentHash }),
        parserVersion:
          FUNCTION_PARSER_REVISION,
        source: {
          artifactId,
          relativePath: file.relativePath,
        },
      };
      try {
        const content = await readFile(join(root, file.relativePath), "utf8");
        const parsed = parseMcFunction(fnId, content, node.source);
        graph.addNode(node);
        nodes.push(node);
        parsedFunctions.push({ node, parsed });
        indexedFiles += 1;
      } catch (error) {
        parseFailures.push({ relativePath: file.relativePath, kind: "function",
          reason: error instanceof Error ? error.message : String(error) });
      }
      continue;
    }

    const scriptId = scriptIdentifier(file.relativePath);
    if (scriptId) {
      relevantFiles += 1;
      relevantPaths.push(file.relativePath);
      const node: SemanticNode = {
        id: semanticNodeId(
          "script_file",
          "project",
          file.relativePath,
        ),
        identity: {
          kind: "script_file",
          scope: "project",
          identifier: scriptId,
        },
        kind: "script_file",
        identifier: scriptId,
        ...(file.contentHash === undefined
          ? {}
          : { contentHash: file.contentHash }),
        parserVersion:
          SCRIPT_PARSER_REVISION,
        source: {
          artifactId,
          relativePath: file.relativePath,
        },
      };
      try {
        const text = await readFile(join(root, file.relativePath), "utf8");
        const parsed = parseScriptFile(scriptId, text, node.source);
        graph.addNode(node);
        nodes.push(node);
        parsedScripts.push({ node, text, parsed });
        indexedFiles += 1;

        // This does not need a second AST pass on bundled/minified scripts.
        const sourceMapReference = sourceMapReferenceFromScript(text);
        const claimedSections = bundledSourceSectionsFromScript(text);
        const record: InspectionScriptSourceMapNavigation = {
          generatedPath: file.relativePath,
          status: "unavailable",
          sites: [],
          omittedSites: 0,
          ...(claimedSections.hints.length === 0 ? {} : {
            claimedSourceSections: claimedSections.hints.map(hint => ({
              generatedLocator: file.relativePath + ":" + hint.generatedLine,
              generatedLine: hint.generatedLine,
              claimedOriginalPath: hint.claimedOriginalPath,
            })),
            omittedSourceSections: claimedSections.omitted,
          }),
        };
        if (sourceMapReference !== undefined) {
          // No network, inline data URLs, arbitrary paths or filesystem
          // traversal. The actual .map MUST be inventoried in this archive.
          const validReference = /^[a-zA-Z0-9_.%/ -]+\.map$/.test(
            sourceMapReference,
          ) && !sourceMapReference.includes("\\") &&
            !sourceMapReference.startsWith("/");
          const mapPath = validReference
            ? posix.normalize(posix.join(
                posix.dirname(file.relativePath), sourceMapReference,
              ))
            : undefined;
          const packSegments = file.relativePath.split("/");
          const scriptsIndex = packSegments.lastIndexOf("scripts");
          const packRoot = scriptsIndex < 0 ? "" :
            packSegments.slice(0, scriptsIndex).join("/");
          const withinPack = mapPath !== undefined &&
            !mapPath.startsWith("../") && mapPath !== ".." &&
            (packRoot === "" || mapPath.startsWith(packRoot + "/"));
          const mapInventory = withinPack && mapPath !== undefined
            ? physicalByPath.get(mapPath) : undefined;
          if (!mapInventory || mapPath === undefined ||
              mapInventory.size > 2_000_000) {
            scriptSourceMapNavigation.push({
              ...record,
              reason: "Referenced map is untrusted, absent, outside its pack or exceeds the 2 MB review budget.",
            });
          } else {
            try {
              const rawMap = await readFile(join(root, mapPath), "utf8");
              const map = parseSourceMapV3(rawMap);
              if (map.file !== undefined &&
                  posix.basename(map.file) !== posix.basename(file.relativePath)) {
                throw new Error("Source map declares a different generated script.");
              }
              const candidates = [
                ...parsed.methodCalls.map(call => ({
                  source: call.source, symbol: call.symbol,
                })),
                ...parsed.propertyAccesses.map(access => ({
                  source: access.source, symbol: access.symbol,
                })),
              ].filter(candidate =>
                candidate.source.range?.lineStart !== undefined &&
                candidate.source.range.columnStart !== undefined)
                .sort((a, b) =>
                  a.source.range!.lineStart! - b.source.range!.lineStart! ||
                  a.source.range!.columnStart! - b.source.range!.columnStart! ||
                  a.symbol.localeCompare(b.symbol));
              const unique = new Map(candidates.map(candidate =>
                [[candidate.source.range!.lineStart,
                  candidate.source.range!.columnStart,
                  candidate.symbol].join(":"), candidate] as const));
              const bounded = [...unique.values()].slice(0, 16);
              const sites = bounded.flatMap(candidate => {
                const generatedLine = candidate.source.range!.lineStart!;
                const generatedColumn = candidate.source.range!.columnStart! - 1;
                const bound = bindGeneratedPosition(
                  map, generatedLine, generatedColumn,
                );
                if (bound.status !== "resolved" ||
                    !bound.source || !bound.originalLine ||
                    bound.originalColumn === undefined) return [];
                return [{
                  generatedLocator: file.relativePath + ":" +
                    generatedLine + ":" + (generatedColumn + 1),
                  originalLocator: bound.source.slice(0, 250) + ":" +
                    bound.originalLine + ":" + (bound.originalColumn + 1),
                  symbol: candidate.symbol,
                }];
              });
              scriptSourceMapNavigation.push({
                generatedPath: file.relativePath,
                mapPath,
                status: sites.length > 0 ? "mapped" : "unavailable",
                sites,
                omittedSites: Math.max(0, unique.size - bounded.length),
                ...(sites.length ? {} : {
                  reason: "No bounded typed API sites had resolvable original positions.",
                }),
              });
            } catch (error) {
              scriptSourceMapNavigation.push({
                ...record, mapPath, status: "invalid",
                reason: error instanceof Error ? error.message.slice(0, 180) :
                  "Invalid source-map data.",
              });
            }
          }
        } else if (claimedSections.hints.length > 0) {
          scriptSourceMapNavigation.push({
            ...record,
            reason: "No source-map reference. Generated section comments are unverified filename hints; original source lines are unknown.",
          });
        }
      } catch (error) {
        parseFailures.push({ relativePath: file.relativePath, kind: "script",
          reason: error instanceof Error ? error.message : String(error) });
      }
      continue;
    }

    const normalizedPath =
      "/" + file.relativePath.replaceAll("\\", "/");

    // Vanilla tick registration is an authored function execution root.
    // Index exact non-empty schedules rather than claiming their
    // gameplay meaning has been understood.
    if (/\/functions\/tick\.json$/i.test(normalizedPath)) {
      relevantFiles += 1;
      relevantPaths.push(file.relativePath);
      try {
        const raw = JSON.parse(
          await readFile(join(root, file.relativePath), "utf8"),
        ) as unknown;
        const values =
          raw !== null && typeof raw === "object" && !Array.isArray(raw)
            ? (raw as { values?: unknown }).values
            : undefined;
        if (!Array.isArray(values) ||
            !values.every((value) =>
              typeof value === "string" && value.trim().length > 0
            )) {
          parseFailures.push({
            relativePath: file.relativePath,
            kind: "function",
            reason: "tick.json requires a values array of non-empty function identifiers.",
          });
        } else {
          tickFunctionRegistrations.push({
            source: { artifactId, relativePath: file.relativePath },
            functions: [...values as string[]],
          });
          indexedFiles += 1;
        }
      } catch (error) {
        parseFailures.push({
          relativePath: file.relativePath,
          kind: "function",
          reason: error instanceof Error ? error.message : String(error),
        });
      }
      continue;
    }

    const isTranslation =
      /\/texts\/[^/]+\.lang$/i.test(
        normalizedPath,
      );
    if (isTranslation) {
      relevantFiles += 1;
      relevantPaths.push(file.relativePath);
      try {
        await readFile(
          join(root, file.relativePath),
          "utf8",
        );
        indexedFiles += 1;
      } catch (error) {
        parseFailures.push({
          relativePath: file.relativePath,
          kind: "translation",
          reason:
            error instanceof Error
              ? error.message
              : String(error),
        });
      }
      continue;
    }

    // Bedrock loot tables may live in loot_tables/entities/. Only an
    // actual entities/ definition root is eligible for the entity parser.
    // Preserve standalone test/project roots as well as packed sources.
    const isEntityJson =
      /^(?:\/entities\/|\/(?:behavior_packs|behavior_pack)\/[^/]+\/entities\/).+\.json$/i
        .test(normalizedPath);

    if (isEntityJson) {
      relevantFiles += 1;
      relevantPaths.push(file.relativePath);
      try {
        const raw = JSON.parse(
          await readFile(
            join(root, file.relativePath),
            "utf8",
          ),
        ) as unknown;
        const parsed = parseEntityDefinition(raw, {
          artifactId,
          relativePath: file.relativePath,
        });

        if (parsed.identifier) {
          const node: SemanticNode = {
            id: semanticNodeId(
              "entity",
              "project",
              parsed.identifier,
            ),
            identity: {
              kind: "entity",
              scope: "project",
              identifier: parsed.identifier,
            },
            kind: "entity",
            identifier: parsed.identifier,
            ...(file.contentHash === undefined
              ? {}
              : { contentHash: file.contentHash }),
            parserVersion:
              ENTITY_PARSER_REVISION,
            source: parsed.source,
          };
          graph.addNode(node);
          nodes.push(node);
          parsedEntities.push({ node, parsed });
          indexedFiles += 1;
        } else {
          parseFailures.push({
            relativePath: file.relativePath,
            kind: "entity",
            reason: "Entity definition has no identifier.",
          });
        }
      } catch (error) {
        parseFailures.push({
          relativePath: file.relativePath,
          kind: "entity",
          reason:
            error instanceof Error
              ? error.message
              : String(error),
        });
      }
      continue;
    }

    const isDialogueJson =
      /\/(?:dialogue|dialogues)\/[^/]+\.json$/i.test(
        normalizedPath,
      );

    if (
      isDialogueJson ||
      normalizedPath.endsWith(".json")
    ) {
      try {
        const raw = JSON.parse(
          await readFile(
            join(root, file.relativePath),
            "utf8",
          ),
        ) as unknown;
        const dialogue = parseDialogueDocument(raw, {
          artifactId,
          relativePath: file.relativePath,
        });

        if (dialogue) {
          if (isDialogueJson) {
            relevantFiles += 1;
      relevantPaths.push(file.relativePath);
            indexedFiles += 1;
          }
          parsedDialogueDocuments.push(dialogue);
          diagnostics.push(
            ...dialogueDocumentDiagnostics(dialogue),
          );
          continue;
        }

        if (isDialogueJson) {
          relevantFiles += 1;
      relevantPaths.push(file.relativePath);
          parseFailures.push({
            relativePath: file.relativePath,
            kind: "dialogue",
            reason:
              "Dialogue JSON does not contain a valid dialogue document.",
          });
          continue;
        }
      } catch (error) {
        if (isDialogueJson) {
          relevantFiles += 1;
      relevantPaths.push(file.relativePath);
          parseFailures.push({
            relativePath: file.relativePath,
            kind: "dialogue",
            reason:
              error instanceof Error
                ? error.message
                : String(error),
          });
          continue;
        }
        // Generic malformed JSON handling remains outside dialogue diagnostics.
      }
    }

    const ownedJsonKind =
      ownedGameplayJsonKind(file.relativePath);
    if (ownedJsonKind !== undefined) {
      relevantFiles += 1;
      relevantPaths.push(file.relativePath);
      try {
        const raw = JSON.parse(
          await readFile(
            join(root, file.relativePath),
            "utf8",
          ),
        ) as unknown;
        const identifier =
          gameplayJsonIdentifier(
            file.relativePath,
          );
        const node: SemanticNode = {
          id: semanticNodeId(
            ownedJsonKind,
            "project",
            identifier,
          ),
          identity: {
            kind: ownedJsonKind,
            scope: "project",
            identifier,
          },
          kind: ownedJsonKind,
          identifier,
          ...(file.contentHash === undefined
            ? {}
            : { contentHash: file.contentHash }),
          source: {
            artifactId,
            relativePath: file.relativePath,
          },
          data: raw,
        };
        graph.addNode(node);
        nodes.push(node);
        indexedFiles += 1;
        // Raw JSON ownership closes source accounting only. Until a
        // domain-specific semantic parser/analysis consumes this definition,
        // gameplay meaning remains an explicit Detection Gap.
        semanticUnderstandingGaps.push(
          file.relativePath,
        );
      } catch (error) {
        parseFailures.push({
          relativePath: file.relativePath,
          kind: ownedJsonKind as
            | "item"
            | "loot_table"
            | "recipe"
            | "block"
            | "spawn_rule"
            | "animation"
            | "animation_controller",
          reason:
            error instanceof Error
              ? error.message
              : String(error),
        });
      }
      continue;
    }

    const structureId =
      structureIdentifier(file.relativePath);
    if (!structureId) {
      if (
        isGameplaySensitiveUnownedSource(
          file.relativePath,
        )
      ) {
        relevantFiles += 1;
      relevantPaths.push(file.relativePath);
        unsupportedRelevantFiles.push(
          file.relativePath,
        );
      }
      continue;
    }

    relevantFiles += 1;
      relevantPaths.push(file.relativePath);

    const node: SemanticNode = {
      id: semanticNodeId(
        "structure",
        "project",
        structureId,
      ),
      identity: {
        kind: "structure",
        scope: "project",
        identifier: structureId,
      },
      kind: "structure",
      identifier: structureId,
      ...(file.contentHash === undefined
        ? {}
        : { contentHash: file.contentHash }),
      parserVersion:
        MCSTRUCTURE_PARSER_REVISION,
      source: {
        artifactId,
        relativePath: file.relativePath,
      },
    };
    // Include failed attempts and all structure-local semantics/diagnostics.
    // Do not change parser ownership, error handling or physical evidence.
    const structureStartedAt = performance.now();
    structureParseWork.attemptedFiles += 1;
    try {
      // Buffer is already Uint8Array; preserve zero extra transport copies.
      const structureBytes = await readFile(join(root, file.relativePath));
      structureParseWork.sourceBytes += structureBytes.byteLength;
      const structure = await parseMcStructure(
        structureBytes,
        file.relativePath,
        // This source-only scope immediately makes a separately owned typed
        // footprint projection. No caller mutates/retains the raw NBT index
        // layers, so a redundant array copy is unnecessary here.
        { readOnlySharedBlockIndices: true },
      );

      const runtimeContent =
        extractStructureRuntimeContent(structure);
      const embeddedCommands =
        analyzeEmbeddedStructureCommands(
          runtimeContent.commandBlocks,
          node.source,
        );

      // Preserve exact normalized indices, but do not expand every parsed structure
      // into millions of cell objects before any source-owned load requires
      // residue or collision analysis. Invariant diagnostics still run below.
      const footprintSource = compactMcStructureFootprintSource(structure);

      parsedStructureModels.push({
        identifier: structureId,
        node,
        ...(structure.size
          ? { size: structure.size }
          : {}),
        semantics: deriveMcStructureSemantics(structure, runtimeContent),
        footprintSource,
        embeddedCommands,
        containerItems:
          runtimeContent.containerItems,
        transitionResidue:
          assessStructureTransitionResidue(
            structure,
          ),
        queuedTickPositions:
          runtimeContent.queuedTickPositions,
      });

      diagnostics.push(
        ...embeddedStructureCommandDiagnostics(
          embeddedCommands.map((item) => ({
            flatIndex: item.block.flatIndex,
            command: item.block.command,
            ...(item.block.auto !== undefined
              ? { auto: item.block.auto }
              : {}),
            ...(item.block.tickDelay !== undefined
              ? { tickDelay: item.block.tickDelay }
              : {}),
            unknownEffects: item.unknownEffects,
          })),
          node.source,
        ),
      );

      diagnostics.push(
        ...commandChainDiagnostics(
          analyzeCommandBlockChains(
            runtimeContent.commandBlocks,
          ).issues,
          node.source,
        ),
      );
      diagnostics.push(
        ...structureInvariantDiagnostics(
          structure,
          node.source,
        ),
      );
      graph.addNode(node);
      nodes.push(node);
      parsedStructures += 1;
      indexedFiles += 1;
    } catch (error) {
      parseFailures.push({
        relativePath: file.relativePath,
        kind: "structure",
        reason:
          error instanceof Error
            ? error.message
            : String(error),
      });
      diagnostics.push(
        structureParseFailedDiagnostic(
          node.source,
          error,
        ),
      );
    } finally {
      structureParseWork.elapsedMs += Math.max(
        0, performance.now() - structureStartedAt,
      );
    }
  }

  const failedPaths = new Set(parseFailures.map(item => item.relativePath));
  const unsupportedPaths = new Set(unsupportedRelevantFiles);
  const semanticGapPaths = new Set(semanticUnderstandingGaps);
  const fileOutcomes = relevantPaths.map(relativePath => ({
    relativePath,
    status: failedPaths.has(relativePath) ? "parse-failure" as const
      : unsupportedPaths.has(relativePath) ? "unsupported" as const
      : semanticGapPaths.has(relativePath) ? "semantic-gap" as const
      : "indexed" as const,
  })).sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  // Recognize every physical asset before gameplay interpretation. Parsers
  // must account for all gameplay-sensitive files; unrelated/unknown assets
  // remain in the physical inventory rather than vanishing from accounting.
  const physicalPaths = files.map(file => file.relativePath);
  const physicalPathSet = new Set(physicalPaths);
  const outcomePaths = fileOutcomes.map(item => item.relativePath);
  const physicalInventoryAccounted =
    physicalPaths.length > 0 &&
    physicalPathSet.size === physicalPaths.length &&
    physicalPaths.every(path => path.length > 0) &&
    new Set(outcomePaths).size === outcomePaths.length &&
    fileOutcomes.length === relevantFiles &&
    fileOutcomes.every(item => physicalPathSet.has(item.relativePath)) &&
    fileOutcomes.filter(item =>
      item.status === "indexed" || item.status === "semantic-gap").length === indexedFiles &&
    fileOutcomes.filter(item => item.status === "parse-failure").length === parseFailures.length &&
    fileOutcomes.filter(item => item.status === "unsupported").length === unsupportedRelevantFiles.length &&
    relevantFiles === indexedFiles + parseFailures.length + unsupportedRelevantFiles.length;

  return {
    graph,
    nodes,
    parsedFunctions,
    parsedScripts,
    scriptSourceMapNavigation,
    parsedEntities,
    parsedDialogueDocuments,
    parsedStructureModels,
    parsedStructures,
    ...(structureParseWork.attemptedFiles === 0 ? {} : { structureParseWork }),
    tickFunctionRegistrations,
    diagnostics,
    coverage: {
      physicalFiles: physicalPaths.length,
      physicalInventoryAccounted,
      relevantFiles,
      indexedFiles,
      parseFailures: [...parseFailures]
        .sort((a, b) =>
          a.relativePath.localeCompare(b.relativePath) ||
          a.kind.localeCompare(b.kind)
        ),
      unsupportedRelevantFiles:
        [...unsupportedRelevantFiles].sort(),
      semanticUnderstandingGaps:
        [...semanticUnderstandingGaps].sort(),
      fileOutcomes,
      complete:
        physicalInventoryAccounted &&
        parseFailures.length === 0 &&
        unsupportedRelevantFiles.length === 0 &&
        indexedFiles === relevantFiles,
    },
  };
}
