export interface SourceRange {
  lineStart?: number;
  lineEnd?: number;
  columnStart?: number;
  columnEnd?: number;
}

export interface SourceRef {
  artifactId: string;
  relativePath: string;
  range?: SourceRange;
  jsonPointer?: string;
}

/** Parser-authored statement position; not a proof that a statement ran. */
export interface SourceSequentialSite {
  readonly block: SourceRef;
  readonly statementIndex: number;
  /** Entire expression statement is the observed call, not a nested call. */
  readonly directCall: boolean;
  /** Unshadowed, named ESM import of the Minecraft world singleton. */
  readonly stableWorldReceiver?: boolean;
}

/** Immutable authored generation snapshot before scheduling; this is NOT
 * a runtime generation or guarded-mutation proof.
 */
export interface SourceGenerationCapture {
  readonly capturedIdentifier: string;
  readonly ownerExpression: string;
  readonly generationExpression: string;
  readonly captureSource: SourceRef;
  readonly ownerBindingSource: SourceRef;
}

export type SourceRefPrecision =
  | "file"
  | "line"
  | "json-pointer";

export function sourceRefPrecision(
  source: SourceRef,
): SourceRefPrecision {
  if (source.jsonPointer !== undefined) {
    return "json-pointer";
  }
  if (
    source.range?.lineStart !== undefined ||
    source.range?.lineEnd !== undefined
  ) {
    return "line";
  }
  return "file";
}

export function validateSourceRef(
  source: SourceRef,
): readonly string[] {
  const errors: string[] = [];

  if (!source.artifactId.trim()) {
    errors.push("artifactId must be non-empty.");
  }
  if (!source.relativePath.trim()) {
    errors.push("relativePath must be non-empty.");
  }

  const range = source.range;
  if (range) {
    const values = [
      ["lineStart", range.lineStart],
      ["lineEnd", range.lineEnd],
      ["columnStart", range.columnStart],
      ["columnEnd", range.columnEnd],
    ] as const;

    for (const [name, value] of values) {
      if (
        value !== undefined &&
        (!Number.isInteger(value) || value < 1)
      ) {
        errors.push(
          name + " must be a positive integer when present.",
        );
      }
    }

    if (
      range.lineStart !== undefined &&
      range.lineEnd !== undefined &&
      range.lineEnd < range.lineStart
    ) {
      errors.push(
        "lineEnd must be greater than or equal to lineStart.",
      );
    }

    if (
      range.lineStart !== undefined &&
      range.lineEnd === range.lineStart &&
      range.columnStart !== undefined &&
      range.columnEnd !== undefined &&
      range.columnEnd < range.columnStart
    ) {
      errors.push(
        "columnEnd must be greater than or equal to columnStart on the same line.",
      );
    }
  }

  if (
    source.jsonPointer !== undefined &&
    source.jsonPointer !== "" &&
    !source.jsonPointer.startsWith("/")
  ) {
    errors.push(
      "jsonPointer must be empty or start with '/'.",
    );
  }

  return errors;
}

/**
 * File-identity check for a source evidence locator emitted by one selected
 * artifact. Parse only documented locator suffixes: source line/column,
 * authored localization #L, JSON pointer, or source-symbol @.
 *
 * The caller must separately establish selected-artifact ownership from
 * Gameplay Intent/SourceRef. This cannot prove that an operation executed.
 * Do not use startsWith(path + ":") alone: arbitrary suffixes can turn
 * a filename resemblance into a false join.
 */
export function sourceLocatorMatchesSourcePath(
  locator: string,
  relativePath: string,
): boolean {
  if (!locator || !relativePath || !locator.startsWith(relativePath)) {
    return false;
  }
  const suffix = locator.slice(relativePath.length);
  if (suffix.length === 0) return true;
  if (/^:[1-9]\d*(?::[1-9]\d*){0,3}$/.test(suffix)) {
    return true;
  }
  if (/^#L[1-9]\d*(?:-L?[1-9]\d*)?(?::[1-9]\d*)?$/.test(suffix)) {
    return true;
  }
  if (/^#\/(?:[^\r\n]*)$/.test(suffix)) {
    return true;
  }
  // Author-authored symbol locator; never an unbounded path prefix.
  if (/^@[a-zA-Z0-9_.:/-]+$/.test(suffix)) {
    return true;
  }
  return false;
}

/**
 * Join an independently identified authored record to its source site.
 * File identity alone cannot link another call in the same one-line bundle
 * or a different JSON member. Caller must independently establish exact
 * evidence ID, artifact scope and canonical graph owner.
 *
 * Without an IR line range, a numeric locator establishes only source-file
 * identity, not independently proven line precision. SourceRef has no
 * verified @symbol identity; never guess a symbol from its filename.
 * This does not prove runtime execution or gameplay behavior.
 */
export function sourceLocatorMatchesSourceRef(
  locator: string,
  source: SourceRef,
): boolean {
  if (!sourceLocatorMatchesSourcePath(locator, source.relativePath)) return false;
  const suffix = locator.slice(source.relativePath.length);
  if (suffix === "") return true;
  if (suffix.startsWith("#/")) {
    return source.jsonPointer !== undefined &&
      source.jsonPointer === suffix.slice(1);
  }
  if (suffix.startsWith("@")) return false;
  const position = /^:([1-9]\d*)(?::([1-9]\d*))?(?::([1-9]\d*))?(?::([1-9]\d*))?$/.exec(suffix);
  const localized = /^#L([1-9]\d*)(?:-L?([1-9]\d*))?(?::([1-9]\d*))?$/.exec(suffix);
  if (!position && !localized) return false;
  const firstLine = Number((position ?? localized)![1]);
  const lastLine = Number(position?.[3] ?? localized?.[2] ?? firstLine);
  if (lastLine < firstLine) return false;
  const column = Number(position?.[2] ?? localized?.[3] ?? 0);
  const range = source.range;
  if (range?.lineStart === undefined) return true; // File identity only.
  const endLine = range.lineEnd ?? range.lineStart;
  if (firstLine > endLine || lastLine < range.lineStart) return false;
  if (column > 0 && firstLine === range.lineStart &&
      range.columnStart !== undefined && column < range.columnStart) return false;
  if (column > 0 && firstLine === endLine &&
      range.columnEnd !== undefined && column > range.columnEnd) return false;
  return true;
}

export function sourceRefHasPreciseLocation(
  source: SourceRef,
): boolean {
  return sourceRefPrecision(source) !== "file";
}
