import { existsSync, readFileSync } from "node:fs";
import { buildResourceCatalog } from "./resource-catalog.mjs";
import { authoredLinks, buildGraph, documentGraphRootId } from "./graph.mjs";
import { buildDocumentSectionIndex } from "./document-sections.mjs";
import {
  readKnowledgeResourceContext,
  scoreResourcesLexically,
  scoreSectionsLexically,
} from "./lexical-retrieval.mjs";

const failures = [];

const catalogPath = "engine/schemas/knowledge-architecture/resource-catalog.v1.schema.json";
const graphPath = "engine/schemas/knowledge-architecture/graph.v1.schema.json";
const namingPath = "docs/system/canonical-naming.md";
const authorityPath = "docs/system/authority-model.md";
const architecturePath = "docs/system/architecture.md";
const retrievalTypesPath = "engine/packages/analysis-planner/src/retrieval.ts";
const documentMetadataPath = "tooling/repository/document-metadata.mjs";

for (const path of [
  catalogPath,
  graphPath,
  namingPath,
  authorityPath,
  architecturePath,
  retrievalTypesPath,
  documentMetadataPath,
]) {
  if (!existsSync(path)) failures.push("Missing knowledge architecture owner: " + path);
}

const expectedClasses = [
  "DOCUMENT",
  "KNOWLEDGE",
  "SOURCE",
  "RELIABILITY",
  "SCHEMA",
  "EXAMPLE",
];
const expectedRoles = [
  "ROUTER",
  "WORKFLOW",
  "CONTRACT",
  "DOMAIN",
  "ARCHITECTURE",
  "GUIDE",
];
const expectedAuthorities = [
  "CANONICAL",
  "REFERENCE",
  "HISTORICAL",
  "DERIVED",
];
const expectedLifecycle = [
  "ACTIVE",
  "RETIRED",
];
const expectedGraphRelations = [
  "ROUTES_TO",
  "OWNS",
  "IMPLEMENTS",
  "USES",
  "DEPENDS_ON",
  "VALIDATES",
  "RELATES_TO",
  "DERIVED_FROM",
];

function sameSet(actual, expected) {
  return JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
}

function quotedVocabulary(text, pattern, label) {
  const match = text.match(pattern);
  if (!match) {
    failures.push("Unable to read " + label + " vocabulary.");
    return [];
  }
  return [...match[1].matchAll(/"([A-Z_]+)"/g)].map((item) => item[1]);
}

if (existsSync(catalogPath)) {
  const schema = JSON.parse(readFileSync(catalogPath, "utf8"));
  const resource = schema?.$defs?.resource?.properties ?? {};

  if (!sameSet(resource.class?.enum ?? [], expectedClasses)) {
    failures.push("Resource Catalog class vocabulary drift.");
  }
  if (!sameSet(resource.role?.enum ?? [], expectedRoles)) {
    failures.push("Resource Catalog document-role vocabulary drift.");
  }
  if (!sameSet(resource.authority?.enum ?? [], expectedAuthorities)) {
    failures.push("Resource Catalog authority vocabulary drift.");
  }
  if (!sameSet(resource.lifecycle?.enum ?? [], expectedLifecycle)) {
    failures.push("Resource Catalog lifecycle vocabulary drift.");
  }

  const vocabularies = [
    ["Resource Class", expectedClasses],
    ["Document Role", expectedRoles],
    ["Authority", expectedAuthorities],
    ["Lifecycle", expectedLifecycle],
  ];

  for (let leftIndex = 0; leftIndex < vocabularies.length; leftIndex += 1) {
    const [leftName, leftValues] = vocabularies[leftIndex];
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < vocabularies.length;
      rightIndex += 1
    ) {
      const [rightName, rightValues] = vocabularies[rightIndex];
      const overlap = leftValues.filter((value) =>
        rightValues.includes(value)
      );
      if (overlap.length > 0) {
        failures.push(
          "Knowledge architecture vocabularies overlap: " +
            leftName +
            " / " +
            rightName +
            " -> " +
            overlap.join(", "),
        );
      }
    }
  }
}

if (existsSync(graphPath)) {
  const schema = JSON.parse(readFileSync(graphPath, "utf8"));
  const actual = schema?.$defs?.edge?.properties?.type?.enum ?? [];
  if (!sameSet(actual, expectedGraphRelations)) {
    failures.push("Graph relation vocabulary drift.");
  }
}

