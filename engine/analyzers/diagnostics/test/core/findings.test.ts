// Bounded owner-local source test family; original assertions retained.
import { describe, expect, it } from "vitest";
import { commandEffectDiagnostics } from "../../src/command/command-findings.js";
import { referenceDiagnostics } from "../../src/core/reference-findings.js";
import { analyzeCommand, flattenCommandEffects } from "../../../commands/src/index.js";
import { packIdentityDriftDiagnostics, releaseIdentityConsistencyDiagnostics } from "../../src/core/identity-findings.js";

// Original source suite: engine/analyzers/diagnostics/test/core/findings.test.ts (Git blob 1083fd2ede8371e34f847b86a87441515e4a10c5)
{


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
}

// Original source suite: engine/analyzers/diagnostics/test/core/identity-findings.test.ts (Git blob 4d30a4de7d7da3543d50fbb8462de38cb87a223c)
{


describe("identity findings", () => {
  it("reports persisted pack ownership that no longer has a current manifest identity", () => {
    const findings = packIdentityDriftDiagnostics(
      ["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"],
      [
        {
          identity: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          namespace: "mivubi:score",
        },
      ],
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]?.code).toBe("PACK_IDENTITY_DRIFT");
  });

  it("keeps release identity distinct from engine and API versions", () => {
    const findings = releaseIdentityConsistencyDiagnostics([
      { component: "world", releaseVersion: "1.0.4" },
      { component: "behavior-pack", releaseVersion: "1.0.3" },
    ]);

    expect(findings).toHaveLength(2);
    expect(findings.every((item) => item.code === "RELEASE_IDENTITY_INCONSISTENT")).toBe(true);
  });
});
}
