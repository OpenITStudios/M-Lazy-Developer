// Script API diagnostic cases formerly split by individual symbol type.
// Original suites, cases and assertions preserved; fixture imports below are
// Minecraft source STRINGS, not executable Node imports.
import { describe } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { parseScriptFile } from "../../../scripts/src/index.js";
import { scriptEnumValueDiagnostics } from "../../src/script/script-enum-value-findings.js";
import { scriptEventSymbolDiagnostics } from "../../src/script/script-event-findings.js";
import { scriptEnumLifecycleDiagnostics } from "../../src/script/script-member-findings.js";
import { scriptPropertyLifecycleDiagnostics } from "../../src/script/script-member-findings.js";
import { scriptMethodSymbolDiagnostics } from "../../src/script/script-method-findings.js";
import { scriptPropertyWriteDiagnostics } from "../../src/script/script-property-write-findings.js";
import { scriptReturnContractDiagnostics } from "../../src/script/script-return-contract-findings.js";
import { scriptSignatureDiagnostics } from "../../src/script/script-signature-findings.js";
import { scriptImportedTypeLifecycleDiagnostics } from "../../src/script/script-type-findings.js";

// Original suite engine/analyzers/diagnostics/test/script/script-enum-value-findings.test.ts, blob 4e1e777cb47def3462c4226e220c24871bc6a55a
{
const source = {
  artifactId: "fixture",
  relativePath: "scripts/main.ts",
};

describe("script enum backing-value diagnostics", () => {
  it("flags the 1.x FluidContainer backing value on 2.x", () => {
    const script = parseScriptFile(
      "scripts/main",
      `
        import { BlockComponentTypes } from "@minecraft/server";
        BlockComponentTypes.FluidContainer === "minecraft:fluidContainer";
      `,
      source,
    );

    expect(scriptEnumValueDiagnostics({
      scriptModules: [{
        moduleName: "@minecraft/server",
        version: "2.0.0",
        track: "stable",
      }],
      educationMetadata: false,
    }, [script])).toEqual([
      expect.objectContaining({
        code: "SCRIPT_API_ENUM_VALUE_INCOMPATIBLE",
        severity: "medium",
        data: expect.objectContaining({
          symbol: "BlockComponentTypes.FluidContainer",
          observedLiteral: "minecraft:fluidContainer",
          expectedLiteral: "minecraft:fluid_container",
        }),
      }),
    ]);
  });

  it("accepts the correct backing value on each API line", () => {
    const oldScript = parseScriptFile(
      "scripts/old",
      'import { BlockComponentTypes } from "@minecraft/server"; BlockComponentTypes.FluidContainer === "minecraft:fluidContainer";',
      source,
    );
    const newScript = parseScriptFile(
      "scripts/new",
      'import { BlockComponentTypes } from "@minecraft/server"; BlockComponentTypes.FluidContainer === "minecraft:fluid_container";',
      source,
    );

    expect(scriptEnumValueDiagnostics({
      scriptModules: [{ moduleName: "@minecraft/server", version: "1.19.0", track: "stable" }],
      educationMetadata: false,
    }, [oldScript])).toEqual([]);

    expect(scriptEnumValueDiagnostics({
      scriptModules: [{ moduleName: "@minecraft/server", version: "2.0.0", track: "stable" }],
      educationMetadata: false,
    }, [newScript])).toEqual([]);
  });
});
}

