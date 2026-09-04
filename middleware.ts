import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isOnDashboard = req.nextUrl.pathname.startsWith('/dashboard') ||
    req.nextUrl.pathname.startsWith('/projects') ||
    req.nextUrl.pathname.startsWith('/library') ||
    req.nextUrl.pathname.startsWith('/drafts') ||
    req.nextUrl.pathname.startsWith('/assets') ||
    req.nextUrl.pathname.startsWith('/scheduled') ||
    req.nextUrl.pathname.startsWith('/channel-insights') ||
    req.nextUrl.pathname.startsWith('/settings');

  if (isOnDashboard && !isLoggedIn) {
    const loginUrl = new URL('/login', req.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }
});

export const config = {
  matcher: ['/dashboard/:path*', '/projects/:path*', '/library/:path*', '/drafts/:path*', '/assets/:path*', '/scheduled/:path*', '/channel-insights/:path*', '/settings/:path*'],
};
