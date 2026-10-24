# Benchmark Corpus Rules

## Ownership

- `engine/reliability/corpus/calibration.json` — development-visible real/reduced cases.
- `engine/reliability/corpus/acceptance.json` — blind holdout cases.
- `engine/reliability/corpus/regressions.json` — minimized reproduced defects.

## Evidence rules

- Prefer reduced/synthetic fixtures for permanent regression tests.
- Do not commit private client maps as general regression fixtures.
- External/full production maps stay outside Git and are referenced by artifact identity plus SHA-256.
- A case is not scorable until its expectation is frozen and its artifact fingerprint is verified.
- Keep positive and negative examples for every material detector family.
- Version-pin Minecraft behavior when semantics changed across releases.
- Preserve known expected failures explicitly.
- Separate detector correctness from runtime-proof availability.
- Do not remove a difficult case because a new implementation cannot pass it.
- Corpus changes require a reason independent of the implementation under test.

## Anti-overfitting rules

- Calibration cases may inform detector development.
- Acceptance cases must not inform detector implementation before observed output is frozen.
- Do not copy acceptance semantics into detector rules or prompts.
- Do not rewrite an expectation after seeing a failing detector unless independent evidence proves the expectation itself was wrong.
- If an expectation becomes stale because the artifact or target Minecraft version changed, classify it `fixture-invalid` and re-approve it rather than silently editing history.

## Negative cases

A known-good case is first-class benchmark evidence.

Unexpected detection on a known-good case is a false positive. Correct silence is a true negative. Do not omit TN from aggregate quality reporting.
