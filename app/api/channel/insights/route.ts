import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { generateChannelInsights } from '@/lib/services/channelInsightsService';

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  try {
    const insight = await generateChannelInsights(userId);
    return NextResponse.json({ insight });
  } catch (err) {
    console.error('Channel insight generation failed:', err);
    const message = err instanceof Error && err.message.includes('Sync at least')
      ? err.message
      : 'Could not generate insights right now. Please check your Gemini configuration and try again.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
