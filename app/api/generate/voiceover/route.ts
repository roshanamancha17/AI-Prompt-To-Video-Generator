import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { requireProjectOwner, UnauthorizedError, NotFoundError } from '@/lib/auth/requireProjectOwner';
import { generateVoiceover } from '@/lib/services/voiceoverService';
import { friendlyGenerationError } from '@/lib/services/jobService';

const BodySchema = z.object({
  scriptId: z.string(),
  voiceId: z.string().min(1),
  stability: z.number().min(0).max(1).optional(),
  similarity: z.number().min(0).max(1).optional(),
  style: z.number().min(0).max(1).optional(),
  speed: z.number().min(0.7).max(1.2).optional(),
  scriptOverride: z.string().optional(),
});

// This endpoint is only ever called from an explicit [Generate Voiceover]
// click in the UI — never chained automatically after script approval.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'A valid voiceId and scriptId are required.' }, { status: 422 });

  const script = await prisma.script.findUnique({ where: { id: parsed.data.scriptId } });
  if (!script) return NextResponse.json({ error: 'Script not found.' }, { status: 404 });

  try {
    await requireProjectOwner(script.projectId);
    const voiceover = await generateVoiceover(parsed.data);
    return NextResponse.json({ voiceover });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    console.error('Voiceover generation failed:', err);
    return NextResponse.json({ error: friendlyGenerationError('Voiceover generation') }, { status: 500 });
  }
}
