---
name: m-bedrock-detection-development
description: >
  Improve reusable Lazy-Developer bug-detection, diagnosis, platform semantics, or proof capability. Use for detection gaps and detector false positives/negatives; not production-map auditing.
---

# Lazy-Developer Detection Development

**Lane:** DEVELOPMENT / BUG-DETECTION IMPROVEMENT

## Purpose

Improve reusable bug-detection correctness, coverage, or proof strength. This is not generic Product Development.

## Entry criteria

Use only for detection-gap, detector false positive/negative, missing/stale platform semantics, missing diagnostic/proof coverage, repeated manual checks, or Minecraft changes affecting detector correctness.

## Allowed actions

- improve adapters/parsers/analyzers/knowledge/rules;
- improve design grounding, Behavior Contract representation, diagnostics, or proof;
- add reduced fixtures and frozen benchmark expectations;
- improve runtime evidence collection for reusable detection.

## Forbidden actions

- patch the seed production map as the solution;
- hardcode seed-map identity/details in reusable logic;
- alter frozen expectations to pass;
- broaden into unrelated Product Development;
- resume Map Bug Audit automatically.

## User-supplied developer methodology (not a second skill system)

For a relevant development concern, consult
`docs/analysis/developer-practice-context.md` and its **single**
`experiments/developer-practice-signals.json` source. The pinned
`sourceFiles[].methodology` entries preserve the developer's real
source chapters, investigation steps and disconfirming alternatives.
Use the six `DEVELOPMENT_WORKFLOW_PROVENANCE` entries only where
the activity matches their subject (ownership handoff, export,
versioning, scoped verification). No ZIP-local build/test command,
team agent, external tool or runtime dependency is implicitly
approved; follow this repository's GitHub authority and the user's
test deferral.

For detecting map errors, use the 16 source-interpretation
methodologies only through the current-map selected source and
existing `compileDeveloperPracticeReferenceContext()`, never by
adding global ZIP-derived defect rules. Preserve exact SHA, method
question, counterexample and proof ceiling.

## Mandatory operating style

Apply `docs/system/development-discipline.md#development-operating-standard` at task intake, before engine edits, and at completion. Discovery improvements must reject both unsupported confidence and unnecessary UNKNOWN; verify positive and negative examples without inventing new owners.

## Workflow

Detection Gap / detector regression → first missing owner → generalized acceptance → minimum reusable change → reduced fixture → frozen expectation → Detection Benchmark.

## Output contract

Validate against ../../schemas/detection-delta.schema.json.

Optional deterministic validation: node scripts/validate-delta.mjs delta.json

Evaluate detector quality using ../../references/detector-quality-metrics.md.

## Handoff

Implementation complete → m-bedrock-detection-benchmark. Benchmark success does not reopen the seed map audit automatically.

## Reference routing

- references/detection-gap-classification.md
- references/generalization-checks.md
- ../../references/detector-quality-metrics.md
- ../../references/evidence-cost-ladder.md

## STOP

Stop when generalized acceptance is implemented and remaining work belongs to benchmark, another owner, unavailable runtime proof, or unrelated cleanup.
