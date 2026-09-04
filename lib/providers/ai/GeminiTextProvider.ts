import type { ZodSchema } from 'zod';
import type { AIProvider } from './AIProvider';
import { isTransientStatus, isDailyQuotaExceeded, parseRetryDelaySeconds, DEFAULT_BACKOFF_MS, sleep } from '@/lib/providers/retryHelpers';

const GEMINI_TEXT_MODEL = 'gemini-3.5-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

interface GenerateOptions {
  /** Plain JSON Schema mirror of the Zod schema, passed as Gemini's response_schema. */
  jsonSchema: object;
  temperature?: number;
}

/**
 * Gemini implementation of AIProvider. Verified against the current Gemini
 * API docs (ai.google.dev/gemini-api/docs/structured-output — checked
 * 2026-08-14): POST /v1beta/models/{model}:generateContent with
 * response_mime_type: "application/json" and response_schema set together
 * guarantees schema-conformant JSON (response_mime_type alone is only a hint).
 */
export class GeminiTextProvider implements AIProvider {
  readonly name = 'gemini';

  private get apiKey(): string {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new ProviderConfigError('GEMINI_API_KEY is not configured.');
    return key;
  }

  async generateStructured<T>(prompt: string, schema: ZodSchema<T>, options?: GenerateOptions): Promise<T> {
    if (!options?.jsonSchema) {
      throw new Error('GeminiTextProvider.generateStructured requires options.jsonSchema (see call sites in lib/services).');
    }

    const raw = await this.callGemini(prompt, options.jsonSchema, options.temperature);
    const parsed = this.tryParse(raw);

    const firstAttempt = schema.safeParse(parsed);
    if (firstAttempt.success) return firstAttempt.data;

    // Structured repair: re-prompt with the validation error and ask for corrected JSON only.
    const repaired = await this.callGemini(
      `Your previous JSON response failed schema validation with this error:\n${JSON.stringify(
        firstAttempt.error.flatten(),
      )}\n\nHere was your response:\n${raw}\n\nReturn ONLY corrected JSON that fixes these issues and matches the required schema. No prose, no markdown fences.`,
      options.jsonSchema,
      options.temperature,
    );
    const repairedParsed = this.tryParse(repaired);
    const secondAttempt = schema.safeParse(repairedParsed);
    if (secondAttempt.success) return secondAttempt.data;

    throw new GenerationValidationError(
      'Gemini returned a response that could not be validated after a repair attempt.',
      secondAttempt.error,
    );
  }

  private async callGemini(prompt: string, jsonSchema: object, temperature = 0.9): Promise<string> {
    const url = `${GEMINI_API_BASE}/models/${GEMINI_TEXT_MODEL}:generateContent`;
    const maxAttempts = 4;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);

      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature,
              response_mime_type: 'application/json',
              response_schema: jsonSchema,
            },
          }),
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timeout);
        if ((err as Error).name === 'AbortError') {
          throw new ProviderTimeoutError('Gemini request timed out.');
        }
        throw new ProviderRequestError('Could not reach Gemini.', err);
      }
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof text !== 'string') {
          console.error('Unexpected Gemini response shape:', JSON.stringify(data).slice(0, 2000));
          throw new ProviderRequestError('Gemini returned an unexpected response shape.');
        }
        return text;
      }

      const body = await res.text().catch(() => '');
      const isLastAttempt = attempt === maxAttempts;
      // A daily quota being exhausted won't be fixed by waiting a few
      // seconds — fail immediately instead of burning the retry budget.
      const worthRetrying = isTransientStatus(res.status) && !isDailyQuotaExceeded(body);

      if (!worthRetrying || isLastAttempt) {
        // Full detail logged server-side only — never surfaced to the client.
        console.error(`Gemini API error ${res.status}:`, body);
        throw new ProviderRequestError(`Gemini API responded with status ${res.status}.`);
      }

      const suggestedDelaySec = parseRetryDelaySeconds(body);
      const waitMs = suggestedDelaySec ? suggestedDelaySec * 1000 : (DEFAULT_BACKOFF_MS[attempt - 1] ?? 9000);
      console.warn(`Gemini API ${res.status} (attempt ${attempt}/${maxAttempts}) — retrying in ${Math.round(waitMs / 1000)}s`);
      await sleep(Math.min(waitMs, 45_000));
    }

    throw new ProviderRequestError('Gemini API did not respond successfully after multiple attempts.');
  }

  private tryParse(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      // Strip markdown fences some models still add despite JSON mode.
      const stripped = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      try {
        return JSON.parse(stripped);
      } catch {
        return null;
      }
    }
  }
}

export class ProviderConfigError extends Error {}
export class ProviderTimeoutError extends Error {}
export class ProviderRequestError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
  }
}
export class GenerationValidationError extends Error {
  constructor(message: string, public zodError: unknown) {
    super(message);
  }
}

let _instance: GeminiTextProvider | null = null;
export function getAIProvider(): AIProvider {
  if (!_instance) _instance = new GeminiTextProvider();
  return _instance;
}
