import type { ScriptSequentialPathEvidence } from "./statement-sequence.js";
import type { ScriptContentUseSite } from "../parser/source-gameplay-content.js";
import type { ScriptWaveStage, ScriptAuthoredGameplayEntry, ScriptAuthoredContentCollection } from "../parser/source-gameplay-content.js";
import type { BlockCustomComponentRegistrationEvidence } from "../domains/automation/block-custom-component-evidence.js";
import type { PersistentReconciliationEvidence } from "../domains/persistence/persistent-reconciliation.js";
import type { ScriptEconomyEvidence } from "../domains/economy/economy-evidence.js";
import type {
  ScriptProgressionActorRegistryEvidence,
  ScriptProgressionActorSpawnEvidence,
  ScriptProgressionCounterEvidence,
} from "../domains/progression/progression-counter-evidence.js";
import type { ScriptChunkLifecycleEvidence } from "../domains/chunk/chunk-lifecycle-evidence.js";
import type { ScriptCombatLifecycleEvidence } from "../domains/combat/combat-lifecycle-evidence.js";
import type { ScriptInventoryLifecycleEvidence } from "../domains/inventory/inventory-lifecycle-evidence.js";
import type { ScriptGlobalLeaseEvidence } from "../domains/arena/global-lease-evidence.js";
import type { ScriptCleanupResourceEvidence } from "../domains/cleanup/cleanup-resource-evidence.js";
import type {
  PersistentDataLifecycleEvidence,
  ScriptResultAuditRecordEvidence,
} from "../domains/persistence/persistent-data-lifecycle.js";
import type { PersistentStateScopeEvidence } from "../domains/persistence/persistent-state-scope.js";
import type { PersistentStateLifetimeEvidence } from "../domains/persistence/persistent-state-lifetime.js";
import type { ScriptSpatialMutationEvidence, ScriptSpatialMutationRejection } from "../domains/spatial/spatial-mutation-evidence.js";
import type { ScriptSafeConfigBinding, ScriptSafeConfigExport, ScriptSafeConfigFunction, ScriptSafeConfigImport, ScriptSafeConfigRejection } from "../config/safe-config-compiler.js";
import type {
  RepairSourceTransformHint,
  SourceRef,
  SourceSequentialSite,
} from "../../../../packages/project-model/src/index.js";
import type { ScriptArgumentKind } from "../../../../packages/compatibility/src/index.js";

/** Source-only handoff data; a candidate class reference is not a live instance. */
export interface ScriptImportedThisConstruction {
  readonly source: SourceRef;
  readonly ownerClass: string;
  readonly module: string;
  readonly importedName: string;
  readonly thisArgumentIndex: number;
}
export interface ScriptConstructorFieldBinding {
  readonly source: SourceRef;
  readonly className: string;
  readonly fieldName: string;
  readonly parameterIndex: number;
}
export interface ScriptThisInstanceDispatch {
  readonly source: SourceRef;
  readonly className: string;
  readonly fieldName: string;
  readonly methodName: string;
  readonly thisArgumentIndex: number;
}
/** An owned JavaScript Map; no runtime equivalence between its keys. */
export interface ScriptClassMapCollection {
  readonly source: SourceRef;
  readonly className: string;
  readonly fieldName: string;
}
export interface ScriptClassMapAccess {
  readonly source: SourceRef;
  readonly className: string;
  readonly executionRegion: string;
  readonly fieldName: string;
  readonly operation: "set" | "get" | "has" | "delete";
  readonly keyExpression: string;
  readonly valueExpression?: string;
  /** Direct immutable new ImportedClass(...) binding at a same-block set. */
  readonly constructorName?: string;
  readonly constructorSource?: SourceRef;
}

export interface ScriptSourceClassMethod {
  readonly source: SourceRef;
  readonly className: string;
  readonly methodName: string;
  readonly parameterNames: readonly (string | null)[];
  readonly stableParameterIndices: readonly number[];
  readonly exported: boolean;
}

