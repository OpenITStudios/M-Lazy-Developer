# Behavioral World Model

The Behavioral World Model is the formal state/transition/temporal kernel for M-Bedrock-Dev.

It is deliberately separate from:

- Semantic IR, which describes normalized source execution/state/temporal structure;
- the knowledge catalog, which stores evidence-backed claims;
- Runtime Lab, which executes controlled experiments;
- reliability search, which explores candidate state/input schedules.

## Kernel

The kernel owns:

- typed semantic variable declarations;
- scoped state instances so multiple players/entities/arenas do not alias;
- explicit authority labels;
- composable boolean predicates;
- deterministic transition preconditions/effects;
- declared Minecraft nondeterminism surfaces;
- finite execution traces;
- temporal properties;
- conservative three-valued evaluation.

Incomplete traces must not prove open-ended temporal claims.

## Minecraft semantic overlays

Runtime classes are separate:

- Bedrock retail client;
- listen server;
- dedicated server;
- Realm;
- Preview;
- Education host;
- Editor.

Claims do not inherit across runtime classes unless inheritance names the source overlay and explicit claim IDs.

## Versioned semantic-claim registry

Runtime/version-specific claim revisions are stored independently from overlays.

The registry:

- keeps exact runtime-class and Minecraft-version scope;
- retains provenance/evidence ceiling;
- supports explicit supersession;
- detects active contradictory dispositions;
- refuses automatic resolution while conflict remains;
- prefers exact-version claims over unversioned fallback claims.

A documented claim and a contradictory runtime observation are not silently ranked. They remain an explicit conflict until a stronger reconciled revision supersedes both.

## Canonical terminology

Target-specific combat, inventory, economy, and spatial constraints are **Behavior Contracts**. Legacy `*Policy` type names remain compatibility aliases; they must not be confused with global Engineering Contracts or Game Design.

## Safety

Behavioral model fragments are evaluation specifications, not Game Design authority. Intended gameplay originates in approved Game Design or sufficiently grounded authored intent.

Observed behavior does not automatically become a general engine fact.

Absence of a claim is unknown, not false.

## Source-behavior structural comparison

`source-behavior-shape.ts` compares typed, bounded source effect anatomy
and state operations without identifying source files, function names or
gameplay labels. It supports source navigation across differing coding styles
and is consumed by existing UNDERSTAND model-task projections. A structural
analog is **not a gameplay-equivalence claim**. Missing typed effects,
unresolved call edges, disconnected entries or omitted source evidence must
keep the comparison inconclusive. Independent design, scope and runtime proof
remain necessary for stronger claims.

The source shape also retains the authored write RHS syntax projected by
Semantic IR (literal Boolean true/false, unevaluated logical RHS,
self-negation, typed scalar literal, or member expression). These are
syntactic forms, not runtime values or state aliases. A material write with
unrecorded RHS syntax makes a proposed structural analog inconclusive;
the source-only comparison also preserves repeated writes instead of
collapsing them to one operation-kind count. This guards against comparing
two maps as structurally equal merely because both assign a status field.


## Provenance naming

Canonical provenance for target-specific authored constraints is `behavior-contract`. `project-policy` is retained only as a legacy compatibility value and must not be used for new data.
