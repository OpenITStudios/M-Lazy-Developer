import { describe, expect, it } from "vitest";
import { projectFindingClassification } from "../src/finding-report-projection.js";
const supported={disposition:"supported" as const,missingRequiredPredicates:[] as string[]};
describe("finding report projection",()=>{
 it("requires proven confidence for PROVEN BUG",()=>{
  expect(projectFindingClassification("confirmed-defect",{...supported,confidence:"high"}).reportClassification).toBe("LIKELY BUG");
  expect(projectFindingClassification("confirmed-defect",{...supported,confidence:"proven"})).toMatchObject({reportClassification:"PROVEN BUG",diagnosticDisposition:"confirmed-defect",proofConfidence:"proven"});
 });
 it("keeps design and expected behavior distinct",()=>{
  expect(projectFindingClassification("design-review",{...supported,confidence:"medium"}).reportClassification).toBe("DESIGN MISMATCH");
  expect(projectFindingClassification("designed-behavior",{...supported,confidence:"high"}).reportClassification).toBe("EXPECTED");
 });
 it("keeps runtime-proof-required unknown",()=>{
  expect(projectFindingClassification("runtime-proof-required",{disposition:"open",confidence:"low",missingRequiredPredicates:["runtime"]}).reportClassification).toBe("UNKNOWN");
 });
});