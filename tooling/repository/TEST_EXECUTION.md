# Test execution lanes

The path-derived routing inventory is `tooling/repository/test-inventory.json`.
Its lane labels are provisional navigation metadata, not proof of test safety,
coverage or successful execution. Semantic decisions in `review` and
`recommendation` do not automatically disable any test.

Existing execution remains intact:

- `npm test`: selected integrated acceptance suite (default).
- `npm run test:full`: all Vitest tests and the native Node test suites.
- `npm run test:focus -- path/to/file.test.ts`: explicit changed-owner tests.

New optional commands:

- `npm run test:lanes`: print file counts per provisional lane, without running tests.
- `npm run test:lane -- safety`: run tests routed to the safety lane.
- `npm run test:lane -- acceptance`: run the acceptance-labeled inventory entries.
- `npm run test:lane -- runtime`: run the runtime-labeled entries.
- `npm run test:lane -- regression`: run the regression-labeled entries.
- `npm run test:lane -- development`: run the development-labeled entries.

Important: A single lane is never sufficient evidence for a release or repair
approval. Tests about safety may currently exist outside the safety lane.
`test:lane -- acceptance` is inventory-derived and is **not** the same
selection as the maintained `npm test` acceptance contract.

Before lane execution, the runner refuses duplicate, missing or malformed
inventory paths instead of silently skipping them. The complete regression
path remains available and `verify:source` continues to use it.
The GitHub CI verification workflows on Local remain disabled.
No test or production source has been deleted by this routing change.
