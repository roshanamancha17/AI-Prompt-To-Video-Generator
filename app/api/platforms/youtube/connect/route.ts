import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { auth } from '@/lib/auth/auth';
import { getYouTubeAuthUrl } from '@/lib/providers/youtube/YouTubeDataProvider';

function getRedirectUri(req: Request): string {
  const url = new URL(req.url);
  return `${url.origin}/api/platforms/youtube/callback`;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL('/login', req.url));

  if (!process.env.YOUTUBE_CLIENT_ID) {
    return NextResponse.redirect(new URL('/channel-insights?error=not-configured', req.url));
  }

  // CSRF protection: state carries the user id, verified again in the callback session.
  const state = randomBytes(16).toString('hex');
  const authUrl = getYouTubeAuthUrl(getRedirectUri(req), state);

  const res = NextResponse.redirect(authUrl);
  res.cookies.set('yt_oauth_state', state, { httpOnly: true, secure: true, maxAge: 600, path: '/' });
  return res;
}
