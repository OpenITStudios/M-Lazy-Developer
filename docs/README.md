---
id: document.docs.router
class: DOCUMENT
domain: docs
role: ROUTER
authority: CANONICAL
lifecycle: ACTIVE
---

# Lazy-Developer Documentation

Single entry point for human and AI documentation discovery.

**Product identity:** M-Lazy-Developer is operated through **ChatGPT Chat** to inspect Minecraft Bedrock/Education `.mcworld` maps provided by accessible Google Drive links. GitHub `Local` owns source, knowledge and policy. Names such as `runSelectedMapAudit()`, CLI, UI, `engine` and `production` refer to repository contracts; none proves execution unless actually invoked. ChatGPT can independently examine source evidence read-only and report precise proof ceilings.

> Repository work planning is intentionally separate from documentation. Use `../planning/` for development, operations, and project continuation intent. Use `workspace/` for working artifacts and execution data.

> Documentation domains use semantic names. Directory names describe ownership domains, not workflow order or authority priority.

## Load rule

Choose the requested responsibility, follow **one** domain router, and load the canonical document for that concern. These are real links, not placeholders or additional workflow owners.

| Concern | Domain router |
|---|---|
| Product behavior and user-facing flow | [Product](./product/README.md) |
| Artifacts and packaging | [Artifacts](./artifacts/README.md) |
| Audit procedure and analysis semantics | [Analysis](./analysis/README.md) |
| Repair and authorized mutation | [Repair](./repair/README.md) |
| Validation and proof | [Validation](./validation/README.md) |
| Architecture, naming and ownership | [System](./system/README.md) |
| Examples and non-authoritative references | [Examples](./examples/README.md) |

Core system documents answer different questions:

```text
What is the complete audit order?  → analysis/master-selected-map-audit-workflow.md
How are checkpoints enforced?       → analysis/mandatory-audit-procedure.md
How is that flow presented?       → product/flow.md
How much should we build?      → system/development-discipline.md
Who owns the implementation?   → system/implementation-map.md
Which specialist procedure?    → system/skill-routing.md
How do we build/test/deliver?  → system/development-operations.md
```

## Documentation domains

The physical directories match the domain routers above:

```text
docs/
├── README.md
├── product/
├── artifacts/
├── analysis/
├── repair/
├── validation/
├── system/
└── examples/
```

`docs/analysis/` groups its domain-specific documents through [Analysis](./analysis/README.md); do not invent extra audit pipelines or rename files merely to mirror a workflow stage. Stable document IDs, not physical paths, identify documents.

## Stable document identity

Every Markdown document under `docs/` has a small frontmatter identity:

```yaml
---
id: document.analysis.player-lifecycle
class: DOCUMENT
domain: analysis
role: DOMAIN
authority: CANONICAL
lifecycle: ACTIVE
---
```

Use `id` to identify the document and path only to locate it. A file may move without changing its identity.

## Documentation loading contract

Documentation is consumed as a routed graph, not as a folder scan:

```text
task / question
→ docs/README.md
→ one domain README
→ one canonical owner
→ Resource Retrieval
→ Section Retrieval when the document is large
→ specialist/source/proof only when activated
→ Context
→ STOP
```

Document roles:

```text
README.md            → router / index
canonical owner      → durable rule or model for one concern
specialist document  → bounded domain detail loaded on demand
source               → implementation/runtime truth
reliability history  → historical evidence only
planning/workspace   → current work/execution state, never docs
```

A document that is not routed by its domain README is invalid. Broad-scanning a domain is a fallback for diagnosis of the documentation system itself, not normal product work.

## Section-level retrieval

Large canonical documents remain single physical owners. Their H2/H3 (`##` / `###`) headings are indexed as DERIVED Catalog resources:

```text
physical document
→ H2 section resources
→ Graph DERIVED_FROM parent
→ Retrieval
```

Example:

```text
document.analysis.mandatory-audit-procedure
└─ document.analysis.mandatory-audit-procedure.section.prove
```

A section is a retrieval address, not a second documentation authority. Editing/renaming a heading may change the derived section ID; the parent document ID remains stable.

### Optional local Retrieval

For a developer with a checkout, the same architecture is available through one read-only command:

```text
npm run retrieve:repository -- "inventory reconnect" --domain analysis
```

Inspect overall knowledge-architecture health:

```text
npm run retrieve:repository -- --summary
```

The summary reports Resource counts by class/domain/authority/lifecycle, Graph edges by type, and document-section count.

Open one exact resource by stable ID and inspect its typed incoming/outgoing relationships plus document sections:

```text
npm run retrieve:repository -- --id document.analysis.player-lifecycle
```

This is the repository-native equivalent of backlinks: it operates on typed Graph edges rather than untyped note references.

Broad cross-domain discovery must be explicit:

```text
npm run retrieve:repository -- "unknown concern" --all
```

This command is optional tooling, not a requirement for ChatGPT remote work. Its purpose is to expose the same Router → Catalog → Graph → Retrieval → section-selection flow in one query surface.

## Context policy

1. Start here only when the domain is not already known.
2. Read the selected domain owner.
3. Load exactly one specialist when its procedure materially helps.
4. Add another specialist only after semantic ownership changes.
5. Do not add planning/todo/current-state data to docs; use `planning/`, `workspace/`, or reliability history according to ownership.
6. Evidence/history is opt-in; do not broad-scan for reassurance.
7. Git history owns superseded architecture and rationale.

## Authority roles

```text
Docs     = durable semantic policy/contracts
Skills   = bounded execution procedure
Source   = current implementation/runtime truth
Evidence = supporting history/research, opt-in
```

One concern has one canonical semantic owner. Link instead of duplicating.


## Zero-waste execution

For task routing, affected analysis, cache/proof reuse, bounded context, and selective validation, see [system/zero-waste-execution.md](system/zero-waste-execution.md).