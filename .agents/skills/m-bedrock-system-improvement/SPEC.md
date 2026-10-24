# IMPROVE SYSTEM Specification

## Scope

Develop the existing Lazy-Developer map-checking engine and its canonical source/consumer flow, including architecture, source/semantic interpretation, reusable detection, Minecraft knowledge, reporting and repository tooling. **Detection improvement and BENCHMARK are operations inside IMPROVE SYSTEM**, not additional work lanes.

## Acceptance

- requested observable outcome and non-goals defined;
- first affected canonical owner established from current source;
- smallest complete change implemented without duplicate ownership;
- relevant regression surface checked at the available proof ceiling;
- exact commit and remaining unverified claims reported.

## Exclusions

No selected-map audit or target mutation, new persistent work-state representation, implicit TEST MAP handoff, upstream script execution/installation, automatic release, or frozen benchmark expectation rewrite.

## Developer ZIP alignment and source boundary

- Native source identity is `skills/bedrock/source-lock.json` (publisher `skills.json`, skill-folder hashes, `module.json` / `requires`); reviewed methodology and independent Skills Probe reports live in `experiments/developer-practice-signals.json`. Pin developer ZIP and Probe installed-skills versions separately.
- Apply relevant `bedrock-agent-team`, `bedrock-project-setup`, `bedrock-git-workflow`, `bedrock-testing-policy`, `bedrock-release-export`, and `bedrock-game-results` principles through existing `GITHUB_RULES.md` and `docs/system/development-discipline.md`: accountable owner, edition/version, bounded code change, explicit approval, risk-matched proof and verified commit. Do not import the publisher's agent hierarchy, Bun/Regolith runner, package installer, release machinery or client-specific scoring rule.
- Technical methods remain source-locked REFERENCE, not executable agent policy or Minecraft gameplay authority. Preserve original Probe PASS/FAIL/BLOCKED/PARTIAL/pending, `status`/`nodeStatus`/`engineStatus`, report revision and target client; no report is current-map proof.
- Follow **DEFINE → INVESTIGATE → DESIGN → IMPLEMENT → VERIFY → COMMIT & STOP**; repair the first incorrect reusable owner and actual consumer, avoid map-specific hardcoding, and never claim unexecuted TypeScript/Minecraft PASS.
