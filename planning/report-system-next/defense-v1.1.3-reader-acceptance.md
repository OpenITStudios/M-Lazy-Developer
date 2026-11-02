# Defense Challenge v1.1.3 — Reader and Verification Readiness

**Work:** report-next-desktop-reader-acceptance / source-grounded reproduction readiness  
**Source boundary:** read-only selected world `Defense Challenge v1.1.3.mcworld`, SHA-256 `14a0dcb7354a69edb9d83c0f8c1e9fd160c29238011aeb817bcdaf31c098fced`; approved ledger `workspace/projects/defense-challenge/report/bug-report.json` at pinned Git `948a3a1d333350da24f14d7248e9ee580f3c6ab4`.  
**Status:** seven approved issues, two BUG and five DESIGN_MISMATCH, all `fixed:false`. This is **not** a Minecraft gameplay test or completion of `runSelectedMapAudit()`. The original world and ledger are not changed.

## What the reader should understand

The **approved ledger** describes current approved source findings. It is **not** the latest Map Audit findings list, a runtime log, or proof that a particular Minecraft test has run. The Report Next reader's `Reproduced`, `Not Reproduced`, and `Blocked` options describe **one tester attempt only**; `Passed`/`Failed` belong only to an eligible *after-fix* retest and do not change canonical Fixed.

A usable test is one that a reader can execute with the prerequisites already available. When a precise trigger, authorized test build, or necessary observation cannot be obtained, select **Blocked**, name the missing prerequisite in notes, and do not invent a gameplay PASS.

The seven approved issue descriptions below retain their original IDs; this document adds **reader/testing guidance only**. It does not replace their `reproduction` field or certify any new behavior.

## Quick routing

| Approved issue | Suitable first check | Readiness | Missing dependency / deciding observation |
| --- | --- | --- | --- |
| `BUG-DEF-INACTIVE-DIRECTION-OPPOSITE` | Controlled in-game North wool/front setup plus source trace | CONDITIONAL | Need North to be strongest wool front before OPPOSITE and visibility of the logical/physical spawn route |
| `BUG-DEF-RELOAD-DEFERRED-WAVE-TIMELINE` | Controlled world/script reload vs. an un-reloaded baseline | CONDITIONAL | Need Level 15 Wave 3, a reproducible real session reload and spawn count/timing observations |
| `DM-DEF-SHEARS-SPECIAL-BEHAVIOR` | Source inspection; gameplay requires approved expected behavior | BLOCKED for gameplay | The exact promised distinctive SHEARS mechanic must be established from approved design |
| `DM-DEF-FLAG-CAPTURE-AUTHORITY` | Static comparison of configured captureZone and runtime defeat check | SOURCE-CHECKABLE | Runtime spatial check requires reliable NPC/flag coordinates, not visual estimation |
| `DM-DEF-CRAFTING-UI` | Normal non-admin in-game inventory/crafting interaction | MANUAL-READY | Confirm intended UI access rule and do not confuse recipe restriction with disabling the UI |
| `DM-DEF-RETRY-MODE-CONFIG` | Static config/runtime comparison; controlled retry with counts | SOURCE-CHECKABLE / runtime conditional | Need known killed-NPC IDs/counts, a deterministic failure, and retry-state comparison |
| `DM-DEF-RESULT-EXPORT-VERSION` | Static record-ID builder vs. selected artifact version | SOURCE-CHECKABLE | Runtime output check needs permission to inspect persisted run/level record IDs |

### Test environment and recording rules

Use exactly the selected world SHA above, record Minecraft Bedrock/Education version, arena ID, player count, game mode, and server/reload mechanism. Use a **normal non-admin gameplay session** for player-facing checks. Separately authorized developer tooling may make setup faster, but a developer-only route is not proof that a normal player reaches the case. Never change the original `.mcworld` or canonical ledger to manufacture a test outcome.

The bundled selected-world configuration evaluates `IS_DEBUG_BUILD = true ? false : true`, i.e. **false**, and `ENABLE_DEBUG_SPAWN_SERVICE = IS_DEBUG_BUILD`. Therefore do **not** instruct testers to use `daigon:debug_spawn` in this build. `ctf_defense:skip_level` has a developer-permission gate. `ctf_defense:force_fail` exists as a script event, but must be restricted to an expressly authorized isolated test arena, never run as a default normal-player action. Source: `behavior_packs/BP/scripts/chunks/chunk-S5QGQQ5V.js:607,1034` and `ctf-defense-5V4T54X5.js:10224,13916-13934,13995-14020,15340`.

