import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireProjectOwner, UnauthorizedError, NotFoundError } from '@/lib/auth/requireProjectOwner';
import { generateContentStrategy, approveStrategy } from '@/lib/services/contentStrategyService';
import { friendlyGenerationError } from '@/lib/services/jobService';

const BodySchema = z.object({ projectId: z.string() });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'projectId is required.' }, { status: 422 });

  try {
    await requireProjectOwner(parsed.data.projectId);
    const strategy = await generateContentStrategy(parsed.data.projectId);
    return NextResponse.json({ strategy });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    console.error('Strategy generation failed:', err);
    return NextResponse.json({ error: friendlyGenerationError('Content strategy generation') }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  // Approve the current strategy.
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'projectId is required.' }, { status: 422 });

  try {
    await requireProjectOwner(parsed.data.projectId);
    const project = await approveStrategy(parsed.data.projectId);
    return NextResponse.json({ project });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    console.error('Strategy approval failed:', err);
    return NextResponse.json({ error: 'Could not approve the strategy. Please try again.' }, { status: 500 });
  }
}
