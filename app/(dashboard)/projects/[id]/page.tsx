import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';
import { WorkspaceClient } from '@/components/project-workspace/WorkspaceClient';

export default async function ProjectWorkspacePage({ params }: { params: { id: string } }) {
  const session = await auth();
  const userId = (session!.user as { id: string }).id;

  const project = await prisma.project.findFirst({
    where: { id: params.id, userId },
    include: {
      strategy: true,
      scripts: { orderBy: { version: 'desc' } },
      scenes: {
        orderBy: { sceneNumber: 'asc' },
        include: {
          imagePrompts: {
            where: { isActive: true },
            include: { generatedImages: { where: { isActive: true }, include: { asset: true } } },
          },
        },
      },
      thumbnails: {
        include: { imagePrompt: { include: { generatedImages: { where: { isActive: true }, include: { asset: true } } } } },
      },
      voiceovers: { where: { isActive: true }, take: 1, include: { asset: true } },
      socialPosts: true,
    },
  });

  if (!project) notFound();

  return <WorkspaceClient project={project} />;
}

