# Generalization Checks

Before accepting Detection Development:

- no production-map name in reusable logic;
- no hidden UUID/coordinate/scoreboard/entity special case;
- no expected count copied from one map unless supplied as typed input;
- no regex that encodes one minified/bundled sample without semantic justification;
- reduced fixture demonstrates the failure independently of the seed map;
- false-positive boundary is represented, not only the happy failure case;
- version/edition applicability is explicit when material;
- unknown remains unknown rather than defaulting to defect;
- benchmark expectation is frozen before reading the new output.

If generalization cannot be demonstrated, the change remains an experiment, not production detection capability.
