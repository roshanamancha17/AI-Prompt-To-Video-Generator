import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { requireProjectOwner, UnauthorizedError, NotFoundError } from '@/lib/auth/requireProjectOwner';
import { updateImagePromptField } from '@/lib/services/imagePromptService';

const BodySchema = z.object({ field: z.string(), value: z.string() });

async function resolveProjectId(imagePromptId: string): Promise<string | null> {
  const prompt = await prisma.imagePrompt.findUnique({
    where: { id: imagePromptId },
    include: { scene: true, thumbnail: true, socialPost: true },
  });
  return prompt?.scene?.projectId ?? prompt?.thumbnail?.projectId ?? prompt?.socialPost?.projectId ?? null;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'field and value are required.' }, { status: 422 });

  const projectId = await resolveProjectId(params.id);
  if (!projectId) return NextResponse.json({ error: 'Image prompt not found.' }, { status: 404 });

  try {
    await requireProjectOwner(projectId);
    const prompt = await updateImagePromptField(params.id, parsed.data.field, parsed.data.value);
    return NextResponse.json({ prompt });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    console.error('Image prompt edit failed:', err);
    return NextResponse.json({ error: 'Could not save your edit. Please try again.' }, { status: 500 });
  }
}
