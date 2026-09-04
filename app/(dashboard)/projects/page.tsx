import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';
import { Card, CardBody, StatusBadge } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default async function ProjectsPage() {
  const session = await auth();
  const userId = (session!.user as { id: string }).id;

  const projects = await prisma.project.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-paper-100">Projects</h1>
        <Link href="/projects/new">
          <Button>+ Create Content</Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardBody className="py-10 text-center text-sm text-ink-500">No projects yet.</CardBody>
        </Card>
      ) : (
        <div className="space-y-2">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card className="transition-colors hover:border-ink-500">
                <CardBody className="flex items-center justify-between py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-paper-100">{p.topic}</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {p.contentType.replace(/_/g, ' ')} · {p.language} · {new Date(p.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
