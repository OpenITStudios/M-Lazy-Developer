# Test classification and registration

## Pinned inventory evidence

At GitHub `Local` commit `d2f764efb79bb7aee53f66fde185f69804a8a1a9`, all **687 source test files** were matched
one-to-one against `tooling/repository/test-inventory.json`: **0 omitted, 0
stale, 0 duplicate paths**. All rows have an owner, execution lane, review
scope, retention recommendation, rationale and actionable triage. The existing
test runner is the sole execution route; there is no additional test registry.

This audit directly read all 300 files formerly labeled
`pending-semantic-review` from that exact source revision and identified
test cases and assertion call sites. One tracker parity suite generates
five cases with `it(testCase, ...)` instead of literal case titles.
Those 300 rows are now `case-inventory-reviewed`, with their inspected
Git blob SHA recorded in `triage.sourceBlobSha`. **This is case-level source
inventory, not full assertion/consumer equivalence, test execution, or
proof that any test can safely be removed.** The prior 230
`source-reviewed` statuses are inherited; they were not all freshly
revalidated in this pass.

| Review scope | Files | Meaning |
| --- | ---: | --- |
| source-reviewed | 230 | Prior source-level review, not an executable PASS |
| case-inventory-reviewed | 457 | Named or generated cases identified; deep assertion equivalence still open |
| pending-semantic-review | 0 | No file still awaits an initial case-inventory read |

Current retention decisions: **204 keep, 430 keep-provisional, 34 defer,
19 merge-candidate, 0 obsolete**. `keep-provisional` prevents premature
deletion; it is not a claim of unique or indispensable coverage. `defer`
means targeted execution, not removal. A `merge-candidate` requires
checking assertion and production-consumer equivalence before consolidation.

## Existing execution lanes

| Lane | Files | Intended selection |
| --- | ---: | --- |
| safety | 54 | Authorization, preservation, mutation and trust boundaries |
| acceptance | 26 | Cross-component user-facing and integration behavior |
| runtime | 81 | Runtime/telemetry/harness *contracts*, not observed live Minecraft |
| regression | 67 | Frozen/historical failure-family and golden checks |
| development | 459 | Owner-specific evolving component contracts |

Every file has exactly one *routing* lane plus one source owner. A single
lane does not mean the file has only that risk or purpose; many development
tests contain safety-relevant assertions. The large development lane is
further distinguished by each row's specific owner, not by inventing
new frameworks or physical directory migrations.

`npm test` / `--acceptance` currently selects **11 curated files
across lanes** (5 acceptance, 2 development, 2 safety, 2 regression).
It is **not** the same as the 26-file `--lane acceptance` selection.
`--lane`, `--list-lanes`, `--focus`, `--affected` and `--full`
are already supported by the existing `run-tests.mjs`.
All modes now validate complete source-file registration, including
owner/review/triage consistency, before test selection or execution.
`--affected --plan` is planning only; it does not run tests.

## Review rule and proof boundary

For a further `source-reviewed` promotion, inspect the production import
owner, actual assertions, positive/negative/UNKNOWN behavior, authoritative
consumer, and overlap with neighboring tests. If the source is changed,
revalidate a pinned case review against its recorded blob SHA. Distinct
failure-family/safety protections cannot be removed merely to reduce file
count. Consolidate only where the same behavior is protected without
losing assertions.

GitHub CI remains disabled as previously requested. This pass performs
**source/static verification only**. It does not execute TypeScript,
Vitest, `runSelectedMapAudit()`, or Minecraft gameplay, and it does not
modify production implementation or test-case bodies.

## Indeks fungsional Minecraft — lengkap 687/687

Semua test yang ditemukan pada tree source GitHub commit `2dcfa66b52dfabdbf06e612f597be1c9880ba84d` telah
dipetakan ke **satu functional area**, **satu sub-sistem (`featureId`)**,
dan tetap mempertahankan `owner`, `lane`, `review`, serta keputusan
retensinya. Semua sub-sistem berada di dalam `featureCatalog` pada
**inventaris tunggal yang sudah ada**, bukan registry atau runner baru.

