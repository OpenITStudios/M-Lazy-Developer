import type {
  SourceRef,
  SourceSequentialSite,
  SourceGenerationCapture,
  StateAuthorityContract,
  StateSurfaceRef,
} from "../../project-model/src/index.js";

export type ExecutionRegionKind =
  | "event-source"
  | "script-module"
  | "script-function"
  | "script-callback"
  | "mcfunction"
  | "behavior-animation"
  | "dialogue-command";

export interface ExecutionRegion {
  id: string;
  kind: ExecutionRegionKind;
  ownerId: string;
  label: string;
  source?: SourceRef;
  /** Source-owned strict event.id != value early-return check on an
   * imported-system scriptEventReceive callback. Not runtime delivery.
   */
  scriptEventIdRejection?: {
    readonly eventId: string;
    readonly source: SourceRef;
    readonly valueSource: SourceRef;
    readonly resolution: "inline-literal" | "local-literal" | "unique-imported-literal";
  };
}

export type ExecutionEdgeKind =
  /** Resolved static ESM module dependency, not function execution or time. */
  | "static-module-dependency"
  /** Exact Map-backed on/emit source relay, contingent on a source-reachable
   * subscription. Never proof of registration, callback delivery or timing.
   */
  | "internal-event-dispatch"
  | "synchronous-call"
  | "event-dispatch"
  | "deferred"
  | "periodic";

export type IrResolution = "resolved" | "unresolved";

/** An authored branch prerequisite, not an evaluated outcome. */
export interface AuthoredBranchGuard {
  readonly expression: string;
  readonly branch: "true" | "false";
  readonly source: SourceRef;
}

export interface ExecutionEdge {
  id: string;
  from: string;
  kind: ExecutionEdgeKind;
  targetLabel: string;
  resolution: IrResolution;
  /** Authored dynamic import of a runtime-provided Minecraft API module.
   * No selected-map source target exists; module loading is NOT observed.
   */
  externalRuntimeModule?: "@minecraft/server" | "@minecraft/server-ui";
  to?: string;
  source: SourceRef;
  /** For event-dispatch only: exact execution region containing the authored
   * Minecraft API subscribe() site. This links subscription eligibility to
   * manifest-rooted source reachability; not proof of registration or delivery.
   */
  registrationRegionId?: string;
  /** An imported Map-backed custom event-bus subscription. Its SOURCE
   * region must become manifest-reachable before the relay can be included
   * in a gameplay source trace. Not an observed JS runtime listener.
   */
  internalSubscriptionRegionId?: string;
  internalSubscriptionSource?: SourceRef;
  scheduler?: "run" | "runTimeout" | "runInterval" | "runJob";
  /** Parsed local-call branching, not proof that a condition was satisfied. */
  controlFlow?: "unconditional" | "conditional" | "deferred";
  /** Exact caller-to-callee source formals for a uniquely resolved call.
   * A lexical handoff never proves runtime session or state identity.
   */
  argumentParameterBindings?: readonly {
    readonly index: number;
    readonly argumentName: string;
    readonly parameterName: string;
    readonly argumentSource: SourceRef;
    readonly parameterSource: SourceRef;
    readonly viaConstAliases?: readonly {
      readonly name: string;
      readonly source: SourceRef;
    }[];
  }[];
  lexicalGuards?: readonly AuthoredBranchGuard[];
  /** Necessary source-time decisions from preceding early exits. */
  precedenceGuards?: readonly AuthoredBranchGuard[];
  guardEvidence?: "explicit-generation-check" | "unresolved";
  guardIdentifiers?: readonly string[];
  /** Exact source location of the callback's early generation exit. */
  generationGuardSource?: SourceRef;
  /** Exact authored operand source spelling, not runtime alias identity. */
  generationGuardOperands?: readonly [string, string];
  /** The authored const source snapshot, not a runtime identity. */
  sourceGenerationCapture?: SourceGenerationCapture;
  sourceSequence?: SourceSequentialSite;
}

/** An authored object-return property, not a gameplay win or loss. */
export interface AuthoredReturnOutcome {
  id: string;
  executionRegionId: string;
  propertyName: string;
  value: string;
  source: SourceRef;
  lexicalGuards?: readonly AuthoredBranchGuard[];
  precedenceGuards?: readonly AuthoredBranchGuard[];
}

/** An observed resource action, not a verified cleanup/reset. */
export interface AuthoredResourceAction {
  id: string;
  executionRegionId: string;
  surface: "tag" | "effect" | "scoreboard" |
    "deferred-callback" | "input-permission" | "mount-relationship";
  action: "acquire" | "release";
  key: string;
  precision: "exact" | "surface-level";
  source: SourceRef;
  /** Source-observed branch alternatives, not actual cleanup execution. */
  lexicalGuards?: readonly AuthoredBranchGuard[];
  precedenceGuards?: readonly AuthoredBranchGuard[];
}

