import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireProjectOwner, UnauthorizedError, NotFoundError } from '@/lib/auth/requireProjectOwner';
import { toResolvedPrompt } from '@/lib/services/imageGenerationService';
import { startRtxJob } from '@/lib/services/rtxImageService';
import { ProviderConfigError, ProviderRequestError } from '@/lib/providers/ai/GeminiTextProvider';
import type { ResolvedImagePrompt } from '@/lib/providers/image/ImageProvider';

/** Builds the same detailed prompt string style as the hosted Stable Diffusion provider — RTX local generation needs the full description, not Unsplash's generic keywords. */
function formatPromptForRtx(p: ResolvedImagePrompt): { prompt: string; negativePrompt?: string } {
  const prompt = [
    p.subject,
    `in ${p.environment}`,
    p.action ? `, ${p.action}` : '',
    `, ${p.emotion} mood`,
    `, ${p.lighting}`,
    `, ${p.camera}`,
    `, ${p.composition}`,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { prompt, negativePrompt: p.negativeRequirements || undefined };
}

export async function POST(req: Request, { params }: { params: { promptId: string } }) {
  try {
    const imagePrompt = await prisma.imagePrompt.findUniqueOrThrow({
      where: { id: params.promptId },
      include: { scene: { include: { project: true } } },
    });

    const projectId = imagePrompt.scene?.project.id;
    if (!projectId) return NextResponse.json({ error: 'Could not resolve the project for this image prompt.' }, { status: 404 });

    await requireProjectOwner(projectId);

    const resolved = toResolvedPrompt(imagePrompt);
    const { prompt, negativePrompt } = formatPromptForRtx(resolved);

    const jobId = await startRtxJob({
      prompt,
      negativePrompt,
      aspectRatio: resolved.aspectRatio,
      style: 'photorealistic',
    });

    return NextResponse.json({ jobId, projectId });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    if (err instanceof ProviderConfigError) return NextResponse.json({ error: err.message }, { status: 503 });
    if (err instanceof ProviderRequestError) return NextResponse.json({ error: err.message }, { status: 502 });
    console.error('Starting RTX generation job failed:', err);
    return NextResponse.json({ error: 'Could not start RTX image generation. Please try again.' }, { status: 500 });
  }
}