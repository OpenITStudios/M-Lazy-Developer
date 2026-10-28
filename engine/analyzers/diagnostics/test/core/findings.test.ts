import { describe, expect, it } from "vitest";
import { commandEffectDiagnostics } from "../../src/command/command-findings.js";
import { referenceDiagnostics } from "../../src/core/reference-findings.js";
import { analyzeCommand } from "../../../commands/src/index.js";
import { flattenCommandEffects } from "../../../commands/src/index.js";

const source = { artifactId: "art_demo", relativePath: "functions/demo.mcfunction" };

describe("diagnostics", () => {
  it("turns unresolved edges into findings", () => {
    const findings = referenceDiagnostics([
      {
        id: "edge_1",
        from: "function:p:a",
        type: "LOADS_STRUCTURE",
        targetIdentifier: "missing",
        status: "unresolved",
        evidence: { source },
      },
    ]);

    expect(findings[0]?.code).toBe("UNRESOLVED_REFERENCE");
  });

  it("adds source-only route context without changing the unresolved-reference diagnostic", () => {
    const edge = {
      id: "edge_orphan", from: "table:swordman", type: "REFERENCES" as const,
      targetIdentifier: "loot_tables/entities/armor_set_iron.json",
      status: "unresolved" as const, evidence: { source },
    };
    const before = referenceDiagnostics([edge]);
    const after = referenceDiagnostics([edge], new Map([[edge.id, {
      classification: "no-entity-chain-observed" as const,
      proofCeiling: "SOURCE_REFERENCES_ONLY" as const,
    }]]));
    expect(after[0]).toMatchObject({
      code: before[0]?.code,
      severity: before[0]?.severity,
      message: before[0]?.message,
      data: { sourceRoute: { classification: "no-entity-chain-observed",
        proofCeiling: "SOURCE_REFERENCES_ONLY" } },
    });
    expect(before[0]?.data).not.toHaveProperty("sourceRoute");
    // Diagnostic identity includes source-derived metadata by design.
    expect(after[0]?.id).not.toBe(before[0]?.id);
    expect(referenceDiagnostics([edge], new Map([[edge.id, {
      classification: "no-entity-chain-observed", proofCeiling: "SOURCE_REFERENCES_ONLY",
    }]]))[0]?.id).toBe(after[0]?.id);
  });

  it("marks context-dependent relative region mutations", () => {
    const effects = flattenCommandEffects(
      analyzeCommand("execute at @s run fill ~ ~ ~ ~2 ~2 ~2 stone", source),
    );
    const findings = commandEffectDiagnostics(effects);

    expect(findings.some((finding) => finding.code === "SUSPICIOUS_REGION_MUTATION")).toBe(true);
  });
});