/**
 * Authored attempts at Minecraft world/player-visible effects.
 * Neither source presence nor a resolved command guarantees runtime success.
 */
export interface AuthoredWorldEffect {
  readonly id: string;
  readonly executionRegionId: string;
  readonly kind: "entity-spawn" | "teleport" | "block-mutation" |
    "structure-load" | "dialogue" | "entity-event" | "audio-feedback";
  readonly mechanism: "mcfunction-command" | "script-command" |
    "script-api" | "script-spatial" |
    "behavior-animation-command" | "behavior-controller-command" |
    "dialogue-command";
  readonly targetLabel: string;
  readonly precision: "parsed-command" | "typed-method" |
    "bounded-method" | "resolved-spatial" | "unresolved-spatial";
  readonly source: SourceRef;
  /** Authored timeline seconds only; never observed wall-clock duration. */
  readonly authoredTimingSeconds?: number;
  readonly lexicalGuards?: readonly AuthoredBranchGuard[];
  readonly precedenceGuards?: readonly AuthoredBranchGuard[];
}

/**
 * Existing arena-authority source observation of a generation mutation.
 * It is not proof the mutation executed or invalidated any live callback.
 */
export interface AuthoredGenerationInvalidation {
  readonly id: string;
  readonly executionRegionId: string;
  readonly generationExpression: string;
  readonly source: SourceRef;
}

export interface StateSurface {
  id: string;
  ref: StateSurfaceRef;
}

export type StateOperationKind =
  | "read"
  | "write"
  | "delete"
  | "clear"
  | "enumerate"
  | "size";

/** Parser-observed state table declaration, not a bound runtime machine. */
export interface AuthoredStateTransitionDeclaration {
  readonly id: string;
  readonly tableName: string;
  readonly stateType?: string;
  readonly from: string;
  readonly to: readonly string[];
  readonly source: SourceRef;
}

export interface StateOperation {
  id: string;
  executionRegionId: string;
  surfaceId: string;
  operation: StateOperationKind;
  source: SourceRef;
  targetHint?: string;
  /** Literal directly compared to a read, not the observed runtime value. */
  readComparison?: {
    readonly value: string;
    readonly scalarKind: "string" | "number" | "boolean";
    readonly operator: "strict-eq" | "strict-neq";
    readonly source: SourceRef;
  };
  /** Authored assigned token; an object member is not its resolved runtime value. */
  writtenValue?: {
    kind: "literal";
    value: string;
    /** Optional to preserve existing non-scalar authored literal producers. */
    scalarKind?: "string" | "number" | "boolean";
  } | { kind: "member"; symbol: string };
  lexicalGuards?: readonly AuthoredBranchGuard[];
  precedenceGuards?: readonly AuthoredBranchGuard[];
  sourceSequence?: SourceSequentialSite;
  /**
   * Site-qualified source fact from an authored JS property assignment.
   * Names like `member.ready` and `session.ready` cannot establish a
   * common runtime object or gameplay status. A lexical self-negation is
   * NOT a proven successful boolean toggle in the presence of accessors.
   * For logical-expression, the original short-circuit operation is retained
   * with UNKNOWN value and UNKNOWN runtime type, never a typed Boolean.
   */
  authoredBooleanPropertyWrite?: {
    readonly targetExpression: string;
    readonly valueExpression: string;
    readonly form: "literal-true" | "literal-false" | "self-negation" |
      "logical-expression";
    readonly proof: "SITE_LOCAL_SOURCE_SYNTAX_NOT_RUNTIME_STATE";
  };
}

export interface StateAuthorityBinding {
  contract: StateAuthorityContract;
  authoritySurfaceId: string;
  mirrorSurfaceIds: readonly string[];
}

export type TemporalRelationKind =
  | "same-turn"
  | "event-dispatch"
  | "deferred"
  | "periodic";

export interface TemporalRelation {
  id: string;
  from: string;
  targetLabel: string;
  resolution: IrResolution;
  /** Authored dynamic import of a runtime-provided Minecraft API module.
   * No selected-map source target exists; module loading is NOT observed.
   */
  externalRuntimeModule?: "@minecraft/server" | "@minecraft/server-ui";
  to?: string;
  kind: TemporalRelationKind;
  source: SourceRef;
  guardEvidence?: "explicit-generation-check" | "unresolved";
  guardIdentifiers?: readonly string[];
}

/**
 * Static, source-backed cross-format behavioral references. A resolved
 * reference does not prove activation, Molang satisfaction, or gameplay outcome.
 */
