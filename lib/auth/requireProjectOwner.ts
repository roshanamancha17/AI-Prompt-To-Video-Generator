import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';

export class UnauthorizedError extends Error {}
export class NotFoundError extends Error {}

/** Throws UnauthorizedError / NotFoundError; callers translate those to HTTP responses. */
export async function requireProjectOwner(projectId: string) {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError('Not authenticated.');

  const userId = (session.user as { id: string }).id;
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) throw new NotFoundError('Project not found.');

  return { userId, project };
}
