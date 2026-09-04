import { Card, CardBody, CardHeader } from '@/components/ui/card';

const PROVIDERS = [
  { key: 'GEMINI_API_KEY', name: 'Gemini (text + strategy/script/scenes/social copy)', usedFor: 'Content strategy, script, scene, and social copy generation' },
  { key: 'ELEVENLABS_API_KEY', name: 'ElevenLabs', usedFor: 'Voiceover generation' },
  { key: 'STORAGE_ACCESS_KEY', name: 'Object storage', usedFor: 'Storing generated images and audio' },
  { key: 'YOUTUBE_CLIENT_ID', name: 'YouTube', usedFor: 'Channel Insights (syncing your videos to learn from past performance)' },
  { key: 'INSTAGRAM_CLIENT_ID', name: 'Instagram', usedFor: 'Publishing (Phase 7)' },
  { key: 'FACEBOOK_CLIENT_ID', name: 'Facebook', usedFor: 'Publishing (Phase 7)' },
  { key: 'X_CLIENT_ID', name: 'X / Twitter', usedFor: 'Publishing (Phase 7)' },
];

const IMAGE_PROVIDER_LABELS: Record<string, string> = {
  gemini: 'Gemini (paid, higher quality)',
  pollinations: 'Pollinations (free)',
  'stable-diffusion': 'Stable Diffusion / SD3.5 (paid, via Stability AI)',
  'local-cpu': 'Local CPU / FastSD CPU (free, offline)',
};

function isImageProviderConfigured(key: string): boolean {
  if (key === 'pollinations') return true;
  if (key === 'stable-diffusion') return Boolean(process.env.STABILITY_API_KEY);
  // No credential needed — but this only actually works while a FastSD
  // CPU server is running locally, which this check can't verify without
  // making a network call. "Configured" here just means "no missing
  // required env var," not "reachable right now."
  if (key === 'local-cpu') return true;
  return Boolean(process.env.GEMINI_API_KEY);
}

export default function ProviderStatusPage() {
  const imageProviderKey = (process.env.IMAGE_PROVIDER || 'gemini').toLowerCase();
  const imageProviderLabel = IMAGE_PROVIDER_LABELS[imageProviderKey] ?? imageProviderKey;
  const imageProviderConfigured = isImageProviderConfigured(imageProviderKey);

  const fallbackKey = (process.env.IMAGE_PROVIDER_FALLBACK || '').toLowerCase();
  const fallbackLabel = fallbackKey ? (IMAGE_PROVIDER_LABELS[fallbackKey] ?? fallbackKey) : null;
  const fallbackConfigured = fallbackKey ? isImageProviderConfigured(fallbackKey) : null;

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-semibold text-paper-100">API / Provider status</h1>
      <p className="mt-1 text-sm text-ink-500">
        Configuration is read from environment variables on the server. Keys themselves are never sent to the browser.
      </p>

      <div className="mt-6 space-y-2">
        <Card>
          <CardBody className="flex items-center justify-between py-3.5">
            <div>
              <p className="text-sm text-paper-100">Image generation</p>
              <p className="mt-0.5 text-xs text-ink-500">
                Active provider: <span className="text-paper-100">{imageProviderLabel}</span> — set via <code className="text-signal-amber">IMAGE_PROVIDER</code> in .env, restart required to change
              </p>
            </div>
            <span
              className={`rounded-sm px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${
                imageProviderConfigured ? 'bg-ready-mintDim text-ready-mint' : 'bg-ink-700 text-ink-500'
              }`}
            >
              {imageProviderConfigured ? 'Configured' : 'Not configured'}
            </span>
          </CardBody>
        </Card>

        {fallbackLabel && (
          <Card>
            <CardBody className="flex items-center justify-between py-3.5">
              <div>
                <p className="text-sm text-paper-100">Image generation fallback</p>
                <p className="mt-0.5 text-xs text-ink-500">
                  Falls back to: <span className="text-paper-100">{fallbackLabel}</span> if the primary provider fails — set via{' '}
                  <code className="text-signal-amber">IMAGE_PROVIDER_FALLBACK</code> in .env
                </p>
              </div>
              <span
                className={`rounded-sm px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${
                  fallbackConfigured ? 'bg-ready-mintDim text-ready-mint' : 'bg-ink-700 text-ink-500'
                }`}
              >
                {fallbackConfigured ? 'Configured' : 'Not configured'}
              </span>
            </CardBody>
          </Card>
        )}

        {PROVIDERS.map((p) => {
          const configured = Boolean(process.env[p.key]);
          return (
            <Card key={p.key}>
              <CardBody className="flex items-center justify-between py-3.5">
                <div>
                  <p className="text-sm text-paper-100">{p.name}</p>
                  <p className="mt-0.5 text-xs text-ink-500">{p.usedFor}</p>
                </div>
                <span
                  className={`rounded-sm px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${
                    configured ? 'bg-ready-mintDim text-ready-mint' : 'bg-ink-700 text-ink-500'
                  }`}
                >
                  {configured ? 'Configured' : 'Not configured'}
                </span>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}