import type { ProcessedMessageStore, SaveProcessedInput } from "../database/workflow-store.js";

export function createInMemoryProcessedMessageLookup(): ProcessedMessageStore {
  const seen = new Set<string>();

  async function hasBeenProcessed(gmailMessageId: string): Promise<boolean> {
    return seen.has(gmailMessageId);
  }

  async function saveProcessed(input: SaveProcessedInput): Promise<{
    applicationStored: boolean;
    duplicateApplication: boolean;
  }> {
    seen.add(input.gmailMessageId);
    return {
      applicationStored: input.application !== null,
      duplicateApplication: false,
    };
  }

  return { hasBeenProcessed, saveProcessed };
}
