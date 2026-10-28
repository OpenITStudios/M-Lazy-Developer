import type { ParsedFunction } from "../../../../analyzers/functions/src/index.js";
import { parseStructureLoadSemantics } from "../../../../analyzers/commands/src/index.js";
import { parseTickingAreaSemantics } from "../../../../analyzers/commands/src/index.js";
import { parseScheduleAreaLoadedSemantics } from "../../../../analyzers/commands/src/index.js";
import {
  placedWorldCoordinate,
  type McStructureFootprint,
  type McStructureSemantics,
  type StructureMirror,
  type StructureRotation,
  type StructureSize,
} from "../../../../adapters/mcstructure/src/index.js";
import {
  analyzeStructureResidue,
  type StructureFootprintCell,
  type StructureResidueReport,
} from "../../../../analyzers/world-db/src/index.js";

function absoluteBlockPosition(
  position: NonNullable<ReturnType<typeof parseStructureLoadSemantics>>["position"],
): { x: number; y: number; z: number } | undefined {
  if (!position) return undefined;
  if (
    position.x.mode !== "absolute" ||
    position.y.mode !== "absolute" ||
    position.z.mode !== "absolute"
  ) return undefined;
  return {
    x: position.x.value,
    y: position.y.value,
    z: position.z.value,
  };
}

function blockToChunk(value: number): number {
  return Math.floor(value / 16);
}

export interface StructureLoadRecord {
  functionId: string;
  line?: number;
  semantics: NonNullable<ReturnType<typeof parseStructureLoadSemantics>>;
}

export interface ChunkLifecycleRecord {
  functionId: string;
  line?: number;
  tickingArea: NonNullable<ReturnType<typeof parseTickingAreaSemantics>>;
}

export interface AreaLoadedScheduleRecord {
  functionId: string;
  line?: number;
  schedule: NonNullable<ReturnType<typeof parseScheduleAreaLoadedSemantics>>;
}

export interface ParsedStructureSummary {
  identifier: string;
  relativePath: string;
  size?: StructureSize;
  semantics: McStructureSemantics;
  footprint?: McStructureFootprint | undefined;
}

export interface StructureTransitionResidueAnalysis {
  functionId: string;
  previousTarget: string;
  nextTarget: string;
  previousLine?: number;
  nextLine?: number;
  status: "analyzed" | "incomplete";
  preservedByVoid: number;
  explicitlyCleared: number;
  replaced: number;
  previousUnknownCells: number;
  nextUnknownCells: number;
  reasons: readonly string[];
  evidence: readonly StructureResidueReport["evidence"][number][];
}

export interface StructureLoadCorrelation {
  load: StructureLoadRecord;
  status: "resolved" | "missing" | "ambiguous";
  candidates: ParsedStructureSummary[];
  findings: Array<
    | "entities-excluded"
    | "blocks-excluded"
    | "probabilistic-command-block-load"
    | "probabilistic-container-load"
    | "runtime-logic-content"
  >;
}

function correlateStructureLoad(
  load: StructureLoadRecord,
  structures: readonly ParsedStructureSummary[],
): StructureLoadCorrelation {
  const candidates = structures.filter(
    (structure) => structure.identifier === load.semantics.name,
  );

  if (candidates.length === 0) {
    return { load, status: "missing", candidates: [], findings: [] };
  }
  if (candidates.length > 1) {
    return { load, status: "ambiguous", candidates, findings: [] };
  }

  const structure = candidates[0]!;
  const findings: StructureLoadCorrelation["findings"] = [];

  if (
    load.semantics.includeEntities === false &&
    structure.semantics.hasEntities
  ) {
    findings.push("entities-excluded");
  }
  if (
    load.semantics.includeBlocks === false &&
    structure.semantics.paletteSize > 0
  ) {
    findings.push("blocks-excluded");
  }

  const probabilistic =
    load.semantics.integrity !== undefined &&
    load.semantics.integrity < 100;

  if (
    probabilistic &&
    structure.semantics.commandBlockPaletteEntries > 0
  ) {
    findings.push("probabilistic-command-block-load");
  }
  if (
    probabilistic &&
    structure.semantics.containerPaletteEntries > 0
  ) {
    findings.push("probabilistic-container-load");
  }
  if (structure.semantics.commandBlockPaletteEntries > 0) {
    findings.push("runtime-logic-content");
  }

  return {
    load,
    status: "resolved",
    candidates,
    findings,
  };
}

interface PlacedResidueInput {
  cells: StructureFootprintCell[];
  unknownCells: number;
  complete: boolean;
  reasons: string[];
}