if (existsSync(retrievalTypesPath)) {
  const text = readFileSync(retrievalTypesPath, "utf8");
  const sourceVocabularies = [
    [
      "CatalogResourceClass",
      /export type CatalogResourceClass =([\s\S]*?);/,
      expectedClasses,
    ],
    [
      "DocumentRole",
      /export type DocumentRole =([\s\S]*?);/,
      expectedRoles,
    ],
    [
      "ResourceAuthority",
      /export type ResourceAuthority =([\s\S]*?);/,
      expectedAuthorities,
    ],
    [
      "ResourceLifecycle",
      /export type ResourceLifecycle =([\s\S]*?);/,
      expectedLifecycle,
    ],
    [
      "GraphRelationType",
      /export type GraphRelationType =([\s\S]*?);/,
      expectedGraphRelations,
    ],
  ];

  for (const [name, pattern, expected] of sourceVocabularies) {
    const actual = quotedVocabulary(
      text,
      pattern,
      "analysis-planner " + name,
    );
    if (!sameSet(actual, expected)) {
      failures.push("Analysis-planner source vocabulary drift: " + name + ".");
    }
  }
}

if (existsSync(documentMetadataPath)) {
  const text = readFileSync(documentMetadataPath, "utf8");
  const metadataVocabularies = [
    [
      "Document Role",
      /const DOCUMENT_ROLES = new Set\(\[([\s\S]*?)\]\);/,
      expectedRoles,
    ],
    [
      "Authority",
      /const AUTHORITIES = new Set\(\[([\s\S]*?)\]\);/,
      expectedAuthorities,
    ],
    [
      "Lifecycle",
      /const LIFECYCLE = new Set\(\[([\s\S]*?)\]\);/,
      expectedLifecycle,
    ],
  ];

  for (const [name, pattern, expected] of metadataVocabularies) {
    const actual = quotedVocabulary(
      text,
      pattern,
      "document metadata " + name,
    );
    if (!sameSet(actual, expected)) {
      failures.push("Document metadata vocabulary drift: " + name + ".");
    }
  }
}

if (existsSync(namingPath)) {
  const text = readFileSync(namingPath, "utf8");
  for (const term of [
    "Catalog",
    "Graph",
    "Router",
    "Retrieval",
    "Context",
    "Owner",
    "History",
    "Corpus",
    "Planning",
    "Workspace",
    "DOCUMENT",
    "CANONICAL",
    "ROUTES_TO",
    "ACTIVE",
    "RETIRED",
  ]) {
    if (!text.includes(term)) failures.push("Canonical naming missing term: " + term);
  }
}

if (existsSync(authorityPath)) {
  const text = readFileSync(authorityPath, "utf8");
  for (const phrase of ["Catalog boundary","Graph boundary","Retrieval boundary","Context boundary"]) {
    if (!text.includes(phrase)) failures.push("Authority model missing boundary: " + phrase);
  }
}

if (existsSync(architecturePath)) {
  const text = readFileSync(architecturePath, "utf8");
  if (!text.includes("Task / Question") || !text.includes("→ Router") || !text.includes("→ Retrieval")) {
    failures.push("Architecture missing canonical knowledge access flow.");
  }
}


