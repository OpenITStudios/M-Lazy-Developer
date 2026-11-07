import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { readDocumentMetadata } from "./document-metadata.mjs";

const DOC_DOMAINS = ["product", "artifacts", "analysis", "repair", "validation", "system", "examples"];

function slug(value) {
  return value
    .replace(/\.md$/i, "")
    .replace(/\.json$/i, "")
    .replace(/\.schema$/i, "")
    .replace(/[^a-zA-Z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function addResource(resources, seen, resource) {
  if (seen.has(resource.id)) throw new Error("Duplicate Resource Catalog id: " + resource.id);
  seen.add(resource.id);
  resources.push(resource);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function catalogDocuments(resources, seen) {
  const rootPath = "docs/README.md";
  const rootText = readFileSync(rootPath, "utf8");
  const rootMetadata = readDocumentMetadata(
    rootText,
    rootPath,
  );
  addResource(resources, seen, {
    ...rootMetadata,
    path: rootPath,
  });

  for (const domain of DOC_DOMAINS) {
    const dir = join("docs", domain);
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const path = join(dir, entry.name).replaceAll("\\", "/");
      const text = readFileSync(path, "utf8");
      const metadata = readDocumentMetadata(
        text,
        path,
      );
      addResource(resources, seen, {
        ...metadata,
        path,
      });
    }
  }
}

function modulesFromOwnership(path, field) {
  const data = readJson(path);
  const result = [];
  for (const config of Object.values(data.groups ?? {})) {
    for (const value of config[field] ?? []) result.push(value);
  }
  return result;
}


function catalogExamples(resources, seen) {
  const root = "docs/examples";
  if (!existsSync(root)) return;

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (entry.name === "README.md") continue;
    if (entry.name.endsWith(".md")) continue;

    const path = join(root, entry.name).replaceAll("\\", "/");
    addResource(resources, seen, {
      id: "example.examples." + slug(entry.name.replace(/\.example(?=\.)/i, "")),
      class: "EXAMPLE",
      domain: "examples",
      authority: "REFERENCE",
      path,
      lifecycle: "ACTIVE",
    });
  }
}


function catalogStandaloneSources(resources, seen) {
  for (const resource of [
    {
      id: "source.rules.agent-policy",
      class: "SOURCE",
      domain: "rules",
      authority: "CANONICAL",
      path: "AGENTS.md",
      lifecycle: "ACTIVE",
    },
    {
      id: "source.rules.github-policy",
      class: "SOURCE",
      domain: "rules",
      authority: "CANONICAL",
      path: "GITHUB_RULES.md",
      lifecycle: "ACTIVE",
    },
    {
      id: "source.rules.improve-system-skill",
      class: "SOURCE",
      domain: "rules",
      authority: "CANONICAL",
      path: ".agents/skills/m-bedrock-system-improvement/SKILL.md",
      lifecycle: "ACTIVE",
    },
    {
      id: "source.rules.test-map-skill",
      class: "SOURCE",
      domain: "rules",
      authority: "CANONICAL",
      path: ".agents/skills/m-bedrock-map-testing/SKILL.md",
      lifecycle: "ACTIVE",
    },
    {
      id: "source.rules.capabilities",
      class: "SOURCE",
      domain: "rules",
      authority: "CANONICAL",
      path: "engine/rules/capabilities",
      lifecycle: "ACTIVE",
    },
    {
      id: "source.runtime.bedrock-reliability-harness",
      class: "SOURCE",
      domain: "runtime",
      authority: "CANONICAL",
      path: "engine/runtime/bedrock-reliability-harness",
      lifecycle: "ACTIVE",
    },
    {
      id: "source.runtime.lab",
      class: "SOURCE",
      domain: "runtime",
      authority: "CANONICAL",
      path: "engine/runtime/lab",
      lifecycle: "ACTIVE",
    },
    {
      id: "source.design.design-system",
      class: "SOURCE",
      domain: "design",
      authority: "CANONICAL",
      path: "engine/design",
      lifecycle: "ACTIVE",
    },
  ]) {
    if (!existsSync(resource.path)) continue;
    addResource(resources, seen, resource);
  }
}

function catalogSourceModules(resources, seen) {
  const groups = [
    ["package", "engine/packages", "engine/packages/ownership.json", "modules"],
    ["analyzer", "engine/analyzers", "engine/analyzers/ownership.json", "modules"],
    ["adapter", "engine/adapters", "engine/adapters/ownership.json", "modules"],
    ["app", "apps", "apps/ownership.json", "entries"],
    ["tooling", "tooling", "tooling/ownership.json", "entries"],
  ];

  for (const [domain, root, ownershipPath, field] of groups) {
    for (const name of modulesFromOwnership(ownershipPath, field)) {
      const path = join(root, name).replaceAll("\\", "/");
      if (!existsSync(path)) continue;
      addResource(resources, seen, {
        id: "source." + domain + "." + slug(name),
        class: "SOURCE",
        domain,
        authority: "CANONICAL",
        path,
        lifecycle: "ACTIVE",
      });
    }
  }
}

function registerFactCatalog(
  resources,
  seen,
  path,
  authority,
) {
  const catalog = readJson(path);

  const entries = [
    ...(catalog.facts ?? []),
    ...(catalog.relations ?? []),
  ];

  for (const entry of entries) {
    if (
      typeof entry.id !== "string" ||
      !entry.id.trim() ||
      typeof entry.domain !== "string" ||
      !entry.domain.trim()
    ) {
      throw new Error(
        "Invalid knowledge fact/relation in " + path,
      );
    }

    addResource(resources, seen, {
      id: "knowledge." + entry.id,
      class: "KNOWLEDGE",
      domain: slug(entry.domain),
      authority,
      path,
      locator: entry.id,
      lifecycle: "ACTIVE",
    });
  }
}

function catalogKnowledge(resources, seen) {
  const ownership = readJson("engine/knowledge/ownership.json");

  for (const config of Object.values(ownership.groups ?? {})) {
    for (const file of config.files ?? []) {
      registerFactCatalog(
        resources,
        seen,
        join("engine/knowledge", file).replaceAll("\\", "/"),
        "REFERENCE",
      );
    }
  }

  const engineering = readJson(
    "engine/contracts/engineering/ownership.json",
  );

  for (const config of Object.values(engineering.groups ?? {})) {
    for (const file of config.files ?? []) {
      registerFactCatalog(
        resources,
        seen,
        join(
          "engine/contracts/engineering/catalogs",
          file,
        ).replaceAll("\\", "/"),
        "CANONICAL",
      );
    }
  }
}


function reliabilityFiles(root) {
  if (!existsSync(root)) return [];

  return readdirSync(root, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(root, entry.name);
      if (entry.isDirectory()) return reliabilityFiles(path);
      if (!entry.isFile()) return [];
      if (entry.name === "README.md") return [];
      if (!/\.(?:json|md)$/i.test(entry.name)) return [];
      return [path];
    })
    .sort();
}

function catalogReliability(resources, seen) {
  for (const [bucket, authority] of [
    ["catalogs", "REFERENCE"],
    ["corpus", "REFERENCE"],
    ["history", "HISTORICAL"],
  ]) {
    const root = "engine/reliability/" + bucket;

    for (const rawPath of reliabilityFiles(root)) {
      if (
        bucket === "history" &&
        !rawPath.endsWith(".json")
      ) {
        continue;
      }
      const path = rawPath.replaceAll("\\", "/");
      const rel = relative(root, rawPath).replaceAll("\\", "/");
      addResource(resources, seen, {
        id:
          "reliability." +
          bucket +
          "." +
          slug(rel),
        class: "RELIABILITY",
        domain: bucket,
        authority,
        path,
        lifecycle: "ACTIVE",
      });
    }
  }
}

function walkJson(root) {
  const result = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) result.push(...walkJson(path));
    else if (entry.isFile() && entry.name.endsWith(".json")) result.push(path);
  }
  return result;
}


