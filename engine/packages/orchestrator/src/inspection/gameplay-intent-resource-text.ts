import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  GameplayIntentSignal,
} from "../../../../analyzers/gameplay-intent/src/index.js";
import type {
  FileInventoryEntry,
} from "../../../project-model/src/index.js";

export interface GameplayResourceTextEntry {
  readonly key: string;
  readonly text: string;
  readonly relativePath: string;
  readonly line: number;
}

function parseLang(
  source: string,
  relativePath: string,
): readonly GameplayResourceTextEntry[] {
  return source
    .split(/\r?\n/)
    .flatMap((raw, index) => {
      const line = raw.trim();
      if (
        !line ||
        line.startsWith("#") ||
        line.startsWith("//")
      ) {
        return [];
      }

      const separator = line.indexOf("=");
      if (separator <= 0) return [];

      const key =
        line.slice(0, separator).trim();
      const text =
        line.slice(separator + 1).trim();

      if (!key || !text) return [];

      return [{
        key,
        text,
        relativePath,
        line: index + 1,
      }];
    });
}


/**
 * A locale key identifies authored content, not executed behavior. Keep each
 * namespace/stage/task identity distinct even when visible text repeats.
 * A generic HUD label or an emoji level number is NOT a gameplay stage.
 */
export function parseLocalizedStageKey(key: string): {
  readonly scopePrefix: string;
  readonly kind: "stage" | "level" | "round";
  readonly number: number;
  readonly section: "guide" | "task" | "feedback";
  readonly taskNumber?: number;
} | undefined {
  const match = key.match(
    /^(.*?)(?:[._-]|^)(stage|level|round)[._-]?([0-9]+)[._-](guide|intro|title|success|task[._-]([0-9]+))$/i,
  );
  if (!match) return undefined;
  const number = Number(match[3]);
  const taskNumber = match[5] === undefined ? undefined : Number(match[5]);
  if (!Number.isSafeInteger(number) || number <= 0 ||
      (taskNumber !== undefined &&
        (!Number.isSafeInteger(taskNumber) || taskNumber <= 0))) {
    return undefined;
  }
  const suffix = match[4]!.toLowerCase();
  return {
    scopePrefix: match[1] ?? "",
    kind: match[2]!.toLowerCase() as "stage" | "level" | "round",
    number,
    section: suffix === "success" ? "feedback" :
      suffix.startsWith("task") ? "task" : "guide",
    ...(taskNumber === undefined ? {} : { taskNumber }),
  };
}

function sourceStageContentSignal(
  entry: GameplayResourceTextEntry,
): GameplayIntentSignal | undefined {
  const stage = parseLocalizedStageKey(entry.key);
  if (!stage) return undefined;
  const readable = entry.text
    .replace(/§./g, "")
    .replace(/%[1-9][0-9]*/g, " ")
    .replace(/[\uE000-\uF8FF]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!readable) return undefined;
  const kind = stage.section === "guide" ? "phase" : "mechanic";
  const id = kind + ":localized:" +
    encodeURIComponent(entry.relativePath + "#" + entry.key);
  const heading = stage.section === "guide"
    ? stage.kind.charAt(0).toUpperCase() + stage.kind.slice(1) +
      " " + stage.number
    : stage.section === "task"
      ? "Task " + stage.taskNumber
      : "Success feedback";
  return {
    id: "signal:" + id,
    subjectKey: id,
    nodeKind: kind,
    label: heading + ": " + readable.slice(0, 180),
    status: "inferred",
    evidenceOrigin: "translation",
    locator: entry.relativePath + "#L" + entry.line,
    summary: "Selected-artifact localized " + entry.key +
      " is a source-labelled " + stage.section + " candidate; " +
      "not verified gameplay order, activation, task completion or outcome.",
  };
}

/**
 * Technical names and pack metadata do not become gameplay instructions.
 * Literal presentation copy remains a cue even when its words are not
 * recognized by the existing gameplay name classifier.
 */
function isPlayerFacingCopy(entry: GameplayResourceTextEntry): boolean {
  if (/^(?:pack|entity|item|tile|block|biome|enchantment|potion)\./i.test(entry.key)) {
    return false;
  }
  const visible = entry.text
    .replace(/§./g, "")
    .replace(/[\uE000-\uF8FF]/g, "")
    .replace(/%[0-9]*(?:\$[0-9]+)?[sdf]/gi, " ")
    .trim();
  return /[\p{L}\p{N}]/u.test(visible);
}

export async function deriveGameplayResourceTextSignals(
  root: string,
  files: readonly FileInventoryEntry[],
): Promise<{
  readonly entries:
    readonly GameplayResourceTextEntry[];
  /** Exact locale wording, never mechanically classified by its words. */
  readonly playerFacingCues: readonly GameplayResourceTextEntry[];
  readonly signals:
    readonly GameplayIntentSignal[];
}> {
  const entries: GameplayResourceTextEntry[] = [];

  for (const file of files) {
    const path =
      file.relativePath.replaceAll("\\", "/");
    if (
      !/\/texts\/[^/]+\.lang$/i.test(
        "/" + path,
      )
    ) {
      continue;
    }

    let source: string;
    try {
      source = await readFile(
        join(root, file.relativePath),
        "utf8",
      );
    } catch {
      continue;
    }

    entries.push(
      ...parseLang(
        source,
        file.relativePath,
      ),
    );
  }

  // Structured stage/task keys retain source-content navigation.
  // Generic copy must NOT become an objective because it says "WINS".
  // A unique instruction also must not vanish because its words are novel.
  const signals = entries.flatMap(entry => {
    const content = sourceStageContentSignal(entry);
    return content === undefined ? [] : [content];
  });

  return {
    entries,
    playerFacingCues: entries.filter(isPlayerFacingCopy),
    signals,
  };
}
