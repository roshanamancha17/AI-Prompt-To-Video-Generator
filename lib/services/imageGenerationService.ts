import { prisma } from '@/lib/db/prisma';
import { getImageProvider } from '@/lib/providers/image/registry';
import { getStorageProvider } from '@/lib/providers/storage/S3StorageProvider';
import type { ResolvedImagePrompt } from '@/lib/providers/image/ImageProvider';
import { runTrackedJob } from './jobService';

function toResolvedPrompt(row: {
  subject: string;
  environment: string;
  action: string | null;
  emotion: string;
  lighting: string;
  camera: string;
  style: string;
  composition: string;
  negativeRequirements: string | null;
  aspectRatio: string;
}): ResolvedImagePrompt {
  return {
    subject: row.subject,
    environment: row.environment,
    action: row.action ?? undefined,
    emotion: row.emotion,
    lighting: row.lighting,
    camera: row.camera,
    style: row.style,
    composition: row.composition,
    negativeRequirements: row.negativeRequirements ?? undefined,
    aspectRatio: row.aspectRatio,
  };
}

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; mimeType: string } {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!match) throw new Error('Unexpected image format returned by provider.');
  return { buffer: Buffer.from(match[2], 'base64'), mimeType: match[1] };
}

/** Generates one image for one ImagePrompt row. Independent of every other prompt — regenerating one scene never touches another. */
export async function generateImageForPrompt(imagePromptId: string) {
  const imagePrompt = await prisma.imagePrompt.findUniqueOrThrow({
    where: { id: imagePromptId },
    include: { scene: { include: { project: true } }, thumbnail: true, socialPost: true },
  });

  const projectId =
    imagePrompt.scene?.project.id ??
    (imagePrompt.thumbnail ? (await prisma.thumbnail.findUniqueOrThrow({ where: { id: imagePrompt.thumbnail.id } })).projectId : null) ??
    imagePrompt.socialPost?.projectId;

  if (!projectId) throw new Error('Could not resolve the project for this image prompt.');

  return runTrackedJob(projectId, 'IMAGES', async () => {
    const result = await getImageProvider().generateImage(toResolvedPrompt(imagePrompt));
    const { buffer, mimeType } = dataUrlToBuffer(result.assetUrl);

    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    const key = `projects/${projectId}/images/${imagePromptId}-${Date.now()}.${ext}`;
    const uploaded = await getStorageProvider().upload(key, buffer, mimeType);

    return prisma.$transaction(async (tx) => {
      const asset = await tx.asset.create({
        data: { projectId, type: 'IMAGE', url: uploaded.url, storageProvider: getStorageProvider().name, sizeBytes: uploaded.sizeBytes, mimeType },
      });

      await tx.generatedImage.updateMany({ where: { imagePromptId }, data: { isActive: false } });

      return tx.generatedImage.create({
        data: { imagePromptId, isActive: true, provider: result.provider, model: result.model, assetId: asset.id },
      });
    });
  });
}

/** Generates images for every active, not-yet-imaged prompt belonging to a project's scenes ("Generate All Images"). */
export async function generateAllImagesForProject(projectId: string) {
  const prompts = await prisma.imagePrompt.findMany({
    where: { isActive: true, scene: { projectId } },
    include: { generatedImages: { where: { isActive: true } } },
  });

  const results = [];
  for (const p of prompts) {
    // Skip prompts that already have an active generated image — this is
    // "generate all", not "regenerate all"; regeneration is a separate,
    // explicit per-image action.
    if (p.generatedImages.length > 0) continue;
    try {
      results.push(await generateImageForPrompt(p.id));
    } catch (err) {
      console.error(`Image generation failed for prompt ${p.id}:`, err);
      // Continue with the rest — one failed scene shouldn't block the others.
    }
  }
  return results;
}
