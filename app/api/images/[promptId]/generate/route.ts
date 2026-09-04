import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireProjectOwner, UnauthorizedError, NotFoundError } from '@/lib/auth/requireProjectOwner';
import { generateImageForPrompt } from '@/lib/services/imageGenerationService';
import { friendlyGenerationError } from '@/lib/services/jobService';

async function resolveProjectId(imagePromptId: string): Promise<string | null> {
  const prompt = await prisma.imagePrompt.findUnique({
    where: { id: imagePromptId },
    include: { scene: true, thumbnail: true, socialPost: true },
  });
  return prompt?.scene?.projectId ?? prompt?.thumbnail?.projectId ?? prompt?.socialPost?.projectId ?? null;
}

// Doubles as "regenerate" — each call creates a new GeneratedImage version
// and marks it active without touching any other scene's image.
export async function POST(_req: Request, { params }: { params: { promptId: string } }) {
  const projectId = await resolveProjectId(params.promptId);
  if (!projectId) return NextResponse.json({ error: 'Image prompt not found.' }, { status: 404 });

  try {
    await requireProjectOwner(projectId);
    const image = await generateImageForPrompt(params.promptId);
    return NextResponse.json({ image });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    console.error('Image generation failed:', err);
    return NextResponse.json({ error: friendlyGenerationError('Image generation') }, { status: 500 });
  }
}
