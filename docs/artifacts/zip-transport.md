---
id: document.artifacts.zip-transport
class: DOCUMENT
domain: artifacts
role: DOMAIN
authority: CANONICAL
lifecycle: ACTIVE
---

# ZIP Transport

ZIP mechanics are isolated behind the archive safety policy.

The current transport uses @zip.js/zip.js and keeps the following ownership split:

- zip.js: ZIP central-directory parsing, CRC/overlap/strict container checks, entry streaming;
- M-Bedrock-Dev: entry count, expanded bytes, compression ratio, path depth, Windows reserved names, case collision and workspace destination policy.

The library is configured with strict entry validation. Application budgets are evaluated before extraction begins.

Extraction writes individual entry streams to disk and does not intentionally buffer whole expanded archives in memory. `extractZipSafely()` returns the already validated `ZipInventoryResult`; the selected-map inspection reuses it rather than independently reopening the ZIP for a second inventory. A distinct extraction pass is still necessary after preflight validation.

Deterministic packaging uses sorted relative paths and fixed timestamps, then output should be reopened through the same inventory path before it is considered package-verified.