import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';
import { Card, CardBody, CardHeader, StatusBadge } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default async function DashboardPage() {
  const session = await auth();
  const userId = (session!.user as { id: string }).id;

  const projects = await prisma.project.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });

  const inProgress = projects.filter((p) => ['IDEA', 'GENERATING', 'DRAFT'].includes(p.status));
  const needsApproval = projects.filter((p) => p.status === 'REVIEW');
  const generatingNow = projects.filter((p) => p.status === 'GENERATING');
  const readyToExport = projects.filter((p) => p.status === 'READY' || p.status === 'APPROVED');

  return (
    <div className="max-w-5xl">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-paper-100">Dashboard</h1>
          <p className="mt-1 text-sm text-ink-500">One idea in. A complete content package out.</p>
        </div>
        <Link href="/projects/new">
          <Button size="lg">+ Create Content</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <DashboardWidget
          title="Continue creating"
          emptyLabel="Nothing in progress. Start with an idea above."
          items={inProgress}
        />
        <DashboardWidget
          title="Needs your approval"
          emptyLabel="Nothing waiting on you right now."
          items={needsApproval}
        />
        <DashboardWidget
          title="Generating now"
          emptyLabel="No active generation jobs."
          items={generatingNow}
        />
        <DashboardWidget
          title="Ready to export"
          emptyLabel="Nothing's finished yet — it'll land here once ready."
          items={readyToExport}
        />
      </div>

      {projects.length === 0 && (
        <Card className="mt-8">
          <CardBody className="py-10 text-center">
            <p className="font-display text-lg text-paper-100">Your first project starts with one idea.</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">
              Drop in a topic — a line, an observation, a hook — and Content Studio turns it into a script, scenes, image
              prompts, voiceover, and platform-ready copy.
            </p>
            <Link href="/projects/new">
              <Button className="mt-5">+ Create Content</Button>
            </Link>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function DashboardWidget({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: { id: string; topic: string; status: string }[];
  emptyLabel: string;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-medium text-paper-100">{title}</h2>
      </CardHeader>
      <CardBody>
        {items.length === 0 ? (
          <p className="text-sm text-ink-500">{emptyLabel}</p>
        ) : (
          <ul className="space-y-2.5">
            {items.slice(0, 5).map((p) => (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`} className="focus-ring flex items-center justify-between gap-3 rounded-sm py-1 hover:opacity-80">
                  <span className="truncate text-sm text-paper-100">{p.topic}</span>
                  <StatusBadge status={p.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
