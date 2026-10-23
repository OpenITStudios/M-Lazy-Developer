import ts from "typescript";

export type ScriptSourceShape =
  | "explicit-source"
  | "modular-compiled"
  | "bundled-minified"
  | "mixed"
  | "unknown";

export interface ScriptSourceRecoveryProfile {
  shape: ScriptSourceShape;
  sourceMapReference?: string;
  bundlerHints: readonly string[];
  minificationSignals: readonly string[];
  recoverable: {
    sourceMap: boolean;
    namedFunctions: number;
    namedClasses: number;
    imports: number;
    exports: number;
  };
  confidence: "high" | "medium" | "low";
  limitations: readonly string[];
}

/** A cheap metadata lookup; full source-shape analysis parses the AST only
 * when that separate question is actually needed.
 */
export function sourceMapReferenceFromScript(text: string): string | undefined {
  return text.match(/[#@]\s*sourceMappingURL=([^\s*]+)/)?.[1];
}


/** Inline bundler comments are untrusted navigation hints, never source maps. */
export interface BundledSourceSectionHint {
  readonly generatedLine: number;
  readonly claimedOriginalPath: string;
}

export interface BundledSourceSectionIndex {
  readonly hints: readonly BundledSourceSectionHint[];
  readonly omitted: number;
}

/** A bounded, read-only fallback for esbuild-style "// packs/.../file.ts"
 * sections when the selected artifact has no usable .map file. It does not
 * establish original line numbers, runtime execution, or source ownership.
 */
export function bundledSourceSectionsFromScript(
  text: string,
  maxHints = 64,
): BundledSourceSectionIndex {
  if (!Number.isSafeInteger(maxHints) || maxHints < 1 || maxHints > 128) {
    throw new Error("Bundled source section limit must be an integer from 1 to 128.");
  }
  const hints: BundledSourceSectionHint[] = [];
  let omitted = 0;
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (!line.startsWith("// ")) continue;
    const claimedOriginalPath = line.slice(3).trim();
    if (claimedOriginalPath.length > 250 ||
        !/^(?:packs|src|scripts)\/[A-Za-z0-9_. /-]+\.[cm]?[jt]sx?$/.test(claimedOriginalPath) ||
        claimedOriginalPath.split("/").some(segment => segment === "." || segment === "..") ||
        claimedOriginalPath.includes("//")) {
      continue;
    }
    if (hints.length < maxHints) {
      hints.push({ generatedLine: index + 1, claimedOriginalPath });
    } else {
      omitted += 1;
    }
  }
  return { hints, omitted };
}

export function analyzeScriptSourceRecovery(
  path: string,
  text: string,
): ScriptSourceRecoveryProfile {
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true,
    path.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.JS);

  let namedFunctions = 0, namedClasses = 0, imports = 0, exports = 0;
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name) namedFunctions++;
    if (ts.isClassDeclaration(node) && node.name) namedClasses++;
    if (ts.isImportDeclaration(node)) imports++;
    if (ts.isExportDeclaration(node) ||
        ((ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined)
          ?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false)) exports++;
    ts.forEachChild(node, visit);
  };
  visit(file);

  const sourceMapReference = sourceMapReferenceFromScript(text);
  const bundlerHints = [
    /__webpack_require__/.test(text) ? "webpack-runtime" : undefined,
    /webpackChunk/.test(text) ? "webpack-chunk" : undefined,
    /__commonJS|__toESM|__export/.test(text) ? "esbuild-runtime" : undefined,
    /define\(.+factory|require\(.+exports/.test(text) ? "module-wrapper" : undefined,
  ].filter((x): x is string => x !== undefined);

  const lines = text.split(/\r?\n/);
  const avgLine = text.length / Math.max(1, lines.length);
  const tinyIdentifiers = [...text.matchAll(/\b[A-Za-z_$][\w$]*\b/g)]
    .map((m) => m[0]).filter((id) => id.length <= 2).length;
  const identifiers = [...text.matchAll(/\b[A-Za-z_$][\w$]*\b/g)].length;
  const tinyRatio = identifiers === 0 ? 0 : tinyIdentifiers / identifiers;
  const minificationSignals = [
    avgLine > 500 ? "very-long-lines" : undefined,
    lines.length <= 5 && text.length > 5000 ? "few-lines-large-source" : undefined,
    tinyRatio > 0.35 ? "high-short-identifier-ratio" : undefined,
  ].filter((x): x is string => x !== undefined);

  const bundled = bundlerHints.length > 0;
  const minified = minificationSignals.length > 0;
  const modular = imports + exports > 0;

  const shape: ScriptSourceShape =
    bundled && minified ? "bundled-minified" :
    bundled || (minified && !modular) ? "mixed" :
    modular ? "modular-compiled" :
    namedFunctions + namedClasses > 0 ? "explicit-source" :
    "unknown";

  return {
    shape,
    ...(sourceMapReference ? { sourceMapReference } : {}),
    bundlerHints,
    minificationSignals,
    recoverable: {
      sourceMap: Boolean(sourceMapReference),
      namedFunctions,
      namedClasses,
      imports,
      exports,
    },
    confidence:
      shape === "bundled-minified" || shape === "modular-compiled"
        ? "high"
        : shape === "unknown" ? "low" : "medium",
    limitations: [
      ...(sourceMapReference ? [] : ["No source-map reference was discovered."]),
      ...(bundled ? ["Bundle wrapper recovery is structural only; original module boundaries are not asserted without evidence."] : []),
      ...(minified ? ["Minified identifiers are not promoted to semantic names without supporting evidence."] : []),
    ],
  };
}
