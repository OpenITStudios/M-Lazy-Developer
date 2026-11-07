import { existsSync, readFileSync, readdirSync, lstatSync } from "node:fs";
import { extname, relative, resolve, sep, posix } from "node:path";
import { buildResourceCatalog, resourceIdForDocumentPath } from "./resource-catalog.mjs";
import { importSpecifiers, resolveRelativeSourceImport } from "./source-import-specifiers.mjs";

const MARKDOWN_LINK = /\[[^\]]*\]\(([^)]+)\)/g;

function cleanTarget(value) {
  return value.trim().replace(/^<|>$/g, "").split("#", 1)[0].split("?", 1)[0];
}

function resolveResourceLink(fromPath, rawTarget) {
  const target = cleanTarget(rawTarget);
  if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) return undefined;
  const resolved = target.startsWith("/")
    ? target.slice(1)
    : posix.normalize(posix.join(posix.dirname(fromPath), target));
  if (resolved === ".." || resolved.startsWith("../")) return undefined;
  return resolved;
}

// Authored Markdown links only. Example links inside fenced code are not
// declarations of repository architecture.
function* authoredLinks(markdown) {
  const lines = markdown.split(/\r?\n/);
  let fence;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
    if (marker) {
      if (!fence) {
        fence = { char: marker[1][0], length: marker[1].length };
      } else if (marker[1][0] === fence.char &&
                 marker[1].length >= fence.length &&
                 marker[2].trim() === "") {
        fence = undefined;
      }
      continue;
    }
    if (fence) continue;
    for (const match of line.matchAll(MARKDOWN_LINK)) {
      yield { target: match[1], line: index + 1 };
    }
  }
}

function addEdge(edges, seen, edge) {
  if (edge.from === edge.to) return;
  const key = edge.from + "|" + edge.type + "|" + edge.to;
  if (seen.has(key)) return;
  seen.add(key);
  edges.push(edge);
}

export function buildGraph() {
  const catalog = buildResourceCatalog();
  const byPath = new Map();
  for (const resource of catalog.resources) {
    if (resource.lifecycle !== "ACTIVE" || resource.locator !== undefined) continue;
    const previous = byPath.get(resource.path);
    if (previous !== undefined && previous.id !== resource.id) {
      throw new Error("Multiple physical Catalog resources share one path: " + resource.path);
    }
    byPath.set(resource.path, resource);
  }
  const edges = [];
  const seen = new Set();
  for (const resource of catalog.resources) {
    if (resource.lifecycle !== "ACTIVE" ||
        !["DOCUMENT", "SOURCE"].includes(resource.class) ||
        resource.locator !== undefined ||
        !resource.path.endsWith(".md") ||
        !existsSync(resource.path)) continue;

    for (const link of authoredLinks(readFileSync(resource.path, "utf8"))) {
      const targetPath = resolveResourceLink(resource.path, link.target);
      if (!targetPath) continue;
      const target = byPath.get(targetPath);
      if (!target) continue;

      addEdge(edges, seen, {
        from: resource.id,
        type: resource.role === "ROUTER" ? "ROUTES_TO" :
          target.class === "KNOWLEDGE" ? "USES" : "RELATES_TO",
        to: target.id,
        basis: "EXTRACTED",
        evidence: { path: resource.path, line: link.line, target: link.target },
      });
    }
  }

  // Declaration-only analyzer/proof bindings are not usage/execution proof.
  edges.sort((a, b) => {
    const left = a.from + "|" + a.type + "|" + a.to;
    const right = b.from + "|" + b.type + "|" + b.to;
    return left.localeCompare(right);
  });
  return { schemaVersion: 1, edges };
}

export function documentGraphRootId() {
  return resourceIdForDocumentPath("docs/README.md");
}


// Repository source dependency intelligence is a DERIVED, opt-in projection.
// Keep it OUT of the documentation/knowledge Retrieval Graph; otherwise a
// module-level import can spuriously turn unrelated Knowledge into "USES".
const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs"]);
const SKIP_SOURCE_DIRS = new Set([
  "node_modules", "test", "tests", "__tests__", "fixtures", "dist",
  "coverage", ".git", ".svelte-kit", "generated",
]);
function* ownedSourceFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_SOURCE_DIRS.has(entry.name)) yield* ownedSourceFiles(path);
    } else if (entry.isFile() && CODE_EXTENSIONS.has(extname(entry.name))) {
      yield path;
    }
  }
}

function repositoryPath(fullPath, root) {
  return relative(root, fullPath).split(sep).join("/");
}