// Original suite engine/analyzers/diagnostics/test/script/script-event-findings.test.ts, blob 595b19a0c2cd4102881b8e91f19c25779bfc0e43
{
const source = {
  artifactId: "fixture",
  relativePath: "scripts/main.ts",
};

describe("script event symbol diagnostics", () => {
  it("flags beta-only event symbols against a stable module dependency", () => {
    const script = parseScriptFile(
      "scripts/main",
      `
        import { world } from "@minecraft/server";
        world.beforeEvents.playerPlaceBlock.subscribe(() => {});
      `,
      source,
    );

    const findings = scriptEventSymbolDiagnostics({
      scriptModules: [{
        moduleName: "@minecraft/server",
        version: "2.10.0",
        track: "stable",
      }],
      educationMetadata: false,
    }, [script]);

    expect(findings).toEqual([
      expect.objectContaining({
        code: "SCRIPT_API_PRERELEASE_SYMBOL",
        data: expect.objectContaining({
          symbol: "world.beforeEvents.playerPlaceBlock",
          declaredVersion: "2.10.0",
        }),
      }),
    ]);
  });

  it("flags a legacy event as deprecated on 1.x and removed on 2.x", () => {
    const script = parseScriptFile(
      "scripts/main",
      `
        import { world } from "@minecraft/server";
        world.afterEvents.itemUseOn.subscribe(() => {});
      `,
      source,
    );

    const deprecated = scriptEventSymbolDiagnostics({
      scriptModules: [{
        moduleName: "@minecraft/server",
        version: "1.19.0",
        track: "stable",
      }],
      educationMetadata: false,
    }, [script]);

    expect(deprecated).toEqual([
      expect.objectContaining({
        code: "SCRIPT_API_DEPRECATED_SYMBOL",
        severity: "minor",
        data: expect.objectContaining({
          symbol: "world.afterEvents.itemUseOn",
          lifecycleState: "deprecated",
          replacement: "world.afterEvents.playerInteractWithBlock",
        }),
      }),
    ]);

    const removed = scriptEventSymbolDiagnostics({
      scriptModules: [{
        moduleName: "@minecraft/server",
        version: "2.0.0",
        track: "stable",
      }],
      educationMetadata: false,
    }, [script]);

    expect(removed).toEqual([
      expect.objectContaining({
        code: "SCRIPT_API_REMOVED_SYMBOL",
        severity: "critical",
        data: expect.objectContaining({
          symbol: "world.afterEvents.itemUseOn",
          lifecycleState: "removed",
          removedIn: "2.0.0",
        }),
      }),
    ]);
  });

  it("does not flag a pre-release symbol when the manifest itself uses beta", () => {
    const script = parseScriptFile(
      "scripts/main",
      `
        import { system } from "@minecraft/server";
        system.beforeEvents.watchdogTerminate.subscribe(() => {});
      `,
      source,
    );

    const findings = scriptEventSymbolDiagnostics({
      scriptModules: [{
        moduleName: "@minecraft/server",
        version: "2.12.0-beta.1.26.60-preview.23",
        track: "beta",
      }],
      educationMetadata: false,
    }, [script]);

    expect(findings).toEqual([]);
  });
});
}

// Original suite engine/analyzers/diagnostics/test/script/script-member-findings.test.ts, blob 166a2ec7301cb2fdfb2eb8a21da781120a24b2f9
{
const source = {
  artifactId: "fixture",
  relativePath: "scripts/main.ts",
};

describe("script property and enum lifecycle diagnostics", () => {
  it("flags PlayerInputPermissions legacy properties as deprecated on 1.x", () => {
    const script = parseScriptFile(
      "scripts/main",
      `
        import { world } from "@minecraft/server";
        const player = world.getAllPlayers()[0];
        player.inputPermissions.cameraEnabled;
      `,
      source,
    );

    const findings = scriptPropertyLifecycleDiagnostics({
      scriptModules: [{
        moduleName: "@minecraft/server",
        version: "1.19.0",
        track: "stable",
      }],
      educationMetadata: false,
    }, [script]);

    expect(findings).toEqual([
      expect.objectContaining({
        code: "SCRIPT_API_DEPRECATED_SYMBOL",
        severity: "minor",
        data: expect.objectContaining({
          symbol: "PlayerInputPermissions.cameraEnabled",
          symbolKind: "property",
          lifecycleState: "deprecated",
          removedIn: "2.0.0",
        }),
      }),
    ]);
  });

  it("flags the same property as removed on 2.x", () => {
    const script = parseScriptFile(
      "scripts/main",
      `
        import { world } from "@minecraft/server";
        const player = world.getAllPlayers()[0];
        player.inputPermissions.movementEnabled;
      `,
      source,
    );

    const findings = scriptPropertyLifecycleDiagnostics({
      scriptModules: [{
        moduleName: "@minecraft/server",
        version: "2.0.0",
        track: "stable",
      }],
      educationMetadata: false,
    }, [script]);

    expect(findings).toEqual([
      expect.objectContaining({
        code: "SCRIPT_API_REMOVED_SYMBOL",
        severity: "critical",
        data: expect.objectContaining({
          symbol: "PlayerInputPermissions.movementEnabled",
          symbolKind: "property",
          lifecycleState: "removed",
        }),
      }),
    ]);
  });

  it("keeps lowercase GameMode active on 1.x but marks it removed on 2.x", () => {
    const script = parseScriptFile(
      "scripts/main",
      `
        import { GameMode as GM } from "@minecraft/server";
        const mode = GM.adventure;
      `,
      source,
    );

    expect(scriptEnumLifecycleDiagnostics({
      scriptModules: [{
        moduleName: "@minecraft/server",
        version: "1.19.0",
        track: "stable",
      }],
      educationMetadata: false,
    }, [script])).toEqual([]);

    const removed = scriptEnumLifecycleDiagnostics({
      scriptModules: [{
        moduleName: "@minecraft/server",
        version: "2.0.0",
        track: "stable",
      }],
      educationMetadata: false,
    }, [script]);

    expect(removed).toEqual([
      expect.objectContaining({
        code: "SCRIPT_API_REMOVED_SYMBOL",
        severity: "critical",
        data: expect.objectContaining({
          symbol: "GameMode.adventure",
          symbolKind: "enum",
          lifecycleState: "removed",
          replacement: "GameMode.Adventure",
        }),
      }),
    ]);
  });

  it("does not flag the replacement uppercase GameMode member", () => {
    const script = parseScriptFile(
      "scripts/main",
      `
        import { GameMode } from "@minecraft/server";
        const mode = GameMode.Adventure;
      `,
      source,
    );

    expect(scriptEnumLifecycleDiagnostics({
      scriptModules: [{
        moduleName: "@minecraft/server",
        version: "2.0.0",
        track: "stable",
      }],
      educationMetadata: false,
    }, [script])).toEqual([]);
  });
});
}

