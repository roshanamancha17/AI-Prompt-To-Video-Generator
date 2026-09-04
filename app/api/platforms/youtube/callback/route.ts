import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';
import { exchangeCodeForTokens, fetchMyChannel } from '@/lib/providers/youtube/YouTubeDataProvider';

function getRedirectUri(req: Request): string {
  const url = new URL(req.url);
  return `${url.origin}/api/platforms/youtube/callback`;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL('/login', req.url));
  const userId = (session.user as { id: string }).id;

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = req.headers.get('cookie')?.match(/yt_oauth_state=([^;]+)/)?.[1];

  if (!code || !state || state !== cookieState) {
    return NextResponse.redirect(new URL('/channel-insights?error=state-mismatch', req.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code, getRedirectUri(req));
    const channel = await fetchMyChannel(tokens.access_token);

    await prisma.platformConnection.upsert({
      where: { userId_platform: { userId, platform: 'YOUTUBE' } },
      create: {
        userId,
        platform: 'YOUTUBE',
        oauthTokens: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: Date.now() + tokens.expires_in * 1000,
        },
        externalChannelId: channel.channelId,
        externalChannelTitle: channel.title,
      },
      update: {
        oauthTokens: {
          access_token: tokens.access_token,
          // Google only returns a refresh_token on first consent; keep the
          // existing one if this is a reconnect without a new grant.
          refresh_token: tokens.refresh_token,
          expires_at: Date.now() + tokens.expires_in * 1000,
        },
        externalChannelId: channel.channelId,
        externalChannelTitle: channel.title,
      },
    });

    const res = NextResponse.redirect(new URL('/channel-insights?connected=1', req.url));
    res.cookies.delete('yt_oauth_state');
    return res;
  } catch (err) {
    console.error('YouTube OAuth callback failed:', err);
    return NextResponse.redirect(new URL('/channel-insights?error=connection-failed', req.url));
  }
}
