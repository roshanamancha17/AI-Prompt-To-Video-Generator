import type { ImageProvider, ResolvedImagePrompt, GeneratedImageResult } from './ImageProvider';
import { ProviderConfigError, ProviderRequestError, ProviderTimeoutError } from '@/lib/providers/ai/GeminiTextProvider';
import { isTransientStatus, DEFAULT_BACKOFF_MS, sleep } from '@/lib/providers/retryHelpers';

const STABILITY_API_BASE = 'https://api.stability.ai/v2beta/stable-image/generate/sd3';

// sd3.5-large: best quality/prompt-following, slowest + most expensive.
// sd3.5-large-turbo: ~4x faster, small quality tradeoff.
// sd3.5-medium: cheapest, lowest quality — fine as a last-resort fallback.
// Override with STABILITY_SD_MODEL; verify current model names/pricing at
// platform.stability.ai/docs before changing, this list shifts over time.
const DEFAULT_MODEL = 'sd3.5-large';

const SUPPORTED_ASPECT_RATIOS = new Set(['1:1', '16:9', '9:16', '4:5', '5:4', '21:9', '9:21', '4:3', '3:4']);

/**
 * Real Stable Diffusion (3.5 family) via Stability AI's official hosted API.
 * Intended as a fallback behind GeminiImageProvider — see
 * lib/providers/image/registry.ts for how the fallback chain is wired.
 *
 * API reference: platform.stability.ai/docs/api-reference — POST with
 * multipart/form-data, Accept: image/* returns raw image bytes directly
 * (no base64 round-trip needed like the JSON response mode does).
 */
export class StableDiffusionImageProvider implements ImageProvider {
  readonly name = 'stable-diffusion';

  private get apiKey(): string {
    const key = process.env.STABILITY_API_KEY;
    if (!key) throw new ProviderConfigError('STABILITY_API_KEY is not configured.');
    return key;
  }

  private get model(): string {
    return process.env.STABILITY_SD_MODEL || DEFAULT_MODEL;
  }

  async generateImage(prompt: ResolvedImagePrompt): Promise<GeneratedImageResult> {
    const { positive, negative } = formatPromptForStableDiffusion(prompt);
    const aspectRatio = SUPPORTED_ASPECT_RATIOS.has(prompt.aspectRatio) ? prompt.aspectRatio : '9:16';
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const form = new FormData();
      form.append('prompt', positive);
      if (negative) form.append('negative_prompt', negative);
      form.append('model', this.model);
      form.append('aspect_ratio', aspectRatio);
      form.append('output_format', 'png');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);

      let res: Response;
      try {
        res = await fetch(STABILITY_API_BASE, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Accept: 'image/*',
          },
          body: form,
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timeout);
        if ((err as Error).name === 'AbortError') throw new ProviderTimeoutError('Stable Diffusion request timed out.');
        throw new ProviderRequestError('Could not reach Stability AI.', err);
      }
      clearTimeout(timeout);

      if (res.ok) {
        const contentType = res.headers.get('content-type') || 'image/png';
        const arrayBuffer = await res.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        return {
          assetUrl: `data:${contentType};base64,${base64}`,
          model: this.model,
          provider: this.name,
        };
      }

      const body = await res.text().catch(() => '');
      const isLastAttempt = attempt === maxAttempts;
      const outOfCredits = res.status === 403 && /credit/i.test(body);

      if (!isTransientStatus(res.status) || outOfCredits || isLastAttempt) {
        console.error(`Stability AI API error ${res.status}:`, body.slice(0, 500));
        throw new ProviderRequestError(`Stability AI responded with status ${res.status}.`);
      }

      const waitMs = DEFAULT_BACKOFF_MS[attempt - 1] ?? 9000;
      console.warn(`Stability AI ${res.status} — retrying in ${Math.round(waitMs / 1000)}s (attempt ${attempt}/${maxAttempts})`);
      await sleep(waitMs);
    }

    throw new ProviderRequestError('Stability AI did not respond successfully after multiple attempts.');
  }
}

function formatPromptForStableDiffusion(p: ResolvedImagePrompt): { positive: string; negative?: string } {
  const positive = [
    p.subject,
    `in ${p.environment}`,
    p.action ? `, ${p.action}` : '',
    `, ${p.emotion} mood`,
    `, ${p.lighting}`,
    `, ${p.camera}`,
    `, ${p.style}`,
    `, ${p.composition}`,
    ', realistic cinematic photography, no text or watermarks',
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { positive, negative: p.negativeRequirements || undefined };
}