import { describe, expect, it } from "vitest";
import { emailClassificationSchema } from "../../src/ai/classifier.schema.js";

const validClassification = {
  classification: "APPLICATION_CONFIRMATION",
  confidence: 0.97,
  company: "Mux",
  position: "Senior Full Stack Engineer",
  applicationDate: "2026-10-06",
  reason: "The employer confirms the application was received.",
};

describe("emailClassificationSchema", function () {
  it("accepts a valid classification", function () {
    const parsed = emailClassificationSchema.parse(validClassification);
    expect(parsed.classification).toBe("APPLICATION_CONFIRMATION");
    expect(parsed.company).toBe("Mux");
    expect(parsed.position).toBe("Senior Full Stack Engineer");
  });

  it("turns blank optional text into null", function () {
    const parsed = emailClassificationSchema.parse({
      ...validClassification,
      company: "  ",
      position: "",
      applicationDate: null,
    });
    expect(parsed.company).toBeNull();
    expect(parsed.position).toBeNull();
    expect(parsed.applicationDate).toBeNull();
  });

  it("rejects an unknown classification", function () {
    const result = emailClassificationSchema.safeParse({
      ...validClassification,
      classification: "THANK_YOU",
    });
    expect(result.success).toBe(false);
  });

  it("rejects confidence outside 0 to 1", function () {
    expect(emailClassificationSchema.safeParse({ ...validClassification, confidence: 1.1 }).success).toBe(false);
    expect(emailClassificationSchema.safeParse({ ...validClassification, confidence: -0.01 }).success).toBe(false);
  });

  it("accepts confidence at the boundaries", function () {
    expect(emailClassificationSchema.safeParse({ ...validClassification, confidence: 0 }).success).toBe(true);
    expect(emailClassificationSchema.safeParse({ ...validClassification, confidence: 1 }).success).toBe(true);
  });

  it("rejects a payload that is missing fields", function () {
    expect(emailClassificationSchema.safeParse({}).success).toBe(false);
    expect(emailClassificationSchema.safeParse({ ...validClassification, reason: "  " }).success).toBe(false);
  });
});
