import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireProjectOwner, UnauthorizedError, NotFoundError } from '@/lib/auth/requireProjectOwner';
import { renderProjectVideo } from '@/lib/services/videoAssemblyService';

// Video rendering shells out to ffmpeg and writes temp files — it needs a
// real Node.js process with a writable filesystem, not an edge/serverless
// function, and can comfortably exceed a typical 10-30s serverless timeout.
export const runtime = 'nodejs';
export const maxDuration = 300;

const BodySchema = z.object({ projectId: z.string() });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'projectId is required.' }, { status: 422 });

  try {
    await requireProjectOwner(parsed.data.projectId);
    const result = await renderProjectVideo(parsed.data.projectId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    console.error('Video render failed:', err);
    const message = err instanceof Error && (
      err.message.includes('Generate a voiceover') ||
      err.message.includes('no timing data') ||
      err.message.includes('Generate at least one scene image')
    ) ? err.message : 'Video rendering failed. Check that ffmpeg is available and your assets are reachable, then try again.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
