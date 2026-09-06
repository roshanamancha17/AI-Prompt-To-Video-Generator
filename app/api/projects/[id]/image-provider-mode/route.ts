import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireProjectOwner, UnauthorizedError, NotFoundError } from '@/lib/auth/requireProjectOwner';
import { prisma } from '@/lib/db/prisma';

const BodySchema = z.object({ mode: z.enum(['UNSPLASH', 'RTX']) });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'mode must be "UNSPLASH" or "RTX".' }, { status: 422 });

  try {
    await requireProjectOwner(params.id);
    const project = await prisma.project.update({
      where: { id: params.id },
      data: { imageProviderMode: parsed.data.mode },
    });
    return NextResponse.json({ project });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    console.error('Updating image provider mode failed:', err);
    return NextResponse.json({ error: 'Could not update the image provider mode. Please try again.' }, { status: 500 });
  }
}