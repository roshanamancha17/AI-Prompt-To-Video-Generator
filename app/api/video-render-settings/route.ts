import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireProjectOwner, UnauthorizedError, NotFoundError } from '@/lib/auth/requireProjectOwner';
import { getOrCreateRenderSettings, updateRenderSettings } from '@/lib/services/videoAssemblyService';

const BodySchema = z.object({
  projectId: z.string(),
  transition: z.enum(['CUT', 'CROSSFADE']).optional(),
  subtitleStyle: z.enum(['BOLD_CENTER', 'KARAOKE_HIGHLIGHT', 'MINIMAL_BOTTOM']).optional(),
  backgroundMusicUrl: z.string().url().optional().or(z.literal('')),
  musicVolume: z.number().min(0).max(1).optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: 'projectId is required.' }, { status: 422 });

  try {
    await requireProjectOwner(projectId);
    const settings = await getOrCreateRenderSettings(projectId);
    return NextResponse.json({ settings });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    return NextResponse.json({ error: 'Could not load render settings.' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid render settings.' }, { status: 422 });

  const { projectId, ...data } = parsed.data;

  try {
    await requireProjectOwner(projectId);
    const settings = await updateRenderSettings(projectId, {
      ...data,
      backgroundMusicUrl: data.backgroundMusicUrl === '' ? null : data.backgroundMusicUrl,
    });
    return NextResponse.json({ settings });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    return NextResponse.json({ error: 'Could not save render settings.' }, { status: 500 });
  }
}