export interface ScriptImport {
  /** Literal module specifier, or source expression when it cannot be resolved. */
  module: string;
  kind: "minecraft" | "relative" | "external" | "unresolved";
  bindings: string[];
  source: SourceRef;
  /** Static type reference only, not a Minecraft/runtime module load. */
  typeOnly?: boolean;
  /**
   * Undefined means ordinary static ESM import. Dynamic forms are only
   * authored requests: source lookup does not prove module execution.
   */
  importSyntax?: "dynamic-literal" | "dynamic-expression";
  /** Exact source execution region of an authored import() call. */
  executionRegion?: string;
  /** Lexical conditions on import(), not verified runtime conditions. */
  lexicalGuards?: readonly ScriptLexicalGuard[];
  /** Necessary decisions implied by earlier direct returns/throws. */
  precedenceGuards?: readonly ScriptLexicalGuard[];
  /** Same-block source order, not proof the async load succeeded. */
  sourceSequence?: SourceSequentialSite;
}

export interface ScriptEventSubscription {
  root: "world" | "system" | "unknown";
  phase: "beforeEvents" | "afterEvents" | "unknown";
  event: string;
  executionRegion?: string;
  callbackRegion?: string;
  callbackSource?: SourceRef;
  source: SourceRef;
}

export interface DynamicPropertyAccess {
  operation: "get" | "set" | "delete" | "clear" | "ids" | "size" | "unknown";
  propertyId?: string;
  propertyExpression?: string;
  /** Only a directly authored scalar in setDynamicProperty, never evaluated expressions. */
  writtenLiteral?: { scalarKind: "string" | "number" | "boolean"; value: string };
  /** Literal directly compared against this read with === or !==. */
  comparedLiteral?: {
    scalarKind: "string" | "number" | "boolean";
    value: string;
    operator: "strict-eq" | "strict-neq";
    comparisonSource: SourceRef;
  };
  receiverHint?: string;
  executionRegion?: string;
  source: SourceRef;
  sourceSequence?: SourceSequentialSite;
  /** Exact AST branch ancestry of this read/write site, not runtime truth. */
  lexicalGuards?: readonly ScriptLexicalGuard[];
  precedenceGuards?: readonly ScriptLexicalGuard[];
}

export interface RestrictedExecutionMutation {
  root: "world" | "system" | "unknown";
  context: "before-event" | "custom-command";
  event: string;
  method: string;
  symbol: string;
  operation: "call" | "write";
  evidence: "exact-symbol" | "contextual-fallback";
  ruleId: string;
  source: SourceRef;
}

export type ScriptApiReceiverType =
  | "World"
  | "System"
  | "Player"
  | "Entity"
  | "ScreenDisplay"
  | "Camera"
  | "ActionFormData"
  | "ModalFormData"
  | "MessageFormData"
  | "UIManager"
  | "Dimension"
  | "Scoreboard"
  | "ScoreboardObjective"
  | "PlayerInputPermissions"
  | "Block"
  | "ItemStack"
  | "BlockPermutation"
  | "EntityFrictionModifierComponent"
  | "EntityMarkVariantComponent"
  | "EntityPushThroughComponent"
  | "EntityScaleComponent"
  | "EntitySkinIdComponent";

export type ScriptMethodResultUse =
  | "ignored"
  | "assigned"
  | "guarded-assigned"
  | "unguarded-assigned"
  | "guard-condition"
  | "returned"
  | "dereferenced"
  | "optional-dereferenced"
  | "non-null-asserted"
  | "other";

export interface ScriptMethodCall {
  receiverType: ScriptApiReceiverType;
  root?: "world" | "system";
  method: string;
  symbol: string;
  inference: "direct" | "bounded";
  receiverHint?: string;
  executionRegion?: string;
  argumentCount: number;
  argumentKinds: ScriptArgumentKind[];
  argumentTexts?: string[];
  hasSpreadArgument: boolean;
  resultUse: ScriptMethodResultUse;
  source: SourceRef;
  lexicalGuards?: readonly ScriptLexicalGuard[];
  precedenceGuards?: readonly ScriptLexicalGuard[];
}

