import type { ImageProvider, ResolvedImagePrompt, GeneratedImageResult } from './ImageProvider';
import { ProviderRequestError, ProviderTimeoutError } from '@/lib/providers/ai/GeminiTextProvider';
import { isTransientStatus, DEFAULT_BACKOFF_MS, sleep } from '@/lib/providers/retryHelpers';

const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt';
const MODEL = 'flux';

/**
 * Pollinations.ai — a free, open-source, no-API-key image generation
 * service (verified at build time: GET https://image.pollinations.ai/prompt/{prompt}
 * returns raw image bytes directly, Flux model, unlimited on the public
 * endpoint). No signup, no billing.
 *
 * Tradeoffs vs GeminiImageProvider, so the person choosing this knows what
 * they're giving up:
 * - Takes one flowing text prompt, not separate structured fields — this
 *   provider folds the structured ResolvedImagePrompt into one paragraph,
 *   which Flux follows more loosely than Gemini follows structured input.
 * - No true negative-prompt support — "what to avoid" is appended as a
 *   soft instruction in the same prompt, not enforced.
 * - No SLA/uptime guarantee — it's a free community service; its backend
 *   returns "Queue full" (503) under load fairly often, which is why this
 *   provider retries automatically before giving up.
 * - Character continuity across scenes is looser than Gemini's.
 */
export class PollinationsImageProvider implements ImageProvider {
  readonly name = 'pollinations';

  async generateImage(prompt: ResolvedImagePrompt): Promise<GeneratedImageResult> {
    const text = formatPromptForPollinations(prompt);
    const { width, height } = mapAspectRatioToDimensions(prompt.aspectRatio);
    const url = `${POLLINATIONS_BASE}/${encodeURIComponent(text)}?width=${width}&height=${height}&nologo=true&model=${MODEL}`;
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45_000);

      let res: Response;
      try {
        res = await fetch(url, { signal: controller.signal });
      } catch (err) {
        clearTimeout(timeout);
        if ((err as Error).name === 'AbortError') throw new ProviderTimeoutError('Pollinations request timed out.');
        throw new ProviderRequestError('Could not reach Pollinations.', err);
      }
      clearTimeout(timeout);

      if (res.ok) {
        const contentType = res.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await res.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        return { assetUrl: `data:${contentType};base64,${base64}`, model: MODEL, provider: this.name };
      }

      const body = await res.text().catch(() => '');
      const isLastAttempt = attempt === maxAttempts;

      if (!isTransientStatus(res.status) || isLastAttempt) {
        console.error(`Pollinations API error ${res.status}:`, body.slice(0, 500));
        throw new ProviderRequestError(`Pollinations responded with status ${res.status}.`);
      }

      const waitMs = DEFAULT_BACKOFF_MS[attempt - 1] ?? 9000;
      console.warn(`Pollinations ${res.status} — likely queue-full, retrying in ${Math.round(waitMs / 1000)}s (attempt ${attempt}/${maxAttempts})`);
      await sleep(waitMs);
    }

    throw new ProviderRequestError('Pollinations did not respond successfully after multiple attempts.');
  }
}

function formatPromptForPollinations(p: ResolvedImagePrompt): string {
  const parts = [
    p.subject,
    `in ${p.environment}`,
    p.action ? `, ${p.action}` : '',
    `, ${p.emotion} mood`,
    `, ${p.lighting}`,
    `, ${p.camera}`,
    `, ${p.style}`,
    `, ${p.composition}`,
    ', realistic cinematic photography, no text or watermarks in the image',
    p.negativeRequirements ? `, avoid: ${p.negativeRequirements}` : '',
  ];
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function mapAspectRatioToDimensions(aspectRatio: string): { width: number; height: number } {
  switch (aspectRatio) {
    case '1:1':
      return { width: 1080, height: 1080 };
    case '16:9':
      return { width: 1920, height: 1080 };
    case '4:5':
      return { width: 1080, height: 1350 };
    case '9:16':
    default:
      return { width: 1080, height: 1920 };
  }
}