- **687 file terdaftar** dengan **115 fitur/sub-sistem** dan 17 nama area (termasuk Lobby yang saat ini kosong).
- **41 file** memiliki source case yang dibaca langsung pada pinned GitHub ref; **646 file** masih diklasifikasikan dari identitas owner/nama file (**path-provisional**), bukan diperiksa ulang seluruh assertion-nya.
- **182 file** memiliki tag mekanik gameplay yang relevan. File test internal lainnya tetap terpetakan secara lengkap melalui `featureId`; tag mekanik tidak dipaksakan ke parser, laporan, atau tooling yang tidak menguji mekanik gameplay langsung.
- Tidak ada file test dibuat, dipindahkan, dihapus, digabung, atau dieksekusi. CI tetap nonaktif.

### Ringkasan area

| Area utama | File | Fokus |
| --- | ---: | --- |
| `map-database` | 9 | LevelDB, world database and NBT |
| `map-content` | 43 | World structures, topology, packs and archives |
| `lobby-pre-match` | 0 | Lobby, queue, team choice, ready state (dedicated coverage gap) |
| `player-session` | 6 | Join, spawn, leave, disconnect and reconnect |
| `arena-match` | 53 | Arena membership, match flow, isolation and reset |
| `player-state-persistence` | 9 | Persistent player state and recovery |
| `combat-entities` | 34 | Combat, mob AI, navigation and revival |
| `inventory-economy` | 13 | Inventory, currency, rewards and progression |
| `world-interaction` | 24 | Chunks, teleport, spatial rules, UI/interaction |
| `gameplay-scripting` | 43 | Commands, functions, scripts and scheduling |
| `gameplay-interpretation` | 59 | Authored intent, scenario and behavior reconstruction |
| `audit-diagnosis` | 158 | Bug detection, proof, causality, reliability and inspection |
| `runtime-telemetry` | 95 | Probe plans, telemetry, runtime experiments and evidence |
| `repair-preservation` | 58 | Repair permission, mutation, safety and preservation |
| `reporting` | 54 | Issue reports, projection, tracker and UI |
| `platform-compatibility` | 3 | Edition and scripting API compatibility |
| `engineering-tooling` | 26 | GitHub/repository, project workflow, delivery tools |
| **Total** | **687** | Seluruh file terklasifikasi |

### Pohon sub-sistem (feature → file)

Ini adalah **indeks navigasi**, bukan laporan bahwa semua mekanik berfungsi.
Setiap file tercantum tepat pada satu feature. Gunakan `--show-feature <id>`
untuk melihat daftar seluruh path file dalam satu feature.

**map-database (9 files)**

- `database.leveldb` — 5 file; LevelDB actor, metadata, keys, entities, and chunks.
- `database.nbt` — 1 file; NBT preservation.
- `database.world-db` — 3 file; World DB source, comparisons, and runtime evidence boundary.

**map-content (43 files)**

- `map.archive` — 4 file; World archive transport and integrity.
- `map.blocks` — 2 file; Minecraft blocks and permissions.
- `map.manifest` — 4 file; Manifest pack identities and modules.
- `map.resource-pack` — 1 file; Resource pack and animations.
- `map.source-index` — 5 file; Map source indexing and artifact inspection.
- `map.structure-proof` — 10 file; Structure source/voxel evidence.
- `map.structures` — 5 file; MCStructure parsing and placement.
- `map.topology` — 12 file; World topology and arena regions.

**lobby-pre-match (0 files)**

- Belum ada test khusus terdaftar untuk area ini.

**player-session (6 files)**

- `player.client-lifecycle` — 1 file; Live client lifecycle contracts.
- `player.generation-guard` — 1 file; Session generation safety.
- `player.inventory-restoration` — 1 file; Inventory restoration at session boundaries.
- `player.join-spawn-leave` — 1 file; Player join, spawn, leave lifecycle.
- `player.reconnect-sessions` — 2 file; Multiplayer join/reconnect session modeling and experiments.

