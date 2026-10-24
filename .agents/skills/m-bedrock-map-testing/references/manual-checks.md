# Manual Checks

Use only from **Map Bug Audit** when current deterministic capability cannot close the claim.

Manual checks are explicit residues, not hidden requirements.

Typical categories:

- multi-player race/interleaving behavior;
- disconnect / reconnect / late join;
- lease/ticking-area release on every terminal path;
- dynamic-property growth over repeated rounds;
- command-block chain activation and chunk residency;
- UI/client feedback timing;
- entity targeting/navigation state that requires live observation;
- Education-only runtime interaction;
- repeated-run cleanup convergence.

For each manual check record:

```text
Check
Why automation is insufficient
Required context: LOCAL_ARTIFACT / LOCAL_MINECRAFT / LIVE_MINECRAFT
Setup
Observation
Pass/fail criterion
What the result can prove
```

Do not convert an unperformed manual check into a defect.
