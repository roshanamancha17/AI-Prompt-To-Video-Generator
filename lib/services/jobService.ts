import { prisma } from '@/lib/db/prisma';
import type { JobStage } from '@prisma/client';

/**
 * Runs `fn` as a tracked GenerationJob. Phase 2 executes this in-process
 * (the route handler awaits it directly) — but every stage is still
 * recorded as a job row with QUEUED/PROCESSING/COMPLETED/FAILED status, so
 * moving to a real queue (BullMQ, Phase 3+) only changes *how* `fn` gets
 * invoked, not the status model the UI already polls.
 */
export async function runTrackedJob<T>(projectId: string, stage: JobStage, fn: () => Promise<T>): Promise<T> {
  const job = await prisma.generationJob.create({
    data: { projectId, stage, status: 'PROCESSING', attempts: 1, startedAt: new Date() },
  });

  try {
    const result = await fn();
    await prisma.generationJob.update({
      where: { id: job.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await prisma.generationJob.update({
      where: { id: job.id },
      data: { status: 'FAILED', lastError: message, completedAt: new Date() },
    });
    throw err;
  }
}

/** Friendly, provider-agnostic message for the client — never the raw error. */
export function friendlyGenerationError(stage: string): string {
  return `${stage} failed. Please check your AI provider configuration and try again.`;
}
