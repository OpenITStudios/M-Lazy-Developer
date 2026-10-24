# Interface Source Agent Rules

Applies to optional CLI and report-view source under `apps/`; M-Lazy-Developer is operated from ChatGPT Chat.

## Boundary

These optional source consumers present results or commands over the canonical engine contracts; they do not define another map-checking operator.

## Rules

- Do not reimplement Bedrock parsing, diagnostics, graph traversal, or repair policy.
- Call orchestrator/core owners through typed APIs.
- Presentation-specific formatting stays here.
- Stable semantic truth remains in engine/packages, engine/analyzers, and engine/rules.
- Any explicitly requested future interface integration must reuse the same canonical engine owners and proof policy.
- Interface convenience must not weaken source immutability, patch preconditions, or proof vocabulary.

Current command-source owner: `apps/cli/`.
