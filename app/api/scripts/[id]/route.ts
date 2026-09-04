import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { requireProjectOwner, UnauthorizedError, NotFoundError } from '@/lib/auth/requireProjectOwner';
import { saveScriptEdit } from '@/lib/services/scriptService';

const BodySchema = z.object({
  content: z.string().min(1),
  voiceoverVersion: z.string().min(1),
  onScreenText: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'content and voiceoverVersion are required.' }, { status: 422 });

  const existing = await prisma.script.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Script not found.' }, { status: 404 });

  try {
    await requireProjectOwner(existing.projectId);
    const script = await saveScriptEdit(params.id, parsed.data.content, parsed.data.voiceoverVersion, parsed.data.onScreenText);
    // A manual edit invalidates the prior approval — the user should re-approve.
    await prisma.project.update({ where: { id: existing.projectId }, data: { scriptApproved: false } });
    return NextResponse.json({ script });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    console.error('Script save failed:', err);
    return NextResponse.json({ error: 'Could not save your edit. Please try again.' }, { status: 500 });
  }
}
