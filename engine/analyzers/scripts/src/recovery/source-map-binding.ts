export interface ParsedSourceMapV3 {
  version: 3;
  file?: string;
  sourceRoot?: string;
  sources: readonly string[];
  names: readonly string[];
  mappings: string;
  sourcesContent?: readonly (string | null)[];
}

export interface SourceMapBinding {
  generatedLine: number;
  generatedColumn: number;
  source?: string;
  originalLine?: number;
  originalColumn?: number;
  name?: string;
  status: "resolved" | "unmapped" | "invalid";
  reason?: string;
}

const BASE64 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function decodeVlq(segment: string): number[] {
  const values: number[] = [];
  let value = 0;
  let shift = 0;

  for (const char of segment) {
    const digit = BASE64.indexOf(char);
    if (digit < 0) {
      throw new Error("Invalid base64 VLQ character: " + char);
    }

    const continuation = (digit & 32) !== 0;
    const payload = digit & 31;
    // Mapping indexes can exceed a signed 32-bit integer. Bitwise shifts
    // silently overflow; arithmetic keeps the VLQ result exact or rejects it.
    value += payload * (2 ** shift);
    if (!Number.isSafeInteger(value)) {
      throw new Error("Base64 VLQ exceeds supported integer precision.");
    }

    if (continuation) {
      shift += 5;
      if (shift > 50) {
        throw new Error("Base64 VLQ is too large.");
      }
      continue;
    }

    const negative = value % 2 === 1;
    const decoded = Math.floor(value / 2);
    values.push(negative ? -decoded : decoded);
    value = 0;
    shift = 0;
  }

  if (shift !== 0) {
    throw new Error("Incomplete base64 VLQ segment.");
  }

  return values;
}

export function parseSourceMapV3(
  input: string | unknown,
): ParsedSourceMapV3 {
  const raw = typeof input === "string"
    ? JSON.parse(input) as Record<string, unknown>
    : input as Record<string, unknown>;

  if (!raw || typeof raw !== "object" || raw.version !== 3) {
    throw new Error("Source map must be version 3.");
  }
  if (!Array.isArray(raw.sources) || !raw.sources.every((x) => typeof x === "string")) {
    throw new Error("Source map sources must be a string array.");
  }
  if (!Array.isArray(raw.names) || !raw.names.every((x) => typeof x === "string")) {
    throw new Error("Source map names must be a string array.");
  }
  if (typeof raw.mappings !== "string") {
    throw new Error("Source map mappings must be a string.");
  }

  return {
    version: 3,
    ...(typeof raw.file === "string" ? { file: raw.file } : {}),
    ...(typeof raw.sourceRoot === "string" ? { sourceRoot: raw.sourceRoot } : {}),
    sources: raw.sources as string[],
    names: raw.names as string[],
    mappings: raw.mappings,
    ...(Array.isArray(raw.sourcesContent)
      ? {
          sourcesContent: raw.sourcesContent.map((x) =>
            typeof x === "string" ? x : null
          ),
        }
      : {}),
  };
}

export function bindGeneratedPosition(
  map: ParsedSourceMapV3,
  generatedLine: number,
  generatedColumn: number,
): SourceMapBinding {
  const invalid = (reason: string): SourceMapBinding => ({
    generatedLine, generatedColumn, status: "invalid", reason,
  });
  if (!Number.isInteger(generatedLine) || generatedLine < 1 ||
      !Number.isInteger(generatedColumn) || generatedColumn < 0) {
    return invalid(
      "Generated position must use 1-based line and 0-based non-negative column.",
    );
  }

  const lines = map.mappings.split(";");
  if (lines[generatedLine - 1] === undefined) {
    return {
      generatedLine, generatedColumn, status: "unmapped",
      reason: "Generated line has no mapping entry.",
    };
  }

  // Source, original line and name VLQ deltas carry across generated lines.
  // Generated and original columns reset at the start of EACH line.
  let sourceIndex = 0;
  let originalLine = 0;
  let nameIndex = 0;
  let best: {
    sourceIndex: number;
    originalLine: number;
    originalColumn: number;
    nameIndex?: number;
  } | undefined;

  for (let lineIndex = 0; lineIndex < generatedLine; lineIndex++) {
    let generated = 0;
    let originalColumn = 0;
    const targetLine = lineIndex === generatedLine - 1;
    for (const segment of lines[lineIndex]!.split(",")) {
      if (!segment) continue;
      let fields: number[];
      try {
        fields = decodeVlq(segment);
      } catch (error) {
        return invalid(error instanceof Error
          ? error.message : "Invalid source-map VLQ segment.");
      }
      if (![1, 4, 5].includes(fields.length)) {
        return invalid("Source-map segment must contain 1, 4 or 5 fields.");
      }

      generated += fields[0]!;
      if (!Number.isSafeInteger(generated) || generated < 0) {
        return invalid("Invalid generated source-map column.");
      }
      if (fields.length === 1) {
        // A one-field segment explicitly cancels the prior mapped span.
        if (targetLine && generated <= generatedColumn) best = undefined;
      } else {
        sourceIndex += fields[1]!;
        originalLine += fields[2]!;
        originalColumn += fields[3]!;
        if (fields.length === 5) nameIndex += fields[4]!;
        if (!Number.isSafeInteger(sourceIndex) ||
            sourceIndex < 0 || sourceIndex >= map.sources.length ||
            !Number.isSafeInteger(originalLine) || originalLine < 0 ||
            !Number.isSafeInteger(originalColumn) || originalColumn < 0 ||
            (fields.length === 5 &&
              (!Number.isSafeInteger(nameIndex) ||
               nameIndex < 0 || nameIndex >= map.names.length))) {
          return invalid("Invalid original source-map position or index.");
        }
        if (targetLine && generated <= generatedColumn) {
          best = {
            sourceIndex, originalLine, originalColumn,
            ...(fields.length === 5 ? { nameIndex } : {}),
          };
        }
      }
      if (targetLine && generated > generatedColumn) break;
    }
  }

  if (!best) {
    return {
      generatedLine, generatedColumn, status: "unmapped",
      reason: "No mapped segment covers the generated position.",
    };
  }

  const source = map.sources[best.sourceIndex]!;
  const rootedSource = map.sourceRoot
    ? map.sourceRoot.replace(/\/$/, "") + "/" + source.replace(/^\//, "")
    : source;

  return {
    generatedLine,
    generatedColumn,
    source: rootedSource,
    originalLine: best.originalLine + 1,
    originalColumn: best.originalColumn,
    ...(best.nameIndex !== undefined
      ? { name: map.names[best.nameIndex] }
      : {}),
    status: "resolved",
  };
}
