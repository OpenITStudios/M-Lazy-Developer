import type { CatalogResource, GraphEdge } from "../../engine/packages/analysis-planner/src/retrieval.js";

/** Declarative type view over the existing JavaScript graph builder. */
export function buildGraph(): {
  schemaVersion: 1;
  edges: GraphEdge[];
};
export function documentGraphRootId(): string;


/** Derived AST source-module view; never part of default Knowledge Retrieval. */
export interface SourceDependencyProjection {
  mode: "SOURCE_MODULE_DEPENDENCY_PROJECTION";
  proofBoundary: "STATIC_LITERAL_IMPORTS_ONLY_NOT_CALLSITE_OR_EXECUTION_PROOF";
  scannedSourceFiles: number;
  scannedModules: number;
  edges: GraphEdge[];
  unresolved: {
    from: string;
    path: string;
    line: number;
    target: string;
    reason: string;
  }[];
}

export function buildSourceDependencyGraph(options?: {
  root?: string;
  catalog?: { resources: CatalogResource[] };
}): SourceDependencyProjection;

export function resolveSourceOwner(
  resources: readonly CatalogResource[],
  input: string,
): CatalogResource | undefined;