/** Direct JavaScript method-local assignment, NOT proof of gameplay settlement. */
export interface ScriptAuthoredPropertyMutation {
  readonly executionRegion: string;
  readonly targetExpression: string;
  readonly valueExpression: string;
  readonly operator: "=" | "+=" | "-=";
  readonly source: SourceRef;
  readonly lexicalGuards?: readonly ScriptLexicalGuard[];
  readonly precedenceGuards?: readonly ScriptLexicalGuard[];
}

/** Authored method invocation through a non-local receiver. No source
 * binding to its implementation is implied by its member name. */
export interface ScriptUnresolvedReceiverCall {
  readonly executionRegion: string;
  readonly receiverExpression: string;
  readonly method: string;
  readonly source: SourceRef;
  readonly lexicalGuards?: readonly ScriptLexicalGuard[];
  readonly precedenceGuards?: readonly ScriptLexicalGuard[];
}

export interface ScriptPropertyWrite {
  receiverType: ScriptApiReceiverType;
  property: string;
  symbol: string;
  operation: "assign" | "compound" | "increment";
  source: SourceRef;
}

export interface ScriptPropertyAccess {
  receiverType: ScriptApiReceiverType;
  root?: "world" | "system";
  property: string;
  symbol: string;
  inference: "direct" | "bounded";
  source: SourceRef;
}

export interface ScriptBlockMatchGuard {
  receiverHint: string;
  receiverType: "Block" | "BlockPermutation";
  conditionSource: SourceRef;
  guardedSource: SourceRef;
  executionRegion: string;
}

/** Source-authored lexical condition; runtime satisfaction is unknown. */
export interface ScriptLexicalGuard {
  conditionText: string;
  branch: "true" | "false";
  predicate: ScriptGuardPredicate;
  source: SourceRef;
}

/** Exact source-side actual/formal forwarding, never runtime instance identity. */
export interface ScriptArgumentParameterBinding {
  index: number;
  /** Original caller parameter after zero or more immutable const aliases. */
  argumentName: string;
  parameterName: string;
  argumentSource: SourceRef;
  parameterSource: SourceRef;
  viaConstAliases?: readonly { name: string; source: SourceRef }[];
}

export interface ScriptLocalFunctionCall {
  callerRegion: string;
  targetRegion: string;
  targetName: string;
  /** Exact declaration site of the statically resolved target, distinct
   * from source (which is always the invocation site). Optional for legacy
   * calls whose declaration source cannot be resolved without guessing.
   */
  targetSource?: SourceRef;
  /** Unique AST source parameter binding at this local call, when proven. */
  argumentParameterBindings?: readonly ScriptArgumentParameterBinding[];
  /** Source-authored actual argument syntax for this.method(...). */
  argumentExpressions?: readonly string[];
  /** Literal event key on a unique local static emit() site, resolved only
   * from a source-stable object member/string; not proof of event delivery.
   */
  sourceEmittedEventKey?: string;
  controlFlow?: "unconditional" | "conditional" | "deferred";
  lexicalGuards?: readonly ScriptLexicalGuard[];
  /** Necessary branch decisions from preceding single-statement exits. */
  precedenceGuards?: readonly ScriptLexicalGuard[];
  source: SourceRef;
  sourceSequence?: SourceSequentialSite;
}

/** Direct ESM-import invocation at one canonical parser AST site. */
export interface ScriptImportedCallGuardSite {
  executionRegion: string;
  source: SourceRef;
  lexicalGuards?: readonly ScriptLexicalGuard[];
  precedenceGuards?: readonly ScriptLexicalGuard[];
}

