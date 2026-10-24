# M-Lazy-Developer — two internal skills

Exactly **two** active `SKILL.md` files are registered and selected:

- **IMPROVE SYSTEM:** `.agents/skills/m-bedrock-system-improvement/SKILL.md` — architecture, engine, references, detector work, constrained benchmark and development.
- **TEST MAP:** `.agents/skills/m-bedrock-map-testing/SKILL.md` — one selected map using **LOAD → UNDERSTAND → TEST → REPORT**, with an explicit optional approved working-copy repair action, never an automatic audit stage.

`.agents/skill-registry.json` owns this two-skill routing. Neither independent Bedrock developer ZIP skills nor Skills Probe are installed in this agent registry. They form a reviewed reference/evidence domain at `skills/bedrock/` and `experiments/developer-practice-signals.json`, delivered through existing Resource Context only with exact selected-map source witnesses. Their reported outcomes do not prove current-map gameplay.

Old detection, benchmark, map-audit, repair and domain-specialist procedures have been **consolidated into these two skills**. Reusable supporting references and deterministic scripts remain within the relevant new skill tree. They are **not** third work lanes.

Permission preflight: `.agents/permissions/evaluate-lane-permission.mjs`. IMPROVE SYSTEM may write the approved engine/source but not targets; TEST MAP is read-only unless a separate, exact, explicit **approved-target-repair** operation satisfies its narrowed working-copy gate. Frozen benchmark operations cannot mutate code/expectations to pass. `docs/system/skill-routing.md` is the canonical selection rule.

ChatGPT Chat remains the sole operator; GitHub `Local` is the working source. Read `AGENTS.md` and `GITHUB_RULES.md` before material repository work.