**arena-match (53 files)**

- `arena.admission-authority` — 1 file; Arena joining, membership and authority evidence.
- `arena.capacity-stress` — 8 file; Arena capacity and stress scenarios.
- `arena.cleanup-reset` — 2 file; Arena cleanup, reset and reuse.
- `arena.entity-population` — 2 file; Arena entity population and spawns.
- `arena.golden-baselines` — 3 file; Arena golden baseline and corpus.
- `arena.layout-replicas` — 6 file; Arena layout, region and replica identity.
- `arena.lifecycle` — 9 file; Match termination and lifecycle.
- `arena.proof-gates` — 9 file; Arena proof and admission gates.
- `arena.repair-strategy` — 4 file; Arena repair constraints and planning.
- `arena.start-ownership` — 2 file; Match start ownership and admission.
- `arena.state-isolation` — 7 file; Multi-arena global/shared state isolation.

**player-state-persistence (9 files)**

- `player.persistence-analysis` — 4 file; Persistence source analysis.
- `player.persistence-diagnosis` — 1 file; Persistence diagnostic evidence.
- `player.persistence-repair` — 2 file; Persistent state repair and idempotency.
- `player.state-recovery` — 2 file; State reconciliation and recovery.

**combat-entities (34 files)**

- `combat.damage` — 8 file; Damage, attack, terminal combat.
- `combat.revive` — 2 file; Downed and revival lifecycle.
- `entity.behavior` — 5 file; Entity AI stack, behavior and mounts.
- `entity.evidence` — 7 file; Entity source and knowledge evidence.
- `entity.loot` — 2 file; Entity loot and item tables.
- `entity.navigation` — 7 file; Entity navigation and path reachability.
- `entity.spawn-population` — 1 file; Entity spawning and population.
- `entity.targeting` — 2 file; Target selection and sensor logic.

**inventory-economy (13 files)**

- `economy.progression` — 1 file; Progression and counters.
- `economy.rewards` — 2 file; Rewards and durability of delivery.
- `economy.transactions` — 5 file; Currency and economy transactions.
- `inventory.lifecycle` — 5 file; Item ownership and inventory lifecycle.

**world-interaction (24 files)**

- `world.blocks-rules` — 2 file; Interactive blocks, hazards, world rules.
- `world.chunk-lifecycle` — 10 file; Chunk loading, readiness and leases.
- `world.cinematic-feedback` — 2 file; Camera, title and UI feedback.
- `world.player-interaction` — 2 file; Player interactions, forms and inputs.
- `world.spatial-authority` — 7 file; Spatial mutation and world boundaries.
- `world.teleport` — 1 file; Teleport result and transaction handling.

**gameplay-scripting (43 files)**

- `script.api-compatibility` — 9 file; Script API signatures and compatibility diagnostics.
- `script.commands` — 8 file; Minecraft command interpretation.
- `script.config` — 3 file; Typed script config parsing.
- `script.control-flow` — 10 file; Script control flow and call evidence.
- `script.dialogue` — 1 file; NPC dialogue semantics.
- `script.mcfunctions` — 3 file; mcfunction parsing and ownership.
- `script.runtime-evidence` — 2 file; Script runtime observation contracts.
- `script.scheduler` — 4 file; Scheduling and event ordering.
- `script.source-model` — 3 file; Script source and parser models.

**gameplay-interpretation (59 files)**

- `gameplay.calibration` — 1 file; Gameplay calibration cases.
- `gameplay.closure` — 5 file; Gameplay closure and defect proof.
- `gameplay.discovery` — 6 file; Gameplay source discovery and fingerprints.
- `gameplay.intent` — 19 file; Authored game intent and authority.
- `gameplay.knowledge` — 9 file; Knowledge claims and authored context.
- `gameplay.reachability` — 4 file; Gameplay route and reachability.
- `gameplay.scenarios` — 6 file; Game mechanics and scenario reconstruction.
- `gameplay.semantic-model` — 9 file; Game architecture, behavioral and world semantic models.

