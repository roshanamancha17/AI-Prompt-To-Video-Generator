/** Extracts Gemini's suggested retryDelay (e.g. "42s") from an error response body, if present. */
export function parseRetryDelaySeconds(body: string): number | null {
  const match = body.match(/"retryDelay":\s*"(\d+(?:\.\d+)?)s"/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * A per-day quota being exceeded won't be fixed by waiting a few seconds
 * and retrying — that just wastes the attempt budget. Detected so callers
 * can fail fast with a clear message instead of retrying pointlessly.
 */
export function isDailyQuotaExceeded(body: string): boolean {
  return /PerDay/i.test(body);
}

/** Status codes worth retrying — rate limits and transient server-side overload/unavailability. */
export function isTransientStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

export const DEFAULT_BACKOFF_MS = [1500, 4000, 9000];

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
