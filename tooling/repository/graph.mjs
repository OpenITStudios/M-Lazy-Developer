import { existsSync, readFileSync, readdirSync, lstatSync, realpathSync } from "node:fs";
import { extname, isAbsolute, relative, resolve, sep, posix } from "node:path";
import { buildResourceCatalog, resourceIdForDocumentPath } from "./resource-catalog.mjs";
import { importSpecifiers, resolveRelativeSourceImport } from "./source-import-specifiers.mjs";

const TICK = String.fromCharCode(96);
const MARKDOWN_LINK = /\[[^\]\n]*\]\(([^)\n]+)\)/g;
const WIKI_LINK = /(!?)\[\[([^\]\n]+)\]\]/g;
const FENCE_MARKER = new RegExp("^ {0,3}(" + TICK + "{3,}|~{3,})(.*)$");

function cleanTarget(value) {
  return value.trim().replace(/^<|>$/g, "").split("#", 1)[0].split("?", 1)[0];
}

function resolveResourceLink(fromPath, rawTarget, syntax) {
  const target = cleanTarget(rawTarget);
  if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) return undefined;
  if (syntax === "OBSIDIAN_WIKILINK") {
    // Only explicit repository-root file identities. Obsidian's fuzzy
    // filename/alias lookup must not elect an ambiguous canonical owner.
    if (!/^(docs|engine|tooling|apps|\.agents)\//.test(target) &&
        !["AGENTS.md", "GITHUB_RULES.md", "CONTEXT.md", "README.md"].includes(target)) {
      return undefined;
    }
    const direct = posix.normalize(target.replace(/^\//, ""));
    if (direct === ".." || direct.startsWith("../")) return undefined;
    return direct;
  }

  const resolved = target.startsWith("/")
    ? target.slice(1)
    : posix.normalize(posix.join(posix.dirname(fromPath), target));
  if (resolved === ".." || resolved.startsWith("../")) return undefined;
  return resolved;
}

function escapedAt(text, index) {
  let slashes = 0;
  for (let i = index - 1; i >= 0 && text[i] === "\\"; i -= 1) slashes += 1;
  return slashes % 2 === 1;
}

// Mask code spans and HTML comments without shifting line offsets. Keep
// state so a multi-line code span/comment cannot leak fictitious edges.
function maskNonProse(line, state) {
  const out = [...line];
  let index = 0;
  const mask = (start, end) => {
    for (let i = start; i < end; i += 1) out[i] = " ";
  };
  while (index < line.length) {
    if (state.comment) {
      const end = line.indexOf("-->", index);
      if (end < 0) {
        mask(index, line.length);
        break;
      }
      mask(index, end + 3);
      state.comment = false;
      index = end + 3;
      continue;
    }
    if (state.inlineTicks > 0) {
      if (line[index] === TICK) {
        let end = index;
        while (line[end] === TICK) end += 1;
        mask(index, end);
        if (end - index === state.inlineTicks) state.inlineTicks = 0;
        index = end;
      } else {
        out[index] = " ";
        index += 1;
      }
      continue;
    }
    if (line.startsWith("<!--", index)) {
      state.comment = true;
      continue;
    }
    if (line[index] === TICK && !escapedAt(line, index)) {
      let end = index;
      while (line[end] === TICK) end += 1;
      state.inlineTicks = end - index;
      mask(index, end);
      index = end;
      continue;
    }
    index += 1;
  }
  return out.join("");
}

/** Exact authored navigation references only. Not code dependencies, usage
 * proof, Obsidian alias resolution, or executable source trace. */
export function* authoredLinks(markdown) {
  const lines = markdown.split(/\r?\n/);
  const state = { fence: undefined, comment: false, inlineTicks: 0 };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const marker = line.match(FENCE_MARKER);
    if (state.fence) {
      if (marker && marker[1][0] === state.fence.char &&
          marker[1].length >= state.fence.length &&
          marker[2].trim() === "") state.fence = undefined;
      continue;
    }
    if (!state.comment && state.inlineTicks === 0 && marker) {
      state.fence = { char: marker[1][0], length: marker[1].length };
      continue;
    }
    // Indented blocks are code, not navigable authored relationships.
    if (!state.comment && state.inlineTicks === 0 && /^( {4}|\t)/.test(line)) continue;
    const prose = maskNonProse(line, state);
    for (const match of prose.matchAll(MARKDOWN_LINK)) {
      const at = match.index ?? 0;
      if (escapedAt(prose, at) || (at > 0 && prose[at - 1] === "!")) continue;
      yield { target: match[1], line: index + 1, syntax: "MARKDOWN_INLINE" };
    }
    for (const match of prose.matchAll(WIKI_LINK)) {
      const at = match.index ?? 0;
      if (match[1] === "!" || escapedAt(prose, at)) continue;
      const target = match[2].split("|", 1)[0].trim();
      if (!target) continue;
      yield { target, line: index + 1, syntax: "OBSIDIAN_WIKILINK" };
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
      const targetPath = resolveResourceLink(resource.path, link.target, link.syntax);
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
export function resolveSourceOwner(resources, input, options = {}) {
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

  // In public --impact input, a file path MUST exist. Mere prefix matching
  // would otherwise report impact for a fictitious or outside-root file.
  // Registered module directory and stable SOURCE ID selection remain valid.
  const moduleDirectory = modules.some((resource) => normalized === resource.path);
  if (options.requireExistingSourceFile && !moduleDirectory) {
    if (!CODE_EXTENSIONS.has(extname(normalized))) return undefined;
    const root = resolve(options.root ?? process.cwd());
    const selected = resolve(root, normalized);
    if (!existsSync(root) || !existsSync(selected) ||
        !lstatSync(selected).isFile()) return undefined;
    const realRoot = realpathSync(root);
    const realSelected = realpathSync(selected);
    const rel = relative(realRoot, realSelected);
    if (rel === ".." || rel.startsWith(".." + sep) || isAbsolute(rel)) {
      return undefined;
    }
  }
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
  const excluded = [];
  let scannedSourceFiles = 0;

  for (const owner of modules) {
    for (const fullPath of ownedSourceFiles(resolve(root, owner.path))) {
      scannedSourceFiles += 1;
      const path = repositoryPath(fullPath, root);
      const unknownCalls = [];
      const imports = importSpecifiers(
        fullPath, readFileSync(fullPath, "utf8"), false, true, unknownCalls,
      );
      for (const call of unknownCalls) {
        unresolved.push({
          from: owner.id, path, line: call.line, column: call.column,
          target: call.target, syntax: call.syntax, reason: call.reason,
        });
      }
      for (const site of imports) {
        if (!site.specifier.startsWith(".")) {
          // Explicitly out of scope, not silently omitted or invented as
          // an internal SOURCE module dependency (may be a package or alias).
          if (!site.specifier.startsWith("node:")) {
            excluded.push({
              from: owner.id, path, line: site.line, column: site.column,
              target: site.specifier, syntax: site.syntax,
              reason: "NON_RELATIVE_SPECIFIER_OUT_OF_SCOPE",
            });
          }
          continue;
        }
        const resolution = resolveRelativeSourceImport(fullPath, site.specifier, root);
        if (resolution.status !== "RESOLVED") {
          unresolved.push({
            from: owner.id, path, line: site.line, column: site.column,
            target: site.specifier, syntax: site.syntax,
            reason: resolution.status,
          });
          continue;
        }
        const targetPath = repositoryPath(resolution.path, root);
        const target = resolveSourceOwner(modules, targetPath);
        if (!target) {
          unresolved.push({
            from: owner.id, path, line: site.line, column: site.column,
            target: site.specifier, syntax: site.syntax,
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
  const sourceSiteOrder = (a, b) =>
    a.from.localeCompare(b.from) || a.path.localeCompare(b.path) ||
    a.line - b.line || (a.column ?? 0) - (b.column ?? 0) ||
    a.target.localeCompare(b.target);
  unresolved.sort(sourceSiteOrder);
  excluded.sort(sourceSiteOrder);
  return {
    mode: "SOURCE_MODULE_DEPENDENCY_PROJECTION",
    proofBoundary: "STATIC_LITERAL_IMPORTS_ONLY_NOT_CALLSITE_OR_EXECUTION_PROOF",
    scannedSourceFiles,
    scannedModules: modules.length,
    edges,
    unresolved,
    excluded,
  };
}
