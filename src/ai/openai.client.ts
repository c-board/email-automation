import OpenAI from "openai";

export function createOpenAiClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
}
