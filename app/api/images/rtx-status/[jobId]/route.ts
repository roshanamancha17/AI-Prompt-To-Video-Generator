import { NextResponse } from 'next/server';
import { requireProjectOwner, UnauthorizedError, NotFoundError } from '@/lib/auth/requireProjectOwner';
import { persistGeneratedImage } from '@/lib/services/imageGenerationService';
import { pollRtxJob } from '@/lib/services/rtxImageService';
import { ProviderRequestError, ProviderTimeoutError } from '@/lib/providers/ai/GeminiTextProvider';

export async function GET(req: Request, { params }: { params: { jobId: string } }) {
  const url = new URL(req.url);
  const promptId = url.searchParams.get('promptId');
  const projectId = url.searchParams.get('projectId');

  if (!promptId || !projectId) {
    return NextResponse.json({ error: 'promptId and projectId query params are required.' }, { status: 422 });
  }

  try {
    await requireProjectOwner(projectId);

    const job = await pollRtxJob(params.jobId);

    if (job.status === 'done') {
      if (!job.image_base64) {
        return NextResponse.json({ error: 'RTX job reported done but returned no image.' }, { status: 502 });
      }
      // Persist immediately — the RTX server drops the base64 payload
      // from its own memory once delivered, so this is the only chance
      // to save it.
      const saved = await persistGeneratedImage({
        imagePromptId: promptId,
        projectId,
        assetUrlDataUri: `data:image/png;base64,${job.image_base64}`,
        provider: 'rtx-local-gpu',
        model: 'sdxl-base-1.0',
      });
      return NextResponse.json({ status: 'done', generatedImage: saved });
    }

    if (job.status === 'error') {
      return NextResponse.json({ status: 'error', error: job.error || 'RTX generation failed.' }, { status: 502 });
    }

    // queued or running — just report progress, nothing to persist yet
    return NextResponse.json({ status: job.status, step: job.step ?? 0, totalSteps: job.total_steps ?? 0 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    if (err instanceof ProviderTimeoutError) return NextResponse.json({ error: err.message }, { status: 504 });
    if (err instanceof ProviderRequestError) return NextResponse.json({ error: err.message }, { status: 502 });
    console.error('Polling RTX job failed:', err);
    return NextResponse.json({ error: 'Could not check RTX generation progress.' }, { status: 500 });
  }
}