// Original suite engine/analyzers/diagnostics/test/script/script-method-findings.test.ts, blob 65d4a65966f51c629b030d0addb77236bda47529
{
const source = {
  artifactId: "fixture",
  relativePath: "scripts/main.ts",
};

describe("script method symbol diagnostics", () => {
  it("flags a direct method whose stable introduction is newer than the manifest dependency", () => {
    const script = parseScriptFile(
      "scripts/main",
      `
        import { system } from "@minecraft/server";
        system.runInterval(() => {}, 1);
      `,
      source,
    );

    const findings = scriptMethodSymbolDiagnostics({
      scriptModules: [{
        moduleName: "@minecraft/server",
        version: "1.0.0",
        track: "stable",
      }],
      educationMetadata: false,
    }, [script]);

    expect(findings).toEqual([
      expect.objectContaining({
        code: "SCRIPT_API_VERSION_INCOMPATIBLE",
        data: expect.objectContaining({
          symbol: "system.runInterval",
          symbolKind: "method",
          requiredVersion: "1.1.0",
        }),
      }),
    ]);
  });

  it("enforces a version rule reached through bounded receiver inference", () => {
    const script = parseScriptFile(
      "scripts/main",
      `
        import { world } from "@minecraft/server";
        const dimension = world.getDimension("overworld");
        for (const entity of dimension.getEntities()) {
          entity.getTags();
        }
      `,
      source,
    );

    const findings = scriptMethodSymbolDiagnostics({
      scriptModules: [{
        moduleName: "@minecraft/server",
        version: "1.1.0",
        track: "stable",
      }],
      educationMetadata: false,
    }, [script]);

    expect(findings).toEqual([
      expect.objectContaining({
        code: "SCRIPT_API_VERSION_INCOMPATIBLE",
        data: expect.objectContaining({
          symbol: "Entity.getTags",
          symbolKind: "method",
          requiredVersion: "1.2.0",
        }),
      }),
    ]);
  });

  it("flags a legacy method as deprecated on documented 1.x usage", () => {
    const script = parseScriptFile(
      "scripts/main",
      `
        import { world } from "@minecraft/server";
        world.playSound("note.pling", { x: 0, y: 0, z: 0 });
      `,
      source,
    );

    const findings = scriptMethodSymbolDiagnostics({
      scriptModules: [{
        moduleName: "@minecraft/server",
        version: "1.19.0",
        track: "stable",
      }],
      educationMetadata: false,
    }, [script]);

    expect(findings).toEqual([
      expect.objectContaining({
        code: "SCRIPT_API_DEPRECATED_SYMBOL",
        severity: "minor",
        data: expect.objectContaining({
          symbol: "world.playSound",
          lifecycleState: "deprecated",
          removedIn: "2.0.0",
          replacement: "Dimension.playSound",
        }),
      }),
    ]);
  });

  it("flags an inherited legacy Entity method as removed on 2.x", () => {
    const script = parseScriptFile(
      "scripts/main",
      `
        import { world } from "@minecraft/server";
        const player = world.getAllPlayers()[0];
        player.runCommandAsync("say legacy");
      `,
      source,
    );

    const findings = scriptMethodSymbolDiagnostics({
      scriptModules: [{
        moduleName: "@minecraft/server",
        version: "2.0.0",
        track: "stable",
      }],
      educationMetadata: false,
    }, [script]);

    expect(findings).toEqual([
      expect.objectContaining({
        code: "SCRIPT_API_REMOVED_SYMBOL",
        severity: "critical",
        data: expect.objectContaining({
          symbol: "Entity.runCommandAsync",
          lifecycleState: "removed",
          removedIn: "2.0.0",
        }),
      }),
    ]);
  });

  it("does not invent compatibility failures for unregistered methods", () => {
    const script = parseScriptFile(
      "scripts/main",
      `
        import { world } from "@minecraft/server";
        world.someFutureMethod();
      `,
      source,
    );

    const findings = scriptMethodSymbolDiagnostics({
      scriptModules: [{
        moduleName: "@minecraft/server",
        version: "1.0.0",
        track: "stable",
      }],
      educationMetadata: false,
    }, [script]);

    expect(findings).toEqual([]);
  });
});
}

