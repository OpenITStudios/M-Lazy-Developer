import { existsSync, readFileSync } from "node:fs";
import { posix } from "node:path";
import { buildResourceCatalog, resourceIdForDocumentPath } from "./resource-catalog.mjs";

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