export interface AuthoredBehaviorRelation {
  readonly id: string;
  readonly kind:
    | "entity-event-trigger" | "external-event-trigger"
    | "entity-controller-activation" | "controller-state-transition"
    | "controller-animation-reference" | "controller-state-command"
    | "entity-animation-activation" | "controller-animation-timeline"
    | "animation-timeline-command" | "animation-timeline-uncertainty"
    | "dialogue-button-command" | "dialogue-scene-command";
  readonly ownerId: string;
  readonly from: string;
  readonly to: string;
  readonly resolution: "EXACT_REFERENCE" | "POSSIBLE_TARGET" | "UNRESOLVED";
  readonly source: SourceRef;
  readonly targetSource?: SourceRef;
  readonly condition?: string;
  /** Authored seconds for timeline commands, never a runtime observation. */
  readonly timingSeconds?: number;
  /** Authored NPC button label, not proof of game-design objective. */
  readonly interactionLabel?: string;
  /** Semantic IR world effects grounded in this exact command source site. */
  readonly worldEffectIds?: readonly string[];
  /** Exact authored command scoreboard/tag operation IDs. Not live state. */
  readonly stateOperationIds?: readonly string[];
  /**
   * Exact command-to-mcfunction edges. Resolved means unique target SOURCE,
   * never activation, successful command execution, or a proven game rule.
   */
  readonly executionEdgeIds?: readonly string[];
  readonly reason: string;
}

/** Parsed intraregion CFG, an authored source map and not runtime execution. */
export interface SourceControlFlowRegion {
  readonly executionRegionId: string;
  readonly entryId: string;
  readonly nodes: readonly {
    readonly id: string;
    readonly kind: "entry" | "exit" | "statement" | "condition" | "opaque";
    readonly site?: SourceSequentialSite;
  }[];
  readonly edges: readonly {
    readonly from: string;
    readonly to: string;
    readonly branch?: "true" | "false";
  }[];
}

/** Typed Script API call observed by the existing parser in one source file.
 * This is an authored call attempt, never proof of a gameplay outcome.
 * Only bounded lifecycle, HUD, form, camera and profiling source
 * surfaces are projected. A query attempt is not measured performance.
 */
export interface AuthoredScriptApiCall {
  readonly id: string;
  readonly receiverType:
    | "Entity" | "Player" | "World" | "Dimension"
    | "ScreenDisplay" | "Camera"
    | "ActionFormData" | "ModalFormData" | "MessageFormData"
    | "UIManager";
  readonly method:
    | "kill" | "remove" | "teleport" | "sendMessage"
    | "setActionBar" | "setTitle" | "setHudVisibility"
    | "setCamera" | "clear" | "show" | "closeAllForms"
    | "getAllPlayers" | "getEntities";
  readonly symbol: string;
  readonly inference: "direct" | "bounded";
  readonly source: SourceRef;
  readonly executionRegionId: string;
}

/** Parser-typed read of the Bedrock game tick counter. It only establishes
 * an authored API read, not a persistent clock or a working countdown.
 */
export interface AuthoredScriptApiPropertyRead {
  readonly id: string;
  readonly receiverType: "System";
  readonly property: "currentTick";
  readonly symbol: "system.currentTick";
  readonly inference: "direct" | "bounded";
  readonly source: SourceRef;
}

export interface SemanticIr {
  schemaVersion: 1;
  execution: {
    /** Exact selected-world attached-pack script roots and static closure.
     * Missing = manifest/attachment/import proof unavailable, NEVER empty.
     * This is authored activation eligibility, not actual load/execution.
     */
    manifestScriptRoots?: {
      readonly entryPaths: readonly string[];
      readonly staticallyReachablePaths: readonly string[];
    };
    regions: readonly ExecutionRegion[];
    edges: readonly ExecutionEdge[];
    /** Typed lifecycle API witnesses; not source-name/lexical matches. */
    apiCalls?: readonly AuthoredScriptApiCall[];
    /** Exact source-backed game-tick property reads, not measured time. */
    apiPropertyReads?: readonly AuthoredScriptApiPropertyRead[];
    outcomes?: readonly AuthoredReturnOutcome[];
    worldEffects?: readonly AuthoredWorldEffect[];
    controlFlow?: readonly SourceControlFlowRegion[];
    authoredBehaviorRelations?: readonly AuthoredBehaviorRelation[];
  };
  state: {
    surfaces: readonly StateSurface[];
    operations: readonly StateOperation[];
    resourceActions?: readonly AuthoredResourceAction[];
    transitionDeclarations?: readonly AuthoredStateTransitionDeclaration[];
    generationInvalidations?: readonly AuthoredGenerationInvalidation[];
    authorityBindings: readonly StateAuthorityBinding[];
  };
  temporal: {
    relations: readonly TemporalRelation[];
  };
}
