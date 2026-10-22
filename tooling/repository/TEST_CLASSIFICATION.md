# Test classification (provisional)

Inventory refreshed against GitHub `Local` source commit `fa5e22c75044de2ea66628a9642c5b4ef86eb014`: **691 existing test files**. Two already-present tests missing from the previous 689-entry inventory were included; no tests were added, executed, or deleted.

This is a **path/name-derived execution routing inventory**, not proof that any test ran, is redundant, or is safe to remove. Review metadata currently records 232 `source-reviewed`, 159 `case-inventory-reviewed`, and 300 `pending-semantic-review` entries. A review label describes source triage, never a PASS. A file may guard several behaviors; its single lane is a provisional execution route, not an exclusive risk assessment.

| Execution lane | Files | Intended use |
| --- | ---: | --- |
| safety | 54 | Authorization, preservation and mutation safety; run when related trust boundaries change |
| acceptance | 26 | Integrated workflows; run when behavior is stabilized or materially changed |
| runtime | 84 | Runtime/telemetry/harness contracts; not equivalent to live Minecraft proof |
| regression | 68 | Golden/history/failure-family regression; targeted or pre-release |
| development | 459 | Evolving component contracts; only when relevant to the changed owner |

`tooling/repository/test-inventory.json` is the single generated routing list. It does not confer any PASS/FAIL verdict. Avoid adding test files solely to meet coverage quotas. Leave automatic CI disabled.

## Reviewing a test

Check (1) imported production owner; (2) tested behavior and observable risk; (3) positive, negative and UNKNOWN cases; (4) overlap with upstream/downstream tests; (5) whether the behavior is still authoritative. Only after reviewing the source can the reviewer propose `keep`, `merge`, `defer`, or `obsolete`. No blanket deletion by lane or file size. The safety lane is not a substitute for reviewing safety-related tests in other lanes.

The normal `npm test` acceptance selection and `npm run test:full` remain unchanged. Future explicit lane selection can be implemented after semantic review; do not mistake path-based grouping for a trustworthy automatic safety gate.
