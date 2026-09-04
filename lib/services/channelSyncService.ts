import { prisma } from '@/lib/db/prisma';
import { fetchMyChannel, fetchRecentVideosWithStats } from '@/lib/providers/youtube/YouTubeDataProvider';
import { getValidAccessToken } from './channelConnectionService';

export async function syncYouTubeChannel(userId: string) {
  const accessToken = await getValidAccessToken(userId, 'YOUTUBE');
  const channel = await fetchMyChannel(accessToken);
  const videos = await fetchRecentVideosWithStats(accessToken, channel.uploadsPlaylistId, 50);

  await prisma.$transaction(
    [
      prisma.platformConnection.update({
        where: { userId_platform: { userId, platform: 'YOUTUBE' } },
        data: { externalChannelId: channel.channelId, externalChannelTitle: channel.title, lastSyncedAt: new Date() },
      }),
      ...videos.map((v) =>
        prisma.channelVideoMetric.upsert({
          where: { userId_platform_externalId: { userId, platform: 'YOUTUBE', externalId: v.videoId } },
          create: {
            userId,
            platform: 'YOUTUBE',
            externalId: v.videoId,
            title: v.title,
            description: v.description,
            publishedAt: new Date(v.publishedAt),
            durationSec: v.durationSec,
            thumbnailUrl: v.thumbnailUrl,
            tags: v.tags,
            views: v.views,
            likes: v.likes,
            comments: v.comments,
          },
          update: {
            title: v.title,
            description: v.description,
            views: v.views,
            likes: v.likes,
            comments: v.comments,
            fetchedAt: new Date(),
          },
        }),
      ),
    ],
    // Up to 50 individual upserts (can't batch via createMany — each is
    // genuinely conditional insert-or-update) against a remote database.
    // This runs as a background sync, not an interactive user-facing
    // generation step, so a longer timeout is appropriate here.
    { timeout: 45_000, maxWait: 10_000 },
  );

  return { channel, videoCount: videos.length };
}