// Original suite engine/analyzers/diagnostics/test/script/script-property-write-findings.test.ts, blob 176d981ead0039f9c2dd8f5718807f46d809f4fc
{
const source = {
  artifactId: "fixture",
  relativePath: "scripts/main.ts",
};

describe("script property mutability diagnostics", () => {
  it("allows component value writes before 2.0.0", () => {
    const script = parseScriptFile(
      "scripts/main",
      `
        import { world } from "@minecraft/server";
        const entity = world.getDimension("overworld").getEntities()[0];
        const scale = entity.getComponent("minecraft:scale");
        scale.value = 2;
      `,
      source,
    );

    expect(scriptPropertyWriteDiagnostics({
      scriptModules: [{
        moduleName: "@minecraft/server",
        version: "1.19.0",
        track: "stable",
      }],
      educationMetadata: false,
    }, [script])).toEqual([]);
  });

  it("flags the same write after the property became read-only", () => {
    const script = parseScriptFile(
      "scripts/main",
      `
        import { world } from "@minecraft/server";
        const entity = world.getDimension("overworld").getEntities()[0];
        const scale = entity.getComponent("minecraft:scale");
        scale.value = 2;
      `,
      source,
    );

    expect(scriptPropertyWriteDiagnostics({
      scriptModules: [{
        moduleName: "@minecraft/server",
        version: "2.0.0",
        track: "stable",
      }],
      educationMetadata: false,
    }, [script])).toEqual([
      expect.objectContaining({
        code: "SCRIPT_API_PROPERTY_WRITE_INCOMPATIBLE",
        severity: "critical",
        data: expect.objectContaining({
          symbol: "EntityScaleComponent.value",
          observedOperation: "assign",
          transitionIn: "2.0.0",
        }),
      }),
    ]);
  });
});
}