function residuePlacement(
  correlation: StructureLoadCorrelation,
): PlacedResidueInput {
  const reasons: string[] = [];

  if (
    correlation.status !== "resolved" ||
    correlation.candidates.length !== 1
  ) {
    return {
      cells: [],
      unknownCells: 0,
      complete: false,
      reasons: [
        "Structure target does not resolve to exactly one definition.",
      ],
    };
  }

  const structure = correlation.candidates[0]!;
  const position =
    absoluteBlockPosition(
      correlation.load.semantics.position,
    );

  if (!position) {
    reasons.push(
      "Structure placement position is not fully absolute.",
    );
  }
  if (!structure.size) {
    reasons.push(
      "Structure size is unavailable.",
    );
  }
  if (!structure.footprint) {
    reasons.push(
      "Canonical structure footprint is unavailable.",
    );
  }
  if (
    correlation.load.semantics.includeBlocks === false
  ) {
    reasons.push(
      "Structure load explicitly excludes blocks.",
    );
  }
  if (
    correlation.load.semantics.integrity !== undefined &&
    correlation.load.semantics.integrity < 100
  ) {
    reasons.push(
      "Structure load uses probabilistic block integrity.",
    );
  }

  if (
    !position ||
    !structure.size ||
    !structure.footprint ||
    correlation.load.semantics.includeBlocks === false ||
    (
      correlation.load.semantics.integrity !== undefined &&
      correlation.load.semantics.integrity < 100
    )
  ) {
    return {
      cells: [],
      unknownCells:
        structure.footprint?.unknownPrimaryCells ?? 0,
      complete: false,
      reasons,
    };
  }

  const rotation =
    (correlation.load.semantics.rotation ??
      "0_degrees") as StructureRotation;
  const mirror =
    (correlation.load.semantics.mirror ??
      "none") as StructureMirror;

  const cells =
    structure.footprint.cells.map(
      (cell): StructureFootprintCell => ({
        ...placedWorldCoordinate(
          cell,
          structure.size!,
          position,
          { rotation, mirror },
        ),
        mode: cell.mode,
      }),
    );

  if (
    structure.footprint.unknownPrimaryCells > 0
  ) {
    reasons.push(
      "Structure footprint contains unresolved primary cells.",
    );
  }

  return {
    cells,
    unknownCells:
      structure.footprint.unknownPrimaryCells,
    complete:
      structure.footprint.unknownPrimaryCells === 0,
    reasons,
  };
}

function deriveStructureTransitionResidue(
  correlations:
    readonly StructureLoadCorrelation[],
): StructureTransitionResidueAnalysis[] {
  const byFunction =
    new Map<
      string,
      StructureLoadCorrelation[]
    >();

  for (const correlation of correlations) {
    const bucket =
      byFunction.get(
        correlation.load.functionId,
      ) ?? [];
    bucket.push(correlation);
    byFunction.set(
      correlation.load.functionId,
      bucket,
    );
  }

  const output:
    StructureTransitionResidueAnalysis[] = [];

  for (
    const [functionId, items] of
      byFunction
  ) {
    const ordered = [...items].sort(
      (a, b) =>
        (a.load.line ??
          Number.MAX_SAFE_INTEGER) -
        (b.load.line ??
          Number.MAX_SAFE_INTEGER),
    );

    for (
      let index = 1;
      index < ordered.length;
      index += 1
    ) {
      const previous =
        ordered[index - 1]!;
      const next =
        ordered[index]!;
      const before =
        residuePlacement(previous);
      const after =
        residuePlacement(next);

      if (
        before.cells.length === 0 ||
        after.cells.length === 0
      ) {
        output.push({
          functionId,
          previousTarget:
            previous.load.semantics.name,
          nextTarget:
            next.load.semantics.name,
          ...(previous.load.line === undefined
            ? {}
            : {
                previousLine:
                  previous.load.line,
              }),
          ...(next.load.line === undefined
            ? {}
            : {
                nextLine:
                  next.load.line,
              }),
          status: "incomplete",
          preservedByVoid: 0,
          explicitlyCleared: 0,
          replaced: 0,
          previousUnknownCells:
            before.unknownCells,
          nextUnknownCells:
            after.unknownCells,
          reasons: [
            ...before.reasons,
            ...after.reasons,
          ],
          evidence: [],
        });
        continue;
      }

      const report =
        analyzeStructureResidue(
          before.cells,
          after.cells,
        );

      output.push({
        functionId,
        previousTarget:
          previous.load.semantics.name,
        nextTarget:
          next.load.semantics.name,
        ...(previous.load.line === undefined
          ? {}
          : {
              previousLine:
                previous.load.line,
            }),
        ...(next.load.line === undefined
          ? {}
          : {
              nextLine:
                next.load.line,
            }),
        status:
          before.complete &&
          after.complete
            ? "analyzed"
            : "incomplete",
        preservedByVoid:
          report.preservedByVoid,
        explicitlyCleared:
          report.explicitlyCleared,
        replaced:
          report.replaced,
        previousUnknownCells:
          before.unknownCells,
        nextUnknownCells:
          after.unknownCells,
        reasons: [
          ...before.reasons,
          ...after.reasons,
          ...(report.preservedByVoid > 0
            ? [
                "The next structure preserves one or more previously occupied cells through structure_void; this is residue evidence, not a defect conclusion.",
              ]
            : []),
        ],
        evidence: report.evidence,
      });
    }
  }

  return output.sort(
    (a, b) =>
      a.functionId.localeCompare(
        b.functionId,
      ) ||
      (a.previousLine ?? 0) -
        (b.previousLine ?? 0) ||
      (a.nextLine ?? 0) -
        (b.nextLine ?? 0),
  );
}