export interface ScriptDeferredCallback {
  scheduler: "run" | "runTimeout" | "runInterval" | "runJob";
  source: SourceRef;
  callerRegion?: string;
  callbackRegion?: string;
  callbackSource?: SourceRef;
  guardEvidence: "explicit-generation-check" | "unresolved";
  guardIdentifiers: string[];
  /** Exact leading mismatch early-exit condition source, when observed. */
  generationGuardSource?: SourceRef;
  /** Both syntactically authored reference expressions; no alias inference. */
  generationGuardOperands?: readonly [string, string];
  delayTicks?: number;
}

export interface ScriptEntityEventTrigger {
  event: string;
  receiverHint?: string;
  executionRegion?: string;
  source: SourceRef;
  lexicalGuards?: readonly ScriptLexicalGuard[];
  precedenceGuards?: readonly ScriptLexicalGuard[];
}

export interface ScriptCommandLiteral {
  command: string;
  mechanism?: "runCommand" | "runCommandAsync" | "embedded-literal";
  executionRegion?: string;
  receiverHint?: string;
  source: SourceRef;
  lexicalGuards?: readonly ScriptLexicalGuard[];
  precedenceGuards?: readonly ScriptLexicalGuard[];
  /** Source-only loop/session guard enclosing this literal command, not
   * evidence of player or arena ownership or of actual command execution.
   */
  arenaActiveSessionLoop?: {
    readonly basis: "for-of-active-session-continue";
    readonly arenaBinding: string;
    readonly sessionBinding: string;
    readonly guardSource: SourceRef;
  };
}

export interface ScriptLifecycleMemberExposure {
  member: string;
  candidateSymbols: string[];
  evidence: "exact-symbol" | "lexical-only";
  exactSymbol?: string;
  source: SourceRef;
}

export interface ScriptImportedSymbol {
  module: string;
  importedName: string;
  localName: string;
  typeOnly: boolean;
  source: SourceRef;
}

export interface ScriptModuleMemberAccess {
  module: string;
  importedName: string;
  localName: string;
  member: string;
  symbol: string;
  source: SourceRef;
}

export interface ScriptEnumValueComparison {
  module: string;
  enumName: string;
  member: string;
  symbol: string;
  operator: "==" | "===" | "!=" | "!==";
  literal: string;
  source: SourceRef;
}

export interface ScriptStateMutation {
  lexicalGuards?: readonly ScriptLexicalGuard[];
  precedenceGuards?: readonly ScriptLexicalGuard[];
  target: string;
  targetName: string;
  value:
    | { kind: "literal"; literal: string }
    | {
        kind: "member";
        owner: string;
        member: string;
        symbol: string;
      };
  executionRegion: string;
  source: SourceRef;
}

export interface ScriptTypeProperty {
  containerName: string;
  propertyName: string;
  typeText: string;
  optional: boolean;
  source: SourceRef;
}

export interface ScriptTransitionDeclaration {
  tableName: string;
  stateType?: string;
  from: string;
  to: readonly string[];
  source: SourceRef;
}

export interface ScriptReturnOutcome {
  /** Lexical ancestry only; not an exhaustive execution path. */
  lexicalGuards?: readonly ScriptLexicalGuard[];
  precedenceGuards?: readonly ScriptLexicalGuard[];
  executionRegion: string;
  propertyName: string;
  value: string;
  source: SourceRef;
}

export interface ScriptDeclaredMember {
  member: string;
  memberKind: "method" | "property";
  containerHint?: string;
  source: SourceRef;
}

export interface ScriptSpatialRoutePoint {
  routeId: string;
  location: {
    x: number;
    y: number;
    z: number;
  };
  index?: number;
  collectionHint?: string;
  source: SourceRef;
}

export interface ScriptSpatialOffsetTransform {
  functionName: string;
  pointParameter: string;
  contextParameter: string;
  offsetPath: string;
  source: SourceRef;
}

