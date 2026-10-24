# Detection Benchmark Science

## A/B requirement

For material Detection Development, compare:
- baseline capability / prior skill revision;
- candidate capability / new skill revision.

Use the same frozen cases and evidence availability.

## Blind comparison

When qualitative judging is required, label outputs only A/B. The evaluator must not know which is newer.

Judge in this order:
1. semantic correctness;
2. false-positive safety;
3. missed defects;
4. proof/evidence integrity;
5. unnecessary escalation/cost;
6. clarity of unresolved residue.

## Repeated runs

Agent-driven evaluations are stochastic. One run is evidence, not a benchmark.

For material routing/procedure changes prefer multiple runs and report:
- mean;
- standard deviation;
- min/max;
- number of runs.

Do not hide variance by reporting only the best run.

## Acceptance

An improvement should normally avoid material regression in:
- precision;
- recall;
- proof strength;
- evidence-tier cost;
- runtime/token/context cost.

Tradeoffs require explicit justification.
