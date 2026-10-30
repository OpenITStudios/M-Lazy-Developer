// Bounded owner-local source test family; original assertions retained.
import { describe, expect, it } from "vitest";
import { parseScriptFile } from "../../../../analyzers/scripts/src/index.js";
import { analyzeCinematicControls } from "../../src/inspection/cinematic-control-analysis.js";
import { analyzeTitleLifecycle } from "../../src/inspection/client-feedback-analysis.js";

// Original source suite: engine/packages/orchestrator/test/inspection/cinematic-control-analysis.test.ts (Git blob 41632ae0af4c514a113e73f1aa18370b0632467e)
{


describe("cinematic control analysis", () => {
  it("keeps camera calls and authored fade timing distinct", () => {
    const parsed = parseScriptFile(
      "main",
      'player.camera.fade({ fadeTime: { fadeInTime: 1, holdTime: 2, fadeOutTime: 1 } });',
      { artifactId: "fixture", relativePath: "scripts/main.ts" },
    );
    const result = analyzeCinematicControls([parsed]);
    expect(result.cameraMethodCalls).toBeGreaterThan(0);
    expect(result.fadeCalls).toBe(1);
    expect(result.fadeTimingAuthored).toBe(1);
  });
});
}

// Original source suite: engine/packages/orchestrator/test/inspection/client-feedback-analysis.test.ts (Git blob a56de6c418270b29a8c31c6331309e80355207d1)
{


describe("client feedback title lifecycle", () => {
  it("separates title timing, clear and reset operations", () => {
    const parsed = parseScriptFile(
      "main",
      [
        "player.runCommand('title @s times 10 40 10');",
        "player.runCommand('title @s title Victory');",
        "player.runCommand('title @s clear');",
        "player.runCommand('title @s reset');",
      ].join("\n"),
      { artifactId: "fixture", relativePath: "scripts/main.ts" },
    );
    expect(analyzeTitleLifecycle([parsed])[0]).toMatchObject({
      target: "@s",
      hasTimes: true,
      hasClear: true,
      hasReset: true,
      titleWrites: 1,
    });
  });
});
}
