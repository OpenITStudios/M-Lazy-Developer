import { resolveScriptImports } from "../../../../analyzers/scripts/src/index.js";
import type { ParsedScriptFile } from "../../../../analyzers/scripts/src/index.js";
import type { SemanticGraph } from "../../../graph/src/index.js";
import type { SemanticNode } from "../../../graph/src/index.js";

export function populateInspectionScriptImportGraph(
  graph: SemanticGraph,
  parsedScripts: readonly {
    node: SemanticNode;
    parsed: ParsedScriptFile;
  }[],
): void {
  const resolutions = resolveScriptImports(
    parsedScripts.map((item) => item.parsed),
  );
  // Import owners are selected source artifacts, not script display IDs.
  // Duplicate module paths must not silently overwrite a different source.
  const nodesBySource = new Map<string, SemanticNode[]>();
  for (const item of parsedScripts) {
    const key = item.parsed.source.relativePath.replaceAll("\\", "/");
    nodesBySource.set(key, [...(nodesBySource.get(key) ?? []), item.node]);
  }
  const uniqueNode = (path: string): SemanticNode | undefined => {
    const nodes = nodesBySource.get(path.replaceAll("\\", "/")) ?? [];
    return nodes.length === 1 ? nodes[0] : undefined;
  };

  for (const resolution of resolutions) {
    // Preserve types in source inventory, never as runtime import edges.
    if (resolution.typeOnly) continue;
    const from = uniqueNode(resolution.fromSourcePath);
    if (!from) continue;

    const authoredImport = resolution.importSyntax === undefined ? {} : {
      importSyntax: resolution.importSyntax,
    };
    // For import(), preserve the exact call site instead of treating the
    // entire module as proof that this request executed.
    const source = resolution.source ?? from.source;
    if (resolution.status === "external") {
      if (resolution.module.startsWith("@minecraft/")) {
        graph.addEdge({
          from: from.id,
          type: "IMPORTS_MINECRAFT_MODULE",
          targetIdentifier: resolution.module,
          status: "unresolved",
          ...authoredImport,
          evidence: { source },
        });
      }
      continue;
    }

    const targetNode = resolution.targetSourcePath
      ? uniqueNode(resolution.targetSourcePath)
      : undefined;

    graph.addEdge({
      from: from.id,
      type: "IMPORTS_SCRIPT",
      targetIdentifier: resolution.module,
      status: resolution.status === "resolved" && targetNode
        ? "resolved"
        : "unresolved",
      ...(resolution.status === "resolved" && targetNode
        ? { to: targetNode.id } : {}),
      ...authoredImport,
      evidence: { source },
    });
  }
}
