import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, signOut } from '@/lib/auth/auth';
import { Button } from '@/components/ui/button';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/projects', label: 'Projects' },
  { href: '/library', label: 'Content Library' },
  { href: '/drafts', label: 'Drafts' },
  { href: '/assets', label: 'Generated Assets' },
  { href: '/scheduled', label: 'Scheduled Content' },
  { href: '/channel-insights', label: 'Channel Insights' },
  { href: '/settings', label: 'Settings' },
  { href: '/settings/providers', label: 'API / Provider Status' },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <div className="flex min-h-screen bg-ink-950">
      <aside className="sprocket-rail flex w-60 flex-col border-r border-ink-700 bg-ink-900 px-3 py-5">
        <div className="mb-6 px-2">
          <p className="font-display text-sm font-semibold tracking-wide text-paper-100">CONTENT STUDIO</p>
        </div>

        <nav className="flex-1 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="focus-ring block rounded-sm px-3 py-2 text-sm text-ink-500 transition-colors hover:bg-ink-800 hover:text-paper-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-ink-700 pt-4">
          <p className="truncate px-2 text-xs text-ink-500">{session.user.email}</p>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}
          >
            <Button type="submit" variant="ghost" size="sm" className="mt-2 w-full justify-start">
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      <main className="flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
