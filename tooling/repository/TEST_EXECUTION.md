# Repository Test Selection — Single Runner

Canonical machine inventory: `tooling/repository/test-inventory.json`.
Existing selector/runner: `tooling/repository/run-tests.mjs`.

| Command | Source-test selection |
| --- | --- |
| `npm test` | Maintained default acceptance (not all tests) |
| `npm run test:full` | All Vitest + native Node source-test suites |
| `npm run test:focus -- path/to/file.test.ts` | Explicit focused suite |
| `npm run test:lanes` | List lane counts; **no test execution** |
| `npm run test:lane -- development` | Development only |
| `npm run test:lane -- safety` | Safety only |
| `npm run test:lane -- runtime` | Runtime only |
| `npm run test:lane -- regression` | Regression only |
| `npm run test:lane -- acceptance` | Inventory acceptance; **not the same as `npm test`** |

`--affected` and area/feature/mechanic navigation reuse the same
selector. Safety-relevant assertions may live outside `safety`;
no single lane certifies release or repair.

The existing runner checks test-file registration, duplicate paths,
and exact LF-normalized Git blobs for source-case-inspected entries.
After changing a test file, review its assertions/consumer and
re-pin `triage.sourceBlobSha`. Source identity is not execution PASS.

CI on `Local` remains disabled. No TypeScript/Vitest,
`runSelectedMapAudit()` or Minecraft execution follows merely from
authored source tests or inventory counts.

