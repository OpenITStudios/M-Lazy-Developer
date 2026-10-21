import { describe, expect, it } from "vitest";
import {
  projectMapAuditOutputV2,
  formatSelectedMapAuditBrief,
} from "../src/map-audit-output-v2.js";

describe("Map Audit Output V2 projection", () => {
  it("preserves PROVEN and NEED_VALIDATION from the same audit finding lanes", () => {
    const inspection: any = {
      gameplayIntent: {
        model: {
          evidence: [{
            id: "e:objective", origin: "game-design-spec",
            scope: "selected-artifact", locator: "embedded-design.json",
            summary: "Selected artifact explicitly states the objective.",
          }],
          nodes: [{
            id: "objective:1",
            kind: "objective",
            label: "Complete objective",
            status: "authored",
            evidenceIds: ["e:objective"],
          }],
          edges: [],
          invariants: [],
        },
      },
      hiddenGameplayDefects: { classification: undefined },
      gameplayWorld: {
        arenas: {
          detected: false,
          isolation: { observations: [] },
        },
        gameplayClosure: {
          status: "CLOSED",
          surfaces: [{
            id: "objective:1",
            label: "Complete objective",
            kind: "objective",
            status: "understood",
            material: true,
            evidenceIds: ["e:objective"],
            boundaries: [],
          }],
          unaccountedSurfaceIds: [],
          blockingSurfaceIds: [],
          unknownSurfaceIds: [],
          stateModelComplete: true,
          boundariesExtracted: true,
          reasons: ["Closed."],
        },
      },
    };
    const proven: any = {
      status: "PROVEN",
      issueType: "BUG",
      failureDomain: "progression-wave-objective",
      contributingDomains: ["progression-wave-objective"],
      gameplayFlow: "PROGRESSION",
      informationMismatch: false,
      playerFacingEvidenceIds: [],
      causalLinkId: "link:proven",
      scenarioId: "scenario:1",
      gameplayStage: "PROGRESSION",
      scenarioLabel: "objective",
      gameplayTrigger: "Complete the objective.",
      gameplayConsequence: "Progression blocks.",
      expectedOutcome: "Progression completes.",
      actualOutcome: "Progression does not complete.",
      affectedScope: "objective:1",
      subjectIds: ["objective:1"],
      componentIds: ["runtime:state"],
      evidenceIds: ["e:objective"],
      knowledgeRequirementIds: ["knowledge:state-flow"],
    };
    const unresolved: any = {
      ...proven,
      status: "NEED_VALIDATION",
      causalLinkId: "link:unresolved",
      knowledgeRequirementIds: ["knowledge:chunk-simulation"],
      validationReason: "Runtime behavior remains unresolved.",
      missingProof: "One exact runtime observation.",
      validationTest: "Run the objective once and observe completion.",
      validationGroupKey: "scenario:1:runtime",
      proofNavigation: {
        recipeId: "proof:progression-dead-end",
        proofGoal: "Resolve progression.",
        provenClaims: [],
        missingClaims: ["Runtime outcome."],
        route: [],
        evidenceSubstitutions: [],
        historicalSearchHints: [],
        historyPressure: 0,
        familyProofCriteria: [],
        proofStopRule: "Stop when decided.",
        runtimeLastResort: true,
      },
    };

    const projectionInput: Parameters<typeof projectMapAuditOutputV2>[0] = {
      inspection,
      identity: {
        artifactId: "artifact:1",
        artifactFingerprint: "a".repeat(64),
        levelName: "Example",
        releaseVersion: "1.0.0",
        releaseIdentityStatus: "consistent",
      },
      issueLanes: {
        BUG: [proven, unresolved],
        DESIGN_MISMATCH: [],
      },
      userIntent: {
        schemaVersion: 1,
        policy:
          "user-input-is-search-guidance-not-gameplay-authority",
        fragments: [{
          id: "f1",
          raw: "wave suka stuck",
        }],
        items: [{
          kind: "SYMPTOM_REPORT",
          raw: "wave suka stuck",
          normalized:
            "possible progression stall",
          sourceFragmentIds: ["f1"],
        }],
        unmappedFragmentIds: [],
        priorityDomains: [
          "progression-wave-objective",
        ],
        priorityPlayerFlows: [
          "PROGRESSION",
        ],
        ambiguities: [],
        blockingAmbiguities: [],
      },
      auditObligations: [],
      validationTests: [{
        key: "scenario:1:runtime",
        verificationMode: "NARROW_RUNTIME_VERIFICATION",
        broadPlaythroughAllowed: false,
        findingIds: ["link:unresolved"],
        issueTypes: ["BUG"],
        gameplayFlows: ["PROGRESSION"],
        test: "Run the objective once and observe completion.",
        assertions: [{
          findingId: "link:unresolved",
          test: "Run the objective once and observe completion.",
        }],
        missingProof: ["One exact runtime observation."],
      }],
      control: {
        status: "READY_FOR_REVIEW",
        currentStage: "COMPLETE",
        allowedNextAction: "PREPARE_REVIEW",
        continuationOwner: "REVIEW",
        requiresNewAuditRun: false,
        blockingCheckpointIds: [],
        reasons: [],
      },
      reasoningByCausalLinkId: {
        "link:unresolved": {
          reportClassification: "LIKELY BUG",
          diagnosticDisposition: "confirmed-defect",
          proofConfidence: "high",
          evidenceDomainSources: ["static"],
          evidenceChain: ["e:objective"],
          unresolvedPredicates: ["objective-runtime-outcome"],
          recommendedValidationPredicate: "objective-runtime-outcome",
          recommendedReadOnlyProbeId: "objective-state-probe",
        },
      },
      honesty: {
        policy: "no-hidden-material-finding",
        status: "PASS",
        expectedVisibleResidueIds: ["link:unresolved"],
        visibleNeedValidationIds: ["link:unresolved"],
        visibleObligationIds: [],
        expectedProvenIds: ["link:proven"],
        visibleProvenIds: ["link:proven"],
        missingVisibleResidueIds: [],
        missingProvenProjectionIds: [],
        reasons: ["All findings visible."],
      },
    };
    const report = projectMapAuditOutputV2(projectionInput);
    expect(report.bugs[0]?.knowledgeRequirementIds).toEqual(["knowledge:state-flow"]);
    expect(report.bugs[1]?.knowledgeRequirementIds).toEqual(["knowledge:chunk-simulation"]);
    const mismatchReport = projectMapAuditOutputV2({
      ...projectionInput,
      issueLanes: {
        BUG: [],
        DESIGN_MISMATCH: [{ ...proven, issueType: "DESIGN_MISMATCH" }],
      },
    });
    expect(mismatchReport.designMismatches[0]?.knowledgeRequirementIds)
      .toEqual(["knowledge:state-flow"]);
    const legacyReport = projectMapAuditOutputV2({
      ...projectionInput,
      issueLanes: { BUG: [{ ...proven, knowledgeRequirementIds: undefined }], DESIGN_MISMATCH: [] },
    });
    expect(legacyReport.bugs[0]).not.toHaveProperty("knowledgeRequirementIds");

    expect(report.schemaVersion).toBe(2);
    expect(report.artifactFingerprint).toBe("a".repeat(64));
    expect(report.auditTarget).toEqual({
      edition: "unknown",
      source: "selected-audit-runtime-target-not-live-observation",
    });
    expect(report.bugs.map((item) => item.status))
      .toEqual(["PROVEN", "NEED_VALIDATION"]);
    expect(report.bugs[1]?.missingProof)
      .toBe("One exact runtime observation.");
    expect(report.bugs[0]?.reasoning).toBeUndefined();
    expect(report.bugs[1]?.reasoning).toMatchObject({
      reportClassification: "LIKELY BUG",
      diagnosticDisposition: "confirmed-defect",
      proofConfidence: "high",
      unresolvedPredicates: ["objective-runtime-outcome"],
      recommendedReadOnlyProbeId: "objective-state-probe",
    });
    expect(report.unresolved.status)
      .toBe("HAS_UNRESOLVED");
    expect(report.unresolved.needValidationIds)
      .toEqual(["link:unresolved"]);
    expect(report.unresolved.runtimeRequiredIds)
      .toEqual(["link:unresolved"]);
    expect(report.unresolved.staticProofPendingIds)
      .toEqual([]);
    expect(report.control.allowedNextAction)
      .toBe("PREPARE_REVIEW");
    expect(report.coverage.disposition)
      .toBe("accounted");
    expect(report.gameDesign.objectiveGrounding)
      .toBe("authored");
    expect(report.userIntent?.items[0]?.kind)
      .toBe("SYMPTOM_REPORT");
    expect(report.userIntent?.policy)
      .toBe(
        "user-input-is-search-guidance-not-gameplay-authority",
      );
    expect(report.qualityGates.informationIntegrity.status)
      .toBe("CLOSED_CLEAR");
    expect(report.qualityGates.zeroFinding.status)
      .toBe("NOT_APPLICABLE");
    expect(report.qualityGates.vitalGameplay.status)
      .toBe("OPEN");
    expect(
      report.qualityGates.vitalGameplay.domains.find(
        (item) =>
          item.domain === "SCORE_RESULT_INTEGRITY",
      )?.status,
    ).toBe("DETECTION_GAP");

    // Several modes can have genuinely different source-backed objectives
    // and terminal rules. Their names must survive the summary, while
    // unresolved mode/player scope must not become an authored global claim.
    const multiModeInspection: any = {
      ...inspection,
      gameplayIntent: {
        model: {
          ...inspection.gameplayIntent.model,
          evidence: [
            ...inspection.gameplayIntent.model.evidence,
            { id: "e:second", origin: "game-design-spec",
              scope: "selected-artifact", locator: "other-mode.json",
              summary: "Second mode objective." },
            { id: "e:win-1", origin: "source-code",
              scope: "selected-artifact", locator: "modes/defense.js:1",
              summary: "Defense completion event." },
            { id: "e:win-2", origin: "source-code",
              scope: "selected-artifact", locator: "modes/rescue.js:1",
              summary: "Rescue completion event." },
            { id: "e:lose-1", origin: "source-code",
              scope: "selected-artifact", locator: "modes/defense.js:2",
              summary: "Defense failure event." },
            { id: "e:lose-2", origin: "source-code",
              scope: "selected-artifact", locator: "modes/rescue.js:2",
              summary: "Rescue failure event." },
            { id: "e:external", origin: "historical-diff",
              scope: "external-reference", locator: "old-map.json",
              summary: "Not part of selected map." },
          ],
          nodes: [
            ...inspection.gameplayIntent.model.nodes,
            { id: "objective:2", kind: "objective", label: "Rescue villagers",
              status: "authored", evidenceIds: ["e:second"] },
            { id: "objective:historical", kind: "objective",
              label: "Historical objective", status: "authored",
              evidenceIds: ["e:external"] },
            ...[
              ["defense-win", "Flag held", "e:win-1"],
              ["rescue-win", "Villagers rescued", "e:win-2"],
              ["defense-lose", "Flag destroyed", "e:lose-1"],
              ["rescue-lose", "Rescue timed out", "e:lose-2"],
            ].map(([id, label, evidenceId]) => ({
              id: "outcome:" + id, kind: "outcome", label,
              status: "authored", evidenceIds: [evidenceId],
            })),
          ],
          edges: [
            { id: "edge:win-1", kind: "wins-by", status: "authored",
              from: "objective:1", to: "outcome:defense-win",
              description: "Hold the flag to win",
              evidenceIds: ["e:objective", "e:win-1"] },
            { id: "edge:win-2", kind: "wins-by", status: "authored",
              from: "objective:2", to: "outcome:rescue-win",
              description: "Rescue villagers to win",
              evidenceIds: ["e:second", "e:win-2"] },
            { id: "edge:lose-1", kind: "loses-by", status: "authored",
              from: "objective:1", to: "outcome:defense-lose",
              description: "Flag destroyed means defeat",
              evidenceIds: ["e:objective", "e:lose-1"] },
            { id: "edge:lose-2", kind: "loses-by", status: "authored",
              from: "objective:2", to: "outcome:rescue-lose",
              description: "Rescue timeout means defeat",
              evidenceIds: ["e:second", "e:lose-2"] },
          ],
        },
      },
    };
    const multiModeReport = projectMapAuditOutputV2({
      ...projectionInput,
      inspection: multiModeInspection,
    });
    expect(multiModeReport.gameDesign.objective).toContain("Complete objective");
    expect(multiModeReport.gameDesign.objective).toContain("Rescue villagers");
    expect(multiModeReport.gameDesign.objective).not.toContain("Historical objective");
    expect(multiModeReport.gameDesign.objectiveGrounding).toBe("unresolved");
    expect(multiModeReport.gameDesign.winCondition).toContain("Hold the flag to win");
    expect(multiModeReport.gameDesign.winCondition).toContain("Rescue villagers to win");
    expect(multiModeReport.gameDesign.loseCondition).toContain("Flag destroyed means defeat");
    expect(multiModeReport.gameDesign.loseCondition).toContain("Rescue timeout means defeat");
    expect(multiModeReport.gameDesign.winConditionGrounding).toBe("unresolved");
    expect(multiModeReport.gameDesign.loseConditionGrounding).toBe("unresolved");
    expect(multiModeReport.bugs.map(item => item.status))
      .toEqual(["PROVEN", "NEED_VALIDATION"]);
  });

  it("renders source-labelled stage/task ownership without assuming progression", () => {
    const path = "resource_packs/demo/texts/en_US.lang";
    const content = [
      ["daigon.offense.stage_1.guide", "phase", "Stage 1: Reach outpost"],
      ["daigon.offense.stage_1.task.1", "mechanic", "Task 1: Break barricade"],
      ["daigon.offense.stage_1.success", "mechanic", "Success feedback: Continue"],
      ["daigon.offense.stage_2.guide", "phase", "Stage 2: Reach fort"],
      ["daigon.offense.stage_2.task.1", "mechanic", "Task 1: Rescue villager"],
    ] as const;
    const evidence = content.map(([key], i) => ({
      id: "e" + i, scope: "selected-artifact" as const,
      origin: "translation" as const, locator: path + "#L" + (i + 5),
      summary: "Authored locale source.",
    }));
    const features = content.map(([key, kind, label], i) => ({
      id: kind + ":localized:" + encodeURIComponent(path + "#" + key),
      kind, label, grounding: "SOURCE_EVIDENCED" as const,
      sourceEvidenceIds: ["e" + i], scenarioIds: [],
      sourceBehaviorPaths: [], activationRelationIds: [],
      effectRelationIds: [], transitionRelationIds: [],
      outcomeRelationIds: [],
    }));
    // A previous-world label is not source evidence for this selected map.
    const oldFeature = {
      ...features[0]!,
      id: "phase:localized:" +
        encodeURIComponent("resource_packs/old/texts/en_US.lang#old.stage_8.guide"),
      sourceEvidenceIds: ["old"],
      label: "Stage 8: Historical",
    };
    const report: any = {
      mapVersion: "1.0.0",
      evidenceScope: { selectedArtifact: "demo.mcworld" },
      control: { status: "BLOCKED", currentStage: "UNDERSTAND",
        allowedNextAction: "RESOLVE_BLOCKING_STAGE" },
      gameDesign: {
        objective: "Investigate", objectiveGrounding: "inferred",
        winCondition: "Unresolved", winConditionGrounding: "unresolved",
        loseCondition: "Unresolved", loseConditionGrounding: "unresolved",
      },
      gameplayStructure: {
        features: [...features, oldFeature],
        mechanicReconstructions: [], gameplayJourneyCandidates: [],
      },
      stateTransitions: [{ from: "waiting", to: "countdown",
        event: "transitions-to", notes: "Source-derived" }],
      gameplayClosure: { surfaceInventory: [], status: "PARTIAL" },
      multiArena: { isolationRules: [] },
      bugs: [], designMismatches: [],
      unresolved: { total: 1 },
    };
    const brief = formatSelectedMapAuditBrief({
      report,
      intent: { evidence: [...evidence, { id: "old",
        scope: "external-reference", origin: "historical-diff",
        locator: "old-map.json", summary: "Historical" }],
        nodes: [], edges: [], invariants: [], unknowns: [] } as any,
      modelTaskPackets: [],
    });
    expect(brief).toContain("Source-labelled level/stage hierarchy");
    expect(brief).toContain("**Stage 1**");
    expect(brief).toContain("**Stage 2**");
    expect(brief).toContain("Task 1: Break barricade");
    expect(brief).toContain("Task 1: Rescue villager");
    expect(brief).toContain("Success text (not proof of completion)");
    expect(brief).toContain(path + "#L5");
    expect(brief).not.toContain("Stage 8: Historical");
    expect(brief).not.toContain("Wave 1");
    expect(brief).toContain("waiting --(transitions-to)--> countdown");
    // Neither localization nor the brief turns staging into confirmed bugs.
    expect(brief).toContain("No published finding");
  });
  it("renders wave recipes with direct source coordinates and unresolved dynamic entity type", () => {
    const report: any = {
      mapVersion: "1.0",
      evidenceScope: {selectedArtifact:"source.mcworld"},
      control: {status:"BLOCKED",currentStage:"UNDERSTAND",
        allowedNextAction:"RESOLVE_BLOCKING_STAGE"},
      gameDesign:{objective:"UNKNOWN",objectiveGrounding:"unresolved",
        winCondition:"UNKNOWN",winConditionGrounding:"unresolved",
        loseCondition:"UNKNOWN",loseConditionGrounding:"unresolved"},
      gameplayClosure:{surfaceInventory:[],status:"PARTIAL"},
      multiArena:{isolationRules:[]},stateTransitions:[],
      bugs:[],designMismatches:[],unresolved:{total:1},
    };
    const source = {artifactId:"current",relativePath:"behavior_packs/a/scripts/main.js",
      range:{lineStart:2,lineEnd:2,columnStart:100,columnEnd:150}};
    const brief = formatSelectedMapAuditBrief({
      report,
      intent:{evidence:[],nodes:[],edges:[],invariants:[],unknowns:[]} as any,
      modelTaskPackets:[],
      waveStages:[{
        source,id:"stage_1",sourceCollection:"stages",
        waves:[{
          source,number:1,delaySpawn:0,nextWaveMinMob:2,
          recipeListIncomplete:false,endCommandsIncomplete:false,
          endCommands:[{source,command:"fill 1 2 3 air",delay:0}],
          recipes:[{source,typeExpression:'i("pillager")',
            coordinates:{x:1,y:-2,z:3},event:"minecraft:ranged_mode"}],
        }],
      }],
    });
    expect(brief).toContain("Script-authored stage → wave → spawn hierarchy");
    expect(brief).toContain("**stages / stage_1**");
    expect(brief).toContain("**Wave 1**");
    expect(brief).toContain("next_wave_min_mob=2");
    expect(brief).toContain('i("pillager") [dynamic ID unresolved]');
    expect(brief).toContain("position=1 -2 3");
    expect(brief).toContain("Source: behavior_packs/a/scripts/main.js:2:100");
    expect(brief).toContain("fill 1 2 3 air");
    expect(brief).toContain("No published finding");
  });

  it("keeps source-authored gameplay catalogs distinct from wave recipes", () => {
    const src = { artifactId: "selected", relativePath:
      "behavior_packs/a/scripts/chunks/catalog.js",
      range: { lineStart: 11, lineEnd: 11, columnStart: 1, columnEnd: 99 }};
    const report: any = {
      mapVersion:"1", evidenceScope:{selectedArtifact:"demo.mcworld"},
      control:{status:"BLOCKED",currentStage:"UNDERSTAND",
        allowedNextAction:"RESOLVE_BLOCKING_STAGE"},
      gameDesign:{ objective:"UNKNOWN",objectiveGrounding:"unresolved",
        winCondition:"UNKNOWN",winConditionGrounding:"unresolved",
        loseCondition:"UNKNOWN",loseConditionGrounding:"unresolved"},
      multiArena:{isolationRules:[]},gameplayClosure:{status:"PARTIAL",surfaceInventory:[]},
      stateTransitions:[],bugs:[],designMismatches:[],unresolved:{total:1},
    };
    const brief = formatSelectedMapAuditBrief({
      report, intent:{evidence:[],nodes:[],edges:[],invariants:[],unknowns:[]} as any,
      modelTaskPackets:[],
      gameplayCatalog:[
        {source:src,kind:"gameplay",id:"combat_trial",name:"Combat Trial",number:1},
        {source:src,kind:"gameplay",id:"capture_run",name:"Capture Run",number:5},
      ],
      waveStages:[],
    });
    expect(brief).toContain("Script-authored gameplay/mode catalog");
    expect(brief).toContain("gameplay #1: Combat Trial");
    expect(brief).toContain("gameplay #5: Capture Run");
    expect(brief).toContain("catalog.js:11:1");
    expect(brief).toContain("not evidence that the map contains no waves");
    expect(brief).not.toContain("**Wave 1**");
    expect(brief).toContain("No published finding");
  });

  it("shows source choices by category without inventing level or wave behavior", () => {
    const source = {artifactId:"world:builder",
      relativePath:"behavior_packs/builder/scripts/game-content.js",
      range:{lineStart:12,lineEnd:12,columnStart:3,columnEnd:50}};
    const report: any = {
      mapVersion:"1",evidenceScope:{selectedArtifact:"build.mcworld"},
      control:{status:"BLOCKED",currentStage:"UNDERSTAND",
        allowedNextAction:"RESOLVE_BLOCKING_STAGE"},
      gameDesign:{objective:"UNKNOWN",objectiveGrounding:"unresolved",
        winCondition:"UNKNOWN",winConditionGrounding:"unresolved",
        loseCondition:"UNKNOWN",loseConditionGrounding:"unresolved"},
      gameplayClosure:{status:"PARTIAL",surfaceInventory:[]},
      multiArena:{isolationRules:[]},stateTransitions:[],
      bugs:[],designMismatches:[],unresolved:{total:1},
    };
    const brief = formatSelectedMapAuditBrief({
      report,intent:{evidence:[],nodes:[],edges:[],invariants:[],unknowns:[]} as any,
      modelTaskPackets:[],gameplayCatalog:[],waveStages:[],
      contentCollections:[{name:"PromptPool",source,
        textField:"text",classificationField:"difficulty",
        incomplete:true,exported:false,entries:[
          {text:"Camera",classification:"easy",source},
          {text:"Cart",classification:"easy",source},
          {text:"Globe",classification:"medium",source},
        ]}],
    });
    expect(brief).toContain("Script-authored content choices");
    expect(brief).toContain("PromptPool");
    expect(brief).toContain("easy: 2 choice(s)");
    expect(brief).toContain("medium: 1 choice(s)");
    expect(brief).toContain("Camera / source");
    expect(brief).toContain("game-content.js:12:3");
    expect(brief).toContain("unresolved entries");
    expect(brief).not.toContain("**Wave 1**");
    expect(brief).not.toContain("**Stage 1**");
    expect(brief).toContain("No published finding");
  });

  it("projects exact intent content dependencies rather than only a detached list", () => {
    const report: any = {
      mapVersion:"1.1.3", evidenceScope:{selectedArtifact:"building.mcworld"},
      control:{status:"BLOCKED",currentStage:"UNDERSTAND",
        allowedNextAction:"RESOLVE_BLOCKING_STAGE"},
      gameDesign:{objective:"UNKNOWN",objectiveGrounding:"unresolved",
        winCondition:"UNKNOWN",winConditionGrounding:"unresolved",
        loseCondition:"UNKNOWN",loseConditionGrounding:"unresolved"},
      gameplayClosure:{status:"PARTIAL",surfaceInventory:[]},
      multiArena:{isolationRules:[]},stateTransitions:[],
      bugs:[],designMismatches:[],unresolved:{total:1},
    };
    const model: any = {
      evidence:[
        {id:"definition",scope:"selected-artifact",origin:"source-code",
          locator:"behavior_packs/a/scripts/words.js:28:1"},
        {id:"use",scope:"selected-artifact",origin:"source-code",
          locator:"behavior_packs/a/scripts/round.js:246:19"},
        {id:"source-content-context:assignment",scope:"selected-artifact",origin:"source-code",
          locator:"behavior_packs/a/scripts/round.js:274:9",
          summary:'Same-method source assignment (NOT CAUSAL): s.phase = "round_countdown"'},
      ],
      nodes:[
        {id:"r",kind:"resource",label:"GuessText",evidenceIds:[]},
        {id:"c",kind:"mechanic",label:"method:Round.selectRound (source content reader)",
          evidenceIds:["use","source-content-context:assignment"]},
        {id:"phase",kind:"state",label:"Round Countdown",evidenceIds:[]},
      ],
      edges:[{id:"source-content-requires:current",kind:"requires",
        status:"inferred",from:"c",to:"r",
        evidenceIds:["definition","use"]},
        {id:"source-content-state-context:phase",kind:"participates-in",
          status:"inferred",from:"c",to:"phase",
          evidenceIds:["use","source-content-context:assignment"]}],
      unknowns:[],
    };
    const brief = formatSelectedMapAuditBrief({
      report,intent:model,modelTaskPackets:[],
    });
    expect(brief).toContain("Source-content dependencies (INTENT GRAPH");
    expect(brief).toContain("Round.selectRound");
    expect(brief).toContain("requires; SOURCE ONLY");
    expect(brief).toContain("GuessText");
    expect(brief).toContain("words.js:28:1");
    expect(brief).toContain("round.js:246:19");
    expect(brief).toContain("Source-local assignments (NOT execution/causation)");
    expect(brief).toContain('s.phase = "round_countdown"');
    expect(brief).toContain("Source-local state association (NOT CAUSAL)");
    expect(brief).toContain("Round Countdown");
    expect(brief).toContain("No published finding");
  });

  it("keeps exact source score mutation separate from final-result proof", () => {
    const report: any = {
      mapVersion:"1.1.3",evidenceScope:{selectedArtifact:"source.mcworld"},
      control:{status:"BLOCKED",currentStage:"UNDERSTAND",
        allowedNextAction:"RESOLVE_BLOCKING_STAGE"},
      gameDesign:{objective:"UNKNOWN",objectiveGrounding:"unresolved",
        winCondition:"UNKNOWN",winConditionGrounding:"unresolved",
        loseCondition:"UNKNOWN",loseConditionGrounding:"unresolved"},
      gameplayClosure:{surfaceInventory:[],status:"PARTIAL"},
      multiArena:{isolationRules:[]},stateTransitions:[],
      bugs:[],designMismatches:[],unresolved:{total:1},
    };
    const content: any = {
      evidence:[{
        id:"source-method-property-site:score",scope:"selected-artifact",
        origin:"source-code",
        locator:"behavior_packs/demo/scripts/guess.js:421:5",
        summary:"Authored JS property mutation in function:addContribution: " +
          "player.score += points. Source attempt only: not proof of " +
          "authoritative scoring, accepted action, committed result " +
          "or Minecraft execution.",
      }],
      nodes:[{
        id:"mechanic:source-method:score",
        kind:"mechanic",
        label:"function:addContribution (source method; gameplay purpose UNKNOWN)",
        evidenceIds:["source-method-property-site:score"],
      }],
      edges:[],unknowns:[],
    };
    const brief = formatSelectedMapAuditBrief({
      report,intent:content,modelTaskPackets:[],
    });
    expect(brief).toContain("Source method property changes (NOT SETTLED RESULTS)");
    expect(brief).toContain("player.score += points");
    expect(brief).toContain("guess.js:421:5");
    expect(brief).not.toContain("confirmed winner");
    expect(brief).toContain("No published finding");
  });

  it("keeps match settlement call graph distinct from unresolved presentation receivers", () => {
    const report: any = {
      mapVersion:"1.0",evidenceScope:{selectedArtifact:"selected.mcworld"},
      control:{status:"BLOCKED",currentStage:"UNDERSTAND",
        allowedNextAction:"RESOLVE_BLOCKING_STAGE"},
      gameDesign:{objective:"UNKNOWN",objectiveGrounding:"unresolved",
        winCondition:"UNKNOWN",winConditionGrounding:"unresolved",
        loseCondition:"UNKNOWN",loseConditionGrounding:"unresolved"},
      gameplayClosure:{surfaceInventory:[],status:"PARTIAL"},
      multiArena:{isolationRules:[]},stateTransitions:[],
      bugs:[],designMismatches:[],unresolved:{total:1},
    };
    const intent: any = {
      evidence:[
        {id:"source-method-site:call",origin:"source-code",scope:"selected-artifact",
          locator:"behavior_packs/demo/scripts/service.js:1130:5",
          summary:"Exact local call function:finish -> function:settleResult; NOT EXECUTED"},
        {id:"source-method-state-site:match",origin:"source-code",scope:"selected-artifact",
          locator:"behavior_packs/demo/scripts/service.js:1126:5",
          summary:"Direct authored state assignment: match_end. NOT OBSERVED"},
        {id:"source-unresolved-receiver-site:say",
          origin:"source-code",scope:"selected-artifact",
          locator:"behavior_packs/demo/scripts/service.js:1131:8",
          summary:"Authored receiver call game.say() in function:finish. " +
            "Receiver implementation, execution, presentation and settlement effect NOT PROVEN."},
      ],
      nodes:[
        {id:"finish",kind:"mechanic",label:"function:finish",
          evidenceIds:["source-method-state-site:match",
            "source-unresolved-receiver-site:say"]},
        {id:"settle",kind:"mechanic",label:"function:settleResult",
          evidenceIds:["source-method-site:call"]},
      ],
      edges:[{
        id:"source-method-call:finish",from:"finish",to:"settle",
        kind:"requires",status:"inferred",evidenceIds:["source-method-site:call"],
      }],
      unknowns:[],
    };
    const brief = formatSelectedMapAuditBrief({
      report,intent,modelTaskPackets:[],
    });
    expect(brief).toContain("Source-local method call graph (NOT PLAY ORDER)");
    expect(brief).toContain("function:finish");
    expect(brief).toContain("function:settleResult");
    expect(brief).toContain("Authored cross-object calls (TARGET UNRESOLVED)");
    expect(brief).toContain("game.say()");
    expect(brief).toContain("service.js:1131:8");
    expect(brief).toContain("No published finding");
  });

  it("presents exact construction/parameter-based receiver candidates without asserting runtime identity", () => {
    const report: any = {
      mapVersion:"1.1.3",evidenceScope:{selectedArtifact:"selected.mcworld"},
      control:{status:"BLOCKED",currentStage:"UNDERSTAND",
        allowedNextAction:"RESOLVE_BLOCKING_STAGE"},
      gameDesign:{objective:"UNKNOWN",objectiveGrounding:"unresolved",
        winCondition:"UNKNOWN",winConditionGrounding:"unresolved",
        loseCondition:"UNKNOWN",loseConditionGrounding:"unresolved"},
      gameplayClosure:{surfaceInventory:[],status:"PARTIAL"},
      multiArena:{isolationRules:[]},stateTransitions:[],
      bugs:[],designMismatches:[],unresolved:{total:1},
    };
    const intent:any = {
      evidence:[
        {id:"source-instance-construct:one",origin:"source-code",
          scope:"selected-artifact",locator:"service.js:450:20"},
        {id:"source-instance-forward:one",origin:"source-code",
          scope:"selected-artifact",locator:"manager.js:206:9"},
        {id:"source-instance-receiver-call:one",origin:"source-code",
          scope:"selected-artifact",locator:"service.js:1131:26"},
      ],
      nodes:[
        {id:"finish",kind:"mechanic",label:"function:finish",evidenceIds:[]},
        {id:"summary",kind:"mechanic",label:"function:matchSummary",evidenceIds:[]},
      ],
      edges:[{id:"source-instance-candidate:summary",
        kind:"requires",status:"inferred",from:"finish",to:"summary",
        evidenceIds:["source-instance-construct:one",
          "source-instance-forward:one","source-instance-receiver-call:one"]}],
      unknowns:[],
    };
    const brief=formatSelectedMapAuditBrief({report,intent,modelTaskPackets:[]});
    expect(brief).toContain("Cross-module receiver candidates (SOURCE CHAIN ONLY)");
    expect(brief).toContain("candidate receiver");
    expect(brief).toContain("matchSummary");
    expect(brief).toContain("service.js:450:20");
    expect(brief).toContain("manager.js:206:9");
    expect(brief).toContain("NOT prove all receiver instances");
    expect(brief).toContain("No published finding");
  });

  it("shows one navigable method dependency tree with source-only state and receiver links", () => {
    const report:any={
      mapVersion:"1.0",evidenceScope:{selectedArtifact:"example.mcworld"},
      control:{status:"BLOCKED",currentStage:"UNDERSTAND",
        allowedNextAction:"RESOLVE_BLOCKING_STAGE"},
      gameDesign:{objective:"UNKNOWN",objectiveGrounding:"unresolved",
        winCondition:"UNKNOWN",winConditionGrounding:"unresolved",
        loseCondition:"UNKNOWN",loseConditionGrounding:"unresolved"},
      gameplayClosure:{surfaceInventory:[],status:"PARTIAL"},
      multiArena:{isolationRules:[]},stateTransitions:[],
      bugs:[],designMismatches:[],unresolved:{total:1},
    };
    const intent:any={
      evidence:[
        {id:"source-method-property-site:score",scope:"selected-artifact",
          locator:"bp/scripts/manager.js:421:5",origin:"source-code",
          summary:"Authored JS property mutation: player.score += points"},
      ],
      nodes:[
        {id:"prepare",kind:"mechanic",label:"prepareRound()",evidenceIds:[]},
        {id:"finish",kind:"mechanic",label:"finish()",evidenceIds:[]},
        {id:"settle",kind:"mechanic",label:"settleResult()",
          evidenceIds:["source-method-property-site:score"]},
        {id:"summary",kind:"mechanic",label:"matchSummary()",evidenceIds:[]},
        {id:"state",kind:"state",label:"Match End",evidenceIds:[]},
      ],
      edges:[
        {id:"source-method-call:one",from:"prepare",to:"finish",
          kind:"requires",status:"inferred",evidenceIds:[]},
        {id:"source-method-call:two",from:"finish",to:"settle",
          kind:"requires",status:"inferred",evidenceIds:[]},
        {id:"source-instance-candidate:three",from:"finish",to:"summary",
          kind:"requires",status:"inferred",evidenceIds:[]},
        {id:"source-method-state:state",from:"finish",to:"state",
          kind:"participates-in",status:"inferred",evidenceIds:[]},
      ],
      unknowns:[],
    };
    const brief=formatSelectedMapAuditBrief({report,intent,modelTaskPackets:[]});
    const treeStart=brief.indexOf("### Source-backed method dependency tree");
    expect(treeStart).toBeGreaterThan(0);
    const tree=brief.slice(treeStart,brief.indexOf("### Source-local method call graph",treeStart));
    expect(tree).toContain("prepareRound()");
    expect(tree).toContain("source call → **finish()**");
    expect(tree).toContain("source call → **settleResult()**");
    expect(tree).toContain("candidate receiver → **matchSummary()**");
    expect(tree).toContain("Authored state value: Match End");
    expect(tree).toContain("player.score += points");
    expect(tree).toContain("NOT PLAY SEQUENCE");
    expect(brief).toContain("No published finding");
  });

  it("shows authored keyed Map writes and reads without equating their runtime owner", () => {
    const report:any={
      mapVersion:"1",evidenceScope:{selectedArtifact:"selected.mcworld"},
      control:{status:"BLOCKED",currentStage:"UNDERSTAND",
        allowedNextAction:"RESOLVE_BLOCKING_STAGE"},
      gameDesign:{objective:"UNKNOWN",objectiveGrounding:"unresolved",
        winCondition:"UNKNOWN",winConditionGrounding:"unresolved",
        loseCondition:"UNKNOWN",loseConditionGrounding:"unresolved"},
      gameplayClosure:{surfaceInventory:[],status:"PARTIAL"},
      multiArena:{isolationRules:[]},stateTransitions:[],
      bugs:[],designMismatches:[],unresolved:{total:1},
    };
    const mapId="resource:source-class-map:example";
    const input:any={
      evidence:[
        {id:"source-class-map-definition:one",origin:"source-code",
          scope:"selected-artifact",locator:"bp/scripts/service.js:81:5",
          summary:"this.sessions = new Map()"},
        {id:"source-class-map-access:set",origin:"source-code",
          scope:"selected-artifact",locator:"bp/scripts/service.js:451:7",
          summary:"Source Arena.this.sessions.set(key=a.id, value=game)."},
        {id:"source-class-map-access:get",origin:"source-code",
          scope:"selected-artifact",locator:"bp/scripts/service.js:1337:18",
          summary:"Source Arena.this.sessions.get(key=this.membership(player.id))."},
      ],
      nodes:[{
        id:mapId,kind:"resource",label:"Arena.this.sessions (source keyed Map)",
        evidenceIds:["source-class-map-definition:one",
          "source-class-map-access:set","source-class-map-access:get"],
      }],
      edges:[],
      unknowns:[{
        id:"unknown:source-map-key-identity:one",
        question:"Read key this.membership(player.id) is not proven equal to stored a.id.",
        blockedSubjectIds:[mapId],
        evidenceIds:["source-class-map-access:set",
          "source-class-map-access:get"],
      }],
    };
    const brief=formatSelectedMapAuditBrief({
      report,intent:input,modelTaskPackets:[],
    });
    expect(brief).toContain("Source keyed storage ownership (KEY IDENTITY UNKNOWN)");
    expect(brief).toContain("set(key=a.id");
    expect(brief).toContain("get(key=this.membership(player.id)");
    expect(brief).toContain("bp/scripts/service.js:451:7");
    expect(brief).toContain("Key identity unresolved:");
    expect(brief).not.toContain("PROVEN SAME SESSION");
    expect(brief).toContain("No published finding");
  });

  it("shows stage-wave and categorized-choice ownership in one source graph without inferring play order", () => {
    const report:any={
      mapVersion:"selected",evidenceScope:{selectedArtifact:"demo.mcworld"},
      control:{status:"BLOCKED",currentStage:"UNDERSTAND",
        allowedNextAction:"RESOLVE_BLOCKING_STAGE"},
      gameDesign:{objective:"UNKNOWN",objectiveGrounding:"unresolved",
        winCondition:"UNKNOWN",winConditionGrounding:"unresolved",
        loseCondition:"UNKNOWN",loseConditionGrounding:"unresolved"},
      gameplayClosure:{surfaceInventory:[],status:"PARTIAL"},
      multiArena:{isolationRules:[]},stateTransitions:[],
      bugs:[],designMismatches:[],unresolved:{total:1},
    };
    const p="behavior_packs/demo/scripts/main.js:11:4";
    const nodes=[
      {id:"resource:authored-source:stage",kind:"resource",label:"Stage stage_1",
        evidenceIds:["stage"]},
      {id:"resource:authored-source:wave",kind:"resource",label:"Wave 1",
        evidenceIds:["wave"]},
      {id:"resource:authored-content:pool",kind:"resource",
        label:"GuessText",evidenceIds:["pool"]},
      {id:"resource:authored-source:category",kind:"resource",
        label:"easy",evidenceIds:["category"]},
      {id:"resource:authored-source:choice",kind:"resource",
        label:"Camera",evidenceIds:["choice"]},
      {id:"resource:authored-source:mode",kind:"resource",
        label:"gameplay: Capture Run (#5)",evidenceIds:["mode"]},
    ];
    const links=[["stage","wave"],["pool","category"],["category","choice"]]
      .map(([from,to])=>{
        const fromId=nodes.find(n=>n.id.endsWith(":"+from))!.id;
        const toId=nodes.find(n=>n.id.endsWith(":"+to))!.id;
        return {
          id:"authored-content-owns:"+from+":"+to,from:fromId,to:toId,
          kind:"owns",status:"inferred",evidenceIds:[from,to],
        };
      });
    const intent:any={
      nodes,edges:links,unknowns:[],
      evidence:["stage","wave","pool","category","choice","mode"]
        .map(id=>({id,origin:"source-code",scope:"selected-artifact",
          locator:p,summary:"Authored selected source."})),
    };
    const brief=formatSelectedMapAuditBrief({
      report,intent,modelTaskPackets:[],
    });
    const start=brief.indexOf("### Game design content graph (SOURCE HIERARCHY ONLY)");
    expect(start).toBeGreaterThan(0);
    const section=brief.slice(start,brief.indexOf("### Other mechanics",start));
    expect(section).toContain("Stage stage_1");
    expect(section).toContain("balanced source samples, NOT OBSERVED");
    expect(section).toContain("Wave 1");
    expect(section).toContain("GuessText");
    expect(section).toContain("easy");
    expect(section).toContain("Camera");
    expect(section).toContain("Capture Run (#5)");
    expect(section).toContain("NOT OBSERVED");
    expect(section).not.toContain("Stage 15");
    expect(section.indexOf("stage_1")).toBeLessThan(section.indexOf("Wave 1"));
    expect(section.indexOf("GuessText")).toBeLessThan(section.indexOf("easy"));
    expect(brief).toContain("No published finding");
  });

  it("shows all fifteen authored levels before a spawn-heavy first stage can consume the detail budget", () => {
    const report: any = {
      mapVersion:"1",evidenceScope:{selectedArtifact:"multi-stage.mcworld"},
      control:{status:"BLOCKED",currentStage:"UNDERSTAND",
        allowedNextAction:"RESOLVE_BLOCKING_STAGE"},
      gameDesign:{objective:"UNKNOWN",objectiveGrounding:"unresolved",
        winCondition:"UNKNOWN",winConditionGrounding:"unresolved",
        loseCondition:"UNKNOWN",loseConditionGrounding:"unresolved"},
      gameplayClosure:{surfaceInventory:[],status:"PARTIAL"},
      multiArena:{isolationRules:[]},stateTransitions:[],
      bugs:[],designMismatches:[],unresolved:{total:1},
    };
    const nodes: any[] = [];
    const edges: any[] = [];
    const evidence: any[] = [];
    const path = "behavior_packs/example/scripts/arena.js";
    const addNode = (id: string, label: string, line: number): void => {
      const proof = "proof:" + id;
      nodes.push({id,label,kind:"resource",status:"inferred",
        evidenceIds:[proof]});
      evidence.push({id:proof,origin:"source-code",
        scope:"selected-artifact",locator:path + ":" + line + ":1",
        summary:"Literal authored source content only."});
    };
    const addOwnership = (parent: string, child: string): void => {
      edges.push({id:"authored-content-owns:"+encodeURIComponent(
        parent+"->"+child),from:parent,to:child,kind:"owns",
        status:"inferred",evidenceIds:["proof:"+parent,"proof:"+child]});
    };
    for(let stage=1;stage<=15;stage++){
      const stageId="resource:authored-source:stage-"+stage;
      addNode(stageId,"Stage "+stage,stage*10);
      for(let wave=1;wave<=2;wave++){
        const waveId="resource:authored-source:wave-"+stage+"-"+wave;
        addNode(waveId,"Wave "+wave,stage*10+wave);
        addOwnership(stageId,waveId);
        const spawnCount=stage===1&&wave===1?190:4;
        for(let index=1;index<=spawnCount;index++){
          const spawnId="resource:authored-source:spawn-"+stage+"-"+
            wave+"-"+index;
          addNode(spawnId,"Spawn recipe "+index,stage*1000+wave*200+index);
          addOwnership(waveId,spawnId);
        }
      }
    }
    const brief = formatSelectedMapAuditBrief({
      report,intent:{schemaVersion:1,id:"sample",nodes,edges,evidence,
        unknowns:[],invariants:[]} as any,
      modelTaskPackets:[],
    });
    const start=brief.indexOf("### Game design content graph (SOURCE HIERARCHY ONLY)");
    const end=brief.indexOf("### Other mechanics",start);
    const graph=brief.slice(start,end<0?undefined:end);
    const detailIndex=graph.indexOf("**Branch details (balanced source samples, NOT OBSERVED):**");
    expect(detailIndex).toBeGreaterThan(0);
    const overview=graph.slice(0,detailIndex);
    const detail=graph.slice(detailIndex);
    for(let stage=1;stage<=15;stage++){
      expect(overview).toContain("**Stage "+stage+"**");
      expect(detail).toContain("**Stage "+stage+"** [authored root]");
    }
    expect(overview.indexOf("**Stage 2**"))
      .toBeLessThan(overview.indexOf("**Stage 10**"));
    expect(overview.indexOf("**Stage 14**"))
      .toBeLessThan(overview.indexOf("**Stage 15**"));
    expect(detail).toContain("**Wave 1**");
    expect(detail).toContain("**Wave 2**");
    expect(detail).toContain("Additional authored items in Wave 1:");
    expect(overview).toContain("15 of 15 source root(s) represented.");
    expect(graph).toContain("canonical source graph retains them");
    expect(graph).not.toContain("Stage 16");
    expect(brief).toContain("No published finding");
  });

  it("renders all 24 source choices when three categories of eight fit the brief budget", () => {
    const report:any={
      mapVersion:"1",evidenceScope:{selectedArtifact:"rounds.mcworld"},
      control:{status:"BLOCKED",currentStage:"UNDERSTAND",
        allowedNextAction:"RESOLVE_BLOCKING_STAGE"},
      gameDesign:{objective:"UNKNOWN",objectiveGrounding:"unresolved",
        winCondition:"UNKNOWN",winConditionGrounding:"unresolved",
        loseCondition:"UNKNOWN",loseConditionGrounding:"unresolved"},
      gameplayClosure:{surfaceInventory:[],status:"PARTIAL"},
      multiArena:{isolationRules:[]},stateTransitions:[],
      bugs:[],designMismatches:[],unresolved:{total:1},
    };
    const nodes:any[]=[],edges:any[]=[],evidence:any[]=[];
    const add=(id:string,label:string,line:number,parent?:string)=>{
      const eid="evidence:"+id;
      nodes.push({id,label,kind:"resource",status:"inferred",
        evidenceIds:[eid]});
      evidence.push({id:eid,origin:"source-code",
        scope:"selected-artifact",
        locator:"behavior_packs/example/scripts/word-data.js:"+line+":1",
        summary:"Authored source only."});
      if(parent)edges.push({
        id:"authored-content-owns:"+id,kind:"owns",status:"inferred",
        from:parent,to:id,evidenceIds:[eid],
      });
    };
    const root="resource:authored-content:guess";
    add(root,"GuessText",1);
    ["easy","medium","hard"].forEach((category,index)=>{
      const cat="resource:authored-source:category-"+category;
      add(cat,category,index+2,root);
      for(let i=1;i<=8;i++){
        add("resource:authored-source:choice-"+category+"-"+i,
          category+"-choice-"+i,10+index*10+i,cat);
      }
    });
    const brief=formatSelectedMapAuditBrief({
      report,intent:{schemaVersion:1,id:"authored-content",
        nodes,edges,evidence,unknowns:[],invariants:[]} as any,
      modelTaskPackets:[],
    });
    const start=brief.indexOf("### Game design content graph (SOURCE HIERARCHY ONLY)");
    const next=brief.indexOf("### Other mechanics",start);
    const graph=brief.slice(start,next<0?undefined:next);
    const detail=graph.slice(graph.indexOf("**Branch details"));
    for(const category of ["easy","medium","hard"])
      for(let i=1;i<=8;i++)
        expect(detail).toContain(category+"-choice-"+i);
    expect(graph).not.toContain("Additional authored items in easy");
    expect(graph).not.toContain("Additional authored items in medium");
    expect(graph).not.toContain("Additional authored items in hard");
    expect(graph).toContain("1 of 1 source root(s) represented.");
    expect(brief).toContain("No published finding");
  });

  it("keeps proven findings visible alongside C9, runtime and detection obligations in a blocked brief", () => {
    const report: any = {
      mapVersion: "1.2.0",
      evidenceScope: { selectedArtifact: "sample.mcworld" },
      control: {
        status: "BLOCKED",
        currentStage: "EVALUATE",
        allowedNextAction: "RESOLVE_BLOCKING_STAGE",
      },
      gameDesign: {
        objective: "Complete each objective", objectiveGrounding: "authored",
        winCondition: "UNKNOWN", winConditionGrounding: "unresolved",
        loseCondition: "UNKNOWN", loseConditionGrounding: "unresolved",
      },
      gameplayClosure: {
        status: "PARTIAL", surfaceInventory: [],
        stateModelComplete: false,
      },
      multiArena: { isolationRules: [] },
      stateTransitions: [],
      bugs: [{
        status: "PROVEN",
        issueType: "BUG",
        issue: "The objective cannot advance.",
        playerImpact: "Progression is blocked.",
        expected: "Advance after completion.",
        actual: "The phase stays active.",
        evidenceIds: ["source:objective"],
      }],
      designMismatches: [],
      unresolved: { total: 3 },
      auditObligations: [{
        id: "mandatory-checkpoint:C9",
        source: "scenario-coverage",
        stage: "EVALUATE",
        title: "Resolve cross-system source coverage",
        reason: "Scenario dependency is unbound.",
        missingProof: "Scenario-scoped causal source evidence.",
        validationTest: "Trace the selected source dependency.",
      }, {
        id: "link:runtime",
        source: "runtime-proof",
        stage: "PROVE",
        title: "Resolve runtime scheduling",
        reason: "Gameplay scheduling is unresolved.",
        missingProof: "One deciding runtime observation.",
        validationTest: "Observe the bounded scheduling condition.",
      }, {
        id: "link:gap",
        source: "detection-gap",
        stage: "UNDERSTAND",
        title: "Resolve source semantics",
        reason: "Causal source relation is not established.",
        missingProof: "Selected-source execution edge.",
        validationTest: "Inspect the exact source relationship.",
      }],
    };
    const brief = formatSelectedMapAuditBrief({
      report,
      intent: { evidence: [], nodes: [], edges: [], unknowns: [] } as any,
      modelTaskPackets: [],
    });
    expect(brief).toContain("BLOCKED / EVALUATE");
    expect(brief).toContain("[PROVEN] BUG: The objective cannot advance.");
    expect(brief).toContain("not an approved issue set");
    expect(brief).toContain("### Audit Obligations (NOT BUG FINDINGS)");
    expect(brief).toContain("mandatory-checkpoint:C9");
    expect(brief).toContain("link:runtime");
    expect(brief).toContain("link:gap");
    expect(brief).toContain("One deciding runtime observation.");
    expect(brief).not.toContain("No specific investigation task");
    expect(brief.indexOf("mandatory-checkpoint:C9")).toBeLessThan(
      brief.indexOf("link:runtime"),
    );
  });

  it("puts the material audit decision before technical inventories with scoped developer caveats", () => {
    const report: any = {
      mapVersion: "1.0.1",
      evidenceScope: { selectedArtifact: "selected.mcworld" },
      control: {
        status: "BLOCKED", currentStage: "UNDERSTAND",
        allowedNextAction: "RESOLVE_BLOCKING_STAGE",
      },
      gameDesign: {
        objective: "Capture zone", objectiveGrounding: "authored",
        winCondition: "Unresolved", winConditionGrounding: "unresolved",
        loseCondition: "Unresolved", loseConditionGrounding: "unresolved",
      },
      gameplayStructure: {
        features: [{
          id: "feature:zone", label: "Capture zone", kind: "mechanic",
          grounding: "SOURCE_EVIDENCED",
          sourceEvidenceIds: ["site:zone"],
          sourceBehaviorPaths: [], purpose: "Authored capture region",
          activationRelationIds: [], effectRelationIds: [],
          transitionRelationIds: [], outcomeRelationIds: [],
        }],
        mechanicReconstructions: [], gameplayJourneyCandidates: [],
      },
      stateTransitions: [], gameplayClosure: {
        stateModelComplete: false, status: "PARTIAL", surfaceInventory: [],
      },
      multiArena: { isolationRules: [] },
      bugs: [{
        id: "bug:zone", issue: "Capture never settles",
        issueType: "BUG", status: "NEED_VALIDATION",
        playerImpact: "Progression may stall.",
        expected: "Capture completes.",
        actual: "Settlement not established.",
        evidenceIds: ["site:zone"],
        validationReason: "Runtime state remains unknown.",
        missingProof: "Observe actual settlement or its source guard.",
      }],
      designMismatches: [], unresolved: { total: 2 },
      auditObligations: [],
    };
    const task: any = {
      id: "task:translate:zone", stage: "PROVE",
      kind: "GAMEPLAY_TRANSLATION", decisionNeeded: "Trace zone settlement",
      goal: "Find the selected-map source branch",
      stopCondition: "Stop at deciding source or explicit gap",
      subjectSelection: {
        basis: "SOURCE_ROLE_CANDIDATE", omittedCandidates: 2,
      },
      evidenceContext: [{
        kind: "selected-artifact-evidence",
        id: "site:zone", locator: "scripts/zone.ts:12",
      }],
      unresolvedEvidenceIds: [],
      knowledgeLookup: {
        sourceLocators: ["scripts/zone.ts:12"],
        query: "settlement from selected source",
      },
      developerPractice: {
        authority: "REFERENCE", status: "INVESTIGATION_HINTS_ONLY",
        items: [{
          patternId: "developer.hint.forms.stale-response",
          question: "Does the caller revalidate its session after await?",
          negativeControl: "The caller may already reject a stale response.",
          prohibits: "Do not infer a form bug from an unguarded helper alone.",
          matchingEvidenceIds: ["source:typed-show"],
          matchingSourcePaths: ["scripts/zone.ts"],
          matchingSignals: ["ActionFormData"],
          referenceCode: {
            path: "modules/forms/form-service.ts",
            sha256: "f".repeat(64),
            symbols: ["openForm"],
          },
          upstreamProbes: [{
            id: "probe.report.t1",
            sourcePath: "docs/test-runs/probe.md",
            status: "UPSTREAM_REPORTED_FAIL",
            summary: "External test result, not current-map proof.",
          }],
        }],
      },
    };
    const brief = formatSelectedMapAuditBrief({
      report,
      intent: {
        evidence: [{
          id: "site:zone", scope: "selected-artifact",
          locator: "scripts/zone.ts:12",
          origin: "source-code", summary: "Source defines zone",
        }],
        nodes: [], edges: [], invariants: [], unknowns: [],
      } as any,
      modelTaskPackets: [task],
      candidateGroups: [],
      validationTests: [{
        key: "zone:source-only",
        verificationMode: "STATIC_PROOF_COMPLETION",
        broadPlaythroughAllowed: false,
        findingIds: ["bug:zone"],
        issueTypes: ["BUG"], gameplayFlows: ["PROGRESSION"],
        test: "Resolve the selected-map session owner from source",
        assertions: [{findingId: "bug:zone", test: "Trace the guard"}],
        missingProof: ["Source guard"],
      }],
    });
    expect(brief.indexOf("## Immediate Decision")).toBeGreaterThan(0);
    expect(brief.indexOf("## Immediate Decision"))
      .toBeLessThan(brief.indexOf("## Detailed Source Navigation"));
    expect(brief.indexOf("## Immediate Decision"))
      .toBeLessThan(brief.indexOf("## Findings"));
    expect(brief).toContain("BUG 0 PROVEN / 1 NEED_VALIDATION");
    expect(brief).toContain("Admitted BUG root groups (not additional findings)");
    expect(brief).toContain("Pending deciding-proof groups (NOT defects)");
    expect(brief).toContain("1 source/formal group(s), 0 narrow-runtime group(s)");
    expect(brief).toContain("Next decision [PROVE / GAMEPLAY_TRANSLATION]");
    expect(brief).toContain("SOURCE_ROLE_CANDIDATE");
    expect(brief).toContain("NOT checkpoint proof");
    expect(brief).toContain("scripts/zone.ts:12");
    expect(brief).toContain("Does the caller revalidate its session after await?");
    expect(brief).toContain("Do not infer a form bug from an unguarded helper alone.");
    expect(brief).toContain("External probe (NOT selected map proof)");
    expect(brief).not.toContain("UPSTREAM_REPORTED_FAIL is a proven map bug");
  });

});
