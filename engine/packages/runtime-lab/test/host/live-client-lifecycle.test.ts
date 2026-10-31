// Constructed execution receipts test policy checks, not an observed Minecraft client session.
import { describe, expect, it } from "vitest";
import {
  buildLiveClientReconnectPlan,
  evaluateLiveClientReconnectProof,
} from "../../src/host/live-client-lifecycle.js";

describe("live client lifecycle proof", () => {
  const plan =
    buildLiveClientReconnectPlan({
      playerKey: "player-1",
      arenaId: "arena-2",
      arenaGeneration: 4,
      connectionGeneration: 7,
      participationGeneration: 3,
      lifeGeneration: 2,
    });

  it("rejects server-simulated execution as reconnect proof", () => {
    const proof =
      evaluateLiveClientReconnectProof(
        plan,
        {
          scenarioId:
            plan.scenario.id,
          adapterId: "server",
          proofAuthority:
            "server-simulated",
          status: "completed",
          requiredClients: 1,
          waveResults: [],
          evidenceIds: ["e1"],
          evidence: [],
          reasons: [],
        },
      );

    expect(proof.status)
      .toBe("blocked");
  });

  it("accepts live-labelled scoped reconnect observations at the pure proof gate", () => {
    const proof =
      evaluateLiveClientReconnectProof(
        plan,
        {
          scenarioId:
            plan.scenario.id,
          adapterId: "desktop-client",
          proofAuthority:
            "live-runtime",
          status: "completed",
          requiredClients: 1,
          waveResults: [],
          evidenceIds: [
            "disconnect",
            "reconnect",
          ],
          evidence: [{
            predicate:
              "player-disconnected",
            state: "present",
            confidence: "observed",
            proofAuthority:
              "live-runtime",
            scope: plan.oldScope,
          }, {
            predicate:
              "player-reconnected",
            state: "present",
            confidence: "observed",
            proofAuthority:
              "live-runtime",
            scope: plan.newScope,
          }],
          reasons: [],
        },
      );

    expect(proof.status)
      .toBe("proven");
  });
});
