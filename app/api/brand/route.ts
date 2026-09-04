import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';

const BrandSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  audience: z.string().max(2000).optional(),
  positioning: z.string().max(1000).optional(),
  tone: z.string().max(200).optional(),
  ctaStyle: z.string().max(500).optional(),
  wordsToUse: z.array(z.string()).default([]),
  wordsToAvoid: z.array(z.string()).default([]),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const brand = await prisma.brand.findFirst({
    where: { userId: (session.user as { id: string }).id, isActive: true },
    include: { pillars: true },
  });

  return NextResponse.json({ brand });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const body = await req.json().catch(() => null);
  const parsed = BrandSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Some fields need attention.', fieldErrors: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const existing = await prisma.brand.findFirst({ where: { userId, isActive: true } });

  try {
    const brand = existing
      ? await prisma.brand.update({ where: { id: existing.id }, data: parsed.data })
      : await prisma.brand.create({ data: { ...parsed.data, userId } });

    return NextResponse.json({ brand });
  } catch (err) {
    console.error('Failed to save brand:', err);
    return NextResponse.json({ error: 'Could not save brand settings. Please try again.' }, { status: 500 });
  }
}
