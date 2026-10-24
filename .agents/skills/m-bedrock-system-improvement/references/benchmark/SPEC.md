# Detection Benchmark Specification

## Intent
Measure detector correctness, proof coverage, regression, and cost against frozen expectations.

## In scope
- repeated detector execution;
- positive/negative/near-miss/ambiguous/version-shift cases;
- TP/FP/FN/unknown;
- precision/recall;
- proof/evidence-tier and cost comparison.

## Out of scope
- changing production detector implementation;
- repairing maps;
- rewriting expectations to fit output.

## Acceptance
- expectation was frozen before observing candidate output;
- result class is explicit;
- metrics are reproducible;
- repeated-run variance is retained when available;
- development handoff is bounded.
