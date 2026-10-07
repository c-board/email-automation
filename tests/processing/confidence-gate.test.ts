import { describe, expect, it } from "vitest";
import { applyConfidenceGate } from "../../src/processing/confidence-gate.js";

const thresholds = {
  autoActionConfidence: 0.95,
  reviewConfidence: 0.8,
};

describe("applyConfidenceGate", function () {
  it("allows automatic action at 95%", function () {
    const decision = applyConfidenceGate("REJECTION", 0.95, thresholds);
    expect(decision.band).toBe("auto");
    expect(decision.effectiveClassification).toBe("REJECTION");
  });

  it("logs but does not treat 94.9% as automatic", function () {
    const decision = applyConfidenceGate("REJECTION", 0.949, thresholds);
    expect(decision.band).toBe("review");
    expect(decision.effectiveClassification).toBe("REJECTION");
  });

  it("keeps the classification in the review band at 80%", function () {
    const decision = applyConfidenceGate("INTERVIEW", 0.8, thresholds);
    expect(decision.band).toBe("review");
    expect(decision.effectiveClassification).toBe("INTERVIEW");
  });

  it("treats confidence below 80% as UNKNOWN", function () {
    const decision = applyConfidenceGate("REJECTION", 0.799, thresholds);
    expect(decision.band).toBe("below_review");
    expect(decision.effectiveClassification).toBe("UNKNOWN");
  });
});
