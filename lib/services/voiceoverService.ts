import { prisma } from '@/lib/db/prisma';
import { getVoiceProvider } from '@/lib/providers/voice/ElevenLabsProvider';
import { getStorageProvider } from '@/lib/providers/storage/S3StorageProvider';
import { runTrackedJob } from './jobService';

export interface VoiceoverRequestInput {
  scriptId: string;
  voiceId: string;
  stability?: number;
  similarity?: number;
  style?: number;
  speed?: number;
  /** Optional user-edited voiceover text, overriding the script's stored voiceoverVersion. */
  scriptOverride?: string;
}

async function nextVoiceoverVersion(projectId: string): Promise<number> {
  const latest = await prisma.voiceover.findFirst({ where: { projectId }, orderBy: { version: 'desc' } });
  return (latest?.version ?? 0) + 1;
}

/**
 * Generates a voiceover from an approved (user-editable) voiceover script.
 * Only ever called from an explicit [Generate Voiceover] click — never
 * chained automatically after script generation or approval.
 */
export async function generateVoiceover(input: VoiceoverRequestInput) {
  const script = await prisma.script.findUniqueOrThrow({ where: { id: input.scriptId }, include: { project: true } });
  const projectId = script.projectId;
  const text = input.scriptOverride?.trim() || script.voiceoverVersion;

  return runTrackedJob(projectId, 'VOICEOVER', async () => {
    const result = await getVoiceProvider().synthesize(text, {
      voiceId: input.voiceId,
      stability: input.stability,
      similarity: input.similarity,
      style: input.style,
      speed: input.speed,
    });

    const key = `projects/${projectId}/voiceovers/${script.id}-${Date.now()}.mp3`;
    const uploaded = await getStorageProvider().upload(key, result.audioBuffer, 'audio/mpeg');

    return prisma.$transaction(async (tx) => {
      const asset = await tx.asset.create({
        data: { projectId, type: 'AUDIO', url: uploaded.url, storageProvider: getStorageProvider().name, sizeBytes: uploaded.sizeBytes, mimeType: 'audio/mpeg' },
      });

      await tx.voiceover.updateMany({ where: { projectId }, data: { isActive: false } });

      const version = await nextVoiceoverVersion(projectId);
      return tx.voiceover.create({
        data: {
          projectId,
          scriptId: script.id,
          version,
          isActive: true,
          provider: 'elevenlabs',
          voiceId: input.voiceId,
          scriptSnapshot: text,
          stability: input.stability,
          similarity: input.similarity,
          style: input.style,
          speed: input.speed,
          assetId: asset.id,
          wordTimings: result.wordTimings as never,
        },
      });
    });
  });
}
