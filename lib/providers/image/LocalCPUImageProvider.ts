import type { ImageProvider, ResolvedImagePrompt, GeneratedImageResult } from './ImageProvider';
import { ProviderRequestError, ProviderTimeoutError } from '@/lib/providers/ai/GeminiTextProvider';

const DEFAULT_BASE_URL = 'http://localhost:8000';

const DEFAULT_INFERENCE_STEPS = 3;
const DEFAULT_GUIDANCE_SCALE = 1.0;

export class LocalCPUImageProvider implements ImageProvider {
  readonly name = 'local-cpu';

  private get baseUrl(): string {
    return process.env.LOCAL_SD_API_URL || DEFAULT_BASE_URL;
  }

  async generateImage(prompt: ResolvedImagePrompt): Promise<GeneratedImageResult> {
    const text = formatPromptForLocalSD(prompt);
    const { width, height } = mapAspectRatioToDimensions(prompt.aspectRatio);
    const url = `${this.baseUrl}/api/generate`;

    const body = {
      prompt: text,
      negative_prompt: prompt.negativeRequirements || '',
      diffusion_task: 'text_to_image',
      image_width: width,
      image_height: height,
      inference_steps: Number(process.env.LOCAL_SD_STEPS) || DEFAULT_INFERENCE_STEPS,
      guidance_scale: DEFAULT_GUIDANCE_SCALE,
      number_of_images: 1,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      if ((err as Error).name === 'AbortError') {
        throw new ProviderTimeoutError('Local CPU image generation timed out — CPU inference can be slow; consider a lighter model or fewer steps in FastSD CPU.');
      }
      throw new ProviderRequestError(
        `Could not reach FastSD CPU at ${this.baseUrl}. Is it running with "python src/app.py --api"? (${(err as Error).message})`,
      );
    }
    clearTimeout(timeout);

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new ProviderRequestError(`FastSD CPU responded with status ${res.status}.`, errBody.slice(0, 500));
    }

    const data = await res.json().catch(() => null);
    const base64 = extractFirstImageBase64(data);

    if (!base64) {
      console.error('Unexpected FastSD CPU response shape:', JSON.stringify(data).slice(0, 500));
      throw new ProviderRequestError(
        'Could not find an image in the FastSD CPU response — its API shape may have changed. Check http://localhost:8000/api/docs and adjust extractFirstImageBase64().',
      );
    }

    return {
      assetUrl: `data:image/jpeg;base64,${base64}`,
      model: process.env.LOCAL_SD_MODEL || 'fastsdcpu-local',
      provider: this.name,
    };
  }
}

function extractFirstImageBase64(data: unknown): string | null {
  if (!data) return null;
  if (typeof data === 'string') return stripDataUrlPrefix(data);

  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.images) && typeof obj.images[0] === 'string') return stripDataUrlPrefix(obj.images[0] as string);
  if (typeof obj.image === 'string') return stripDataUrlPrefix(obj.image);
  return null;
}

function stripDataUrlPrefix(s: string): string {
  const match = s.match(/^data:.+?;base64,(.+)$/);
  return match ? match[1] : s;
}

function formatPromptForLocalSD(p: ResolvedImagePrompt): string {
  return [
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
}

function mapAspectRatioToDimensions(aspectRatio: string): { width: number; height: number } {
  switch (aspectRatio) {
    case '1:1':
      return { width: 512, height: 512 };
    case '16:9':
      return { width: 512, height: 288 };
    case '4:5':
      return { width: 512, height: 640 };
    case '9:16':
    default:
      return { width: 512, height: 912 };
  }
}