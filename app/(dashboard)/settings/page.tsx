import Link from 'next/link';
import { Card, CardBody } from '@/components/ui/card';

const SETTINGS_LINKS = [
  { href: '/settings/brand', label: 'Brand voice', description: 'Positioning, tone, content pillars, words to use and avoid.' },
  { href: '/settings/providers', label: 'API / Provider status', description: 'Check which AI, voice, and storage providers are configured.' },
];

export default function SettingsPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-semibold text-paper-100">Settings</h1>
      <div className="mt-6 space-y-3">
        {SETTINGS_LINKS.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="transition-colors hover:border-ink-500">
              <CardBody>
                <p className="text-sm font-medium text-paper-100">{link.label}</p>
                <p className="mt-1 text-xs text-ink-500">{link.description}</p>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
