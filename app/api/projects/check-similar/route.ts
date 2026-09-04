import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth/auth';
import { findSimilarRecentTopics } from '@/lib/services/contentHistoryService';

const BodySchema = z.object({ topic: z.string().min(5) });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ similar: [] });

  const userId = (session.user as { id: string }).id;
  const similar = await findSimilarRecentTopics(userId, parsed.data.topic);

  return NextResponse.json({ similar: similar.slice(0, 3) });
}
