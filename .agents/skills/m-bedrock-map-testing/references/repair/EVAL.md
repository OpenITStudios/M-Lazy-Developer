# Eval Contract

Evaluate whether Target Repair:
- starts bug repair only from an Approved Bug;
- carries non-empty Must Change and Must Preserve;
- treats intentional modification as a separate user-approved path;
- mutates only the working copy;
- uses bounded preconditions and patch scope;
- reruns defect verification;
- reruns selected-version gameplay preservation verification;
- does not modify detector capability in the repair lane.