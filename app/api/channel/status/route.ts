import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';
import { getConnection, disconnectChannel } from '@/lib/services/channelConnectionService';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const connection = await getConnection(userId, 'YOUTUBE');
  const videoCount = await prisma.channelVideoMetric.count({ where: { userId, platform: 'YOUTUBE' } });
  const latestInsight = await prisma.channelInsight.findFirst({ where: { userId, platform: 'YOUTUBE' }, orderBy: { generatedAt: 'desc' } });

  return NextResponse.json({
    connected: Boolean(connection),
    channelTitle: connection?.externalChannelTitle ?? null,
    lastSyncedAt: connection?.lastSyncedAt ?? null,
    videoCount,
    latestInsight,
  });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  await disconnectChannel(userId, 'YOUTUBE');
  return NextResponse.json({ disconnected: true });
}
