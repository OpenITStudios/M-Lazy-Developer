import { describe, expect, it } from "vitest";
import { blindspotTasksFromMutationResults } from "../../src/index.js";

describe("automatic blindspot task generation", () => {
  it("maps survived mutants to actionable detector strategies", () => {
    const tasks = blindspotTasksFromMutationResults([
      {
        descriptor: {
          id: "coord",
          operator: "coordinate-shift",
          domain: "command-coordinate",
          description: "shift",
        },
        status: "survived",
        evidence: "no topology context",
      },
      {
        descriptor: {
          id: "event",
          operator: "script-event-drop",
          domain: "script-event",
          description: "drop",
        },
        status: "survived",
      },
    ]);

    expect(tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "blindspot:event",
        priority: "P0",
        suggestedStrategies: expect.arrayContaining([
          "static-analysis",
          "dependency-graph",
          "runtime-observation",
        ]),
      }),
      expect.objectContaining({
        id: "blindspot:coord",
        priority: "P1",
        suggestedStrategies: expect.arrayContaining([
          "topology",
          "differential",
        ]),
      }),
    ]));
  });

  it("does not create backlog tasks for killed mutants", () => {
    expect(blindspotTasksFromMutationResults([{
      descriptor: {
        id: "killed",
        operator: "selector-broaden",
        domain: "command-selector",
        description: "x",
      },
      status: "killed",
    }])).toEqual([]);
  });
});
