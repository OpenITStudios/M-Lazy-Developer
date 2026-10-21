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

export function sourceRefHasPreciseLocation(
  source: SourceRef,
): boolean {
  return sourceRefPrecision(source) !== "file";
}
