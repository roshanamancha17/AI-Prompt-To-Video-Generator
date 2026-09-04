import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';
import { CreateProjectSchema } from '@/lib/schemas/project.schema';

// GET /api/projects — list the current user's projects, newest first.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    where: { userId: (session.user as { id: string }).id },
    orderBy: { createdAt: 'desc' },
    include: { pillar: true },
  });

  return NextResponse.json({ projects });
}

// POST /api/projects — create a new project in IDEA status.
// Phase 1 only persists the row; no AI generation is triggered here.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Some fields need attention.', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const data = parsed.data;
  const userId = (session.user as { id: string }).id;

  const activeBrand = data.brandId
    ? await prisma.brand.findFirst({ where: { id: data.brandId, userId } })
    : await prisma.brand.findFirst({ where: { userId, isActive: true } });

  try {
    const project = await prisma.project.create({
      data: {
        userId,
        brandId: activeBrand?.id,
        pillarId: data.pillarId,
        topic: data.topic,
        contentType: data.contentType,
        language: data.language,
        customLanguage: data.customLanguage,
        audience: data.audience,
        tone: data.tone,
        targetDurationSec: data.targetDurationSec,
        imagePromptCount: data.imagePromptCount,
        thumbnailCount: data.thumbnailCount,
        xPostCount: data.xPostCount,
        ctaLevel: data.ctaLevel,
        ctaText: data.ctaText,
        websiteUrl: data.websiteUrl || undefined,
        additionalNotes: data.additionalNotes,
        maintainCharacterContinuity: data.maintainCharacterContinuity,
        status: 'IDEA',
      },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    // Never leak raw DB/provider errors to the client.
    console.error('Failed to create project:', err);
    return NextResponse.json(
      { error: 'Could not create the project. Please try again.' },
      { status: 500 },
    );
  }
}
