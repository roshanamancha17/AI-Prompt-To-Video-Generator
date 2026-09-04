import { prisma } from '@/lib/db/prisma';
import { refreshAccessToken } from '@/lib/providers/youtube/YouTubeDataProvider';

interface StoredTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number; // epoch ms
}

export async function getConnection(userId: string, platform: 'YOUTUBE' = 'YOUTUBE') {
  return prisma.platformConnection.findUnique({ where: { userId_platform: { userId, platform } } });
}

/** Returns a valid access token, transparently refreshing it if expired. */
export async function getValidAccessToken(userId: string, platform: 'YOUTUBE' = 'YOUTUBE'): Promise<string> {
  const connection = await getConnection(userId, platform);
  if (!connection) throw new Error('No YouTube connection found. Please connect your channel first.');

  const tokens = connection.oauthTokens as unknown as StoredTokens;

  if (Date.now() < tokens.expires_at - 60_000) {
    return tokens.access_token;
  }

  if (!tokens.refresh_token) {
    throw new Error('Your YouTube connection has expired. Please reconnect.');
  }

  const refreshed = await refreshAccessToken(tokens.refresh_token);
  const newTokens: StoredTokens = {
    access_token: refreshed.access_token,
    refresh_token: tokens.refresh_token, // refresh responses don't always include a new one
    expires_at: Date.now() + refreshed.expires_in * 1000,
  };

  await prisma.platformConnection.update({
    where: { userId_platform: { userId, platform } },
    data: { oauthTokens: newTokens as never },
  });

  return newTokens.access_token;
}

export async function disconnectChannel(userId: string, platform: 'YOUTUBE' = 'YOUTUBE') {
  await prisma.platformConnection.deleteMany({ where: { userId, platform } });
}
