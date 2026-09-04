const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';

// Verified against developers.google.com/youtube/v3/guides/auth at build
// time. youtube.readonly covers channel + video reads; yt-analytics.readonly
// is requested for future watch-time/CTR ingestion even though this build
// only uses the Data API's public statistics (views/likes/comments).
export const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
].join(' ');

export function getYouTubeAuthUrl(redirectUri: string, state: string): string {
  const clientId = requireEnv('YOUTUBE_CLIENT_ID');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: YOUTUBE_SCOPES,
    access_type: 'offline', // required to receive a refresh_token
    prompt: 'consent', // forces refresh_token on every connect, not just the first
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: requireEnv('YOUTUBE_CLIENT_ID'),
      client_secret: requireEnv('YOUTUBE_CLIENT_SECRET'),
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    console.error('YouTube token exchange failed:', await res.text().catch(() => ''));
    throw new Error('Could not complete the YouTube connection.');
  }
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: requireEnv('YOUTUBE_CLIENT_ID'),
      client_secret: requireEnv('YOUTUBE_CLIENT_SECRET'),
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    console.error('YouTube token refresh failed:', await res.text().catch(() => ''));
    throw new Error('Your YouTube connection has expired. Please reconnect.');
  }
  return res.json();
}

export interface YouTubeChannelInfo {
  channelId: string;
  title: string;
  uploadsPlaylistId: string;
}

export async function fetchMyChannel(accessToken: string): Promise<YouTubeChannelInfo> {
  const res = await ytGet('/channels', accessToken, { part: 'snippet,contentDetails', mine: 'true' });
  const channel = res.items?.[0];
  if (!channel) throw new Error('No YouTube channel found for this account.');
  return {
    channelId: channel.id,
    title: channel.snippet?.title ?? 'Untitled channel',
    uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads,
  };
}

export interface YouTubeVideoSummary {
  videoId: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl?: string;
  tags: string[];
  durationSec: number;
  views: number;
  likes: number;
  comments: number;
}

/**
 * Fetches up to `maxResults` recent uploads with statistics. Uses the
 * uploads playlist (playlistItems.list, 1 unit) rather than search.list
 * (100 units) to stay well under the 10,000/day quota — verified against
 * the current YouTube Data API quota costs at build time.
 */
export async function fetchRecentVideosWithStats(accessToken: string, uploadsPlaylistId: string, maxResults = 50): Promise<YouTubeVideoSummary[]> {
  const videoIds: string[] = [];
  let pageToken: string | undefined;

  while (videoIds.length < maxResults) {
    const res = await ytGet('/playlistItems', accessToken, {
      part: 'contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults: String(Math.min(50, maxResults - videoIds.length)),
      ...(pageToken ? { pageToken } : {}),
    });
    for (const item of res.items ?? []) videoIds.push(item.contentDetails.videoId);
    pageToken = res.nextPageToken;
    if (!pageToken) break;
  }

  if (videoIds.length === 0) return [];

  const summaries: YouTubeVideoSummary[] = [];
  // videos.list accepts up to 50 IDs per call.
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const res = await ytGet('/videos', accessToken, { part: 'snippet,statistics,contentDetails', id: batch.join(',') });
    for (const v of res.items ?? []) {
      summaries.push({
        videoId: v.id,
        title: v.snippet?.title ?? '',
        description: v.snippet?.description ?? '',
        publishedAt: v.snippet?.publishedAt,
        thumbnailUrl: v.snippet?.thumbnails?.medium?.url,
        tags: v.snippet?.tags ?? [],
        durationSec: parseIso8601Duration(v.contentDetails?.duration ?? ''),
        views: Number(v.statistics?.viewCount ?? 0),
        likes: Number(v.statistics?.likeCount ?? 0),
        comments: Number(v.statistics?.commentCount ?? 0),
      });
    }
  }
  return summaries;
}

async function ytGet(path: string, accessToken: string, params: Record<string, string>) {
  const url = `${YT_API_BASE}${path}?${new URLSearchParams(params).toString()}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    console.error(`YouTube API error ${res.status} on ${path}:`, await res.text().catch(() => ''));
    throw new Error('Could not fetch data from YouTube.');
  }
  return res.json();
}

function parseIso8601Duration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const [, h, m, s] = match;
  return (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0);
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured.`);
  return value;
}
