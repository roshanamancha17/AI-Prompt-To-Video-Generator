import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireProjectOwner, UnauthorizedError, NotFoundError } from '@/lib/auth/requireProjectOwner';
import { generateThumbnails } from '@/lib/services/thumbnailService';
import { friendlyGenerationError } from '@/lib/services/jobService';

const BodySchema = z.object({ projectId: z.string() });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'projectId is required.' }, { status: 422 });

  try {
    await requireProjectOwner(parsed.data.projectId);
    const thumbnails = await generateThumbnails(parsed.data.projectId);
    return NextResponse.json({ thumbnails });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    console.error('Thumbnail generation failed:', err);
    return NextResponse.json({ error: friendlyGenerationError('Thumbnail generation') }, { status: 500 });
  }
}
