import { describe, expect, it } from "vitest";
import { parseEnv, parseGoogleAuthEnv } from "../../src/config/env.js";

const required = {
  GOOGLE_CLIENT_ID: "client-id",
  GOOGLE_CLIENT_SECRET: "client-secret",
  GOOGLE_REFRESH_TOKEN: "refresh-token",
  OPENAI_API_KEY: "sk-test",
};

describe("parseEnv", function () {
  it("applies the read-only defaults", function () {
    const env = parseEnv(required);
    expect(env.dryRun).toBe(true);
    expect(env.openAiModel).toBe("gpt-5.4");
    expect(env.autoActionConfidence).toBe(0.95);
    expect(env.reviewConfidence).toBe(0.8);
    expect(env.protectedCompanies).toEqual(["Grainger"]);
    expect(env.gmailFetchLimit).toBe(20);
    expect(env.maxEmailBodyChars).toBe(30_000);
    expect(env.timezone).toBe("America/Chicago");
    expect(env.nodeEnv).toBe("development");
  });

  it("rejects a review threshold that is not below the automatic threshold", function () {
    expect(function () {
      parseEnv({
        ...required,
        REVIEW_CONFIDENCE: "0.95",
        AUTO_ACTION_CONFIDENCE: "0.95",
      });
    }).toThrow(/REVIEW_CONFIDENCE/);
  });

  it("parses a custom protected-company list", function () {
    const env = parseEnv({
      ...required,
      PROTECTED_COMPANIES: "Grainger, Initech",
    });
    expect(env.protectedCompanies).toEqual(["Grainger", "Initech"]);
  });
});

describe("parseGoogleAuthEnv", function () {
  it("does not require a refresh token or OpenAI key", function () {
    const env = parseGoogleAuthEnv({
      GOOGLE_CLIENT_ID: "client-id",
      GOOGLE_CLIENT_SECRET: "client-secret",
    });
    expect(env.googleClientId).toBe("client-id");
    expect(env.googleClientSecret).toBe("client-secret");
  });
});