**audit-diagnosis (158 files)**

- `audit.causal-diagnosis` — 10 file; Causal/cross-domain diagnosis.
- `audit.change-comparison` — 1 file; Version-aware map comparisons.
- `audit.defect-analysis` — 14 file; Defect diagnostics and classification.
- `audit.diagnosis-execution` — 4 file; Diagnostic pipeline execution and configuration.
- `audit.diagnostic-vocabulary` — 1 file; Diagnostic code/definition contracts.
- `audit.end-to-end` — 1 file; Source-level audit integration.
- `audit.evidence-integrity` — 4 file; Evidence recovery, consistency and traceability.
- `audit.falsification-search` — 27 file; Bounded search, mutation and counterexamples.
- `audit.invariants` — 7 file; Invariant and contradiction solving.
- `audit.multiplayer-validation` — 1 file; Mixed-state multiplayer audit scenarios.
- `audit.proof-control` — 17 file; Audit proof and honest admission.
- `audit.reliability` — 29 file; Regression knowledge, retest and release assurance.
- `audit.report-admission` — 1 file; Evidence-to-issue admission.
- `audit.rule-evaluation` — 2 file; Diagnostic rules and reasoning infrastructure.
- `audit.semantic-analysis` — 6 file; Semantic IR, state and dataflow.
- `audit.source-inspection` — 16 file; Map source inspection and analysis.
- `audit.task-context` — 8 file; Audit model tasks and context retrieval.
- `audit.workflow` — 9 file; Audit plans, workflow and decisions.

**runtime-telemetry (95 files)**

- `runtime.differential` — 4 file; Cross-version runtime comparisons.
- `runtime.evidence` — 20 file; Runtime evidence authority, state, adapters, and validation.
- `runtime.experiments` — 10 file; Runtime experiments and scenario contracts.
- `runtime.host` — 6 file; Runtime host, action and capabilities.
- `runtime.multiplayer` — 4 file; Concurrent client runtime experimentation.
- `runtime.probes` — 17 file; Runtime probes and evidence.
- `runtime.profiles` — 2 file; Runtime/target profile metadata.
- `runtime.telemetry` — 32 file; Telemetry, buffers and observations.

**repair-preservation (58 files)**

- `repair.authorization` — 13 file; Repair permission and preconditions.
- `repair.integration` — 1 file; Repair pipeline integration.
- `repair.lifecycle` — 6 file; Repair lifecycle and incident closure.
- `repair.mutations` — 10 file; Authorized mutations and source transforms.
- `repair.preservation` — 5 file; Unchanged behavior preservation and invariants.
- `repair.release` — 3 file; Repair package staging and release gate.
- `repair.strategies` — 13 file; Repair option selection and realization.
- `repair.verification` — 7 file; Repair proof and verification.

**reporting (54 files)**

- `report.confirmation` — 10 file; Report confirmation and admission.
- `report.findings` — 14 file; Finding classification, explanation and projection.
- `report.golden` — 1 file; Golden report fixtures and format.
- `report.presentation` — 4 file; Human-facing report documents.
- `report.schema` — 12 file; Report schema and serialization.
- `report.tracker` — 6 file; Tester/developer tracker documents.
- `report.ui` — 7 file; Bug report UI and GitHub handoff.

**platform-compatibility (3 files)**

- `platform.editions` — 2 file; Education/Bedrock capability differences.
- `platform.script-api` — 1 file; Minecraft scripting API compatibility.

**engineering-tooling (26 files)**

- `tooling.decisions` — 2 file; Decision and invariant registry.
- `tooling.efficiency` — 5 file; Development and test efficiency.
- `tooling.graph` — 2 file; Repository ownership and graph.
- `tooling.projects` — 5 file; Project workspace and publication.
- `tooling.release` — 3 file; Release and published package identity.
- `tooling.repository` — 9 file; Repository structure and build/test workflow.

### Matriks mekanik gameplay yang sering dibutuhkan

