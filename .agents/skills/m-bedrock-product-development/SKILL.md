---
name: m-bedrock-product-development
description: >
  Develop Lazy-Developer product features, architecture, UI, or tooling using existing canonical owners; not map bug audit or detector-specific development.
---

# M-Bedrock Product Development

**Lane:** DEVELOPMENT / PRODUCT SYSTEM

## Purpose

Implement bounded **GitHub source/knowledge/contract** changes to M-Lazy-Developer, the Minecraft map-checking system operated through **ChatGPT Chat**. The user supplies accessible `.mcworld` inputs from Google Drive, and GitHub `Local` owns canonical code/knowledge. The development process belongs to `docs/system/development-discipline.md`; CLI/report source and Node metadata do not alter the operator workflow or constitute execution proof.

## Entry criteria

Use for system behavior, architecture, ChatGPT workflows, tooling, interfaces and general engine source work. For improvements specifically to reusable detection, use `m-bedrock-detection-development`.

## Allowed actions

- inspect the pinned `Local` implementation and applicable owners;
- implement a complete, justified integration slice across existing owners rather than patching one test-sized symptom at a time;
- during an unfinished architecture BUILD, preserve existing tests and defer routine test authoring/execution until the production path is integrated;
- review source/consumer consistency at the available evidence ceiling and publish a coherent bounded commit.

## Forbidden actions

- run a selected-map bug audit or modify an original/working target map;
- treat an unsupported hypothesis as confirmed defect;
- create parallel owners, registries, or state stores without evidence;
- require a different user interface, a localtest, or claim a programmatic audit or Minecraft runtime proof without actual corresponding execution.

## Mandatory operating style

Apply `docs/system/development-discipline.md#development-operating-standard` at task intake, before material edits, and at completion. Normalize unclear prompts without inventing requirements; preserve minimal context loading and existing ownership. 

## Procedure

Use DEFINE → INVESTIGATE → DESIGN → IMPLEMENT → VERIFY → COMMIT & STOP from the canonical development discipline. When requested to finish architecture first, treat VERIFY as source-level integration review until the acceptance boundary; do not create a separate testing lane or initiate CI. Open SPEC.md, SOURCES.md, or EVAL.md only for the relevant decision, not as automatic startup context.

## Reverse-engineering reference use

When the requested development uses REA or investigates incomplete map understanding,
apply the existing [REA-derived investigation contract](../m-bedrock-map-bug-audit/references/game-design-contract.md#rea-derived-investigation)
to the selected source/consumer question. Remain in SYSTEM DEVELOPMENT: this reference
does not authorize a separate map audit or target mutation. Read complete source
repositories directly; reserve callable REA providers for package/binary/runtime
claims they can actually answer. Carry the useful tracing, counter-evidence and
unknown-preservation behavior into the first wrong existing owner, not a new manager
or a production dependency. Distinguish a source comparison, an executed isolated
upstream function, a full REA CLI/MCP run and actual Minecraft observations.


## ChatGPT-native reverse engineering without REA MCP

For any selected-map analysis or source-graph blindspot investigation, apply
[the existing ChatGPT-native reverse-engineering procedure](../m-bedrock-map-bug-audit/references/game-design-contract.md)
inside the current owner and stage. In particular, inventory the exact
selected artifact, trace a mechanic forwards and backwards, challenge
unexplained raw source effects, and retain failed cross-source joins as unknown
rather than inventing REA evidence receipts. This skill remains SYSTEM
DEVELOPMENT; following the procedure does not authorize a target-map audit,
a parallel interpreter or untested runtime claims.

## Output contract

Report changed canonical owner(s), achieved outcome, evidence and limitations, verified commit SHA, and bounded unresolved issue if any. No separate development status database or skill-specific persisted report.

## Handoff

Detector-specific improvement → Detection Development, only by explicit scope decision. Map bug audit or target repair → their dedicated lane, never automatically.

## STOP

Stop once the agreed change is committed with matching proof. Do not extend into adjacent cleanup or workflow changes.
