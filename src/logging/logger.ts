import pino from "pino";
import type { Env } from "../config/env.js";

const REDACT_PATHS = [
  "refreshToken",
  "refresh_token",
  "access_token",
  "accessToken",
  "authorization",
  "apiKey",
  "api_key",
  "password",
  "clientSecret",
  "client_secret",
  "OPENAI_API_KEY",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN",
  "FASTMAIL_PASSWORD",
  "*.refreshToken",
  "*.refresh_token",
  "*.access_token",
  "*.accessToken",
  "*.authorization",
  "*.apiKey",
  "*.password",
  "*.clientSecret",
  "req.headers.authorization",
  "err.config.headers.Authorization",
  "err.config.headers.authorization",
  "response.config.headers.Authorization",
  "response.config.headers.authorization",
];

export type Logger = pino.Logger;

export async function createLogger(env: Pick<Env, "logLevel" | "nodeEnv">): Promise<Logger> {
  const options = {
    level: env.logLevel,
    redact: {
      paths: REDACT_PATHS,
      censor: "[Redacted]",
    },
  };

  if (env.nodeEnv !== "development") {
    return pino(options);
  }

  const prettyModule = await import("pino-pretty");
  const stream = prettyModule.default({
    colorize: true,
    translateTime: "SYS:standard",
    sync: true,
  });
  return pino(options, stream);
}