function fixtureFiles(root) {
  if (!existsSync(root)) return [];

  return readdirSync(root, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(root, entry.name);
      if (entry.isDirectory()) return fixtureFiles(path);
      if (!entry.isFile()) return [];
      if (entry.name === "README.md") return [];
      return [path];
    })
    .sort();
}

function catalogFixtures(resources, seen) {
  const root = "engine/fixtures";

  for (const rawPath of fixtureFiles(root)) {
    const path = rawPath.replaceAll("\\", "/");
    const rel = relative(root, rawPath).replaceAll("\\", "/");
    addResource(resources, seen, {
      id: "reliability.fixtures." + slug(rel),
      class: "RELIABILITY",
      domain: "fixtures",
      authority: "REFERENCE",
      path,
      lifecycle: "ACTIVE",
    });
  }
}

function catalogSchemas(resources, seen) {
  const designSchema = "engine/design/schema/v1.schema.json";
  if (existsSync(designSchema)) {
    addResource(resources, seen, {
      id: "schema.design.v1",
      class: "SCHEMA",
      domain: "design",
      authority: "CANONICAL",
      path: designSchema,
      lifecycle: "ACTIVE",
    });
  }

  for (const rawPath of walkJson("engine/schemas")) {
    const path = rawPath.replaceAll("\\", "/");
    const rel = relative("engine/schemas", rawPath).replaceAll("\\", "/");
    const parts = rel.split("/");
    const domain = slug(parts.length > 1 ? parts[0] : "engine");
    const name = slug(parts.slice(1).join("-") || parts[0]);
    addResource(resources, seen, {
      id: "schema." + domain + "." + name,
      class: "SCHEMA",
      domain,
      authority: "CANONICAL",
      path,
      lifecycle: "ACTIVE",
    });
  }
}

export function buildResourceCatalog() {
  const resources = [];
  const seen = new Set();

  catalogDocuments(resources, seen);
  catalogExamples(resources, seen);
  catalogSourceModules(resources, seen);
  catalogStandaloneSources(resources, seen);
  catalogKnowledge(resources, seen);
  catalogReliability(resources, seen);
  catalogFixtures(resources, seen);
  catalogSchemas(resources, seen);

  resources.sort((a, b) => a.id.localeCompare(b.id));
  return { schemaVersion: 1, resources };
}

export function resourceIdForDocumentPath(path) {
  const normalized = path.replaceAll("\\", "/");
  return readDocumentMetadata(
    readFileSync(normalized, "utf8"),
    normalized,
  ).id;
}