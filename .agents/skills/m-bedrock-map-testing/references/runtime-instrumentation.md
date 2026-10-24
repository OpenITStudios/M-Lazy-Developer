# Runtime Instrumentation Lifecycle

Applies to E4/E5 controlled/live Minecraft proof.

Temporary instrumentation is a **transaction**, not permanent product logic.

## Lifecycle

1. **Hypothesis**
   - state the claim that runtime evidence must separate;
   - define expected observation for each competing hypothesis.

2. **Instrumentation plan**
   - smallest probe surface;
   - exact target files/commands/events;
   - expected output schema;
   - rollback/removal plan;
   - privacy/sensitive-data review.

3. **Install**
   - working copy only;
   - record source fingerprint;
   - tag every temporary probe with a stable instrumentation id.

4. **Reproduce**
   - fixed scenario/run identity;
   - preserve event ordering/timestamps/generation identity when material;
   - do not change gameplay merely to make instrumentation easier.

5. **Capture**
   - store raw runtime evidence separately from interpretation;
   - record dropped/incomplete evidence.

6. **Interpret**
   - compare observations to predeclared hypotheses;
   - unresolved evidence remains unresolved.

7. **Remove**
   - delete all temporary probes;
   - verify no instrumentation ids or temporary outputs remain in production source.

8. **Post-removal verification**
   - re-run affected static/package checks;
   - runtime result does not count as clean delivery until instrumentation removal is verified.

## Never

- leave debug commands/loggers/tags in packaged output;
- treat instrumentation itself as the repair;
- collect unrelated player/private data;
- expand probe scope without a new hypothesis.
