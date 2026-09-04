import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { syncYouTubeChannel } from '@/lib/services/channelSyncService';

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  try {
    const result = await syncYouTubeChannel(userId);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Channel sync failed:', err);
    const message = err instanceof Error ? err.message : 'Could not sync your channel. Please try again.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