export interface ScriptSpatialTransformUse {
  functionName: string;
  pointExpression: string;
  contextExpression: string;
  source: SourceRef;
}

export interface ScriptSpatialWorldMutation {
  method:
    | "setBlockType"
    | "setBlockPermutation"
    | "fillBlocks";
  executionRegion: string;
  status: "resolved" | "unresolved";
  volume?: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  writeIdentity?: string;
  /** Uninterpreted authored second argument at the write site. */
  permutationExpression?: string;
  reason?: string;
  source: SourceRef;
  lexicalGuards?: readonly ScriptLexicalGuard[];
  precedenceGuards?: readonly ScriptLexicalGuard[];
}

export interface ScriptSpatialContextOffsetSeries {
  collectionName: string;
  sourceCollectionName: string;
  contextCount: number;
  offsetPath: string;
  offsetBase: {
    x: number;
    y: number;
    z: number;
  };
  offsetStride: {
    x: number;
    y: number;
    z: number;
  };
  contextIdPrefix?: string;
  contextIdIndexBase?: number;
  source: SourceRef;
}

export type ScriptGuardScalar =
  | string
  | number
  | boolean
  | null;

export type ScriptGuardOperand =
  | { kind: "path"; path: string }
  | { kind: "literal"; value: ScriptGuardScalar }
  | {
      kind: "index";
      base: ScriptGuardOperand;
      key: ScriptGuardOperand;
    };

export type ScriptGuardPredicate =
  | {
      kind: "truthy";
      operand: ScriptGuardOperand;
    }
  | {
      kind: "falsy";
      operand: ScriptGuardOperand;
    }
  | {
      kind: "comparison";
      operator: "eq" | "neq" | "lt" | "lte" | "gt" | "gte";
      left: ScriptGuardOperand;
      right: ScriptGuardOperand;
    }
  | {
      kind: "all" | "any";
      predicates: readonly ScriptGuardPredicate[];
    }
  | {
      kind: "in";
      operand: ScriptGuardOperand;
      values: readonly ScriptGuardScalar[];
    }
  | {
      kind: "fallback";
      excludedPredicates: readonly ScriptGuardPredicate[];
    }
  | {
      kind: "unknown";
      text: string;
    };

export interface ScriptGuardedOutcome {
  executionRegion: string;
  conditionText: string;
  conditionIdentifiers: readonly string[];
  predicate: ScriptGuardPredicate;
  propertyName: string;
  value: string;
  conditionSource: SourceRef;
  outcomeSource: SourceRef;
}

export interface ScriptArenaAuthorityEvidence {
  kind:
    | "membership-commit"
    | "membership-release"
    | "capacity-operand"
    | "capacity-check"
    | "arena-generation-operand"
    | "generation-invalidate"
    | "start-owner-guard"
    | "start-owner-acquire"
    | "start-state-commit"
    | "ready-set-snapshot-risk";
  arenaExpression: string;
  subjectExpression?: string;
  membershipExpression?: string;
  capacityExpression?: string;
  /** Exact source span of the roster write enforced by this guard. */
  guardedCommitSource?: SourceRef;
  /** Immutable selected-source numeric configuration, not runtime success. */
  resolvedCapacityValue?: number;
  resolvedCapacitySource?: SourceRef;
  /** Constructor assignment and matching allocations used in numeric proof. */
  resolvedCapacityWitnesses?: readonly SourceRef[];
  ownerExpression?: string;
  generationExpression?: string;
  stateExpression?: string;
  snapshotExpression?: string;
  revalidationExpression?: string;
  executionRegion: string;
  source: SourceRef;
  /** Present only for an authored direct statement within one lexical block. */
  sequentialBlockSource?: SourceRef;
  sequentialPathEvidence?: ScriptSequentialPathEvidence;
}

