import { describe, expect, it } from "vitest";
import type { KnowledgeCatalog } from "../../../knowledge/src/index.js";
import { parseScriptFile } from "../../../../analyzers/scripts/src/index.js";
import {
  analyzeScriptCommandMutationTransactions,
  scriptCommandMutationRuntimeEvidence,
} from "../../src/inspection/script-command-transaction-analysis.js";
import { analyzeKnowledgeRuntime } from "../../src/knowledge-runtime-analysis.js";

const source = {
  artifactId: "a",
  relativePath: "scripts/main.ts",
};

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
    id: "policy",
    title: "Policy",
    url: "project://knowledge/script-command-transaction-test",
    authority: "project-policy",
    confidence: "designed",
    retrievedDate: "2026-09-24",
  }],
  facts: [],
  relations: [{
    id: "script-command-candidate-needs-verification",
    domain: "world-mutation",
    subject: "script-mutation-dependent-action-candidate",
    kind: "requires",
    object: "script-verification-before-dependent-action",
    classification: "project-policy",
    applicability: { editions: ["bedrock"] },
    sourceIds: ["policy"],
  }],
};

function parse(text: string) {
  return parseScriptFile("scripts/main", text, source);
}

describe("script literal command mutation transactions", () => {
  it("proves a gated teleport when the sentinel is inside structure bounds", () => {
    const script = parse(`
      import { world } from "@minecraft/server";
      const dimension = world.getDimension("overworld");

      dimension.runCommand("structure load demo:arena 0 64 0");
      dimension.runCommand(
        "execute if block 1 64 1 minecraft:gold_block run tp @a 5 65 5"
      );
    `);

    const assessments = analyzeScriptCommandMutationTransactions(
      [script],
      [structure],
    );

    expect(assessments).toEqual([
      expect.objectContaining({
        status: "verified-before-dependent",
      }),
    ]);

    const reasoning = analyzeKnowledgeRuntime(
      catalog,
      { edition: "bedrock" },
      [],
      [],
      scriptCommandMutationRuntimeEvidence(assessments),
      [script],
    );

    expect(reasoning.violations).toBe(0);
    expect(reasoning.evidenceGaps).toBe(0);
  });

  it("keeps a gated teleport unresolved when its sentinel is outside mutation bounds", () => {
    const script = parse(`
      import { world } from "@minecraft/server";
      const dimension = world.getDimension("overworld");

      dimension.runCommand("structure load demo:arena 0 64 0");
      dimension.runCommand(
        "execute if block 100 64 100 minecraft:gold_block run tp @a 5 65 5"
      );
    `);

    const assessments = analyzeScriptCommandMutationTransactions(
      [script],
      [structure],
    );

    expect(assessments[0]?.status).toBe("verification-unresolved");

    const reasoning = analyzeKnowledgeRuntime(
      catalog,
      { edition: "bedrock" },
      [],
      [],
      scriptCommandMutationRuntimeEvidence(assessments),
      [script],
    );

    expect(reasoning.violations).toBe(0);
    expect(reasoning.evidenceGaps).toBe(1);
    expect(reasoning.diagnostics[0]?.severity).toBe("info");
  });

  it("keeps structure verification unresolved when target inventory cannot resolve one structure", () => {
    const script = parse(`
      import { world } from "@minecraft/server";
      const dimension = world.getDimension("overworld");

      dimension.runCommand("structure load demo:missing 0 64 0");
      dimension.runCommand(
        "execute if block 1 64 1 minecraft:gold_block run tp @a 5 65 5"
      );
    `);

    expect(
      analyzeScriptCommandMutationTransactions([script], [structure])[0]?.status,
    ).toBe("verification-unresolved");
  });

  it("follows direct local function calls containing the gated dependent command", () => {
    const script = parse(`
      import { world } from "@minecraft/server";
      const dimension = world.getDimension("overworld");

      function verifyAndMove() {
        dimension.runCommand(
          "execute if block 1 64 1 minecraft:gold_block run tp @a 5 65 5"
        );
      }

      dimension.runCommand("structure load demo:arena 0 64 0");
      verifyAndMove();
    `);

    const assessments = analyzeScriptCommandMutationTransactions(
      [script],
      [structure],
    );

    expect(assessments).toEqual([
      expect.objectContaining({
        executionRegion: "module",
        status: "verified-before-dependent",
        dependentLiteral: expect.objectContaining({
          executionRegion: "function:verifyAndMove",
        }),
      }),
    ]);
  });

  it("treats recursive local calls before the dependent command as an unresolved barrier", () => {
    const script = parse(`
      import { world } from "@minecraft/server";
      const dimension = world.getDimension("overworld");

      function verifyAndMove() {
        recurse();
        dimension.runCommand(
          "execute if block 1 64 1 minecraft:gold_block run tp @a 5 65 5"
        );
      }

      function recurse() {
        verifyAndMove();
      }

      dimension.runCommand("structure load demo:arena 0 64 0");
      verifyAndMove();
    `);

    const assessment = analyzeScriptCommandMutationTransactions(
      [script],
      [structure],
    )[0];

    expect(assessment?.status).toBe("verification-unresolved");
    expect(assessment?.barriers).toEqual([
      expect.objectContaining({
        kind: "recursive-call",
        targetRegion: "function:verifyAndMove",
      }),
    ]);
  });

  it("proves a gated summon after fill mutation", () => {
    const script = parse(`
      import { world } from "@minecraft/server";
      const dimension = world.getDimension("overworld");

      dimension.runCommand("fill 0 64 0 15 70 15 minecraft:stone");
      dimension.runCommand(
        "execute if block 1 64 1 minecraft:stone run summon minecraft:zombie 5 65 5"
      );
    `);

    const assessment = analyzeScriptCommandMutationTransactions([script])[0];
    expect(assessment?.status).toBe("verified-before-dependent");

    const evidence = scriptCommandMutationRuntimeEvidence([assessment!]);
    expect(evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        predicate: "script-verification-before-dependent-action",
        state: "present",
      }),
    ]));
  });

  it("detects summon before a later matching verification", () => {
    const script = parse(`
      import { world } from "@minecraft/server";
      const dimension = world.getDimension("overworld");

      dimension.runCommand("fill 0 64 0 15 70 15 minecraft:stone");
      dimension.runCommand("summon minecraft:zombie 5 65 5");
      dimension.runCommand(
        "execute if block 1 64 1 minecraft:stone run function demo:done"
      );
    `);

    const assessment = analyzeScriptCommandMutationTransactions([script])[0];
    expect(assessment?.status).toBe("dependent-before-verification");
    expect(assessment?.verificationLiteral).toEqual(
      expect.objectContaining({
        command: expect.stringContaining("execute if block"),
      }),
    );

    const reasoning = analyzeKnowledgeRuntime(
      catalog,
      { edition: "bedrock" },
      [],
      [],
      scriptCommandMutationRuntimeEvidence([assessment!]),
      [script],
    );
    expect(reasoning.violations).toBe(1);
    expect(reasoning.evidenceGaps).toBe(0);
  });

  it("supports project-defined function handoff in literal commands", () => {
    const script = parse(`
      import { world } from "@minecraft/server";
      const dimension = world.getDimension("overworld");

      dimension.runCommand("fill 0 64 0 15 70 15 minecraft:stone");
      dimension.runCommand(
        "execute if block 1 64 1 minecraft:stone run function arena/start"
      );
    `);

    const assessments = analyzeScriptCommandMutationTransactions(
      [script],
      [],
      [{
        id: "arena-start",
        kind: "function-call",
        functionTarget: "arena/start",
        purpose: "arena gameplay start",
      }],
    );

    expect(assessments[0]).toEqual(expect.objectContaining({
      status: "verified-before-dependent",
    }));
  });

  it("keeps project-defined scoreboard activation unresolved without a gated check", () => {
    const script = parse(`
      import { world } from "@minecraft/server";
      const dimension = world.getDimension("overworld");

      dimension.runCommand("fill 0 64 0 15 70 15 minecraft:stone");
      dimension.runCommand("scoreboard players set #arena phase 1");
    `);

    const assessments = analyzeScriptCommandMutationTransactions(
      [script],
      [],
      [{
        id: "phase-activation",
        kind: "scoreboard-write",
        objective: "phase",
      }],
    );

    expect(assessments[0]).toEqual(expect.objectContaining({
      status: "verification-unresolved",
    }));
  });

  it("also proves fill/setblock mutation bounds without structure inventory", () => {
    const script = parse(`
      import { world } from "@minecraft/server";
      const dimension = world.getDimension("overworld");

      dimension.runCommand("fill 0 64 0 15 70 15 minecraft:stone");
      dimension.runCommand(
        "execute if block 1 64 1 minecraft:stone run tp @a 5 65 5"
      );
    `);

    expect(
      analyzeScriptCommandMutationTransactions([script])[0]?.status,
    ).toBe("verified-before-dependent");
  });
});
