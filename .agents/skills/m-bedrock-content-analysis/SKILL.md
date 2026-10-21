---
name: m-bedrock-content-analysis
description: >
  Analyze manifests, functions, commands, references, semantic graphs, diagnostics, and topology as a read-only domain specialist. Does not choose the active work lane.
---

# Lazy-Developer Content Analysis

**Role:** DOMAIN SPECIALIST — read-only semantic analysis

Use for manifests, functions, commands, references, semantic graph, diagnostics, and derived topology facts.

## Procedure

1. Start from normalized inventory/project facts.
2. Parse only content relevant to the question.
3. Preserve raw source/evidence.
4. Emit typed semantic nodes/edges/effects.
5. Keep unresolved and ambiguous references explicit.
6. Use `SourceRef` for traceability.
7. Populate graph/reverse indexes only from supported facts.
8. Derive diagnostics from facts; do not mutate source.
9. Use topology as a derived view, never a universal arena assumption.

## External developer-practice reference boundary

When selected-artifact evidence raises a specific semantic question,
consult `docs/analysis/developer-practice-context.md` and the existing
`experiments/developer-practice-signals.json` only as `REFERENCE` inputs.
Use the selected Semantic IR's exact source IDs and the existing opt-in
`compileDeveloperPracticeReferenceContext()` (maximum two hints), not
raw keyword matching or wholesale execution of uploaded skills.
The 2026-10-21 intake includes scoped camera/chunk, JSON-versus-script
state ownership and idempotent scheduling questions plus the upstream
Skills Probe's negative and unverified cases. Do not convert those
external reports into platform facts, map intent, BUG disposition,
analyzer mutations, or a claim that Minecraft was run here.

## Complete external implementation reference boundaries

Developer v0.24.0 source examples comprise 20 TypeScript modules with
eight accompanying module tests. The existing
`experiments/developer-practice-signals.json` tracks all module paths and
hashes, plus all 22 Skills Probe reports and their attribution. Model
task context may include bounded same-skill code/probe pointers only
after an exact selected-map Semantic IR cue. It does not call or import
any external runtime implementation. Test-only fake Minecraft, result
export adapters and external store dependencies must not become
source-independent gameplay invariants. Unsupported cues remain explicit.

## Efficiency

Prefer content hashes, selective parsing, and change-scoped invalidation over full rescans.


## Lane boundary

This skill does not decide whether the current job is Map Audit or Detection Development.

- In **Map Bug Audit**, use existing analysis capability only. If required semantics are unsupported, emit `detection-gap` and return to the audit lane.
- In **Detection Development**, this skill defines analyzer semantics/ownership, but development acceptance is owned by `m-bedrock-detection-development`.

Never modify analyzer implementation merely because an operational audit encounters unsupported evidence.