export interface ScriptArenaAuthorityPath {
  arenaExpression: string;
  /** Position-qualified evidence-owner identity; never discard or merge. */
  executionRegion: string;
  /** Exact unique binding to the parser/CFG region, when one exists. */
  parserExecutionRegion?: string;
  membershipCommit?: ScriptArenaAuthorityEvidence;
  membershipRelease?: ScriptArenaAuthorityEvidence;
  capacityOperand?: ScriptArenaAuthorityEvidence;
  capacityCheck?: ScriptArenaAuthorityEvidence;
  generationOperand?: ScriptArenaAuthorityEvidence;
  generationInvalidation?: ScriptArenaAuthorityEvidence;
  startOwnerGuard?: ScriptArenaAuthorityEvidence;
  startOwnerAcquire?: ScriptArenaAuthorityEvidence;
  startStateCommit?: ScriptArenaAuthorityEvidence;
  capacityAuthorityProven: boolean;
  startAuthorityProven: boolean;
  startGuardProven: boolean;
}

export interface ScriptPersistenceIdempotencyGuard {
  propertyKey: string;
  appliedExpression: string;
  journalExpression: string;
  sideEffectExpression: string;
  executionRegion: string;
  conditionSource: SourceRef;
  sideEffectSource: SourceRef;
  journalWriteSource: SourceRef;
}

export interface ScriptCapabilityUse {
  capability:
    | "world-access"
    | "system-access"
    | "event-subscription"
    | "dynamic-properties"
    | "script-event"
    | "restricted-execution"
    | "early-execution"
    | "api-method"
    | "api-property"
    | "api-property-write"
    | "api-module-member"
    | "api-imported-symbol"
    | "unknown";
  detail?: string;
  source: SourceRef;
}

/** Source-local CFG: source facts only, never evaluated gameplay. */
export interface ScriptControlFlowNode {
  readonly id: string;
  readonly kind: "entry" | "exit" | "statement" | "condition" | "opaque";
  readonly site?: SourceSequentialSite;
}

export interface ScriptControlFlowEdge {
  readonly from: string;
  readonly to: string;
  readonly branch?: "true" | "false";
}

export interface ScriptControlFlowRegion {
  readonly region: string;
  readonly entryId: string;
  readonly nodes: readonly ScriptControlFlowNode[];
  readonly edges: readonly ScriptControlFlowEdge[];
}

