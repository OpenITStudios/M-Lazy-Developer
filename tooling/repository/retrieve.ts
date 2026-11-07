import { readFileSync } from "node:fs";
import {
  retrieveDocumentSections,
  retrieveResources,
  explainResourcePath,
  type ResourcePathExplanation,
} from "../../engine/packages/analysis-planner/src/index.js";
import { buildDocumentSectionIndex } from "./document-sections.mjs";
import { buildGraph } from "./graph.mjs";
import {
  readKnowledgeResourceContext,
  scoreResourcesLexically,
  scoreSectionsLexically,
} from "./lexical-retrieval.mjs";
import {
  compileResourceContext,
  type RetrievedKnowledgeContext,
} from "../../engine/packages/orchestrator/src/workflow/resource-context.js";
import { buildResourceCatalog } from "./resource-catalog.mjs";

interface RetrievalCliOptions {
  query: string;
  id?: string;
  summary: boolean;
  domains: string[];
  includeHistorical: boolean;
  allowAllDomains: boolean;
  limit: number;
  sectionLimit: number;
  trace?: { from: string; to: string };
  format: "json" | "mermaid" | "markdown";
  allowReverse: boolean;
  maxHops: number;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("Retrieval limits must be positive integers.");
  }
  return parsed;
}

function parseArgs(argv: readonly string[]): RetrievalCliOptions {
  const domains: string[] = [];
  const queryParts: string[] = [];
  let includeHistorical = false;
  let allowAllDomains = false;
  let id: string | undefined;
  let summary = false;
  let limit = 12;
  let sectionLimit = 8;
  let trace: { from: string; to: string } | undefined;
  let format: "json" | "mermaid" | "markdown" = "json";
  let allowReverse = false;
  let maxHops = 4;

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]!;

    if (value === "--trace") {
      const from = argv[index + 1];
      const to = argv[index + 2];
      if (!from || !to || from.startsWith("--") || to.startsWith("--")) {
        throw new Error("--trace requires two registered resource IDs.");
      }
      trace = { from, to };
      index += 2;
      continue;
    }
    if (value === "--format") {
      const chosen = argv[index + 1];
      if (chosen !== "json" && chosen !== "mermaid" && chosen !== "markdown") {
        throw new Error("--format must be json, mermaid, or markdown.");
      }
      format = chosen;
      index += 1;
      continue;
    }
    if (value === "--both-directions") {
      allowReverse = true;
      continue;
    }
    if (value === "--max-hops") {
      maxHops = positiveInteger(argv[index + 1], 4);
      if (maxHops > 6) throw new Error("--max-hops must be at most 6.");
      index += 1;
      continue;
    }

    if (value === "--summary") {
      summary = true;
      continue;
    }

    if (value === "--id") {
      const resourceId = argv[index + 1];
      if (!resourceId) throw new Error("--id requires a resource ID.");
      id = resourceId;
      index += 1;
      continue;
    }

    if (value === "--domain") {
      const domain = argv[index + 1];
      if (!domain) throw new Error("--domain requires a value.");
      domains.push(
        ...domain
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      );
      index += 1;
      continue;
    }

    if (value === "--history") {
      includeHistorical = true;
      continue;
    }

    if (value === "--all") {
      allowAllDomains = true;
      continue;
    }

    if (value === "--limit") {
      limit = positiveInteger(argv[index + 1], 12);
      index += 1;
      continue;
    }

    if (value === "--section-limit") {
      sectionLimit = positiveInteger(argv[index + 1], 8);
      index += 1;
      continue;
    }

    queryParts.push(value);
  }

  const query = queryParts.join(" ").trim();
  if (trace !== undefined && (id !== undefined || summary || query ||
      domains.length > 0 || allowAllDomains)) {
    throw new Error("--trace takes only two IDs, not a query or scope.");
  }
  if (trace === undefined && (format !== "json" || allowReverse || maxHops !== 4)) {
    throw new Error("--format/--both-directions/--max-hops require --trace.");
  }
  if (!query && id === undefined && !summary && trace === undefined) {
    throw new Error(
      "Usage: npm run retrieve:repository -- <query> --domain <domain> OR npm run retrieve:repository -- --id <resource-id>",
    );
  }

  if (
    id === undefined &&
    !summary &&
    trace === undefined &&
    domains.length === 0 &&
    !allowAllDomains
  ) {
    throw new Error(
      "Retrieval requires Router scope. Pass --domain <domain>, or use --all explicitly for broad diagnostic discovery.",
    );
  }

  return {
    query,
    ...(id === undefined ? {} : { id }),
    summary,
    domains: [...new Set(domains)].sort(),
    includeHistorical,
    allowAllDomains,
    limit,
    sectionLimit,
    ...(trace === undefined ? {} : { trace }),
    format,
    allowReverse,
    maxHops,
  };
}

