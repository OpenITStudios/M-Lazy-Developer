import type { SourceRef } from "../../../packages/project-model/src/index.js";

/** Bedrock-authored event operators, not confirmed gameplay execution. */
export interface EntityEventProgram {
  readonly kind: "mutation" | "sequence" | "randomize" | "unsupported";
  /** Exact JSON pointer inside the selected entity source. */
  readonly path: string;
  readonly filters?: unknown;
  readonly weight?: number;
  readonly addGroups?: readonly string[];
  readonly removeGroups?: readonly string[];
  readonly triggerEvents?: readonly string[];
  readonly steps?: readonly EntityEventProgram[];
  readonly reason?: string;
}

export interface EntityEventMutation {
  /** MAY references from all authored branches, not a simultaneous effect. */
  addGroups: string[];
  removeGroups: string[];
  triggerEvents: string[];
  /** Structured execution operators; absent only on historical input. */
  program?: EntityEventProgram;
}

export interface ParsedEntityDefinition {
  identifier?: string;
  runtimeIdentifier?: string;
  formatVersion?: string;
  source: SourceRef;
  baseComponents: string[];
  baseComponentData: Record<string, unknown>;
  componentGroups: Record<string, string[]>;
  componentGroupData: Record<string, Record<string, unknown>>;
  events: Record<string, EntityEventMutation>;
  /** Animation aliases declared in this entity source, not activated by themselves. */
  animationAliases?: Readonly<Record<string, string>>;
  /** Only explicitly declared scripts.animate activations are linked. */
  activeAnimations?: readonly {
    readonly alias: string;
    readonly condition?: string;
    readonly source: SourceRef;
  }[];
}

/** Data-driven BP controller states and literal Molang transition expressions. */
export interface ParsedBehaviorAnimationController {
  readonly identifier: string;
  readonly source: SourceRef;
  readonly initialState: string;
  readonly states: readonly {
    readonly name: string;
    readonly source: SourceRef;
    readonly animations: readonly { readonly alias: string; readonly condition?: string; readonly source: SourceRef }[];
    readonly transitions: readonly { readonly target: string; readonly condition: string; readonly source: SourceRef }[];
    readonly onEntryCommands: readonly { readonly command: string; readonly source: SourceRef }[];
    readonly onExitCommands: readonly { readonly command: string; readonly source: SourceRef }[];
  }[];
  readonly limitations: readonly string[];
}

/** Authored behavior-pack animation timepoints; execution is never assumed. */
export interface ParsedBehaviorAnimation {
  readonly identifier: string;
  readonly source: SourceRef;
  readonly loop?: string | boolean;
  readonly timelineCommands: readonly {
    readonly seconds: number;
    readonly command: string;
    readonly source: SourceRef;
  }[];
  readonly limitations: readonly string[];
}

export interface EntityStateCandidate {
  id: string;
  activeComponents: string[];
  activeComponentData: Record<string, unknown>;
  activeGroups: string[];
  viaEvent?: string;
  /** Source-conditional possibility, not an observed runtime state. */
  sourceConditioned?: boolean;
  sourceEventPath?: readonly string[];
  /** Authored root → local trigger chain, never evidence of delivered events. */
  sourceEventChain?: readonly string[];
}

export interface EntityStateGraph {
  candidates: EntityStateCandidate[];
  eventEdges: Array<{
    event: string;
    adds: string[];
    removes: string[];
    triggers: string[];
    program?: EntityEventProgram;
  }>;
  /** Event semantics that cannot safely be interpreted as state paths. */
  staticAnalysisLimits?: readonly string[];
}

export interface NavigationCapabilities {
  navigationComponent?: string;
  canPassDoors?: boolean;
  canOpenDoors?: boolean;
  canOpenIronDoors?: boolean;
  canBreakDoors?: boolean;
  canPathOverWater?: boolean;
  canSwim?: boolean;
  canWalk?: boolean;
  canSink?: boolean;
  avoidWater?: boolean;
  avoidDamageBlocks?: boolean;
  capabilities: string[];
}
