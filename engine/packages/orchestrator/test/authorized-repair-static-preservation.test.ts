import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildFilesystemInventory,
  CONTRACT_REGISTRY_REVISION,
} from "../../project-model/src/index.js";
import {
  authorizeRepair,
  createPatchTransaction,
  patchTransactionSemanticFingerprint,
} from "../../repair/src/index.js";
import {
  applyAuthorizedRepair,
  semanticGraphFingerprint,
  type RepairProofBundle,
} from "../src/index.js";
import {
  indexInspectionSources,
} from "../src/inspection/inspect-source-index.js";
import {
  enrichInspectionSemanticGraph,
} from "../src/inspection/inspect-graph-enrichment.js";
import {
  populateInspectionScriptImportGraph,
} from "../src/inspection/inspect-script-import-graph.js";

async function buildGraph(
  root: string,
  artifactId: string,
) {
  const files =
    await buildFilesystemInventory(root);
  const sourceIndex =
    await indexInspectionSources(
      root,
      artifactId,
      files,
    );

  enrichInspectionSemanticGraph({
    graph: sourceIndex.graph,
    nodes: sourceIndex.nodes,
    artifactId,
    parsedFunctions:
      sourceIndex.parsedFunctions,
    parsedDialogueDocuments:
      sourceIndex.parsedDialogueDocuments,
    parsedStructureModels:
      sourceIndex.parsedStructureModels,
    tickFunctionRegistrations:
      sourceIndex.tickFunctionRegistrations,
  });
  populateInspectionScriptImportGraph(
    sourceIndex.graph,
    sourceIndex.parsedScripts,
  );

  return sourceIndex.graph;
}

