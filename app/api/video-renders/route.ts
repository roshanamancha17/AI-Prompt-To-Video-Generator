import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireProjectOwner, UnauthorizedError, NotFoundError } from '@/lib/auth/requireProjectOwner';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: 'projectId is required.' }, { status: 422 });

  try {
    await requireProjectOwner(projectId);
    const renders = await prisma.videoRender.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: { asset: true },
      take: 10,
    });
    return NextResponse.json({ renders });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    return NextResponse.json({ error: 'Could not load renders.' }, { status: 500 });
  }
}
