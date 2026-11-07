# Task Graph

`packages/task-graph` is the repository execution control plane.

It does not own Minecraft semantics, diagnostics, repair policy, or validation semantics. It only decides which registered capabilities are affected by a change and which deterministic work remains necessary.

Core flow:

```text
changed paths / explicit targets
→ directly affected capabilities
→ dependency closure
→ context filter
→ completed/cache reuse
→ deterministic execution order
```

## Repository-path reconciliation

Builtin task capability prefixes such as `packages/...` and
`analyzers/...` are **engine-local**. GitHub and Resource Graph inputs
normally use repository-root paths such as `engine/packages/...`.
`resolveAffectedTasks()` accepts either spelling by mapping the
three known `engine/packages/`, `engine/analyzers/`, and
`engine/adapters/` prefixes for matching only. Returned changed paths
and unmatched paths retain their original repository spelling, so
provenance is never silently rewritten. Paths without an exact registered
capability remain unmatched and require conservative fallback.

This is a path-admission correction in the existing Task Graph, not a
join with the derived source import graph or proof of executed behavior.

## Rules

- capability ownership stays with the existing package/analyzer/adapter;
- dependencies must be explicit and acyclic;
- affected execution is conservative: an unknown path never silently proves safety;
- cached/completed work may be reused only when the caller has already validated its cache identity;
- Task Graph plans work; it never authorizes repair or upgrades proof strength;
- semantic/runtime evidence remains owned by the existing evidence and validation layers.

This package is intentionally small. Do not move domain logic into it.
