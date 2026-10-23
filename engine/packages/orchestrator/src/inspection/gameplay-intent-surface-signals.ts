import {
  extractGameplayIntentSurfaceSignal,
  type GameplayIntentSignal,
} from "../../../../analyzers/gameplay-intent/src/index.js";
import type {
  ParsedDialogueDocument,
} from "../../../../analyzers/dialogue/src/index.js";
import type {
  ParsedEntityDefinition,
} from "../../../../analyzers/entities/src/index.js";
import type { AuthoredBehaviorRelation } from "../../../semantic-ir/src/index.js";

export interface GameplayIntentSurfaceSignalSource {
  readonly functions: readonly {
    readonly identifier: string;
    readonly source: {
      readonly relativePath: string;
    };
  }[];
  readonly dialogues:
    readonly (ParsedDialogueDocument | undefined)[];
  readonly structures: readonly {
    readonly identifier: string;
    readonly node: {
      readonly source?: {
        readonly relativePath: string;
      };
    };
  }[];
  readonly entities: readonly {
    readonly parsed: ParsedEntityDefinition;
  }[];
}

function add(
  output: GameplayIntentSignal[],
  input: Parameters<
    typeof extractGameplayIntentSurfaceSignal
  >[0],
): void {
  const signal =
    extractGameplayIntentSurfaceSignal(input);
  if (signal) output.push(signal);
}

export function deriveGameplayIntentSurfaceSignals(
  source: GameplayIntentSurfaceSignalSource,
): readonly GameplayIntentSignal[] {
  const signals: GameplayIntentSignal[] = [];

  for (const fn of source.functions) {
    add(signals, {
      label: fn.identifier,
      locator: fn.source.relativePath,
      evidenceOrigin: "source-code",
      status: "inferred",
      summary:
        "An authored mcfunction identifier exposes a gameplay-surface candidate; naming alone is not intended-design proof.",
    });
  }

  for (const document of source.dialogues) {
    if (!document) continue;
    for (const scene of document.scenes) {
      // A scene_tag is a technical lookup key, not NPC text presented to
      // players. Preserve its navigational identity without issuing a
      // player-facing promise from a source identifier.
      add(signals, {
        label: scene.sceneTag,
        locator: scene.source?.jsonPointer &&
          scene.source.artifactId === document.source.artifactId &&
          scene.source.relativePath === document.source.relativePath
          ? scene.source.relativePath + "#" + scene.source.jsonPointer
          : document.source.relativePath,
        evidenceOrigin: "source-code",
        status: "inferred",
        summary:
          "An NPC scene identifier is an authored source key; it does not prove that dialogue is displayed or that any objective is intended.",
      });
      for (const item of scene.displayText ?? []) {
        // The exact JSON pointer distinguishes identical button/body text
        // appearing in separate scenes and distinguishes a button label
        // from its executable command in the very same JSON file.
        const site = item.source;
        if (!site?.jsonPointer ||
            site.artifactId !== document.source.artifactId ||
            site.relativePath !== document.source.relativePath) continue;
        add(signals, {
          label: item.text,
          locator: site.relativePath + "#" + site.jsonPointer,
          evidenceOrigin: "dialogue",
          status: "inferred",
          summary:
            "Literal NPC display text; source presence does not establish visibility, design approval or successful button-command execution.",
        });
      }
    }
  }

  for (const structure of source.structures) {
    const locator =
      structure.node.source?.relativePath;
    if (!locator) continue;

    add(signals, {
      label: structure.identifier,
      locator,
      evidenceOrigin: "structure",
      status: "inferred",
      summary:
        "An authored structure identifier exposes a physical/world gameplay-surface candidate.",
    });
  }

  for (const entity of source.entities) {
    const identifier =
      entity.parsed.identifier;
    if (!identifier) continue;

    add(signals, {
      label: identifier,
      locator:
        entity.parsed.source.relativePath,
      evidenceOrigin: "source-code",
      status: "inferred",
      summary:
        "An authored entity identifier exposes an actor/role/mechanic candidate; naming alone is not intended-design proof.",
    });
  }

  const unique = new Map<
    string,
    GameplayIntentSignal
  >();

  for (const signal of signals) {
    const key = [
      signal.subjectKey,
      signal.evidenceOrigin,
      signal.locator,
    ].join("::");
    if (!unique.has(key)) {
      unique.set(key, signal);
    }
  }

  return [...unique.values()].sort(
    (a, b) =>
      a.subjectKey.localeCompare(b.subjectKey) ||
      a.locator.localeCompare(b.locator),
  );
}


/**
 * Dialogue button → literal command linkage is source-authored, unlike
 * semantic similarity between a phrase and a feature name.
 * The command analyzer in ParsedDialogueDocument already owns syntax;
 * world effects will be normalized by the existing Semantic IR producer.
 */
export function deriveAuthoredDialogueBehaviorRelations(
  documents: readonly (ParsedDialogueDocument | undefined)[],
): readonly AuthoredBehaviorRelation[] {
  const result: AuthoredBehaviorRelation[] = [];
  for (const document of documents) {
    if (!document) continue;
    for (const scene of document.scenes) {
      const sceneSource = scene.source;
      if (!sceneSource?.jsonPointer) continue;
      for (const command of scene.commands) {
        if (!command.source?.jsonPointer) continue;
        const label = command.trigger === "button"
          ? (scene.displayText ?? []).find(item =>
              item.kind === "button" &&
              item.buttonIndex === command.buttonIndex &&
              item.source !== undefined)
          : undefined;
        const ownerId = [
          "dialogue-interaction",
          document.source.relativePath,
          sceneSource.jsonPointer,
          command.trigger,
          command.trigger === "button" ? String(command.buttonIndex) : "-",
        ].map(encodeURIComponent).join(":");
        result.push({
          id: [
            "authored-dialogue-command",
            document.source.artifactId,
            document.source.relativePath,
            command.source.jsonPointer,
          ].map(encodeURIComponent).join(":"),
          kind: command.trigger === "button"
            ? "dialogue-button-command" : "dialogue-scene-command",
          ownerId,
          from: ownerId,
          to: command.raw,
          source: command.source,
          resolution: label?.source
            ? "EXACT_REFERENCE" : "POSSIBLE_TARGET",
          ...(label?.source ? { targetSource: label.source } : {}),
          ...(label?.text ? { interactionLabel: label.text } : {}),
          reason: label?.text
            ? "NPC dialogue button text and authored command are bound by exact scene/button index; activation and effect success remain unknown."
            : "NPC scene open/close or unlabelled button command; player-facing intent and invocation remain unknown.",
        });
      }
    }
  }
  return result.sort((a, b) => a.id.localeCompare(b.id));
}
