import type { ImageProvider, ResolvedImagePrompt, GeneratedImageResult } from './ImageProvider';
import { ProviderConfigError } from '@/lib/providers/ai/GeminiTextProvider';

/**
 * Wraps a primary ImageProvider with a secondary one to fall back to.
 * Tries primary first; if it throws for ANY reason (config, timeout,
 * quota, transient-after-retries, whatever), tries the fallback once
 * before giving up. Never partially retries — each wrapped provider
 * already does its own internal retry loop, so by the time an error
 * reaches here it means "this provider is genuinely not going to work
 * right now."
 *
 * `.name` reports the primary's name so existing callers/logging that
 * only check `.name` up front see no change; which provider actually
 * produced a given image is on GeneratedImageResult.provider instead,
 * since that can only be known after the call resolves.
 */
export class FallbackImageProvider implements ImageProvider {
  readonly name: string;

  constructor(
    private readonly primary: ImageProvider,
    private readonly fallback: ImageProvider,
  ) {
    this.name = primary.name;
  }

  async generateImage(prompt: ResolvedImagePrompt): Promise<GeneratedImageResult> {
    try {
      return await this.primary.generateImage(prompt);
    } catch (primaryErr) {
      // A missing API key for the primary is a setup mistake, not a
      // reason to silently start billing a different provider — surface
      // it plainly instead of masking it behind a fallback attempt.
      if (primaryErr instanceof ProviderConfigError) throw primaryErr;

      console.warn(
        `Image provider "${this.primary.name}" failed, falling back to "${this.fallback.name}":`,
        (primaryErr as Error).message,
      );

      try {
        return await this.fallback.generateImage(prompt);
      } catch (fallbackErr) {
        console.error(`Fallback provider "${this.fallback.name}" also failed:`, (fallbackErr as Error).message);
        // Surface the primary's error — it's the "real" provider the
        // person configured; the fallback's failure is logged above but
        // is generally the less actionable of the two messages.
        throw primaryErr;
      }
    }
  }
}