import type { ImageProvider } from './ImageProvider';
import { GeminiImageProvider } from './GeminiImageProvider';
import { PollinationsImageProvider } from './PollinationsImageProvider';
import { StableDiffusionImageProvider } from './StableDiffusionImageProvider';
import { LocalCPUImageProvider } from './LocalCPUImageProvider';
import { UnsplashImageProvider } from './UnsplashImageProvider';
import { FallbackImageProvider } from './FallbackImageProvider';

/**
 * The single entry point every service should use to get an image
 * provider — never import a concrete provider class directly outside
 * this file.
 *
 * Primary provider — IMAGE_PROVIDER:
 *   - unset or "gemini" → GeminiImageProvider (paid, higher quality, needs
 *     GEMINI_API_KEY + billing enabled on that Google Cloud project)
 *   - "pollinations" → PollinationsImageProvider (free, no key, lower
 *     quality/consistency — see that file's doc comment for tradeoffs)
 *   - "stable-diffusion" → StableDiffusionImageProvider, hosted API
 *     (needs STABILITY_API_KEY)
 *   - "local-cpu" → LocalCPUImageProvider, free + no API key, but needs
 *     a FastSD CPU server running locally (see that file's doc comment)
 *   - "unsplash" → UnsplashImageProvider — NOT generative, searches real
 *     stock photos instead (needs UNSPLASH_ACCESS_KEY, free tier capped
 *     at 50 requests/hour). See that file's doc comment for when this is
 *     and isn't a good fit.
 *
 * Fallback provider (optional) — IMAGE_PROVIDER_FALLBACK:
 *   Same values as above. If set, and the primary provider throws for
 *   any reason other than a missing API key, the fallback is tried once
 *   before the call fails. Leave unset to disable fallback entirely
 *   (matches old behavior).
 *
 * Changing either env var requires restarting the dev/prod server —
 * Next.js only reads .env at startup.
 */
let _instance: ImageProvider | null = null;
let _instanceKey: string | null = null;

function buildProvider(key: string): ImageProvider {
  switch (key) {
    case 'pollinations':
      return new PollinationsImageProvider();
    case 'stable-diffusion':
      return new StableDiffusionImageProvider();
    case 'local-cpu':
      return new LocalCPUImageProvider();
    case 'unsplash':
      return new UnsplashImageProvider();
    case 'gemini':
    default:
      return new GeminiImageProvider();
  }
}

export function getImageProvider(): ImageProvider {
  const primaryKey = (process.env.IMAGE_PROVIDER || 'gemini').toLowerCase();
  const fallbackKey = (process.env.IMAGE_PROVIDER_FALLBACK || '').toLowerCase();
  const cacheKey = `${primaryKey}|${fallbackKey}`;

  if (_instance && _instanceKey === cacheKey) return _instance;

  const primary = buildProvider(primaryKey);
  _instance = fallbackKey && fallbackKey !== primaryKey ? new FallbackImageProvider(primary, buildProvider(fallbackKey)) : primary;
  _instanceKey = cacheKey;
  return _instance;
}

// Providers that search existing photos rather than generate anything.
// Anything upstream of actual image generation that assumes a generative
// renderer (e.g. writing a hyper-specific, exact-character prompt) needs
// to check this and behave differently — see imagePromptService.ts.
const SEARCH_BASED_PROVIDERS = new Set(['unsplash']);

/** True when the currently configured PRIMARY provider is search-based (e.g. Unsplash), not generative. Only checks the primary — a fallback provider's nature doesn't change what the primary is optimized to ask for. */
export function isPrimaryImageProviderSearchBased(): boolean {
  const primaryKey = (process.env.IMAGE_PROVIDER || 'gemini').toLowerCase();
  return SEARCH_BASED_PROVIDERS.has(primaryKey);
}