Jumlah di bawah menunjukkan **file terpetakan oleh tag spesifik**, bukan
jumlah kasus yang lulus, pengujian Minecraft hidup, atau sertifikasi kelengkapan.
`NO DEDICATED TEST` berarti *tidak teridentifikasi test langsung dari
source yang telah ditinjau*, bukan kepastian bahwa implementasi game tidak ada.
`PARTIAL` menunjukkan aspek source/model tertentu, bukan alur pemain end-to-end.

| Mekanik yang dicari | File relevan | Cakupan | Contoh test | Batas bukti |
| --- | ---: | --- | --- | --- |
| Map database / LevelDB | 8 | SOURCE CONTRACT | `engine/adapters/leveldb/test/inspect.test.ts`; `engine/analyzers/world-db/test/world-db-evidence.test.ts` | Belum membaca database map pilihan secara live |
| Lobby join-pad / keluar antrean | 2 | PARTIAL | `engine/analyzers/scripts/test/domains/arena/arena-authority-evidence.test.ts`; `engine/packages/runtime-lab/test/domains/multiplayer/multiplayer-session-experiment.test.ts` | Bukan alur lobby lengkap |
| Lobby team selection | 0 | NO DEDICATED TEST |  | Belum ada suite eksplisit yang ditemukan |
| Lobby ready → countdown → game start | 0 | NO END-TO-END TEST | `engine/packages/orchestrator/test/arena-start-ownership-guard-realizer.test.ts` | Ada fragmen start/ready, bukan perjalanan penuh |
| Ready-set dan delayed start | 2 | SOURCE CONTRACT | `engine/analyzers/scripts/test/domains/arena/arena-authority-evidence.test.ts`; `engine/packages/orchestrator/test/arena/arena-lifecycle-analysis.test.ts` | Kasus snapshot/generation saja |
| Player join | 3 | SOURCE CONTRACT | `engine/packages/orchestrator/test/inspection/player-session-lifecycle-analysis.test.ts`; `engine/packages/runtime-lab/test/domains/multiplayer/multiplayer-session-experiment.test.ts` | Bukan login Minecraft nyata |
| Player spawn | 1 | SOURCE CONTRACT | `engine/packages/orchestrator/test/inspection/player-session-lifecycle-analysis.test.ts` | Event source, tidak membuktikan world spawn berhasil |
| Player leave (bagian dari logout) | 3 | PARTIAL | `engine/packages/orchestrator/test/inspection/player-session-lifecycle-analysis.test.ts` | Bukan logout dan cleanup lengkap |
| Player disconnect | 1 | MODEL CONTRACT | `engine/packages/reliability/test/session/session-model.test.ts` | Belum real network disconnect |
| Player reconnect/rejoin | 2 | MODEL/EXPERIMENT | `engine/packages/reliability/test/session/session-model.test.ts`; `engine/packages/runtime-lab/test/domains/multiplayer/multiplayer-session-experiment.test.ts` | Belum pengujian rejoin pada game nyata |
| Respawn | 2 | SOURCE/EXPERIMENT | `engine/packages/runtime-lab/test/domains/multiplayer/multiplayer-session-experiment.test.ts`; `engine/packages/orchestrator/test/inspection/inventory-lifecycle-analysis.test.ts` | Perlu proof runtime |
| Arena start ownership | 5 | SOURCE CONTRACT | `engine/analyzers/scripts/test/domains/arena/arena-authority-evidence.test.ts`; `engine/packages/orchestrator/test/arena-start-ownership-guard-realizer.test.ts` | Belum hasil start permainan live |
| Arena capacity | 9 | SOURCE CONTRACT | `engine/analyzers/scripts/test/domains/arena/arena-authority-evidence.test.ts` | Bukan benchmark real players |
| Multi-arena state isolation | 7 | SOURCE CONTRACT | `engine/packages/orchestrator/test/arena/arena-state-isolation-analysis.test.ts` | Simulasi/source, bukan live 5 pemain/arena |
| Scoreboard ownership | 1 | SOURCE CONTRACT | `engine/packages/orchestrator/test/inspection/state-authority-analysis.test.ts` | Validasi otoritas sumber, bukan tampilan HUD |
| Game end/terminal lifecycle | 9 | SOURCE CONTRACT | `engine/packages/orchestrator/test/arena/arena-lifecycle-analysis.test.ts` | Tidak mengamati akhir game Minecraft |
| Arena cleanup/reset | 4 | SOURCE CONTRACT | `engine/packages/orchestrator/test/arena/arena-reset-closure-analysis.test.ts` | Tidak membuktikan dunia ter-reset live |
| Inventory/equipment | 5 | SOURCE CONTRACT | `engine/packages/orchestrator/test/inspection/inventory-lifecycle-analysis.test.ts` | Bukan interaksi inventory live |
| Economy / reward | 7 | SOURCE CONTRACT | `engine/packages/orchestrator/test/inspection/economy-contract-analysis.test.ts` | Bukan transaksi pemain live |
| Combat / downed / revive | 10 | MODEL/SOURCE | `engine/packages/behavior-model/test/combat-lifecycle.test.ts` | Bukan interaksi combat live |
| Teleport | 1 | SOURCE CONTRACT | `engine/packages/orchestrator/test/inspection/teleport-transaction-analysis.test.ts` | Bukan teleport berhasil di server |
| Chunk lifecycle / ticking area | 10 | SOURCE CONTRACT | `engine/packages/orchestrator/test/inspection/chunk-lifecycle-analysis.test.ts` | Bukan bukti chunk loaded live |

