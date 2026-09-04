import { prisma } from '@/lib/db/prisma';
import { getAIProvider } from '@/lib/providers/ai/GeminiTextProvider';
import { ChannelInsightSchema, ChannelInsightJsonSchema } from '@/lib/schemas/channelInsight.schema';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function engagementRate(v: { views: number; likes: number; comments: number }): number {
  return v.views > 0 ? (v.likes + v.comments) / v.views : 0;
}

/**
 * Builds a compact, numbers-grounded digest of the channel's recent videos —
 * top/bottom performers, posting-time distribution of top performers,
 * duration patterns — so the AI synthesizes from real signals rather than
 * inventing plausible-sounding advice from titles alone.
 */
function buildPerformanceDigest(videos: {
  title: string;
  description: string | null;
  publishedAt: Date;
  durationSec: number | null;
  views: number;
  likes: number;
  comments: number;
}[]) {
  const ranked = [...videos].sort((a, b) => b.views - a.views);
  const top = ranked.slice(0, Math.min(8, Math.ceil(ranked.length * 0.25) || 1));
  const bottom = ranked.slice(-Math.min(8, Math.ceil(ranked.length * 0.25) || 1)).reverse();

  const avgViews = videos.reduce((s, v) => s + v.views, 0) / videos.length;
  const avgEngagement = videos.reduce((s, v) => s + engagementRate(v), 0) / videos.length;

  const postingHourCounts = new Map<string, { count: number; totalViews: number }>();
  for (const v of top) {
    const key = `${DAY_NAMES[v.publishedAt.getUTCDay()]} ${v.publishedAt.getUTCHours()}:00 UTC`;
    const entry = postingHourCounts.get(key) ?? { count: 0, totalViews: 0 };
    entry.count += 1;
    entry.totalViews += v.views;
    postingHourCounts.set(key, entry);
  }

  const topPostingTimes = [...postingHourCounts.entries()]
    .sort((a, b) => b[1].totalViews - a[1].totalViews)
    .slice(0, 5)
    .map(([time, d]) => `${time} (${d.count} top video${d.count > 1 ? 's' : ''})`);

  const fmt = (v: (typeof videos)[number]) =>
    `"${v.title}" — ${v.views.toLocaleString()} views, ${v.likes.toLocaleString()} likes, ${v.comments.toLocaleString()} comments, ${((v.durationSec ?? 0) / 60).toFixed(1)}min, posted ${DAY_NAMES[v.publishedAt.getUTCDay()]} ${v.publishedAt.getUTCHours()}:00 UTC`;

  return `Videos analyzed: ${videos.length}
Average views: ${Math.round(avgViews).toLocaleString()}
Average engagement rate (likes+comments/views): ${(avgEngagement * 100).toFixed(2)}%

TOP PERFORMERS (highest views):
${top.map(fmt).join('\n')}

LOWEST PERFORMERS (lowest views):
${bottom.map(fmt).join('\n')}

Posting times that correlate with top performers (UTC, from actual publish timestamps):
${topPostingTimes.join('\n') || 'Not enough data to detect a pattern yet.'}`;
}

export async function generateChannelInsights(userId: string) {
  const videos = await prisma.channelVideoMetric.findMany({
    where: { userId, platform: 'YOUTUBE' },
    orderBy: { publishedAt: 'desc' },
    take: 60,
  });

  if (videos.length < 3) {
    throw new Error('Sync at least a few videos before generating insights — there\u2019s not enough data yet.');
  }

  const digest = buildPerformanceDigest(videos);

  const prompt = `You are a YouTube Shorts/short-form growth strategist analyzing a real creator's recent channel performance. Base every conclusion strictly on the data below — do not invent statistics or reference videos not listed.

${digest}

Produce:
- top_performing_patterns: what the top performers actually have in common (topic, title style, length, format) — be specific, referencing the real titles above
- common_mistakes: what the lowest performers have in common that the top performers avoid — be honest and specific, not generic advice
- recommended_improvements: 3-5 concrete, actionable changes for future content, each tied to something observed in the data
- best_posting_times: the best-supported posting time pattern from the data above (say plainly if the sample is too small to be confident)
- top_hook_styles: the opening-line/title style pattern shared by the top performers
- topic_recommendations: 3-5 specific topic directions worth trying next, reasoned from what has and hasn't worked

Write each field as 2-5 sentences of genuinely useful analysis, not a bullet-point summary of the input. Return ONLY JSON matching the required schema.`;

  const output = await getAIProvider().generateStructured(prompt, ChannelInsightSchema, {
    jsonSchema: ChannelInsightJsonSchema,
    temperature: 0.6, // lower temperature — this should read as analysis, not creative writing
  });

  return prisma.channelInsight.create({
    data: {
      userId,
      platform: 'YOUTUBE',
      videosAnalyzed: videos.length,
      topPerformingPatterns: output.top_performing_patterns,
      commonMistakes: output.common_mistakes,
      recommendedImprovements: output.recommended_improvements,
      bestPostingTimes: output.best_posting_times,
      topHookStyles: output.top_hook_styles,
      topicRecommendations: output.topic_recommendations,
    },
  });
}

export async function getLatestInsight(userId: string) {
  return prisma.channelInsight.findFirst({ where: { userId, platform: 'YOUTUBE' }, orderBy: { generatedAt: 'desc' } });
}
