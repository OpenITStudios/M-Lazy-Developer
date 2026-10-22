import { parseMcFunction } from "../../../../analyzers/functions/src/index.js";
import { flattenCommandEffects } from "../../../../analyzers/commands/src/index.js";
import { stateAccessesFromEffects } from "../../../../analyzers/topology/src/index.js";
import { likelyGlobalAccess } from "../../../../analyzers/topology/src/index.js";
import type { SourceMutation } from "../../../reliability-search/src/index.js";
import type { SourceMutationDetector } from "../../../reliability-search/src/index.js";
import { analyzeFunctionTopology } from "../inspection/topology-analysis.js";

export interface SourceMutationFixture {
  identifier: string;
  relativePath: string;
  commands: readonly string[];
  knownFunctions?: readonly string[];
  knownStructures?: readonly string[];
  knownObjectives?: readonly string[];
  knownTags?: readonly string[];
}

export interface MutationDetectionEvidence {
  killed: boolean;
  invalid?: boolean;
  evidence?: string;
}

function replaceSingleCommand(
  commands: readonly string[],
  mutation: SourceMutation,
): string[] | undefined {
  const indexes = commands
    .map((command, index) => command === mutation.original ? index : -1)
    .filter((index) => index >= 0);

  if (indexes.length !== 1) return undefined;
  const next = [...commands];
  next[indexes[0]!] = mutation.mutated;
  return next;
}

function parsedFixture(
  fixture: SourceMutationFixture,
  commands: readonly string[],
) {
  return parseMcFunction(
    fixture.identifier,
    commands.join("\n"),
    {
      artifactId: "mutation_fixture",
      relativePath: fixture.relativePath,
    },
  );
}

function broadWrites(parsed: ReturnType<typeof parseMcFunction>) {
  const effects = parsed.commands.flatMap((command) =>
    flattenCommandEffects(command.analysis),
  );
  return stateAccessesFromEffects(effects).filter(
    (access) => access.access === "write" && likelyGlobalAccess(access),
  );
}

function unknownReferences(
  parsed: ReturnType<typeof parseMcFunction>,
  fixture: SourceMutationFixture,
): string[] {
  const knownFunctions = new Set(fixture.knownFunctions ?? []);
  const knownStructures = new Set(fixture.knownStructures ?? []);
  const knownObjectives = new Set(fixture.knownObjectives ?? []);
  const knownTags = new Set(fixture.knownTags ?? []);
  const unknown: string[] = [];

  for (const ref of parsed.references) {
    if (ref.kind === "function" && !knownFunctions.has(ref.target)) {
      unknown.push(`function:${ref.target}`);
    } else if (ref.kind === "structure" && !knownStructures.has(ref.target)) {
      unknown.push(`structure:${ref.target}`);
    } else if (
      (ref.kind === "scoreboard-read" || ref.kind === "scoreboard-write") &&
      fixture.knownObjectives &&
      !knownObjectives.has(ref.objective)
    ) {
      unknown.push(`scoreboard:${ref.objective}`);
    } else if (
      (ref.kind === "tag-read" || ref.kind === "tag-write") &&
      fixture.knownTags &&
      !knownTags.has(ref.tag)
    ) {
      unknown.push(`tag:${ref.tag}`);
    }
  }

  return [...new Set(unknown)].sort();
}

export function detectSourceMutation(
  fixture: SourceMutationFixture,
  mutation: SourceMutation,
): MutationDetectionEvidence {
  const mutatedCommands = replaceSingleCommand(fixture.commands, mutation);
  if (!mutatedCommands) {
    return {
      killed: false,
      invalid: true,
      evidence: "Mutation fixture must contain exactly one matching original command.",
    };
  }

  const baseline = parsedFixture(fixture, fixture.commands);
  const mutated = parsedFixture(fixture, mutatedCommands);

  if (
    mutation.descriptor.operator === "selector-broaden" ||
    mutation.descriptor.operator === "tag-filter-omit"
  ) {
    const before = broadWrites(baseline);
    const after = broadWrites(mutated);
    if (after.length > before.length) {
      return {
        killed: true,
        evidence: `State-scope detector introduced ${after.length - before.length} new broad write(s).`,
      };
    }
  }

  if (
    mutation.descriptor.operator === "structure-reference-redirect" ||
    mutation.descriptor.operator === "function-reference-redirect" ||
    mutation.descriptor.operator === "scoreboard-objective-substitution"
  ) {
    const before = new Set(unknownReferences(baseline, fixture));
    const after = unknownReferences(mutated, fixture)
      .filter((reference) => !before.has(reference));
    if (after.length > 0) {
      return {
        killed: true,
        evidence: `Reference detector found new unresolved identifier(s): ${after.join(", ")}`,
      };
    }
  }

  if (mutation.descriptor.operator === "coordinate-shift") {
    const baselineTopology = analyzeFunctionTopology([baseline]);
    const mutatedTopology = analyzeFunctionTopology([mutated]);
    if (mutatedTopology.linearOutliers.length > baselineTopology.linearOutliers.length) {
      return {
        killed: true,
        evidence: "Topology detector introduced a new linear translation outlier.",
      };
    }

    const baselineEvidence = Math.max(
      0,
      ...baselineTopology.candidates.map((candidate) => candidate.evidenceCount),
    );
    const mutatedEvidence = Math.max(
      0,
      ...mutatedTopology.candidates.map((candidate) => candidate.evidenceCount),
    );
    if (baselineEvidence >= 4 && mutatedEvidence < baselineEvidence) {
      return {
        killed: true,
        evidence: `Repeated-topology membership weakened from ${baselineEvidence} to ${mutatedEvidence} matching effects.`,
      };
    }
  }

  return {
    killed: false,
    evidence: "No configured real detector distinguished the mutant from baseline.",
  };
}

export function createSourceMutationDetector(
  fixture: SourceMutationFixture,
): SourceMutationDetector {
  return async (mutation) => detectSourceMutation(fixture, mutation);
}