describe("authorized repair static graph preservation", () => {
  it("rolls back a transform when rebuilt graph topology changes outside the admitted semantic model", async () => {
    const root = await mkdtemp(
      join(
        tmpdir(),
        "m-bedrock-static-preservation-",
      ),
    );
    const sourceRoot = join(root, "source");
    const workingRoot = join(root, "working");
    const scriptDir =
      "behavior_packs/demo/scripts";

    await mkdir(
      join(sourceRoot, scriptDir),
      { recursive: true },
    );
    await mkdir(
      join(workingRoot, scriptDir),
      { recursive: true },
    );

    const aPath = scriptDir + "/a.js";
    const bPath = scriptDir + "/b.js";
    const cPath = scriptDir + "/c.js";
    const originalA = [
      'import "./b.js";',
      "export const value = 1;",
    ].join("\n");
    const bText =
      "export const dependency = 1;";
    const cText = "export const alternative = 2;";

    for (const base of [
      sourceRoot,
      workingRoot,
    ]) {
      await writeFile(
        join(base, aPath),
        originalA,
      );
      await writeFile(
        join(base, bPath),
        bText,
      );
      await writeFile(join(base, cPath), cText);
    }

    const sourceFingerprint =
      "source-static-preservation";
    const beforeGraph = await buildGraph(
      sourceRoot,
      sourceFingerprint,
    );
    const graphFingerprint =
      semanticGraphFingerprint(beforeGraph);

    const authorization = authorizeRepair({
      confirmedDefect: true,
      diagnosisEvidenceIds: ["fixture:proven-topology-defect"],
      invariantIds: ["fixture:preserve-unaffected-source-topology"],
      sourceFingerprint,
      sourceFingerprintMatches: true,
      evidenceFreshness: "fresh",
    }).receipt;
    if (!authorization) throw new Error("Fixture authorization was rejected.");

    const transaction =
      createPatchTransaction({
        authorization,
        title:
          "unsafe import topology transform",
        sourceFingerprint,
        requiredProofs: [
          "post-transform",
        ],
        operations: [{
          kind: "replace-text",
          source: {
            artifactId:
              sourceFingerprint,
            relativePath: aPath,
            range: {
              lineStart: 1,
              lineEnd: 1,
            },
          },
          expected:
            'import "./b.js";',
          replacement:
            'import "./c.js";',
        }],
        preconditions: [{
          kind: "source-fingerprint",
          expected:
            sourceFingerprint,
        }],
        validation: [{
          kind: "reparse",
          source: {
            artifactId:
              sourceFingerprint,
            relativePath: aPath,
            range: {
              lineStart: 1,
              lineEnd: 1,
            },
          },
        }, {
          kind: "rebuild-graph",
        }],
      });

    const transactionFingerprint =
      patchTransactionSemanticFingerprint(
        transaction,
      );
    const postTransformProofRevision =
      "fixture-post-transform-proof";

    const proof: RepairProofBundle = {
      transactionId: transaction.id,
      transactionFingerprint,
      sourceFingerprint,
      graphFingerprint,
      decisionBasis: {
        contractRegistryRevision:
          CONTRACT_REGISTRY_REVISION,
        sourceFingerprint,
        graphFingerprint,
        semanticIrRevision:
          "semantic-ir-current",
        preservationContractRevision:
          "preservation-contract-current",
        preservationBaselineRevision:
          "preservation-baseline-current",
        runtimeEvidenceRevision:
          "runtime-current",
        postTransformProofRevision,
      },
      incidentId: "incident-1",
      selectedCandidateId:
        "candidate-1",
      diagnosticDisposition:
        "repair-eligible",
      claimStrength: "proven-runtime",
      effectiveEvidenceLevel:
        "proven-with-observed-outcome",
      proofState: "causal",
      blastRadiusDisposition:
        "minimal",
      admissionDisposition: "eligible",
      preservationContractId:
        "preserve:" + transaction.id,
      preservationReadinessDisposition:
        "ready",
      preservationBaselineEvidenceIds: [
        "baseline:healthy",
      ],
      postTransformProofBinding: {
        transactionId: transaction.id,
        transactionFingerprint,
      },
      workflowAuthorityKind: "approved-bug",
      approvedBugSemanticKey: "bug:approved",
      mustChangeInvariantIds: ["invariant::change"],
      mustPreserveInvariantIds: ["invariant::preserve"],
      supportingInvariantIds: [],
      changedNodeIds: beforeGraph
        .allNodes()
        .filter(
          (node) =>
            node.source.relativePath ===
              aPath,
        )
        .map((node) => node.id),
      affectedNodeIds: beforeGraph
        .allNodes()
        .filter(
          (node) =>
            node.source.relativePath ===
              aPath,
        )
        .map((node) => node.id),
      requiredRevalidationNodeIds:
        [],
      requiredRevalidationPaths: [],
      impactTraces: [],
      reasons: [],
    };

    const result = await applyAuthorizedRepair(
      transaction,
      {
        sourceRoot,
        workingRoot,
      },
      {
        currentSourceFingerprint:
          sourceFingerprint,
      },
      proof,
      beforeGraph,
      {},
      {
        repairAuthority: {
          kind: "approved-bug",
          approved: {
            map: {
              name: "Repair Test",
              mapVersion: "1.0.0",
              drive: "https://drive.google.com/file/d/map/view",
              baseVersion: "1.26.20",
              testedVersion: "1.26.32",
            },
            approvedSemanticKeys: ["bug:approved"],
            rejectedSemanticKeys: [],
            decisions: [{ semanticKey: "bug:approved", decision: "approve" }],
          },
          bugSemanticKey: "bug:approved",
          preservationContract: {
            schemaVersion: 1,
            id: "preserve:" + transaction.id,
            transactionId: transaction.id,
            mustChangeInvariantIds: ["invariant::change"],
            mustPreserveInvariantIds: ["invariant::preserve"],
          },
        },
        decisionBasis: {
          semanticIrRevision:
            "semantic-ir-current",
          preservationContractRevision:
            "preservation-contract-current",
          preservationBaselineRevision:
            "preservation-baseline-current",
          runtimeEvidenceRevision:
            "runtime-current",
          postTransformProofRevision,
        },
      },
    );

    expect(result.status).toBe(
      "static-preservation-failed",
    );
    if (
      result.status !==
        "static-preservation-failed"
    ) {
      return;
    }

    expect(
      result.staticPreservation
        .edgeTopologyChanged,
    ).toBe(true);
    expect(result.rollback.ok).toBe(true);
    expect(
      await readFile(
        join(workingRoot, aPath),
        "utf8",
      ),
    ).toBe(originalA);
  });
});
