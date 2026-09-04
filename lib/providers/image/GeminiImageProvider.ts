import type { ImageProvider, ResolvedImagePrompt, GeneratedImageResult } from './ImageProvider';
import { ProviderConfigError, ProviderRequestError, ProviderTimeoutError } from '@/lib/providers/ai/GeminiTextProvider';
import { isTransientStatus, isDailyQuotaExceeded, parseRetryDelaySeconds, DEFAULT_BACKOFF_MS, sleep } from '@/lib/providers/retryHelpers';

const GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Gemini native image generation ("Nano Banana"). Imagen-family models are
 * deprecated (shutdown Aug 17, 2026) — this uses generateContent with
 * response_modalities: ["TEXT", "IMAGE"], reading the result out of
 * candidates[0].content.parts[].inlineData. Verified against
 * ai.google.dev/gemini-api/docs/generate-content/image-generation at build
 * time — re-check before changing GEMINI_IMAGE_MODEL, this space moves fast.
 */
export class GeminiImageProvider implements ImageProvider {
  readonly name = 'gemini';

  private get apiKey(): string {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new ProviderConfigError('GEMINI_API_KEY is not configured.');
    return key;
  }

  async generateImage(prompt: ResolvedImagePrompt): Promise<GeneratedImageResult> {
    const text = formatPromptForGemini(prompt);
    const url = `${GEMINI_API_BASE}/models/${GEMINI_IMAGE_MODEL}:generateContent`;
    const maxAttempts = 4;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);

      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text }] }],
            generationConfig: { response_modalities: ['TEXT', 'IMAGE'] },
          }),
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timeout);
        if ((err as Error).name === 'AbortError') throw new ProviderTimeoutError('Gemini image request timed out.');
        throw new ProviderRequestError('Could not reach Gemini image generation.', err);
      }
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const parts = data?.candidates?.[0]?.content?.parts ?? [];
        const imagePart = parts.find((p: { inlineData?: { data: string; mimeType: string } }) => p.inlineData);

        if (!imagePart?.inlineData?.data) {
          console.error('No image data in Gemini response:', JSON.stringify(data).slice(0, 2000));
          throw new ProviderRequestError('Gemini did not return an image for this prompt.');
        }

        // The base64 payload is handed back to the caller (imageGenerationService),
        // which uploads it through StorageProvider — this class never touches storage.
        return {
          assetUrl: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`,
          model: GEMINI_IMAGE_MODEL,
          provider: this.name,
        };
      }

      const body = await res.text().catch(() => '');
      const isLastAttempt = attempt === maxAttempts;
      // A daily/free-tier quota of 0 won't be fixed by retrying — fail fast.
      const worthRetrying = isTransientStatus(res.status) && !isDailyQuotaExceeded(body);

      if (!worthRetrying || isLastAttempt) {
        console.error(`Gemini image API error ${res.status}:`, body);
        throw new ProviderRequestError(`Gemini image API responded with status ${res.status}.`);
      }

      const suggestedDelaySec = parseRetryDelaySeconds(body);
      const waitMs = suggestedDelaySec ? suggestedDelaySec * 1000 : (DEFAULT_BACKOFF_MS[attempt - 1] ?? 9000);
      console.warn(`Gemini image API ${res.status} (attempt ${attempt}/${maxAttempts}) — retrying in ${Math.round(waitMs / 1000)}s`);
      await sleep(Math.min(waitMs, 45_000));
    }

    throw new ProviderRequestError('Gemini image API did not respond successfully after multiple attempts.');
  }
}

function formatPromptForGemini(p: ResolvedImagePrompt): string {
  return [
    `SUBJECT: ${p.subject}`,
    `ENVIRONMENT: ${p.environment}`,
    p.action ? `ACTION: ${p.action}` : '',
    `EMOTION: ${p.emotion}`,
    `LIGHTING: ${p.lighting}`,
    `CAMERA: ${p.camera}`,
    `STYLE: ${p.style}`,
    `COMPOSITION: ${p.composition}`,
    `ASPECT RATIO: ${p.aspectRatio}`,
    p.negativeRequirements ? `NEGATIVE REQUIREMENTS (do not include): ${p.negativeRequirements}` : '',
    'Realistic cinematic photography. Do not include any text, watermarks, or logos in the image unless explicitly requested above.',
  ]
    .filter(Boolean)
    .join('\n');
}
