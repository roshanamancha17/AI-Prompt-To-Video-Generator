import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireProjectOwner, UnauthorizedError, NotFoundError } from '@/lib/auth/requireProjectOwner';
import { publishToYouTube } from '@/lib/services/publishService';

const BodySchema = z.object({
  mode: z.enum(['now', 'schedule']),
  scheduledFor: z.string().datetime().optional(),
  privacyStatus: z.enum(['public', 'unlisted']).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid request body.' }, { status: 422 });

  try {
    const { userId } = await requireProjectOwner(params.id);

    const result = await publishToYouTube({
      projectId: params.id,
      userId,
      mode: parsed.data.mode,
      scheduledFor: parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor) : undefined,
      privacyStatus: parsed.data.privacyStatus,
    });

    return NextResponse.json({ result });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    console.error('YouTube publish failed:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Publishing to YouTube failed.' }, { status: 502 });
  }
}
