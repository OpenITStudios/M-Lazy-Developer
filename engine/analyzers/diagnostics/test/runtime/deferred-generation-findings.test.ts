import { describe, expect, it } from "vitest";
import type { KnowledgeCatalog } from "../../../../packages/knowledge/src/index.js";
import { parseScriptFile } from "../../../scripts/src/index.js";
import { scriptRuntimeEvidence } from "../../../scripts/src/index.js";
import { knowledgeRuntimeDiagnostics } from "../../src/runtime/knowledge-runtime-findings.js";

const catalog: KnowledgeCatalog = {
  schemaVersion: 1,
  sources: [{
    id: "policy",
    title: "Policy",
    url: "project://knowledge/deferred-test",
    authority: "project-policy",
    confidence: "designed",
    retrievedDate: "2026-09-24",
  }],
  facts: [],
  relations: [{
    id: "deferred-needs-generation-check",
    domain: "event-ordering",
    subject: "deferred-script-work",
    kind: "requires",
    object: "async-generation-revalidation",
    classification: "project-policy",
    applicability: { editions: ["bedrock"] },
    sourceIds: ["policy"],
    diagnosticSeverity: "medium",
  }],
};

function diagnosticsFor(text: string) {
  const parsed = parseScriptFile(
    "scripts/main",
    text,
    { artifactId: "fixture", relativePath: "scripts/main.ts" },
  );
  return knowledgeRuntimeDiagnostics({
    catalog,
    profile: { edition: "bedrock" },
    snapshot: {
      schemaVersion: 1,
      records: scriptRuntimeEvidence(parsed),
    },
  });
}

describe("deferred callback knowledge reasoning", () => {
  it("keeps unproven ownership as an evidence gap", () => {
    const findings = diagnosticsFor(`
      import { system } from "@minecraft/server";
      system.run(() => doWork());
    `);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.code).toBe("KNOWLEDGE_EVIDENCE_GAP");
    expect(findings[0]?.severity).toBe("info");
  });

  it("satisfies the relation when an explicit generation guard is present", () => {
    const findings = diagnosticsFor(`
      import { system } from "@minecraft/server";
      let arenaGeneration = 1;
      const capturedGeneration = arenaGeneration;
      system.run(() => {
        if (capturedGeneration !== arenaGeneration) return;
        doWork();
      });
    `);
    expect(findings).toEqual([]);
  });
});
