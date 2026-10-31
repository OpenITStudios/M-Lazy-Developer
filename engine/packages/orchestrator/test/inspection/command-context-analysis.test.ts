// Source-preserving same-owner, same-feature, same-lane suite.
import { describe, expect, it } from "vitest";
import { parseScriptFile } from "../../../../analyzers/scripts/src/index.js";
import { analyzeCommandContext, commandContextDiagnostics } from "../../src/inspection/command-context-analysis.js";
import type { KnowledgeCatalog } from "../../../knowledge/src/index.js";
import { analyzeScriptCommandMutationTransactions, scriptCommandMutationRuntimeEvidence } from "../../src/inspection/script-command-transaction-analysis.js";
import { analyzeKnowledgeRuntime } from "../../src/knowledge-runtime-analysis.js";

// Original suite: engine/packages/orchestrator/test/inspection/command-context-analysis.test.ts (blob a2ac42de1838deb1f2fc0ad2add3cd274a67e970)
{
function script(text: string) {
  return parseScriptFile(
    "main",
    text,
    {
      artifactId: "fixture",
      relativePath:
        "scripts/main.ts",
    },
  );
}

describe("command context analysis", () => {
  it("surfaces bare global and tag-only mutation selectors in multi-arena context", () => {
    const result =
      analyzeCommandContext([
        script([
          "dimension.runCommand('tp @a 1 2 3');",
          "dimension.runCommand('tag @a[tag=arena1] add ready');",
        ].join("\n")),
      ], true);

    expect(
      result.bareGlobalMutationCandidates,
    ).toBe(1);
    expect(
      result.tagOnlyMembershipCandidates,
    ).toBe(1);

    expect(
      commandContextDiagnostics(
        result,
      ).map((item) =>
        item.code
      ),
    ).toEqual(
      expect.arrayContaining([
        "COMMAND_SELECTOR_GLOBAL_SCOPE",
        "COMMAND_SELECTOR_STALE_TAG_SCOPE",
      ]),
    );
  });

  it("proves explicit nested execute context for local coordinates", () => {
    const result =
      analyzeCommandContext([
        script(
          "dimension.runCommand('execute at @s positioned 1 2 3 rotated 90 0 anchored eyes run tp @s ^1 ^ ^2');",
        ),
      ], false);

    expect(
      result.tracedExecuteCommands,
    ).toBe(1);
    expect(
      result.relativeContextUnresolved,
    ).toBe(0);
    expect(
      result.assessments[0]
        ?.relativeContext,
    ).toBe("proven");
  });

  it("keeps relative coordinates unresolved without explicit context trace", () => {
    const result =
      analyzeCommandContext([
        script(
          "dimension.runCommand('tp @s ~1 ~ ~2');",
        ),
      ], false);

    expect(
      result.relativeContextUnresolved,
    ).toBe(1);
  });
});


describe("typed script command execution context", () => {
  it("proves Dimension.runCommand as explicit dimension execution", () => {
    const result =
      analyzeCommandContext([
        script([
          "import { world } from '@minecraft/server';",
          "const dimension = world.getDimension('overworld');",
          "dimension.runCommand('setblock 1 2 3 minecraft:stone');",
        ].join("\n")),
      ], false);

    expect(
      result.explicitDimensionCommands,
    ).toBe(1);
    expect(
      result.assessments[0],
    ).toMatchObject({
      executionContext:
        "dimension-explicit",
      receiverType: "Dimension",
      receiverHint: "dimension",
    });
  });

  it("proves entity-bound command execution from typed Entity receiver", () => {
    const result =
      analyzeCommandContext([
        script([
          "function apply(entity: Entity) {",
          "  entity.runCommandAsync('tp @s 1 2 3');",
          "}",
        ].join("\n")),
      ], false);

    expect(
      result.entityBoundCommands,
    ).toBe(1);
    expect(
      result.assessments[0],
    ).toMatchObject({
      executionContext:
        "entity-bound",
      receiverType: "Entity",
      receiverHint: "entity",
    });
  });

  it("keeps untyped command receivers explicit as unknown", () => {
    const result =
      analyzeCommandContext([
        script(
          "dimension.runCommand('setblock 1 2 3 minecraft:stone');",
        ),
      ], false);

    expect(
      result.unknownExecutionContext,
    ).toBe(1);
    expect(
      commandContextDiagnostics(
        result,
      ).some(
        (item) =>
          item.code ===
          "COMMAND_DIMENSION_CONTEXT_UNKNOWN",
      ),
    ).toBe(true);
  });
});
}

// Original suite: engine/packages/orchestrator/test/inspection/script-command-transaction-analysis.test.ts (blob daab8f156c8fb6cdeffb4637c0ee794cf034acda)
{
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
}
