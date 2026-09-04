import type { ZodSchema } from 'zod';

/**
 * Contract every text-generation provider must satisfy. Services call this
 * interface, never a vendor SDK directly, so swapping Gemini for another
 * provider later is a new class + registry entry — not a service rewrite.
 */
export interface AIProvider {
  readonly name: string;

  /**
   * Generate a response and validate it against `schema` before returning.
   * Implementations are responsible for prompting the model to return only
   * JSON, attempting a structured repair on the first validation failure,
   * and retrying once before throwing.
   *
   * `options.jsonSchema` is a plain JSON Schema mirror of `schema`, required
   * by providers (like Gemini) that accept a response schema directly.
   */
  generateStructured<T>(
    prompt: string,
    schema: ZodSchema<T>,
    options?: { jsonSchema: object; temperature?: number },
  ): Promise<T>;
}
