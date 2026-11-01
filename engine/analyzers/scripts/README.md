# Script Analyzer

Static analysis for Bedrock Script API source.

The analyzer uses the TypeScript compiler parser for JavaScript/TypeScript syntax and never executes artifact code.

## Internal hierarchy

```text
src/
├── core/       shared script-analysis contracts
├── parser/     parse/module/call/receiver resolution
├── flow/       parser-independent value-flow extraction bindings/witnesses
├── recovery/   bundled/minified source recovery and source-map binding
├── config/     safe configuration projection/compilation
├── repair/     script transform hint derivation
├── runtime/    script-authored runtime evidence projection
├── domains/
│   ├── arena/
│   ├── automation/
│   ├── chunk/
│   ├── cleanup/
│   ├── combat/
│   ├── economy/
│   ├── inventory/
│   ├── lifecycle/
│   ├── persistence/
│   ├── progression/
│   └── spatial/
└── index.ts    sole cross-owner public entrypoint
```

Tests mirror the same hierarchy under `test/`.

The domain folders contain read-only authored-source evidence extraction. They do not become gameplay policy owners.

## Current facts

- imports and imported bindings;
- @minecraft/* module usage;
- relative module dependencies;
- world/system access;
- beforeEvents/afterEvents subscriptions;
- system.afterEvents.scriptEventReceive usage;
- dynamic property calls and literal property IDs when statically knowable.

Unknown/computed behavior remains unknown rather than being evaluated.

This analyzer does not execute JavaScript or attempt arbitrary symbolic execution. A conservative project-level data-flow extractor covers direct assignments and resolvable direct function argument/return flow; unsupported dynamic aliasing/calls remain unresolved.

## Data-flow

`deriveScriptDataFlowGraph()` builds evidence-bearing value flow across modules for direct/resolved calls.

Supported:

- direct variable assignment;
- simple reassignment;
- direct local function parameters/arguments;
- resolved imported function parameters/arguments;
- direct return → call-result flow;
- forward/backward slicing through `packages/dataflow`.

Not yet claimed:

- arbitrary alias analysis;
- prototype/reflection flow;
- computed dynamic call resolution;
- full closure/environment modeling;
- JavaScript execution.

## Semantic data-flow bindings

Minecraft-specific source/sink labels are derived separately from the generic data-flow graph. Labels are evidence hints, not defect conclusions, and bounded matches remain bounded.

## Source recovery

`analyzeScriptSourceRecovery()` classifies explicit, modular, bundled/minified, mixed, or unknown source shapes. It detects source-map references and structural bundler/minification signals without executing or rewriting artifact code.

Source recovery never invents original symbol names or module boundaries.

## Boundary

- Parsing and authored evidence extraction remain read-only.
- Diagnostics policy belongs to `engine/analyzers/diagnostics/` and diagnostic packages.
- Repair execution belongs to repair/orchestrator owners; this analyzer may only derive bounded transform hints/evidence.
- Cross-owner consumers import through `src/index.ts`.