// Original suite engine/analyzers/diagnostics/test/script/script-return-contract-findings.test.ts, blob ce0ebe07afd6080b260da3d81bd2cc6e14ff9f32
{
const source = {
  artifactId: "fixture",
  relativePath: "scripts/main.ts",
};

describe("script return-contract diagnostics", () => {
  it("flags direct dereference after Entity.getComponent became optional", () => {
    const script = parseScriptFile(
      "scripts/main",
      `
        import { world } from "@minecraft/server";
        const entity = world.getDimension("overworld").getEntities()[0];
        const value = entity.getComponent("minecraft:health").currentValue;
      `,
      source,
    );

    const findings = scriptReturnContractDiagnostics({
      scriptModules: [{
        moduleName: "@minecraft/server",
        version: "1.18.0",
        track: "stable",
      }],
      educationMetadata: false,
    }, [script]);

    expect(findings).toEqual([
      expect.objectContaining({
        code: "SCRIPT_API_RETURN_CONTRACT_RISK",
        severity: "medium",
        data: expect.objectContaining({
          symbol: "Entity.getComponent",
          transitionIn: "1.18.0",
          observedResultUse: "dereferenced",
        }),
      }),
    ]);
  });

  it("supports explicitly typed Block, ItemStack, and BlockPermutation receivers", () => {
    const script = parseScriptFile(
      "scripts/main",
      `
        import type { Block, ItemStack, BlockPermutation } from "@minecraft/server";

        function inspect(block: Block, item: ItemStack, permutation: BlockPermutation) {
          block.getComponent("minecraft:inventory").foo;
          item.getComponent("minecraft:durability").foo;
          permutation.getState("minecraft:cardinal_direction").toString();
        }
      `,
      source,
    );

    const findings = scriptReturnContractDiagnostics({
      scriptModules: [{
        moduleName: "@minecraft/server",
        version: "1.18.0",
        track: "stable",
      }],
      educationMetadata: false,
    }, [script]);

    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        data: expect.objectContaining({ symbol: "Block.getComponent" }),
      }),
      expect.objectContaining({
        data: expect.objectContaining({ symbol: "ItemStack.getComponent" }),
      }),
      expect.objectContaining({
        data: expect.objectContaining({ symbol: "BlockPermutation.getState" }),
      }),
    ]));
  });

  it("does not flag optional chaining", () => {
    const script = parseScriptFile(
      "scripts/main",
      `
        import { world } from "@minecraft/server";
        const entity = world.getDimension("overworld").getEntities()[0];
        const value = entity.getComponent("minecraft:health")?.currentValue;
      `,
      source,
    );

    expect(scriptReturnContractDiagnostics({
      scriptModules: [{
        moduleName: "@minecraft/server",
        version: "1.18.0",
        track: "stable",
      }],
      educationMetadata: false,
    }, [script])).toEqual([]);
  });

  it("does not guess assigned downstream flow", () => {
    const script = parseScriptFile(
      "scripts/main",
      `
        import { world } from "@minecraft/server";
        const entity = world.getDimension("overworld").getEntities()[0];
        const component = entity.getComponent("minecraft:health");
        if (component) component.currentValue;
      `,
      source,
    );

    expect(scriptReturnContractDiagnostics({
      scriptModules: [{
        moduleName: "@minecraft/server",
        version: "1.18.0",
        track: "stable",
      }],
      educationMetadata: false,
    }, [script])).toEqual([]);
  });
});
}

