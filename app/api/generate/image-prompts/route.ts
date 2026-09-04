import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireProjectOwner, UnauthorizedError, NotFoundError } from '@/lib/auth/requireProjectOwner';
import { generateImagePrompts } from '@/lib/services/imagePromptService';
import { friendlyGenerationError } from '@/lib/services/jobService';

const BodySchema = z.object({ projectId: z.string() });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'projectId is required.' }, { status: 422 });

  try {
    await requireProjectOwner(parsed.data.projectId);
    const prompts = await generateImagePrompts(parsed.data.projectId);
    return NextResponse.json({ prompts });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    console.error('Image prompt generation failed:', err);
    const message = err instanceof Error && err.message.includes('Scenes must be')
      ? err.message
      : friendlyGenerationError('Image prompt generation');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