export interface ParsedScriptFile {
  identifier: string;
  source: SourceRef;
  /** Original source string for source-level inspectors; parser does not copy or normalize it. */
  text?: string;
  controlFlowRegions?: readonly ScriptControlFlowRegion[];
  /** Nested, source-authored wave recipes; not actual gameplay execution. */
  waveConfigurations?: readonly ScriptWaveStage[];
  /** Explicit source-labelled gameplay/mode/challenge catalog entries. */
  authoredGameplayCatalog?: readonly ScriptAuthoredGameplayEntry[];
  /** Source-labelled content choices, not verified player challenge content. */
  authoredContentCollections?: readonly ScriptAuthoredContentCollection[];
  /** Exact named-ESM collection method reference, NOT an executed round. */
  authoredContentUses?: readonly ScriptContentUseSite[];
  /** Source facts for direct JS property writes, not live state or score proof. */
  authoredPropertyMutations?: readonly ScriptAuthoredPropertyMutation[];
  /** Calls via another object; target method ownership not proven. */
  unresolvedReceiverCalls?: readonly ScriptUnresolvedReceiverCall[];
  /** Exact direct class-constructor/field/this-forward source witnesses. */
  importedThisConstructions?: readonly ScriptImportedThisConstruction[];
  constructorFieldBindings?: readonly ScriptConstructorFieldBinding[];
  thisInstanceDispatches?: readonly ScriptThisInstanceDispatch[];
  sourceClassMethods?: readonly ScriptSourceClassMethod[];
  /** Source-only owner Map declaration and literal access sites. */
  sourceClassMaps?: readonly ScriptClassMapCollection[];
  sourceClassMapAccesses?: readonly ScriptClassMapAccess[];
  blockCustomComponentRegistrations?: BlockCustomComponentRegistrationEvidence[];
  persistentReconciliation?: PersistentReconciliationEvidence;
  imports: ScriptImport[];
  events: ScriptEventSubscription[];
  dynamicProperties: DynamicPropertyAccess[];
  restrictedMutations: RestrictedExecutionMutation[];
  deferredCallbacks: ScriptDeferredCallback[];
  localFunctionCalls: ScriptLocalFunctionCall[];
  /** Exact authored guards for direct imported calls resolved separately. */
  importedCallGuardSites?: readonly ScriptImportedCallGuardSite[];
  blockMatchGuards: ScriptBlockMatchGuard[];
  methodCalls: ScriptMethodCall[];
  propertyAccesses: ScriptPropertyAccess[];
  propertyWrites: ScriptPropertyWrite[];
  entityEventTriggers: ScriptEntityEventTrigger[];
  commandLiterals: ScriptCommandLiteral[];
  lifecycleMemberExposures: ScriptLifecycleMemberExposure[];
  moduleMemberAccesses: ScriptModuleMemberAccess[];
  importedSymbols: ScriptImportedSymbol[];
  enumValueComparisons: ScriptEnumValueComparison[];
  stateMutations?: ScriptStateMutation[];
  typeProperties?: ScriptTypeProperty[];
  transitionDeclarations?: ScriptTransitionDeclaration[];
  returnOutcomes?: ScriptReturnOutcome[];
  guardedOutcomes?: ScriptGuardedOutcome[];
  declaredMembers?: ScriptDeclaredMember[];
  spatialRoutePoints?: ScriptSpatialRoutePoint[];
  spatialOffsetTransforms?: ScriptSpatialOffsetTransform[];
  spatialTransformUses?: ScriptSpatialTransformUse[];
  spatialContextOffsetSeries?: ScriptSpatialContextOffsetSeries[];
  spatialMutations?: ScriptSpatialMutationEvidence[];
  spatialMutationRejected?: ScriptSpatialMutationRejection[];
  spatialWorldMutations?: ScriptSpatialWorldMutation[];
  cleanupResourceEvidence?: ScriptCleanupResourceEvidence[];
  chunkLifecycleEvidence?: ScriptChunkLifecycleEvidence[];
  combatLifecycleEvidence?: ScriptCombatLifecycleEvidence[];
  economyEvidence?: ScriptEconomyEvidence[];
  progressionCounterEvidence?: ScriptProgressionCounterEvidence[];
  progressionActorSpawnEvidence?: ScriptProgressionActorSpawnEvidence[];
  progressionActorRegistryEvidence?: ScriptProgressionActorRegistryEvidence[];
  inventoryLifecycleEvidence?: ScriptInventoryLifecycleEvidence[];
  globalLeaseEvidence?: ScriptGlobalLeaseEvidence[];
  persistentDataLifecycleEvidence?: PersistentDataLifecycleEvidence[];
  resultAuditRecordEvidence?: ScriptResultAuditRecordEvidence[];
  persistentStateScopes?: PersistentStateScopeEvidence[];
  persistentStateLifetimes?: PersistentStateLifetimeEvidence[];
  repairTransformHints?: RepairSourceTransformHint[];
  arenaAuthorityEvidence?: ScriptArenaAuthorityEvidence[];
  arenaAuthorityPaths?: ScriptArenaAuthorityPath[];
  persistenceIdempotencyGuards?: ScriptPersistenceIdempotencyGuard[];
  safeConfigBindings?: ScriptSafeConfigBinding[];
  safeConfigFunctions?: ScriptSafeConfigFunction[];
  safeConfigImports?: ScriptSafeConfigImport[];
  safeConfigExports?: ScriptSafeConfigExport[];
  safeConfigRejected?: ScriptSafeConfigRejection[];
  capabilities: ScriptCapabilityUse[];
}
