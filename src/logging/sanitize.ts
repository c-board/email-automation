export function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/sk-[A-Za-z0-9_-]+/g, "[Redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [Redacted]")
    .replace(/ya29\.[A-Za-z0-9._\-]+/g, "[Redacted]");
}

export function errorText(error: unknown): string {
  if (error instanceof Error) {
    return sanitizeErrorMessage(error.message);
  }
  return "Unknown error";
}
