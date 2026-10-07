export type ProcessedMessageLookup = {
  hasBeenProcessed: (gmailMessageId: string) => Promise<boolean>;
  markProcessed: (gmailMessageId: string) => Promise<void>;
};

// Remembers ids for the current process only. Database persistence replaces this in a later milestone.
export function createInMemoryProcessedMessageLookup(): ProcessedMessageLookup {
  const seen = new Set<string>();

  async function hasBeenProcessed(gmailMessageId: string): Promise<boolean> {
    return seen.has(gmailMessageId);
  }

  async function markProcessed(gmailMessageId: string): Promise<void> {
    seen.add(gmailMessageId);
  }

  return { hasBeenProcessed, markProcessed };
}
