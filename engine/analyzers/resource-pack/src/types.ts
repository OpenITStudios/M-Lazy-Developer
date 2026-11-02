import type { SourceRef } from "../../../packages/project-model/src/index.js";

export interface ResourcePackAnimationDefinition {
  id: string;
  formatVersion?: string;
  source: SourceRef;
  /** Authored timeline particle-effect ALIASES, not active emitted particles. */
  particleEffectAliases?: readonly string[];
}

/** Selected RP client-entity declaration, not proof of client loading. */
export interface ResourcePackClientParticleSource {
  readonly identifier: string;
  readonly source: SourceRef;
  readonly animationAliases: Readonly<Record<string, string>>;
  readonly activeAnimationAliases: readonly string[];
  readonly particleAliases: Readonly<Record<string, string>>;
}

/** Selected RP particle definition, not evidence of visual rendering. */
export interface ResourcePackParticleSource {
  readonly identifier: string;
  readonly source: SourceRef;
}

/** Unique, source-joined BP player seat/family → BP actor → RP visual chain.
 * No rider installation, effect emission or cleanup outcome is observed.
 */
export interface PlayerParticleAttachmentCandidate {
  readonly id: string;
  readonly actorIdentifier: string;
  readonly family: string;
  readonly particleIdentifier: string;
  readonly sources: readonly SourceRef[];
  readonly proof: "AUTHORED_BP_RP_ATTACHMENT_CANDIDATE_NOT_GAMEPLAY_PROOF";
}

export interface AnimationControllerTransition {
  targetState: string;
  condition: string;
}

export interface AnimationControllerState {
  id: string;
  animations: string[];
  transitions: AnimationControllerTransition[];
  particleEffects: string[];
  soundEffects: string[];
  onEntry: string[];
  onExit: string[];
}

export interface ResourcePackAnimationController {
  id: string;
  formatVersion?: string;
  initialState: string;
  states: AnimationControllerState[];
  molangExpressions: string[];
  source: SourceRef;
}