function countBy<T>(
  values: readonly T[],
  key: (value: T) => string,
): Readonly<Record<string, number>> {
  const counts = new Map<string, number>();

  for (const value of values) {
    const name = key(value);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  return Object.fromEntries(
    [...counts.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
}

function mermaidTrace(trace: ResourcePathExplanation): string {
  const lines = ["flowchart LR"];
  if (trace.status !== "FOUND") {
    lines.push('  missing["No verified navigation path"]');
    return lines.join("\n");
  }
  for (const [index, resource] of trace.nodes.entries()) {
    // Stable Catalog IDs, never user-authored Mermaid snippets.
    lines.push('  n' + index + '["' + resource.id + '"]');
  }
  for (const [index, step] of trace.steps.entries()) {
    const from = step.direction === "FORWARD" ? index : index + 1;
    const to = step.direction === "FORWARD" ? index + 1 : index;
    lines.push("  n" + from + " -->|" + step.type + "| n" + to);
  }
  return lines.join("\n");
}

function obsidianResourceLink(resource: ResourcePathExplanation["nodes"][number]): string {
  const mark = String.fromCharCode(96);
  // The repository root is the proposed vault root; no vault is written.
  return resource.path.endsWith(".md")
    ? "[[" + resource.path + "|" + resource.id + "]]"
    : mark + resource.id + mark + " (" + resource.path + ")";
}

function markdownTrace(trace: ResourcePathExplanation): string {
  const mark = String.fromCharCode(96);
  const out = [
    "# Repository Architecture Trace",
    "",
    "Status: **" + trace.status + "**",
    "",
    "Proof boundary: " + mark + trace.proofBoundary + mark + ".",
    "Search scope: max " + trace.scope.maxHops + " hops; reverse " +
      trace.scope.allowReverse + "; history " + trace.scope.includeHistorical + ".",
    "",
    "Repository navigation only: a link is not source execution, gameplay behavior, " +
      "causal ownership, test PASS, or repair authority.",
    "",
  ];
  if (trace.status === "FOUND") {
    out.push("## Routed resources", "");
    for (const resource of trace.nodes) {
      out.push("- " + obsidianResourceLink(resource) + " — " +
        resource.authority + " / " + resource.class);
    }
    out.push("", "## Authored link witnesses", "");
    for (const step of trace.steps) {
      out.push("- " + mark + step.from + mark + " " +
        (step.direction === "FORWARD" ? "→" : "← (reverse traversal)") +
        " " + mark + step.to + mark + " (" + step.type + ", " + step.basis + ")" +
        (step.evidence ? " — " + mark + step.evidence.path + ":" + step.evidence.line + mark
          : " — NO_SOURCE_WITNESS"));
    }
  } else {
    out.push("No path was established within the selected depth, direction and authority scope.", "");
  }
  const fence = mark.repeat(3);
  out.push("## Mermaid / Pele-compatible diagram", "", fence + "mermaid", mermaidTrace(trace), fence, "");
  return out.join("\n");
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const catalog = buildResourceCatalog();
  const graph = buildGraph();

  if (options.trace !== undefined) {
    const trace = explainResourcePath(
      catalog.resources, graph.edges, options.trace.from, options.trace.to,
      {
        maxHops: options.maxHops,
        allowReverse: options.allowReverse,
        includeHistorical: options.includeHistorical,
      },
    );
    if (options.format === "json") {
      process.stdout.write(JSON.stringify({
        schemaVersion: 1,
        mode: "REPOSITORY_ARCHITECTURE_TRACE",
        trace,
      }, null, 2) + "\n");
    } else if (options.format === "mermaid") {
      process.stdout.write(mermaidTrace(trace) + "\n");
    } else {
      process.stdout.write(markdownTrace(trace));
    }
    return;
  }

  if (options.summary) {
    const sectionIndex = buildDocumentSectionIndex();

    process.stdout.write(
      JSON.stringify(
        {
          schemaVersion: 1,
          resources: {
            total: catalog.resources.length,
            byClass: countBy(
              catalog.resources,
              (resource) => resource.class,
            ),
            byDomain: countBy(
              catalog.resources,
              (resource) => resource.domain,
            ),
            byAuthority: countBy(
              catalog.resources,
              (resource) => resource.authority,
            ),
            byLifecycle: countBy(
              catalog.resources,
              (resource) => resource.lifecycle,
            ),
          },
          graph: {
            totalEdges: graph.edges.length,
            byType: countBy(
              graph.edges,
              (edge) => edge.type,
            ),
          },
          sections: {
            total: sectionIndex.sections.length,
          },
        },
        null,
        2,
      ) + "\n",
    );
    return;
  }

  if (options.id !== undefined) {
    const resource = catalog.resources.find(
      (item) => item.id === options.id,
    );
    if (resource === undefined) {
      throw new Error(
        "Unknown Resource Catalog id: " + options.id,
      );
    }

    const incoming = graph.edges
      .filter((edge) => edge.to === resource.id)
      .sort((a, b) =>
        (a.from + "|" + a.type).localeCompare(
          b.from + "|" + b.type,
        ),
      );
    const outgoing = graph.edges
      .filter((edge) => edge.from === resource.id)
      .sort((a, b) =>
        (a.type + "|" + a.to).localeCompare(
          b.type + "|" + b.to,
        ),
      );

    const sectionIndex = buildDocumentSectionIndex();
    const sections =
      resource.class === "DOCUMENT"
        ? sectionIndex.sections.filter(
            (section) =>
              section.documentId === resource.id,
          )
        : [];

    const knowledge = resource.class === "KNOWLEDGE"
      ? readKnowledgeResourceContext(resource)
      : undefined;
    // Keep declared source/proof references discoverable by exact ID, but
    // never treat them as runtime use or ranked Graph dependencies.
    const bindingDeclaration = resource.class === "KNOWLEDGE"
      ? (JSON.parse(readFileSync(
          "engine/reliability/catalogs/knowledge-detector-bindings.json",
          "utf8",
        )).bindings ?? []).find(
          (item: { readonly knowledgeId: string }) => item.knowledgeId === resource.locator,
        )
      : undefined;
    if (resource.class === "KNOWLEDGE" && knowledge === undefined) {
      throw new Error("Knowledge content could not be resolved: " + resource.id);
    }
    process.stdout.write(
      JSON.stringify(
        {
          schemaVersion: 1,
          resource,
          incoming,
          outgoing,
          sections,
          ...(knowledge === undefined ? {} : { knowledge }),
          ...(bindingDeclaration === undefined ? {} : {
            bindingDeclaration: {
              semantics: "REFERENCE_ONLY_NOT_CONSUMPTION_PROOF",
              consumer: bindingDeclaration.consumer,
              analyzerPaths: bindingDeclaration.analyzerPaths,
              proofPaths: bindingDeclaration.proofPaths,
            },
          }),
        },
        null,
        2,
      ) + "\n",
    );
    return;
  }

  const lexicalScores = scoreResourcesLexically(
    catalog.resources,
    options.query,
  );

  const resources = retrieveResources(
    catalog.resources,
    graph.edges,
    {
      text: options.query,
      ...(options.domains.length === 0
        ? {}
        : { domains: options.domains }),
      includeHistorical: options.includeHistorical,
      lexicalScores,
      graphDepth: 2,
      limit: options.limit,
    },
  );

  const knowledgeByResourceId: Record<string, RetrievedKnowledgeContext> = {};
  const knowledgeCache = new Map();
  for (const result of resources) {
    if (result.resource.class !== "KNOWLEDGE") continue;
    const knowledge = readKnowledgeResourceContext(result.resource, knowledgeCache);
    if (knowledge === undefined) {
      throw new Error("Knowledge content could not be resolved: " + result.resource.id);
    }
    knowledgeByResourceId[result.resource.id] = knowledge;
  }
  const resourceContext = compileResourceContext(
    resources,
    options.limit,
    knowledgeByResourceId,
  );

  const selectedDocumentIds = resources
    .filter((result) => result.resource.class === "DOCUMENT")
    .map((result) => result.resource.id);

  const sectionIndex = buildDocumentSectionIndex();
  const sectionLexicalScores = scoreSectionsLexically(
    sectionIndex.sections,
    options.query,
  );

  const sections = retrieveDocumentSections(
    sectionIndex.sections,
    {
      text: options.query,
      ...(selectedDocumentIds.length === 0
        ? {}
        : { documentIds: selectedDocumentIds }),
      lexicalScores: sectionLexicalScores,
      limit: options.sectionLimit,
    },
  );

  process.stdout.write(
    JSON.stringify(
      {
        schemaVersion: 1,
        query: options.query,
        domains: options.domains,
        includeHistorical: options.includeHistorical,
        broadDiagnostic: options.allowAllDomains,
        resources,
        resourceContext,
        sections,
      },
      null,
      2,
    ) + "\n",
  );
}

main();