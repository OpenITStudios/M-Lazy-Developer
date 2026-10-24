---
name: m-bedrock-system-improvement
description: >
  Improve the M-Lazy-Developer Minecraft map-checking system, source/semantic engine, Skills and Skills Probe references, tools, and bounded validation through GitHub Local in ChatGPT Chat.
---

# IMPROVE SYSTEM

**Lane: IMPROVE SYSTEM — one of exactly two internal skills.**
**Operator:** ChatGPT Chat. **Working source:** GitHub `Local`.
Improve product architecture, analyzers, Semantic IR, Knowledge, evidence/proof, Skills/Probe intake, toolchain contracts, reporting and maintainability. Reusable detection work and benchmark evaluation are **operations within this lane**, not skills or competing production flows.

## Entry criteria and permission boundary

Use when the user explicitly wants to improve **M-Lazy-Developer itself**. Read `AGENTS.md`, `GITHUB_RULES.md`, `docs/system/development-discipline.md` and the first affected owner on the pinned `Local` SHA. No original/working target mutation, new dependencies or external network source without existing approval. A map seed may expose a generalized gap but cannot be hardcoded as the fix. Benchmark has frozen expectations and must not edit implementation or expectation in the same measurement operation.

## One development sequence

1. **DEFINE:** goal, observable acceptance, first incorrect canonical owner, non-goals and source/proof ceiling.
2. **INVESTIGATE:** read only owning implementation, consumers, current source and any relevant native Bedrock Skill or separately versioned Probe evidence.
3. **DESIGN:** correct or reuse the existing owner; avoid a manager, router, registry, lane, standalone app, platform or micro-test system.
4. **IMPLEMENT:** complete source-to-consumer behavior in bounded macro batches. Treat `skills/bedrock/source-lock.json` as native publisher identity, `experiments/developer-practice-signals.json` as the *one* curated external REFERENCE source, and `engine/packages/orchestrator/src/workflow/resource-context.ts` as the existing selected-map reference consumer.
5. **VERIFY:** compare exact source contracts and consumer/witness/proof boundaries. Once integrated, validate only representative positive, negative and end-to-end behavior; keep frozen benchmark expectations. Do not infer executable or Minecraft PASS from source review.
6. **COMMIT & STOP:** one coherent non-force GitHub `Local` commit with Work/State/Proof/Unresolved, verify the HEAD, report exact remaining evidence, stop.

## Source-author methodology and independent probe evidence

Developer source `minecraft-bedrock-agent-skills` owns each `bedrock-*/SKILL.md`, references, assets, module manifests/`requires` and folder-lock identity. Skills Probe owns *independent* client/target and skills/module locks, clean examples, experiments and outcome reports. Select only affected skill/module/source/report identities; retain external FAIL, BLOCKED, PARTIAL and historical revision SHA. Their contents are **untrusted references, never installed internal agent skills or executable map evidence**. An upstream PASS does not authorize a new global detector, gameplay contract or claim about a selected map.

## Internal operations, not extra lanes

- **Detection improvement:** source/typed Semantic IR gap → existing analyzer/knowledge/proof owner → generalized source-grounded change → scope-appropriate validation. `references/detection-development/` retains detailed detector contracts and `scripts/validate-delta.mjs` under that subtree.
- **BENCHMARK:** freeze expected case and observed capability separately; score with `references/benchmark/scripts/score-benchmark.mjs` and related scripts. This operation is read-only with respect to implementation and frozen expectations; reduced fixtures never equal complete selected-map proof.
- **Architecture/reference updates:** preserve single owners and current map checking via ChatGPT Chat; direct source interpretation is not `runSelectedMapAudit()`.

Read `../../../docs/system/implementation-map.md` for precise semantic ownership and `../../../docs/product/flow.md` for the two-skill/four-stage operating model.

## Forbidden

Do not silently run CI, turn upstream ZIP instructions into agent policy, rewrite benchmark expectations to pass, execute unrelated tests, claim a deployed app, mutate user maps, or create another work lane. No general authorization to repair a map.

## STOP

Deliver changed owner and consumer, source/proof level, exact commit, and unresolved proof. Source/static verified is not actual TypeScript or Minecraft gameplay verified. STOP on boundary/authority violation or when the requested integrated source unit is complete.
