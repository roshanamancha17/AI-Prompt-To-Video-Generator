import { prisma } from '@/lib/db/prisma';
import { getValidAccessToken } from './channelConnectionService';
import { uploadVideo } from '@/lib/providers/youtube/YouTubeDataProvider';

export interface PublishToYouTubeParams {
  projectId: string;
  userId: string;
  mode: 'now' | 'schedule';
  /** Required when mode is 'schedule'. Must be a future Date. */
  scheduledFor?: Date;
  /** Only used when mode is 'now' — scheduled posts are always uploaded as 'private' (YouTube requirement; see uploadVideo). */
  privacyStatus?: 'public' | 'unlisted';
}

/**
 * Publishing "later" does NOT use a local cron job or background worker —
 * it uploads the video to YouTube immediately, but marks it 'private' with
 * a future `publishAt` timestamp. YouTube itself holds the video and flips
 * it to public at that time. This sidesteps needing any scheduler process
 * running at the exact future moment, which would be unreliable for an app
 * that isn't always running (a personal dev server isn't a 24/7 host).
 */
export async function publishToYouTube(params: PublishToYouTubeParams) {
  const project = await prisma.project.findFirstOrThrow({ where: { id: params.projectId, userId: params.userId } });

  const latestRender = await prisma.videoRender.findFirst({
    where: { projectId: params.projectId, status: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
    include: { asset: true },
  });
  if (!latestRender?.asset?.url) throw new Error('No completed video render found for this project. Render the video first.');

  const socialPosts = await prisma.socialPost.findMany({
    where: { projectId: params.projectId, platform: 'YOUTUBE', isActive: true },
  });
  const title = socialPosts.find((p) => p.postType === 'TITLE')?.content;
  const description = socialPosts.find((p) => p.postType === 'DESCRIPTION')?.content ?? '';
  const hashtags = socialPosts.find((p) => p.postType === 'HASHTAGS')?.content ?? '';
  const keywords = socialPosts.find((p) => p.postType === 'KEYWORDS')?.content ?? '';

  if (!title) throw new Error('No YouTube title found — generate social copy for this project first.');

  const fullDescription = hashtags ? `${description}\n\n${hashtags}` : description;
  const tags = keywords
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  if (params.mode === 'schedule' && !params.scheduledFor) throw new Error('scheduledFor is required when mode is "schedule".');
  if (params.mode === 'schedule' && params.scheduledFor!.getTime() <= Date.now()) throw new Error('Scheduled time must be in the future.');

  // Record the attempt as PENDING before the (potentially large, slow)
  // upload starts — if it fails partway, the row already exists to update
  // to FAILED rather than needing a separate error-path insert.
  await prisma.schedule.upsert({
    where: { projectId: params.projectId },
    create: {
      projectId: params.projectId,
      platform: 'YOUTUBE',
      scheduledFor: params.mode === 'schedule' ? params.scheduledFor! : new Date(),
      status: 'PENDING',
      privacyStatus: params.mode === 'schedule' ? 'private' : params.privacyStatus ?? 'public',
    },
    update: {
      scheduledFor: params.mode === 'schedule' ? params.scheduledFor! : new Date(),
      status: 'PENDING',
      privacyStatus: params.mode === 'schedule' ? 'private' : params.privacyStatus ?? 'public',
      publishedUrl: null,
      errorMessage: null,
    },
  });

  try {
    const accessToken = await getValidAccessToken(params.userId);

    const videoRes = await fetch(latestRender.asset.url);
    if (!videoRes.ok) throw new Error('Could not download the rendered video from storage.');
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

    const result = await uploadVideo({
      accessToken,
      videoBuffer,
      title,
      description: fullDescription,
      tags,
      privacyStatus: params.mode === 'schedule' ? 'private' : params.privacyStatus ?? 'public',
      publishAt: params.mode === 'schedule' ? params.scheduledFor!.toISOString() : undefined,
    });

    await prisma.schedule.update({
      where: { projectId: params.projectId },
      data: { status: params.mode === 'schedule' ? 'SCHEDULED' : 'PUBLISHED', publishedUrl: result.url },
    });

    return result;
  } catch (err) {
    await prisma.schedule.update({
      where: { projectId: params.projectId },
      data: { status: 'FAILED', errorMessage: err instanceof Error ? err.message : 'Unknown error.' },
    });
    throw err;
  }
}