For each attempt, record: initial state, exact steps achieved, local timing, actual result, comparison/control, artifacts (screenshots/logs/coordinates when authorized), and **why** the conclusion is Reproduced / Not Reproduced / Blocked. If the required conditions could not be reached or observed, use **Blocked**. One negative attempt never proves absence.

## 1. OPPOSITE direction before South is enabled

**Issue:** `BUG-DEF-INACTIVE-DIRECTION-OPPOSITE` — Major, approved/open.

**Cause in source:** Level 5 Wave 2 declares only North/East. The spawn order is `WEAKEST`, `SAME`, `STRONGEST_WOOL` (SHEARS), then `OPPOSITE`. The resolver maps the preceding North direction to South without checking `levelConfig.directions` afterward; South is then converted to alternative South anchors. `getStrongestWool` orders by wool block count, not total block count.

**Setup:** Reach Level 5 Wave 2, with current front-scan data showing **North strictly ahead of East in wool count** so that the preceding SHEARS `STRONGEST_WOOL` entry selects North. Confirm whether player placement can produce this arrangement within configured detection zones; do not assume visibility of the logical front without coordinates/logs.

**Check:** Run the wave from this state. Record the declared active fronts and the resulting four `OPPOSITE` Tier 2 spawns. Look for South-route materialization even though South is not part of Level 5. Include a control attempt with different wool-front ranking if feasible.

**Supports issue:** the logical/physical spawn route is South before Level 10. **Not reproduced in this attempt:** the OPPOSITE group stays in the active North/East domain *and* the North-predecessor trigger was actually reached. **Blocked:** trigger/route cannot be identified, or Level 5 Wave 2 is inaccessible.

**Source:** `chunk-SEN6JQP2.js:1390-1415`; `ctf-defense-5V4T54X5.js:1761-1769,1722-1727,3922-3995`. **Source check establishes a possible out-of-domain transform; no in-game spawn was observed here.**

## 2. Delayed enemy group after actual session reload

**Issue:** `BUG-DEF-RELOAD-DEFERRED-WAVE-TIMELINE` — Major, approved/open.

**Source condition:** Level 15 Wave 3 includes six delayed NPCs: three East and three West, each `delaySeconds:10`, after the earlier North/South group. Recovery derives schedule from `lastLaunchedWaveIndex`; source has no proven reconstruction of the in-memory delayed sub-groups.

**Setup:** Reach Level 15 Wave 3. Establish a **baseline without reload** and record the number/timing/paths of its six delayed East/West units. Document how the test environment performs an actual **script/world session restart**; a player disconnect/reconnect is not interchangeable with that restart.

**Check:** Repeat under matching conditions. Restart while the 10-second delayed sub-group is pending; resume the same persisted arena/session; compare the post-restart East/West group with baseline, including missing NPCs, duplicate NPCs and remaining delay.

**Supports issue:** the pending six-NPC East/West group is lost or timing/composition diverges from control. **Not reproduced in this attempt:** all six materialize with the expected relative delay after a verified equivalent restart. **Blocked:** cannot control restart window, recover the same session, or count/identify the NPC group.

**Source:** `chunk-SEN6JQP2.js:1754-1808`; `ctf-defense-5V4T54X5.js:9954-9974,11110-11182,4286-4306`. Source does **not** establish a valid player-operated test-reload command.

## 3. SHEARS special identity

**Issue:** `DM-DEF-SHEARS-SPECIAL-BEHAVIOR` — Major, approved/open.

**Source check:** `SHEARS` becomes the ordinary `daigon:defense_tier_2_militia` entity with a `shears_carrier` tag. The reviewed selected-world scripts include the tag assignment, but no inspected consumer of that tag. SHEARS entries appear at Level 2 and later.

**Gameplay test is BLOCKED until the approved design identifies the required different behavior.** A comparison of SHEARS and Tier 2 movement alone cannot establish a missing *specific* mechanic without a design oracle. The tester should first obtain the intended action and its visible trigger. Then compare matched SHEARS/Tier 2 encounters and record the player-facing distinction or lack thereof.

**Supports source discrepancy:** special identity has no implemented tag consumer in inspected source. **Does not yet establish:** a specific unobserved live Minecraft mechanic. **Source:** `chunk-SEN6JQP2.js:1271,1345`; `ctf-defense-5V4T54X5.js:3846-3854`. Do not invent that shears must cut a particular block unless approved design explicitly says so.

## 4. Flag boundary authority

**Issue:** `DM-DEF-FLAG-CAPTURE-AUTHORITY` — Major, approved/open.

