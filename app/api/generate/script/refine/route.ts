import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { requireProjectOwner, UnauthorizedError, NotFoundError } from '@/lib/auth/requireProjectOwner';
import { refineScript } from '@/lib/services/scriptService';
import { ScriptRefineActionSchema } from '@/lib/schemas/script.schema';
import { friendlyGenerationError } from '@/lib/services/jobService';

const BodySchema = z.object({
  scriptId: z.string(),
  action: ScriptRefineActionSchema,
  customInstruction: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'A valid action and scriptId are required.' }, { status: 422 });

  const existing = await prisma.script.findUnique({ where: { id: parsed.data.scriptId } });
  if (!existing) return NextResponse.json({ error: 'Script not found.' }, { status: 404 });

  try {
    await requireProjectOwner(existing.projectId);
    const script = await refineScript(parsed.data.scriptId, parsed.data.action, parsed.data.customInstruction);
    return NextResponse.json({ script });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    console.error('Script refine failed:', err);
    return NextResponse.json({ error: friendlyGenerationError('Script refinement') }, { status: 500 });
  }
}