const resourceIdPattern =
  /^(document|knowledge|source|reliability|schema|example)\.[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

try {
  const catalog = buildResourceCatalog();
  const graph = buildGraph();
  const sectionIndex = buildDocumentSectionIndex();

  const ids = new Set();
  const locations = new Set();
  const byId = new Map();

  for (const resource of catalog.resources) {
    if (!resourceIdPattern.test(resource.id)) {
      failures.push("Invalid Resource Catalog id: " + resource.id);
    }
    if (ids.has(resource.id)) {
      failures.push("Duplicate Resource Catalog id: " + resource.id);
    }
    ids.add(resource.id);

    const locationKey =
      resource.path + "#" + (resource.locator ?? "");
    if (locations.has(locationKey)) {
      failures.push("Multiple active resources use the same location: " + locationKey);
    }
    locations.add(locationKey);

    if (!existsSync(resource.path)) {
      failures.push("Resource Catalog path does not exist: " + resource.path);
    }

    if (resource.class === "DOCUMENT" && !resource.role) {
      failures.push("DOCUMENT resource lacks role: " + resource.id);
    }
    if (resource.class !== "DOCUMENT" && resource.role !== undefined) {
      failures.push("Non-DOCUMENT resource must not declare role: " + resource.id);
    }

    if (resource.class === "EXAMPLE") {
      if (resource.domain !== "examples") {
        failures.push("EXAMPLE resource must use examples domain: " + resource.id);
      }
      if (resource.authority !== "REFERENCE") {
        failures.push("EXAMPLE resource must use REFERENCE authority: " + resource.id);
      }
    }

    if (resource.class === "DOCUMENT") {
      const expectedDomain =
        resource.path === "docs/README.md"
          ? "docs"
          : resource.path.split("/")[1];

      if (resource.domain !== expectedDomain) {
        failures.push(
          "DOCUMENT domain/path mismatch: " +
            resource.id +
            " metadata=" +
            resource.domain +
            " path-domain=" +
            expectedDomain,
        );
      }

      const expectedIdPrefix =
        "document." + expectedDomain + ".";
      if (!resource.id.startsWith(expectedIdPrefix)) {
        failures.push(
          "DOCUMENT id/domain mismatch: " +
            resource.id +
            " expected prefix " +
            expectedIdPrefix,
        );
      }

      const isRouter =
        resource.path === "docs/README.md" ||
        resource.path.endsWith("/README.md");

      if (isRouter && resource.role !== "ROUTER") {
        failures.push(
          "Documentation README must use ROUTER role: " +
            resource.path,
        );
      }
      if (!isRouter && resource.role === "ROUTER") {
        failures.push(
          "Only documentation README files may use ROUTER role: " +
            resource.path,
        );
      }

      const expectedAuthority =
        resource.locator !== undefined
          ? "DERIVED"
          : expectedDomain === "examples"
            ? "REFERENCE"
            : "CANONICAL";
      if (resource.authority !== expectedAuthority &&
          !(resource.role === "DOMAIN" && resource.authority === "REFERENCE")) {
        failures.push(
          "DOCUMENT authority/domain mismatch: " +
            resource.id +
            " expected " +
            expectedAuthority,
        );
      }
    }

    byId.set(resource.id, resource);
  }

  const sectionIds = new Set();
  for (const section of sectionIndex.sections) {
    if (sectionIds.has(section.id)) {
      failures.push("Document Section id is duplicated: " + section.id);
    }
    sectionIds.add(section.id);

    const parent = byId.get(section.documentId);
    if (parent?.class !== "DOCUMENT") {
      failures.push(
        "Document Section parent is not a registered DOCUMENT: " +
          section.id,
      );
    }
    if (
      !Number.isInteger(section.startLine) ||
      !Number.isInteger(section.endLine) ||
      section.startLine < 1 ||
      section.endLine < section.startLine
    ) {
      failures.push("Document Section has invalid range: " + section.id);
    }
    if (!section.heading.trim() || !section.anchor.trim()) {
      failures.push("Document Section lacks heading/anchor: " + section.id);
    }
  }

  const resourceLexicalScores =
    scoreResourcesLexically(
      catalog.resources,
      "inventory reconnect lifecycle",
    );
  for (const id of Object.keys(resourceLexicalScores)) {
    if (!byId.has(id)) {
      failures.push(
        "Lexical Resource score references unknown id: " + id,
      );
    }
  }
  if (Object.keys(resourceLexicalScores).length === 0) {
    failures.push(
      "Lexical Resource Retrieval produced no result for baseline query.",
    );
  }

  // The Catalog registers Knowledge relations as resources. Require the
  // existing lexical reader to make their subject/predicate/object searchable.
  const relationId = "knowledge.persistence.relation-worldload-gates-reconcile";
  const relationResource = byId.get(relationId);
  if (!relationResource) {
    failures.push("Canonical persistence relation resource is missing.");
  } else {
    const relationScores = scoreResourcesLexically(
      [relationResource],
      "worldLoad durable-state-reconciliation",
    );
    if (!(relationScores[relationId] > 0)) {
      failures.push("Lexical retrieval cannot search a Knowledge relation by its content.");
    }
  }

  // Selected facts and relations must reach the model with exact content,
  // catalog provenance and declared applicability, without a runtime assertion.
  if (relationResource) {
    const content = readKnowledgeResourceContext(relationResource);
    if (
      content?.kind !== "relation" ||
      content.relation?.kind !== "gates" ||
      content.relation.object !== "durable-state-reconciliation" ||
      content.applicabilityStatus !== "NOT_EVALUATED" ||
      content.sources.length === 0 ||
      !content.sources.every((source) => source.id && source.url)
    ) {
      failures.push("Knowledge relation context lost semantics or provenance.");
    }
    try {
      readKnowledgeResourceContext({
        ...relationResource,
        locator: "persistence.nonexistent-relation",
      });
      failures.push("Missing Knowledge locator was silently hydrated.");
    } catch {
      // Missing canonical content must remain an error, never a fabricated claim.
    }
  }
  const factResource = byId.get(
    "knowledge.persistence.dynamic-properties-survive-restart",
  );
  if (!factResource) {
    failures.push("Canonical persistence fact resource is missing.");
  } else {
    const content = readKnowledgeResourceContext(factResource);
    if (
      content?.kind !== "fact" ||
      !content.summary.includes("Dynamic properties") ||
      !content.applicability?.editions.includes("bedrock") ||
      content.applicabilityStatus !== "NOT_EVALUATED" ||
      content.sources.length === 0
    ) {
      failures.push("Knowledge fact context lost content, source or applicability.");
    }
  }

  const sectionLexicalScores =
    scoreSectionsLexically(
      sectionIndex.sections,
      "proof validation",
    );
  const knownSectionIds = new Set(
    sectionIndex.sections.map((section) => section.id),
  );
  for (const id of Object.keys(sectionLexicalScores)) {
    if (!knownSectionIds.has(id)) {
      failures.push(
        "Lexical Section score references unknown id: " + id,
      );
    }
  }
  if (Object.keys(sectionLexicalScores).length === 0) {
    failures.push(
      "Lexical Section Retrieval produced no result for baseline query.",
    );
  }

  const edgeKeys = new Set();
  const linkWitnessCache = new Map();
  for (const edge of graph.edges) {
    const key = edge.from + "|" + edge.type + "|" + edge.to;
    if (edgeKeys.has(key)) {
      failures.push("Duplicate Graph edge: " + key);
    }
    edgeKeys.add(key);

    const declaredOwner = byId.get(edge.from);
    const witness = edge.evidence;
    if (edge.basis !== "EXTRACTED" || !witness ||
        witness.path !== declaredOwner?.path ||
        !Number.isInteger(witness.line) || witness.line < 1 ||
        typeof witness.target !== "string" || !witness.target) {
      failures.push("Graph edge lacks exact authored Markdown witness: " + key);
    } else {
      if (!linkWitnessCache.has(witness.path)) {
        linkWitnessCache.set(
          witness.path,
          [...authoredLinks(readFileSync(witness.path, "utf8"))],
        );
      }
      const exact = linkWitnessCache.get(witness.path).some((link) =>
        link.line === witness.line && link.target === witness.target
      );
      if (!exact) {
        failures.push("Graph edge authored witness does not match source: " + key);
      }
    }

    if (!byId.has(edge.from)) {
      failures.push("Graph edge source is not registered: " + edge.from);
    }
    if (!byId.has(edge.to)) {
      failures.push("Graph edge target is not registered: " + edge.to);
    }

    for (const endpoint of [edge.from, edge.to]) {
      const resource = byId.get(endpoint);
      if (
        resource !== undefined &&
        resource.lifecycle !== "ACTIVE"
      ) {
        failures.push(
          "Graph edge references RETIRED resource: " +
            endpoint,
        );
      }
    }
  }

  // Declaration-only registry pointers must not inflate the active
  // graph with unsupported use/validation claims at MODULE granularity.
  const bindingRegistryPath =
    "engine/reliability/catalogs/knowledge-detector-bindings.json";
  if (existsSync(bindingRegistryPath)) {
    const bindingRegistry = JSON.parse(
      readFileSync(bindingRegistryPath, "utf8"),
    );
    const declaredKnowledgeTargets = new Set(
      (bindingRegistry.bindings ?? []).map(
        (binding) => "knowledge." + binding.knowledgeId,
      ),
    );
    const unprovenBindingEdges = graph.edges.filter((edge) =>
      edge.from.startsWith("source.") &&
      declaredKnowledgeTargets.has(edge.to) &&
      (edge.type === "USES" || edge.type === "VALIDATES")
    );
    if (unprovenBindingEdges.length > 0) {
      failures.push(
        "Declaration-only Knowledge binding edges pollute the active Retrieval Graph: " +
        unprovenBindingEdges.length,
      );
    }
  }

  const routeAdjacency = new Map();
  for (const edge of graph.edges.filter((item) => item.type === "ROUTES_TO")) {
    const list = routeAdjacency.get(edge.from) ?? [];
    list.push(edge.to);
    routeAdjacency.set(edge.from, list);
  }

  const rootId = documentGraphRootId();
  if (!byId.has(rootId)) {
    failures.push("Root documentation Router is not registered: " + rootId);
  } else {
    const reachable = new Set([rootId]);
    const queue = [rootId];

    while (queue.length) {
      const current = queue.shift();
      for (const next of routeAdjacency.get(current) ?? []) {
        if (reachable.has(next)) continue;
        reachable.add(next);
        queue.push(next);
      }
    }

    for (const resource of catalog.resources.filter(
      (item) =>
        (item.class === "DOCUMENT" || item.class === "EXAMPLE") &&
        item.lifecycle === "ACTIVE",
    )) {
      if (!reachable.has(resource.id)) {
        failures.push("Active DOCUMENT is not reachable from docs Router: " + resource.id);
      }
    }
  }
} catch (error) {
  failures.push(
    "Unable to build Resource Catalog / Graph: " +
      (error instanceof Error ? error.message : String(error)),
  );
}

if (failures.length) {
  console.error("Knowledge architecture violations:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log("Knowledge architecture verification passed.");