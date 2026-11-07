import ts from "typescript";
import { existsSync, realpathSync, statSync } from "node:fs";
import { dirname, extname, isAbsolute, normalize, relative, resolve, sep } from "node:path";

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs"];

/** One repository-native literal import resolver. Symbolic links outside the
 * source root, ambiguous TS/JS source candidates and calculated imports are
 * never silently promoted into known dependency edges. */
export function resolveRelativeSourceImport(fromFile, specifier, sourceRoot = process.cwd()) {
  if (typeof specifier !== "string" || !specifier.startsWith(".")) {
    return { status: "NOT_RELATIVE", candidates: [] };
  }
  const root = realpathSync(resolve(sourceRoot));
  const base = normalize(resolve(dirname(resolve(fromFile)), specifier));
  const rel = relative(root, base);
  if (rel === ".." || rel.startsWith(".." + sep) || isAbsolute(rel)) {
    return { status: "OUTSIDE_ROOT", candidates: [] };
  }

  const extension = extname(base);
  const candidates = [];
  if (SOURCE_EXTENSIONS.includes(extension)) {
    candidates.push(base);
    const aliasExtensions = extension === ".js" ? [".ts", ".tsx", ".mts", ".cts"]
      : extension === ".mjs" ? [".mts"]
      : extension === ".cjs" ? [".cts"] : [];
    const stem = base.slice(0, -extension.length);
    candidates.push(...aliasExtensions.map((suffix) => stem + suffix));
  } else if (!extension) {
    candidates.push(base);
    for (const suffix of SOURCE_EXTENSIONS) candidates.push(base + suffix);
    for (const suffix of SOURCE_EXTENSIONS) candidates.push(resolve(base, "index" + suffix));
  } else {
    return { status: "UNRESOLVED", candidates: [] };
  }

  const matches = [];
  for (const candidate of candidates) {
    if (!existsSync(candidate) || !statSync(candidate).isFile()) continue;
    const actual = realpathSync(candidate);
    const relativeActual = relative(root, actual);
    if (relativeActual === ".." || relativeActual.startsWith(".." + sep) ||
        isAbsolute(relativeActual)) {
      return { status: "OUTSIDE_ROOT", candidates: [] };
    }
    if (!matches.includes(actual)) matches.push(actual);
  }
  if (matches.length > 1) return { status: "AMBIGUOUS", candidates: matches };
  if (matches.length === 0) return { status: "UNRESOLVED", candidates: [] };
  return { status: "RESOLVED", path: matches[0], candidates: matches };
}


// Derive actual imports from AST, never from text in comments, template strings
// or generated source examples (which previously produced phantom edges).
export function importSpecifiers(filePath, content, includeLocalResources = false, includeSourceSites = false) {
  const kind = filePath.endsWith(".tsx") ? ts.ScriptKind.TSX :
    /\.[cm]?js$/.test(filePath) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const file = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, kind);
  const found = [];
  const add = (specifier, runtime, node, syntax) => {
    const result = { specifier, runtime };
    if (includeSourceSites) {
      const site = file.getLineAndCharacterOfPosition(node.getStart(file));
      result.line = site.line + 1;
      result.column = site.character + 1;
      result.syntax = syntax;
    }
    found.push(result);
  };
  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      const typeOnly = ts.isImportDeclaration(node)
        ? (node.importClause?.isTypeOnly === true ||
           (node.importClause?.namedBindings &&
            ts.isNamedImports(node.importClause.namedBindings) &&
            node.importClause.namedBindings.elements.length > 0 &&
            node.importClause.namedBindings.elements.every(item => item.isTypeOnly)))
        : (node.isTypeOnly ||
           (node.exportClause && ts.isNamedExports(node.exportClause) &&
            node.exportClause.elements.length > 0 &&
            node.exportClause.elements.every(item => item.isTypeOnly)));
      add(node.moduleSpecifier.text, !typeOnly, node.moduleSpecifier, ts.isImportDeclaration(node) ? "STATIC_IMPORT" : "RE_EXPORT");
    }
    // Type-position import("./types.js") references a source module but
    // never creates a runtime dependency edge.
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) &&
        ts.isStringLiteralLike(node.argument.literal)) {
      add(node.argument.literal.text, false, node.argument.literal, "IMPORT_TYPE");
    }
    if (ts.isImportEqualsDeclaration(node) &&
        ts.isExternalModuleReference(node.moduleReference) &&
        node.moduleReference.expression && ts.isStringLiteralLike(node.moduleReference.expression)) {
      add(node.moduleReference.expression.text, !node.isTypeOnly, node.moduleReference.expression, "IMPORT_EQUALS");
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) {
      add(node.arguments[0].text, true, node.arguments[0], "DYNAMIC_LITERAL");
    }
    // Opt-in static resource edge; default imports remain unchanged for
    // repository dependency graph consumers.
    if (includeLocalResources && ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) && node.expression.text === "URL" &&
        node.arguments?.length === 2 &&
        ts.isStringLiteralLike(node.arguments[0])) {
      const base = node.arguments[1];
      if (ts.isPropertyAccessExpression(base) && base.name.text === "url" &&
          ts.isMetaProperty(base.expression) &&
          base.expression.keywordToken === ts.SyntaxKind.ImportKeyword &&
          base.expression.name.text === "meta") {
        add(node.arguments[0].text, true, node.arguments[0], "LOCAL_RESOURCE");
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