// Original suite engine/analyzers/diagnostics/test/script/script-signature-findings.test.ts, blob 1497f35ba8c047bc001cbd06d6dce0534c2d9524
{
const source = {
  artifactId: "fixture",
  relativePath: "scripts/main.ts",
};

describe("script signature diagnostics", () => {
  it("flags the legacy four-argument applyKnockback shape on 2.x", () => {
    const script = parseScriptFile(
      "scripts/main",
      `
        import { world } from "@minecraft/server";
        const player = world.getAllPlayers()[0];
        player.applyKnockback(0, 1, 0.5, 0.4);
      `,
      source,
    );

    const findings = scriptSignatureDiagnostics({
      scriptModules: [{
        moduleName: "@minecraft/server",
        version: "2.0.0",
        track: "stable",
      }],
      educationMetadata: false,
    }, [script]);

    expect(findings).toEqual([
      expect.objectContaining({
        code: "SCRIPT_API_SIGNATURE_INCOMPATIBLE",
        severity: "critical",
        data: expect.objectContaining({
          symbol: "Entity.applyKnockback",
          expectedMinArgs: 2,
          expectedMaxArgs: 2,
          observedArgumentCount: 4,
          transitionIn: "2.0.0",
        }),
      }),
    ]);
  });

  it("flags spawnEntity options against a 1.x dependency", () => {
    const script = parseScriptFile(
      "scripts/main",
      `
        import { world } from "@minecraft/server";
        const dimension = world.getDimension("overworld");
        dimension.spawnEntity("minecraft:zombie", { x: 0, y: 0, z: 0 }, {
          initialPersistence: true,
        });
      `,
      source,
    );

    const findings = scriptSignatureDiagnostics({
      scriptModules: [{
        moduleName: "@minecraft/server",
        version: "1.19.0",
        track: "stable",
      }],
      educationMetadata: false,
    }, [script]);

    expect(findings).toEqual([
      expect.objectContaining({
        code: "SCRIPT_API_SIGNATURE_INCOMPATIBLE",
        severity: "medium",
        data: expect.objectContaining({
          symbol: "Dimension.spawnEntity",
          expectedMinArgs: 2,
          expectedMaxArgs: 2,
          observedArgumentCount: 3,
        }),
      }),
    ]);
  });

  it("does not flag the current applyKnockback shape on 2.x", () => {
    const script = parseScriptFile(
      "scripts/main",
      `
        import { world } from "@minecraft/server";
        const player = world.getAllPlayers()[0];
        player.applyKnockback({ x: 0, z: 1 }, 0.4);
      `,
      source,
    );

    expect(scriptSignatureDiagnostics({
      scriptModules: [{
        moduleName: "@minecraft/server",
        version: "2.0.0",
        track: "stable",
      }],
      educationMetadata: false,
    }, [script])).toEqual([]);
  });
});
}

// Original suite engine/analyzers/diagnostics/test/script/script-type-findings.test.ts, blob 6fd1aa0aa50a10880e797bf01510f1fb671726c4
{
const source = {
  artifactId: "fixture",
  relativePath: "scripts/main.ts",
};

describe("script imported type lifecycle diagnostics", () => {
  it("flags deprecated prior types on 1.x", () => {
    const script = parseScriptFile(
      "scripts/main",
      'import type { WorldInitializeBeforeEvent } from "@minecraft/server";',
      source,
    );

    expect(scriptImportedTypeLifecycleDiagnostics({
      scriptModules: [{
        moduleName: "@minecraft/server",
        version: "1.19.0",
        track: "stable",
      }],
      educationMetadata: false,
    }, [script])).toEqual([
      expect.objectContaining({
        code: "SCRIPT_API_DEPRECATED_SYMBOL",
        severity: "minor",
        data: expect.objectContaining({
          symbol: "WorldInitializeBeforeEvent",
          symbolKind: "type",
          typeOnlyImport: true,
        }),
      }),
    ]);
  });

  it("flags legacy camera option types with documented replacements", () => {
    const script = parseScriptFile(
      "scripts/main",
      `
        import type { CameraDefaultOptions, CameraEaseOptions } from "@minecraft/server";
      `,
      source,
    );

    const findings = scriptImportedTypeLifecycleDiagnostics({
      scriptModules: [{
        moduleName: "@minecraft/server",
        version: "2.0.0",
        track: "stable",
      }],
      educationMetadata: false,
    }, [script]);

    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "SCRIPT_API_REMOVED_SYMBOL",
        data: expect.objectContaining({
          symbol: "CameraDefaultOptions",
          replacement: "Camera.setDefaultCamera",
        }),
      }),
      expect.objectContaining({
        code: "SCRIPT_API_REMOVED_SYMBOL",
        data: expect.objectContaining({
          symbol: "CameraEaseOptions",
          replacement: "EaseOptions",
        }),
      }),
    ]));
  });

  it("flags removed namespace-qualified types on 2.x", () => {
    const script = parseScriptFile(
      "scripts/main",
      `
        import * as mc from "@minecraft/server";
        type Init = mc.WorldInitializeAfterEvent;
      `,
      source,
    );

    expect(scriptImportedTypeLifecycleDiagnostics({
      scriptModules: [{
        moduleName: "@minecraft/server",
        version: "2.0.0",
        track: "stable",
      }],
      educationMetadata: false,
    }, [script])).toEqual([
      expect.objectContaining({
        code: "SCRIPT_API_REMOVED_SYMBOL",
        severity: "critical",
        data: expect.objectContaining({
          symbol: "WorldInitializeAfterEvent",
          symbolKind: "type",
        }),
      }),
    ]);
  });
});
}
