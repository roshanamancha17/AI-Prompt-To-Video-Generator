import { ProviderConfigError, ProviderRequestError, ProviderTimeoutError } from '@/lib/providers/ai/GeminiTextProvider';

const RTX_SERVER_BASE = process.env.RTX_SERVER_URL || 'http://127.0.0.1:8001';

export interface RtxGenerateParams {
  prompt: string;
  negativePrompt?: string;
  aspectRatio: string;
  style?: 'photorealistic' | 'cinematic' | 'none';
  steps?: number;
}

export interface RtxJobStatus {
  status: 'queued' | 'running' | 'done' | 'error';
  step?: number;
  total_steps?: number;
  image_base64?: string;
  error?: string;
}

const ASPECT_RATIOS = new Set(['1:1', '16:9', '9:16', '4:3', '3:4']);

/** Starts an RTX generation job on the local Python server and returns its job_id immediately — does not wait for completion. Poll pollRtxJob() to track progress and get the result. */
export async function startRtxJob(params: RtxGenerateParams): Promise<string> {
  const body = {
    prompt: params.prompt,
    negative_prompt: params.negativePrompt || null,
    style: params.style || 'photorealistic',
    aspect_ratio: ASPECT_RATIOS.has(params.aspectRatio) ? params.aspectRatio : '9:16',
    steps: params.steps || 20,
  };

  let res: Response;
  try {
    res = await fetch(`${RTX_SERVER_BASE}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new ProviderConfigError(
      `Could not reach the RTX local GPU server at ${RTX_SERVER_BASE}. Is rtx_server.py running? (${(err as Error).message})`,
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ProviderRequestError(`RTX server responded with status ${res.status}.`, text.slice(0, 500));
  }

  const data = (await res.json()) as { job_id: string };
  return data.job_id;
}

/** Checks the current status of an RTX job — used both for progress-bar polling and to retrieve the final image once status is "done". */
export async function pollRtxJob(jobId: string): Promise<RtxJobStatus> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  let res: Response;
  try {
    res = await fetch(`${RTX_SERVER_BASE}/generate/${jobId}`, { signal: controller.signal });
  } catch (err) {
    clearTimeout(timeout);
    if ((err as Error).name === 'AbortError') throw new ProviderTimeoutError('RTX status poll timed out.');
    throw new ProviderRequestError('Could not reach the RTX local GPU server while polling job status.', err);
  }
  clearTimeout(timeout);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ProviderRequestError(`RTX server status check responded with status ${res.status}.`, text.slice(0, 500));
  }

  return (await res.json()) as RtxJobStatus;
}
