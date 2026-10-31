// Source-preserving family consolidation: original suites and assertions retained in separate lexical scopes.
import { describe } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import type { KnowledgeCatalog } from "../../../knowledge/src/index.js";
import { parseScriptFile } from "../../../../analyzers/scripts/src/index.js";
import { correlateScriptStructureLoads } from "../../src/inspection/script-structure-correlation.js";
import { scriptStructureRuntimeEvidence } from "../../src/inspection/script-structure-correlation.js";
import { analyzeKnowledgeRuntime } from "../../src/knowledge-runtime-analysis.js";
import { parseMcFunction } from "../../../../analyzers/functions/src/index.js";
import { analyzeStructureAndChunkRuntime } from "../../src/structure-runtime-analysis.js";
import { structureRuntimeEvidence } from "../../src/inspection/structure-runtime-evidence.js";

// Original suite engine/packages/orchestrator/test/inspection/script-structure-correlation.test.ts, blob fab6fd2d4e3f3a1d59e497ac19e2caae1e03d7eb
{






const source = { artifactId: "a", relativePath: "scripts/main.ts" };

const structure = {
  identifier: "demo:arena",
  relativePath: "structures/demo/arena.mcstructure",
  size: { x: 16, y: 8, z: 16 },
  semantics: {
    entityCount: 0,
    hasEntities: false,
    paletteSize: 1,
    hasBlockPositionData: false,
    commandBlockPaletteEntries: 0,
    containerPaletteEntries: 0,
    embeddedCommandBlocks: 0,
    queuedTickPositions: 0,
    educationAllowEntries: 0,
    educationDenyEntries: 0,
    educationBorderEntries: 0,
  },
};

const catalog: KnowledgeCatalog = {
  schemaVersion: 1,
  sources: [{
    id: "official",
    title: "Official",
    url: "https://learn.microsoft.com/example",
    authority: "official",
    confidence: "documented",
    retrievedDate: "2026-09-24",
  }],
  facts: [],
  relations: [{
    id: "placement-needs-target",
    domain: "world-mutation",
    subject: "structure-placement-request",
    kind: "requires",
    object: "structure-target-resolved",
    classification: "derived-rule",
    applicability: { editions: ["bedrock"] },
    sourceIds: ["official"],
    diagnosticSeverity: "critical",
  }],
};

function script() {
  return parseScriptFile(
    "scripts/main",
    `
      import { world } from "@minecraft/server";
      const dimension = world.getDimension("overworld");
      dimension.runCommand("structure load demo:arena 0 64 0");
    `,
    source,
  );
}

describe("script structure load correlation", () => {
  it("satisfies structure target resolution when inventory contains one exact match", () => {
    const parsed = script();
    const correlations = correlateScriptStructureLoads(
      [parsed],
      [structure],
    );
    expect(correlations).toEqual([
      expect.objectContaining({
        target: "demo:arena",
        status: "resolved",
      }),
    ]);

    const result = analyzeKnowledgeRuntime(
      catalog,
      { edition: "bedrock" },
      [],
      [],
      scriptStructureRuntimeEvidence(correlations),
      [parsed],
    );

    expect(result.violations).toBe(0);
    expect(result.evidenceGaps).toBe(0);
  });

  it("turns a definitely missing Script structure target into a critical violation", () => {
    const parsed = script();
    const correlations = correlateScriptStructureLoads([parsed], []);
    expect(correlations[0]?.status).toBe("missing");

    const result = analyzeKnowledgeRuntime(
      catalog,
      { edition: "bedrock" },
      [],
      [],
      scriptStructureRuntimeEvidence(correlations),
      [parsed],
    );

    expect(result.violations).toBe(1);
    expect(result.diagnostics[0]?.severity).toBe("critical");
    expect(result.diagnostics[0]?.source?.relativePath).toBe("scripts/main.ts");
  });
});

}

// Original suite engine/packages/orchestrator/test/inspection/structure-runtime-evidence.test.ts, blob 5b43f8d943a8a3f8245186127d5b7bd4e14163fa
{







const catalog: KnowledgeCatalog = {
  schemaVersion: 1,
  sources: [{
    id: "official",
    title: "Official",
    url: "https://learn.microsoft.com/example",
    authority: "official",
    confidence: "documented",
    retrievedDate: "2026-09-24",
  }],
  facts: [],
  relations: [{
    id: "placement-needs-target",
    domain: "world-mutation",
    subject: "structure-placement-request",
    kind: "requires",
    object: "structure-target-resolved",
    classification: "derived-rule",
    applicability: { editions: ["bedrock"] },
    sourceIds: ["official"],
  }],
};

const semantics = {
  entityCount: 0,
  hasEntities: false,
  paletteSize: 1,
  hasBlockPositionData: false,
  commandBlockPaletteEntries: 0,
  containerPaletteEntries: 0,
  embeddedCommandBlocks: 0,
  queuedTickPositions: 0,
  educationAllowEntries: 0,
  educationDenyEntries: 0,
  educationBorderEntries: 0,
};

function fixture() {
  return parseMcFunction(
    "demo/start",
    "structure load demo:arena 0 64 0",
    { artifactId: "fixture", relativePath: "functions/start.mcfunction" },
  );
}

describe("structure runtime evidence", () => {
  it("satisfies resolved structure target evidence in the same operation scope", () => {
    const fn = fixture();
    const analysis = analyzeStructureAndChunkRuntime([fn], [{
      identifier: "demo:arena",
      relativePath: "structures/demo/arena.mcstructure",
      semantics,
    }]);
    const evidence = structureRuntimeEvidence(
      analysis,
      new Map([[fn.identifier, fn.source]]),
    );
    const result = analyzeKnowledgeRuntime(
      catalog,
      { edition: "bedrock" },
      [],
      [fn],
      evidence,
    );

    expect(result.violations).toBe(0);
    expect(result.evidenceGaps).toBe(0);
  });

  it("turns a missing structure target into an explicit knowledge violation", () => {
    const fn = fixture();
    const analysis = analyzeStructureAndChunkRuntime([fn], []);
    const evidence = structureRuntimeEvidence(
      analysis,
      new Map([[fn.identifier, fn.source]]),
    );
    const result = analyzeKnowledgeRuntime(
      catalog,
      { edition: "bedrock" },
      [],
      [fn],
      evidence,
    );

    expect(result.violations).toBe(1);
    expect(result.diagnostics[0]?.code).toBe("KNOWLEDGE_RELATION_VIOLATION");
    expect(result.diagnostics[0]?.source?.range?.lineStart).toBe(1);
  });
});
}
