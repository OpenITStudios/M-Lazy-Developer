import { posix } from "node:path";
import type { SourceRef } from "../../../../packages/project-model/src/index.js";
import type { ParsedScriptFile } from "../core/types.js";

const EXTENSIONS = [".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"];

function withoutExtension(path: string): string {
  for (const extension of EXTENSIONS) {
    if (path.endsWith(extension)) return path.slice(0, -extension.length);
  }
  return path;
}

function normalize(path: string): string {
  return posix.normalize(path.replaceAll("\\", "/"));
}

function packRoot(path: string): string | undefined {
  const parts = normalize(path).split("/");
  return parts.length >= 3 &&
    (parts[0] === "behavior_packs" || parts[0] === "resource_packs")
    ? parts.slice(0, 2).join("/") : undefined;
}

function relativeCandidates(fromPath: string, module: string): string[] {
  const base = normalize(posix.join(posix.dirname(normalize(fromPath)), module));
  const stem = withoutExtension(base);
  const candidates = new Set<string>([base]);
  for (const extension of EXTENSIONS) candidates.add(stem + extension);
  for (const extension of EXTENSIONS) {
    candidates.add(posix.join(stem, "index" + extension));
  }
  return [...candidates];
}

export interface ScriptImportResolution {
  fromIdentifier: string;
  fromSourcePath: string;
  module: string;
  targetSourcePath?: string;
  status: "resolved" | "unresolved" | "external";
  targetIdentifier?: string;
  /** Runtime-insignificant ESM type import, retained for source inventory. */
  typeOnly?: boolean;
  /** Source-site receipt only. Presence does not establish module execution. */
  importSyntax?: "dynamic-literal" | "dynamic-expression";
  executionRegion?: string;
  source?: SourceRef;
  lexicalGuards?: ParsedScriptFile["imports"][number]["lexicalGuards"];
  precedenceGuards?: ParsedScriptFile["imports"][number]["precedenceGuards"];
  sourceSequence?: ParsedScriptFile["imports"][number]["sourceSequence"];
}

export function resolveScriptImports(
  files: readonly ParsedScriptFile[],
): ScriptImportResolution[] {
  // A path may appear more than once in synthetic or mixed-version inputs.
  // Never silently let a later script replace an earlier source owner.
  const byPath = new Map<string, ParsedScriptFile[]>();
  for (const file of files) {
    const key = normalize(file.source.relativePath);
    byPath.set(key, [...(byPath.get(key) ?? []), file]);
  }

  const results: ScriptImportResolution[] = [];
  for (const file of files) {
    const fromPath = normalize(file.source.relativePath);
    const ownPack = packRoot(fromPath);
    for (const imported of file.imports) {
      const origin = {
        fromIdentifier: file.identifier,
        fromSourcePath: file.source.relativePath,
        module: imported.module,
        ...(imported.typeOnly ? { typeOnly: true } : {}),
        ...(imported.importSyntax === undefined ? {} : {
          importSyntax: imported.importSyntax,
          executionRegion: imported.executionRegion,
          source: imported.source,
          lexicalGuards: imported.lexicalGuards,
          precedenceGuards: imported.precedenceGuards,
          sourceSequence: imported.sourceSequence,
        }),
      };
      if (imported.kind === "unresolved") {
        results.push({ ...origin, status: "unresolved" });
        continue;
      }
      if (imported.kind !== "relative") {
        results.push({ ...origin, status: "external" });
        continue;
      }

      const candidates = relativeCandidates(fromPath, imported.module);
      const owned = (candidate: string): readonly ParsedScriptFile[] =>
        (byPath.get(candidate) ?? []).filter(target =>
          target.source.artifactId === file.source.artifactId &&
          packRoot(target.source.relativePath) === ownPack);

      // An exact authored extension is preferable. When a bundler writes
      // ".js" but source is ".ts", permit a fallback only if unambiguous.
      const exact = candidates[0] ? owned(candidates[0]) : [];
      const possible = exact.length > 0
        ? exact
        : [...new Set(candidates.slice(1).flatMap(owned))];
      const target = possible.length === 1 ? possible[0] : undefined;
      if (!target) {
        results.push({ ...origin, status: "unresolved" });
        continue;
      }
      results.push({
        ...origin,
        status: "resolved",
        targetIdentifier: target.identifier,
        targetSourcePath: target.source.relativePath,
      });
    }
  }
  return results;
}