export function analyzeStructureAndChunkRuntime(
  functions: readonly ParsedFunction[],
  structures: readonly ParsedStructureSummary[] = [],
) {
  const structureLoads: StructureLoadRecord[] = [];
  const tickingAreas: ChunkLifecycleRecord[] = [];
  const areaLoadedSchedules: AreaLoadedScheduleRecord[] = [];

  for (const fn of functions) {
    for (const command of fn.commands) {
      const line = command.source.range?.lineStart;
      const structure = parseStructureLoadSemantics(command.raw);
      if (structure) {
        structureLoads.push({
          functionId: fn.identifier,
          ...(line ? { line } : {}),
          semantics: structure,
        });
      }

      const tickingArea = parseTickingAreaSemantics(command.raw);
      if (tickingArea) {
        tickingAreas.push({
          functionId: fn.identifier,
          ...(line ? { line } : {}),
          tickingArea,
        });
      }

      const schedule = parseScheduleAreaLoadedSemantics(command.raw);
      if (schedule) {
        areaLoadedSchedules.push({
          functionId: fn.identifier,
          ...(line ? { line } : {}),
          schedule,
        });
      }
    }
  }

  const correlations = structureLoads.map((load) =>
    correlateStructureLoad(load, structures)
  );
  const structureTransitionResidue =
    deriveStructureTransitionResidue(
      correlations,
    );
  const absoluteLoadDestinations = structureLoads.flatMap((load) => {
    const block = absoluteBlockPosition(load.semantics.position);
    if (!block) return [];
    return [{
      target: load.semantics.name,
      chunkX: blockToChunk(block.x),
      chunkZ: blockToChunk(block.z),
      functionId: load.functionId,
      ...(load.line !== undefined ? { line: load.line } : {}),
    }];
  });

  const absoluteStructurePlacements = structureLoads.map((load) => {
    const position = absoluteBlockPosition(load.semantics.position);
    return {
      target: load.semantics.name,
      ...(position === undefined ? {} : { position }),
      options: {
        rotation: load.semantics.rotation ?? "default",
        mirror: load.semantics.mirror ?? "default",
        animationMode:
          load.semantics.animationMode ?? "default",
        animationSeconds:
          load.semantics.animationSeconds ?? null,
        includeEntities:
          load.semantics.includeEntities ?? "default",
        includeBlocks:
          load.semantics.includeBlocks ?? "default",
        waterlogged:
          load.semantics.waterlogged ?? "default",
        integrity:
          load.semantics.integrity ?? "default",
        seed:
          load.semantics.seed ?? "default",
      },
      functionId: load.functionId,
      ...(load.line !== undefined ? { line: load.line } : {}),
    };
  });

  return {
    structureLoads,
    tickingAreas,
    areaLoadedSchedules,
    correlations,
    structureTransitionResidue,
    probabilisticStructureLoads: structureLoads.filter(
      (item) => item.semantics.integrity !== undefined &&
        item.semantics.integrity < 100,
    ).length,
    structureLoadsExcludingEntities: structureLoads.filter(
      (item) => item.semantics.includeEntities === false,
    ).length,
    preloadedTickingAreas: tickingAreas.filter(
      (item) =>
        (item.tickingArea.action === "add-circle" ||
          item.tickingArea.action === "add-rectangle") &&
        item.tickingArea.preload === true,
    ).length,
    unresolvedStructureLoads: correlations.filter(
      (item) => item.status !== "resolved",
    ).length,
    runtimeLogicStructureLoads: correlations.filter(
      (item) => item.findings.includes("runtime-logic-content"),
    ).length,
    absoluteLoadDestinations,
    absoluteStructurePlacements,
    chunkLifecycleEvidence: {
      tickingAreas: tickingAreas.length,
      preloadedTickingAreas: tickingAreas.filter(
        (item) =>
          (item.tickingArea.action === "add-circle" ||
            item.tickingArea.action === "add-rectangle") &&
          item.tickingArea.preload === true,
      ).length,
      areaLoadedSchedules: areaLoadedSchedules.length,
    },
  };
}
