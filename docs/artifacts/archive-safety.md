---
id: document.artifacts.archive-safety
class: DOCUMENT
domain: artifacts
role: DOMAIN
authority: CANONICAL
lifecycle: ACTIVE
---

# Archive Safety

User-supplied Bedrock archives are untrusted input.

The generic archive boundary must reject:

- absolute paths;
- parent traversal;
- Windows reserved device paths;
- duplicate normalized paths;
- case collisions that are unsafe on common target filesystems;
- excessive path depth;
- excessive file count;
- excessive expanded byte volume;
- excessive single-file expansion;
- suspicious compression ratios.

The current implementation is split between `engine/packages/archive/src/path-safety.ts` and `inventory.ts` (application safety policy) and `zip-transport.ts` (ZIP mechanics using `@zip.js/zip.js`). The transport validates entry metadata against the extraction budget before streaming individual entries, and enables strict container checks and CRC verification during extraction. `extractZipSafely()` returns the validated inventory so an audit caller need not perform its own redundant inventory scan.

This describes current source contracts, not a claim of executed security acceptance or a verified Minecraft import. The selected-map inspection keeps an extracted source snapshot separate from its working copy because native LevelDB readers may touch files in the working copy.