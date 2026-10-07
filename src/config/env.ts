import dotenv from "dotenv";
import { z } from "zod";
import {
  DEFAULT_DATABASE_URL,
  DEFAULT_FETCH_LIMIT,
  DEFAULT_MAX_EMAIL_BODY_CHARS,
  DEFAULT_PROTECTED_COMPANIES,
} from "./constants.js";

const logLevels = ["fatal", "error", "warn", "info", "debug", "trace"] as const;

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REFRESH_TOKEN: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().min(1).default("gpt-5.4"),
  AUTO_ACTION_CONFIDENCE: z.coerce.number().gt(0).lte(1).default(0.95),
  REVIEW_CONFIDENCE: z.coerce.number().gte(0).lt(1).default(0.8),
  DRY_RUN: z.enum(["true", "false"]).default("true"),
  TIMEZONE: z.string().min(1).default("America/Chicago"),
  GMAIL_FETCH_LIMIT: z.coerce.number().int().positive().max(100).default(DEFAULT_FETCH_LIMIT),
  MAX_EMAIL_BODY_CHARS: z.coerce.number().int().positive().default(DEFAULT_MAX_EMAIL_BODY_CHARS),
  PROTECTED_COMPANIES: z.string().optional(),
  LOG_LEVEL: z.enum(logLevels).default("info"),
  DATABASE_URL: z.string().min(1).default(DEFAULT_DATABASE_URL),
});

const googleAuthSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
});

export type Env = {
  nodeEnv: "development" | "test" | "production";
  googleClientId: string;
  googleClientSecret: string;
  googleRefreshToken: string;
  openAiApiKey: string;
  openAiModel: string;
  autoActionConfidence: number;
  reviewConfidence: number;
  dryRun: boolean;
  timezone: string;
  gmailFetchLimit: number;
  maxEmailBodyChars: number;
  protectedCompanies: string[];
  logLevel: (typeof logLevels)[number];
  databaseUrl: string;
};

export type GoogleAuthEnv = {
  googleClientId: string;
  googleClientSecret: string;
};

type EnvSource = Record<string, string | undefined>;

function blankToUndefined(source: EnvSource): EnvSource {
  const normalized: EnvSource = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value !== "string") {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      normalized[key] = trimmed;
    }
  }
  return normalized;
}

function parseProtectedCompanies(value: string | undefined): string[] {
  if (value === undefined) {
    return [...DEFAULT_PROTECTED_COMPANIES];
  }
  const names = value
    .split(",")
    .map(function (name) {
      return name.trim();
    })
    .filter(function (name) {
      return name.length > 0;
    });
  if (names.length === 0) {
    return [...DEFAULT_PROTECTED_COMPANIES];
  }
  return names;
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map(function (issue) {
      const path = issue.path.length > 0 ? issue.path.join(".") : "env";
      return `${path}: ${issue.message}`;
    })
    .join("\n");
}

export function formatConfigError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return formatIssues(error);
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Invalid configuration";
}

export function parseEnv(source: EnvSource): Env {
  const parsed = envSchema.safeParse(blankToUndefined(source));
  if (!parsed.success) {
    throw new Error(formatIssues(parsed.error));
  }

  if (parsed.data.REVIEW_CONFIDENCE >= parsed.data.AUTO_ACTION_CONFIDENCE) {
    throw new Error("REVIEW_CONFIDENCE must be less than AUTO_ACTION_CONFIDENCE");
  }

  return {
    nodeEnv: parsed.data.NODE_ENV,
    googleClientId: parsed.data.GOOGLE_CLIENT_ID,
    googleClientSecret: parsed.data.GOOGLE_CLIENT_SECRET,
    googleRefreshToken: parsed.data.GOOGLE_REFRESH_TOKEN,
    openAiApiKey: parsed.data.OPENAI_API_KEY,
    openAiModel: parsed.data.OPENAI_MODEL,
    autoActionConfidence: parsed.data.AUTO_ACTION_CONFIDENCE,
    reviewConfidence: parsed.data.REVIEW_CONFIDENCE,
    dryRun: parsed.data.DRY_RUN === "true",
    timezone: parsed.data.TIMEZONE,
    gmailFetchLimit: parsed.data.GMAIL_FETCH_LIMIT,
    maxEmailBodyChars: parsed.data.MAX_EMAIL_BODY_CHARS,
    protectedCompanies: parseProtectedCompanies(parsed.data.PROTECTED_COMPANIES),
    logLevel: parsed.data.LOG_LEVEL,
    databaseUrl: parsed.data.DATABASE_URL,
  };
}

export function parseGoogleAuthEnv(source: EnvSource): GoogleAuthEnv {
  const parsed = googleAuthSchema.safeParse(blankToUndefined(source));
  if (!parsed.success) {
    throw new Error(formatIssues(parsed.error));
  }
  return {
    googleClientId: parsed.data.GOOGLE_CLIENT_ID,
    googleClientSecret: parsed.data.GOOGLE_CLIENT_SECRET,
  };
}

export function loadEnv(): Env {
  dotenv.config({ quiet: true });
  return parseEnv(process.env);
}

export function loadGoogleAuthEnv(): GoogleAuthEnv {
  dotenv.config({ quiet: true });
  return parseGoogleAuthEnv(process.env);
}
