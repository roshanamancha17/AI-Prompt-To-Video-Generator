import type { ImageProvider, ResolvedImagePrompt, GeneratedImageResult } from './ImageProvider';
import { ProviderConfigError, ProviderRequestError, ProviderTimeoutError } from '@/lib/providers/ai/GeminiTextProvider';

const UNSPLASH_SEARCH_URL = 'https://api.unsplash.com/search/photos';

interface UnsplashPhoto {
  id: string;
  urls: { regular: string; full: string };
  links: { download_location: string };
  user: { name: string; links: { html: string } };
}

/**
 * Unsplash — searches EXISTING real stock photos, it does not generate
 * anything. imagePromptService.ts checks isPrimaryImageProviderSearchBased()
 * (registry.ts) and, when this provider is active, writes a short,
 * generic, search-friendly subject/environment instead of the detailed
 * exact-character prompt Gemini/SD get — so by the time a prompt reaches
 * here it should already be search-shaped, not something this provider
 * needs to distill itself.
 *
 * Good fit for generic B-roll/mood shots ("busy city street at night").
 * Weak fit for anything needing a specific character or exact staged
 * composition — there's no guarantee a matching photo exists, only a
 * best-effort search.
 *
 * Free tier ("Demo" apps, unreviewed) is capped at 50 requests/hour —
 * fine for personal use, but there's no billing to raise it if you were
 * ever running this at any real volume.
 */
export class UnsplashImageProvider implements ImageProvider {
  readonly name = 'unsplash';

  private get accessKey(): string {
    const key = process.env.UNSPLASH_ACCESS_KEY;
    if (!key) throw new ProviderConfigError('UNSPLASH_ACCESS_KEY is not configured.');
    return key;
  }

  async generateImage(prompt: ResolvedImagePrompt): Promise<GeneratedImageResult> {
    const orientation = mapAspectRatioToOrientation(prompt.aspectRatio);

    // Three-tier fallback: the full query (subject + action + environment)
    // has the best chance of actually matching what the scene needs, but
    // "action" carries the most specific/unusual language (gestures,
    // activities) and is the most likely single term to zero out a
    // search — so each fallback tier drops the most specific piece first.
    const tiers = [
      [prompt.subject, prompt.action, prompt.environment],
      [prompt.subject, prompt.environment],
      [prompt.environment],
    ]
      .map((parts) => parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim())
      .filter((q, i, arr) => q && arr.indexOf(q) === i); // drop empties and exact duplicates between tiers

    let photo: UnsplashPhoto | null = null;
    for (const query of tiers) {
      photo = await this.searchPhotos(query, orientation);
      if (photo) {
        console.info(`Unsplash: matched on query "${query}"`);
        break;
      }
      console.warn(`Unsplash: no results for "${query}", trying next fallback tier`);
    }

    if (!photo) {
      throw new ProviderRequestError(
        `Unsplash had no results across any fallback tier (tried: ${tiers.join(' | ')}) — this scene may be too specific for a stock-photo match.`,
      );
    }

    // Unlike every other provider here, Unsplash hands back a real https
    // URL, not raw image bytes — but GeneratedImageResult.assetUrl is a
    // data: URL contract every downstream consumer (imageGenerationService's
    // dataUrlToBuffer) relies on. Fetch the actual bytes and convert,
    // matching that shared contract, rather than special-casing one
    // provider's format further downstream.
    const imageRes = await fetch(photo.urls.regular);
    if (!imageRes.ok) {
      throw new ProviderRequestError(`Could not download the selected Unsplash photo (status ${imageRes.status}).`);
    }
    const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await imageRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Best-effort attribution ping — required by Unsplash's API
    // guidelines when a photo is actually used, but must never block or
    // fail the actual generation if it errors.
    fetch(`${photo.links.download_location}&client_id=${this.accessKey}`).catch(() => {});

    return {
      assetUrl: `data:${contentType};base64,${base64}`,
      model: 'unsplash-search',
      provider: this.name,
    };
  }

  /** Runs one search, returns a random pick among the top results, or null if there were none. */
  private async searchPhotos(query: string, orientation: 'landscape' | 'portrait' | 'squarish'): Promise<UnsplashPhoto | null> {
    const url = `${UNSPLASH_SEARCH_URL}?query=${encodeURIComponent(query)}&orientation=${orientation}&per_page=10`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Client-ID ${this.accessKey}` },
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      if ((err as Error).name === 'AbortError') throw new ProviderTimeoutError('Unsplash request timed out.');
      throw new ProviderRequestError('Could not reach Unsplash.', err);
    }
    clearTimeout(timeout);

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      // 403 on Unsplash's search endpoint is almost always the 50/hour
      // Demo-tier rate limit, not a bad key — worth calling out distinctly
      // since it reads as an auth failure otherwise.
      if (res.status === 403) {
        throw new ProviderRequestError('Unsplash rate limit likely hit (Demo apps are capped at 50 requests/hour).', body.slice(0, 300));
      }
      throw new ProviderRequestError(`Unsplash responded with status ${res.status}.`, body.slice(0, 300));
    }

    const data = (await res.json()) as { results: UnsplashPhoto[] };
    if (!data.results?.length) return null;

    // Pick randomly among the top results rather than always the first —
    // otherwise every scene sharing similar keywords ends up with the
    // exact same photo.
    return data.results[Math.floor(Math.random() * Math.min(data.results.length, 5))];
  }
}

function mapAspectRatioToOrientation(aspectRatio: string): 'landscape' | 'portrait' | 'squarish' {
  switch (aspectRatio) {
    case '1:1':
      return 'squarish';
    case '16:9':
      return 'landscape';
    case '9:16':
    case '4:5':
    default:
      return 'portrait';
  }
}