import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { getConnection } from '@/lib/services/channelConnectionService';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const connection = await getConnection(userId, 'YOUTUBE');
  if (!connection) return NextResponse.json({ connected: false });

  return NextResponse.json({ connected: true, channelTitle: connection.externalChannelTitle });
}