/** Resolve a registered module owner by its source ID OR a relative
 * repository path. Reject absolute/out-of-repo path selections. */
export function resolveSourceOwner(resources, input) {
  if (typeof input !== "string" || !input || input.includes("\0")) return undefined;
  const normalized = input.replaceAll("\\", "/").replace(/^(\.\/)+/, "");
  if (normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized) ||
      normalized.includes("://") || normalized.split("/").includes("..")) {
    return undefined;
  }
  const modules = resources.filter((resource) =>
    resource.class === "SOURCE" && resource.lifecycle === "ACTIVE" &&
    !resource.locator && !resource.path.endsWith(".md"));
  const byId = modules.find((resource) => resource.id === normalized);
  if (byId) return byId;
  return modules
    .filter((resource) =>
      normalized === resource.path ||
      normalized.startsWith(resource.path + "/"))
    .sort((a, b) => b.path.length - a.path.length ||
      a.id.localeCompare(b.id))[0];
}

/** AST source import sites → registered SOURCE module links.
 * One DEPENDS_ON edge per exact module pair, with all known source sites.
 * Includes type-only imports because edits can affect TypeScript contracts.
 * Literal dynamic import is a source-declared dependency, not executed code.
 * Ambiguous/unresolved/nonregistered paths remain explicit open obligations.
 */
export function buildSourceDependencyGraph(options = {}) {
  const root = resolve(options.root ?? process.cwd());
  const catalog = options.catalog ?? buildResourceCatalog();
  const modules = catalog.resources.filter((resource) =>
    resource.class === "SOURCE" && resource.lifecycle === "ACTIVE" &&
    !resource.locator && !resource.path.endsWith(".md") &&
    existsSync(resolve(root, resource.path)) &&
    lstatSync(resolve(root, resource.path)).isDirectory());
  const pairs = new Map();
  const unresolved = [];
  let scannedSourceFiles = 0;

  for (const owner of modules) {
    for (const fullPath of ownedSourceFiles(resolve(root, owner.path))) {
      scannedSourceFiles += 1;
      const path = repositoryPath(fullPath, root);
      const imports = importSpecifiers(fullPath, readFileSync(fullPath, "utf8"), false, true);
      for (const site of imports) {
        if (!site.specifier.startsWith(".")) continue;
        const resolution = resolveRelativeSourceImport(fullPath, site.specifier, root);
        if (resolution.status !== "RESOLVED") {
          unresolved.push({
            from: owner.id, path, line: site.line, target: site.specifier,
            reason: resolution.status,
          });
          continue;
        }
        const targetPath = repositoryPath(resolution.path, root);
        const target = resolveSourceOwner(modules, targetPath);
        if (!target) {
          unresolved.push({
            from: owner.id, path, line: site.line, target: site.specifier,
            reason: "UNREGISTERED_TARGET_OWNER",
          });
          continue;
        }
        if (target.id === owner.id) continue; // Internal implementation, not module-level impact.
        const key = owner.id + "|" + target.id;
        const edge = pairs.get(key) ?? {
          from: owner.id, type: "DEPENDS_ON", to: target.id,
          basis: "EXTRACTED", sourceSites: [],
        };
        edge.sourceSites.push({
          path, line: site.line, column: site.column,
          target: site.specifier, targetPath,
          runtime: site.runtime, syntax: site.syntax,
        });
        pairs.set(key, edge);
      }
    }
  }

  const edges = [...pairs.values()].map((edge) => {
    edge.sourceSites.sort((a, b) =>
      a.path.localeCompare(b.path) || a.line - b.line ||
      a.column - b.column || a.target.localeCompare(b.target));
    const first = edge.sourceSites[0];
    return {
      ...edge,
      // Existing GraphEdge explanation can display one witness; detailed
      // impact output retains EVERY sourceSites entry separately.
      evidence: { path: first.path, line: first.line, target: first.target },
    };
  }).sort((a, b) =>
    a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  unresolved.sort((a, b) =>
    a.from.localeCompare(b.from) || a.path.localeCompare(b.path) ||
    a.line - b.line || a.target.localeCompare(b.target));
  return {
    mode: "SOURCE_MODULE_DEPENDENCY_PROJECTION",
    proofBoundary: "STATIC_LITERAL_IMPORTS_ONLY_NOT_CALLSITE_OR_EXECUTION_PROOF",
    scannedSourceFiles,
    scannedModules: modules.length,
    edges,
    unresolved,
  };
}
