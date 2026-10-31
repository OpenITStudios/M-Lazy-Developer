import{describe,expect,it}from"vitest";import{diagnosticDispositionForDefectResolution}from"../../src/diagnosis/defect-resolution-diagnostic-disposition.js";describe("defect resolution diagnostic disposition",()=>{it("maps authority explicitly",()=>{expect(diagnosticDispositionForDefectResolution("CONFIRMED_DEFECT_READY")).toBe("confirmed-defect");expect(diagnosticDispositionForDefectResolution("RUNTIME_PROOF_REQUIRED")).toBe("runtime-proof-required");expect(diagnosticDispositionForDefectResolution("DETECTION_GAP")).toBe("insufficient-evidence");});});
describe("issue type to diagnostic disposition", () => {
  it("preserves canonical BUG and DESIGN_MISMATCH classification without changing other proof dispositions", () => {
    expect(diagnosticDispositionForDefectResolution("CONFIRMED_DEFECT_READY", "BUG"))
      .toBe("confirmed-defect");
    expect(diagnosticDispositionForDefectResolution("CONFIRMED_DEFECT_READY", "DESIGN_MISMATCH"))
      .toBe("design-review");
    expect(diagnosticDispositionForDefectResolution("RUNTIME_PROOF_REQUIRED", "DESIGN_MISMATCH"))
      .toBe("runtime-proof-required");
  });
});
