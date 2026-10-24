# Detection Development Specification

## Intent
Improve reusable detector correctness, semantic coverage, or proof strength from a bounded detection gap/regression.

## In scope
- adapters/parsers/analyzers;
- Platform Knowledge / Rules;
- design grounding / Behavior Contracts;
- diagnostic inference;
- proof/runtime-harness capability;
- reduced fixtures and frozen expectations.

## Out of scope
- production-map repair;
- unrelated product features;
- seed-specific hardcoding.

## Acceptance
- first missing owner is identified;
- generalized acceptance is stated before implementation;
- reduced fixture or stable expectation exists;
- false-positive boundary is represented where material;
- benchmark handoff is explicit.

## Discovery-specific acceptance

When improving gameplay Discovery, require a grounded positive case and a distinct negative or ambiguous case for the affected semantic claim. Follow the existing evidence path from selected-artifact source through the affected analyzer, semantic/intent/world model, scenario or challenger, and closure/admission consumer as applicable. A fix is not accepted merely because a parser emits more findings.

A material `UNKNOWN` must retain its exact unresolved question and the relevant available evidence/search route attempted, or name the inaccessible source/capability that stopped investigation. Do not claim search exhaustion when it was not performed. Conversely, do not leave a claim UNKNOWN when bounded available evidence already proves it.

Treat source indexing, gameplay semantics, relationships, and proof as distinct concerns. Never use Discovery `COMPLETE`, lexical resemblance, matching paths, or contract `sourceRefs` alone as proof of full gameplay understanding or runtime isolation. Preserve unsupported/conflicted evidence without fabricating authority.

## Quality objective
Optimize detector quality, not raw finding count. Precision, recall, proof strength, evidence cost, and runtime/context cost are all valid quality dimensions.