**Celah yang perlu dipertahankan eksplisit**: kategori `lobby-pre-match`
belum mempunyai test utama khusus, meskipun `lobby.join-pad` mengacu
pada test lintas-area. Belum ada pengujian **end-to-end** yang ditemukan
untuk lobby → team selection → ready/countdown → start, maupun logout
→ cleanup → reconnect/rejoin → restore. Memiliki unit test komponen berbeda
dari membuktikan seluruh perjalanan pemain.

### Navigasi tanpa mengeksekusi test

Perintah read-only dari **runner yang sudah ada**:

```text
node tooling/repository/run-tests.mjs --list-areas
node tooling/repository/run-tests.mjs --show-area player-session
node tooling/repository/run-tests.mjs --list-features
node tooling/repository/run-tests.mjs --show-feature database.leveldb
node tooling/repository/run-tests.mjs --show-feature arena.lifecycle
node tooling/repository/run-tests.mjs --list-mechanics
node tooling/repository/run-tests.mjs --show-mechanic lobby.join-pad
node tooling/repository/run-tests.mjs --show-mechanic player.leave
node tooling/repository/run-tests.mjs --show-mechanic player.reconnect
```

Fungsi-fungsi indeks ini hanya membaca `test-inventory.json`; tidak
menjalankan Vitest. Fitur saat ini menjalankan test hanya melalui opsi
eksekusi yang sudah ada (`--lane`, `--focus`, `--affected`,
`--acceptance`, `--full`), yang perilakunya tidak diubah.

### Aturan koreksi status

- Klaim **source-case-inspected** berarti daftar kasus dan kontrak relevan
  pernah dibaca di source yang dipin, *bukan* bahwa assertion setara atau
  bahwa Minecraft telah diuji.
- **path-provisional** tetap boleh dipakai untuk mencari file, tetapi
  perlu review assertions, production owner, dan test consumer jika
  status kelengkapan mekanik atau penggabungan akan diputuskan.
- Setiap file baru wajib menambah `functionalArea`, `featureId`
  yang terdaftar pada `featureCatalog`, serta basis pemetaan.
  Verifier existing runner menolak registrasi tidak cocok, unknown feature,
  atau feature yang tidak digunakan.
- Jangan membuat suite tambahan hanya untuk memperindah statistik kategori.
  Kekosongan mekanik adalah informasi, bukan otorisasi membuat microtests.
  Semua bukti runtime/user map dan Minecraft yang tidak dijalankan tetap
  **NOT EXECUTED / UNKNOWN**.