**Source check:** arena configuration has a `captureZone` around the flag, while actual defeat uses horizontal 1.3-block and vertical 1.5-block thresholds. The configured zone also feeds a warning-zone derivation. This is a mismatch between two named authorities, not evidence that radius **1.3** is inherently wrong.

**Manual test without coordinates is BLOCKED.** A reliable runtime check needs authorized positions for the enemy and flag, ideally snapshots/logs of center-based horizontal distance, vertical distance, warning state and defeat state at both sides of the 1.3 threshold. Record the arena-offset variant. A screenshot alone cannot reliably determine a 1.3-block boundary.

**Supports issue:** the configured captureZone is treated as the defeat boundary in design yet the actual defeat trigger follows a different radius. **Not reproduced in this attempt:** requires a genuine position-controlled boundary test; absence of a warning by sight is insufficient.

**Source:** `chunk-S5QGQQ5V.js:180-194`; `ctf-defense-5V4T54X5.js:1877-1881,1933-1943,2315-2320`.

## 5. Retry mode versus checkpoint behavior

**Issue:** `DM-DEF-RETRY-MODE-CONFIG` — Minor, approved/open.

**Source check:** config declares `full_level_restart`, while `retryLevel` gathers already-killed configured NPC IDs, calculates the first incomplete wave and calls `prepareRetry` with killed IDs.

**Controlled runtime check:** On a disposable, authorized test session, choose a level with identifiable NPCs, record its NPC total and killed configured IDs. Kill only a subset, induce failure using normal gameplay (or separately authorized `ctf_defense:force_fail <arenaId>` in an isolated developer session), and observe retry. Compare which killed NPCs return and whether the first wave restarts or only the remaining encounter resumes. Do not confuse a retry with reconnect or reload.

**Supports issue:** retry behaves as remaining-NPC checkpoint despite the declared full restart. **Not reproduced in this attempt:** all configured NPCs return and encounter restarts fully under the same controlled conditions. **Blocked:** killed-NPC IDs/counts or retry entry state unavailable.

**Source:** `chunk-S5QGQQ5V.js:970-985`; `ctf-defense-5V4T54X5.js:13783-13864,13916-13934`. Debug options must not be assumed available to ordinary players.

## 6. Persisted result version

**Issue:** `DM-DEF-RESULT-EXPORT-VERSION` — Minor, approved/open.

**Source check already sufficient for the literal discrepancy:** selected world/BP/RP are version 1.1.3, but `DEFENSE_RECORD_VERSION = "1.1.0"` is used in both level and run record IDs.

**Optional runtime check (developer access):** Complete/terminate a run that persists a result. Read the stored level/run IDs from an authorized data inspection interface and compare their version segment with selected-world 1.1.3. Capture full record ID, game/map version and session context; avoid exposing any player secrets.

**Supports issue:** stored ID begins `defense:1.1.0:...` for the selected 1.1.3 world. **Not reproduced in this attempt:** correctly names 1.1.3 after a genuine new record. **Blocked:** persistent records inaccessible or run did not persist.

**Source:** `ctf-defense-5V4T54X5.js:7041-7086` and selected-world pack manifests. This is **source-authorized evidence**, not a newly observed persisted record.

## 7. Crafting UI: simple player-facing control case

**Issue:** `DM-DEF-CRAFTING-UI` — Minor, approved/open.

Enter normal Defense gameplay as a non-admin player. Open inventory and crafting UI. If crafting UI remains accessible despite the approved requirement, capture a screenshot, current phase and version, while confirming inventory/kit/shop still function. Distinguish a disabled recipe from an actually disabled UI. The selected RP contains HUD/information UI but no cited crafting-screen disablement; recipe overrides do not satisfy the UI rule. Source: `resource_packs/RP/ui` and `behavior_packs/BP/recipes`.

## Reader acceptance and STOP

A reader should be able to (1) explain the issue and impact; (2) find the causal source reference; (3) identify required setup and *whether it is actually available*; (4) distinguish Expected, source-observed, and tester-observed outcomes; (5) record Reproduced, Not Reproduced or Blocked **per attempt** without changing canonical Fixed; (6) preserve notes/images after Save as HTML and reopening.

**Actual proof obtained here:** archive SHA-256 and cited JS/config paths were examined from the selected `.mcworld`; the approved ledger remains source authority. **Not executed:** Minecraft gameplay, controlled reload, spatial instrumentation, true on-device crafting UI, production HTML file:// handoff. Do not turn any of those into a PASS based on this document.
