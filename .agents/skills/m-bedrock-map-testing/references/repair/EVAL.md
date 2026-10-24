# Eval Contract

Evaluate separately approved working-copy repair **within TEST MAP (REFERENCE ONLY)**:
- starts bug repair only from an Approved Bug;
- carries non-empty Must Change and Must Preserve;
- treats intentional modification as a separate user-approved path;
- mutates only the working copy;
- uses bounded preconditions and patch scope;
- reruns defect verification;
- reruns selected-version gameplay preservation verification;
- preserves the immutable original artifact;
- never modifies the engine/detectors without an independent IMPROVE SYSTEM request.