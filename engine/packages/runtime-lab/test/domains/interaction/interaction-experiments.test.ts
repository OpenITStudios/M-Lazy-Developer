import { describe, expect, it } from "vitest";
import {
 createCooldownExperiment, createEntityInteractionAndPermissionExperiment,
 createInteractionContextExperiment, createUseLifecycleExperiment,
} from "../../../src/domains/interaction/interaction-experiments.js";
import { validateRuntimeExperimentDefinition } from "../../../src/index.js";
const base={id:"i",title:"i",targetProfileFingerprint:"p",fixtureFingerprint:"f",playerKey:"player",objectiveId:"probe",participant:"player"};
describe("interaction experiments",()=>{it("builds valid reusable interaction families",()=>{for(const d of [createUseLifecycleExperiment(base),createCooldownExperiment(base),createInteractionContextExperiment(base),createEntityInteractionAndPermissionExperiment(base)])expect(validateRuntimeExperimentDefinition(d)).toEqual([]);});});
