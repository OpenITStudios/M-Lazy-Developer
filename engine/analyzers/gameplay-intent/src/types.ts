import type { ParsedScriptFile, CrossFileCallEdge } from "../../scripts/src/index.js";
import type {
  GameplayIntentEdgeKind,
  GameplayIntentEvidenceOrigin,
  GameplayIntentNodeKind,
  GameplayIntentPolicyPredicate,
  GameplayIntentSpatialProfile,
  GameplayIntentStatus,
} from "../../../packages/gameplay-intent/src/index.js";

export interface GameplayIntentSignal {
  id: string;
  subjectKey: string;
  nodeKind: GameplayIntentNodeKind;
  label: string;
  status: GameplayIntentStatus;
  evidenceOrigin: GameplayIntentEvidenceOrigin;
  locator: string;
  summary: string;
  policyPredicate?: GameplayIntentPolicyPredicate;
  spatialProfile?: GameplayIntentSpatialProfile;
  /**
   * Same lexical state value appears on distinct script-memory targets.
   * This is an identity/alias question, not a claim about runtime scope.
   */
  sourceStateCollisionBaseKey?: string;
  /** Finite source-declared values, not a verified player journey. */
  sourceObjectiveStateSequence?: {
    readonly declarationName: string;
    readonly statePropertyName: string;
    readonly values: readonly string[];
  };
  /** AST-local objective-state literal sites, not executed or committed writes.
   * The same selected-source parser owns these facts; Intent reuses them. */
  sourceObjectiveStateWriteOrigins?: readonly {
    readonly scriptSource: ParsedScriptFile["source"];
    readonly declarationName: string;
    readonly statePropertyName: string;
    readonly value: string;
    readonly sequenceIndex: number;
    readonly site: NonNullable<
      ParsedScriptFile["sourceStateSequences"]
    >[number]["literalWriteSites"][number];
  }[];
  /** Exact parsed named function region, not evidence of its actual invocation. */
  executionRegionOrigins?: readonly {
    scriptSource: ParsedScriptFile["source"];
    scriptIdentifier: ParsedScriptFile["identifier"];
    region: string;
  }[];
  /** Exact authored state-write sites; source mutation is not an executed transition. */
  stateMutationOrigins?: readonly {
    scriptSource: ParsedScriptFile["source"];
    mutation: NonNullable<ParsedScriptFile["stateMutations"]>[number];
  }[];
  /** Exact parsed return sites associated with an already classified intent candidate. */
  returnOutcomeOrigins?: readonly {
    scriptSource: ParsedScriptFile["source"];
    outcome: NonNullable<ParsedScriptFile["returnOutcomes"]>[number];
  }[];
  /** Exact resource actions within an already classified function, not reset proof. */
  resourceActionOrigins?: readonly {
    scriptSource: ParsedScriptFile["source"];
    action: NonNullable<ParsedScriptFile["cleanupResourceEvidence"]>[number];
  }[];
}

export interface GameplayIntentRelationSignal {
  id: string;
  /** Exact authored return sites for inferred source producer relationships. */
  returnOutcomeOrigins?: readonly {
    scriptSource: ParsedScriptFile["source"];
    outcome: NonNullable<ParsedScriptFile["returnOutcomes"]>[number];
  }[];
  /** Exact parsed state assignments for inferred transitions; not gameplay proof. */
  stateMutationOrigins?: readonly {
    scriptSource: ParsedScriptFile["source"];
    mutation: NonNullable<ParsedScriptFile["stateMutations"]>[number];
  }[];
  /** Exact parsed local call sites, not merely a lexical relationship hint. */
  localCallOrigins?: readonly {
    scriptSource: ParsedScriptFile["source"];
    call: ParsedScriptFile["localFunctionCalls"][number];
  }[];
  /** Exact direct ESM call and both module owners, not a verified gameplay dependency. */
  crossFileCallOrigins?: readonly {
    scriptSource: ParsedScriptFile["source"];
    targetScriptSource: ParsedScriptFile["source"];
    call: CrossFileCallEdge;
  }[];
  /** Parsed event or scheduler origin; exact IR ID is resolved by the model stage. */
  callbackOrigins?: readonly (
    | { kind: "event"; scriptSource: ParsedScriptFile["source"];
        scriptIdentifier: string; event: ParsedScriptFile["events"][number] }
    | { kind: "scheduler"; scriptSource: ParsedScriptFile["source"];
        callback: ParsedScriptFile["deferredCallbacks"][number] }
  )[];
  fromSubjectKey: string;
  toSubjectKey: string;
  edgeKind: GameplayIntentEdgeKind;
  status: GameplayIntentStatus;
  evidenceOrigin: GameplayIntentEvidenceOrigin;
  locator: string;
  summary: string;
}

export interface GameplayOutcomePolicyCoverage {
  outcomeSubjectKey: string;
  totalLiteralReturnSites: number;
  directlyGuardedReturnSites: number;
  completeDirectGuardCoverage: boolean;
}

export interface GameplayIntentSignalSet {
  schemaVersion: 1;
  signals: readonly GameplayIntentSignal[];
  relations: readonly GameplayIntentRelationSignal[];
  outcomePolicyCoverage: readonly GameplayOutcomePolicyCoverage[];
}
