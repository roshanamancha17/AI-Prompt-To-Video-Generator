import { prisma } from '@/lib/db/prisma';
import { getAIProvider } from '@/lib/providers/ai/GeminiTextProvider';
import { SocialCopySchema, SocialCopyJsonSchema } from '@/lib/schemas/socialCopy.schema';
import { buildProjectBrief } from './promptBuilders';
import { runTrackedJob } from './jobService';

export async function generateSocialCopy(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { brand: true, scripts: { where: { isActive: true }, take: 1 }, strategy: true },
  });

  const script = project.scripts[0];
  if (!script) throw new Error('A script is required before generating social copy.');

  return runTrackedJob(projectId, 'SOCIAL_COPY', async () => {
    const brief = await buildProjectBrief(project);
    const prompt = `You are a social media copywriter producing platform-native copy for a short-form video.

${brief}

Video script (for context — do not repeat it verbatim in captions):
"""
${script.content}
"""

Produce:

YOUTUBE: title (curiosity-driven, not clickbait), description (2-4 short paragraphs), hashtags (5-8), keywords (5-10 SEO terms).

INSTAGRAM: caption (matches brand tone), hashtags (8-15, mix of broad and niche), first_comment (a follow-up thought or soft CTA to post as the first comment), story_cta (one line for a Story sticker/caption).

FACEBOOK: caption (slightly more descriptive than Instagram, Facebook's native tone), hashtags (2-4, Facebook uses fewer).

X_POSTS: generate exactly ${project.xPostCount} standalone posts. Each must work on its own (not require the others), be short, have a strong hook, avoid sounding like an advertisement, and include a website CTA only where it genuinely fits given the CTA intensity setting. For each post also write an image_prompt — a copy-paste-ready Gemini image prompt (subject, environment, lighting, camera, style, composition, aspect ratio 9:16, what should not appear) that visually matches that specific post.

Return ONLY JSON matching the required schema.`;

    const output = await getAIProvider().generateStructured(prompt, SocialCopySchema, {
      jsonSchema: SocialCopyJsonSchema,
      temperature: 0.85,
    });

    const saved = await prisma.$transaction(
      async (tx) => {
        await tx.socialPost.deleteMany({ where: { projectId } });

        const rows: Array<{
          projectId: string;
          platform: 'YOUTUBE' | 'INSTAGRAM' | 'FACEBOOK' | 'X_TWITTER';
          postType: 'TITLE' | 'DESCRIPTION' | 'HASHTAGS' | 'KEYWORDS' | 'CAPTION' | 'FIRST_COMMENT' | 'STORY_CTA' | 'POST';
          content: string;
          orderIndex: number;
        }> = [
          { projectId, platform: 'YOUTUBE', postType: 'TITLE', content: output.youtube.title, orderIndex: 0 },
          { projectId, platform: 'YOUTUBE', postType: 'DESCRIPTION', content: output.youtube.description, orderIndex: 0 },
          { projectId, platform: 'YOUTUBE', postType: 'HASHTAGS', content: output.youtube.hashtags.join(' '), orderIndex: 0 },
          { projectId, platform: 'INSTAGRAM', postType: 'CAPTION', content: output.instagram.caption, orderIndex: 0 },
          { projectId, platform: 'INSTAGRAM', postType: 'HASHTAGS', content: output.instagram.hashtags.join(' '), orderIndex: 0 },
          { projectId, platform: 'FACEBOOK', postType: 'CAPTION', content: output.facebook.caption, orderIndex: 0 },
        ];

        if (output.youtube.keywords.length) {
          rows.push({ projectId, platform: 'YOUTUBE', postType: 'KEYWORDS', content: output.youtube.keywords.join(', '), orderIndex: 0 });
        }
        if (output.instagram.first_comment) {
          rows.push({ projectId, platform: 'INSTAGRAM', postType: 'FIRST_COMMENT', content: output.instagram.first_comment, orderIndex: 0 });
        }
        if (output.instagram.story_cta) {
          rows.push({ projectId, platform: 'INSTAGRAM', postType: 'STORY_CTA', content: output.instagram.story_cta, orderIndex: 0 });
        }
        if (output.facebook.hashtags.length) {
          rows.push({ projectId, platform: 'FACEBOOK', postType: 'HASHTAGS', content: output.facebook.hashtags.join(' '), orderIndex: 0 });
        }
        // The image_prompt is stored as free text on the post for Phase 2;
        // Phase 3 will promote it to a real ImagePrompt row + GeneratedImage
        // once image generation exists, keeping the same SocialPost id.
        output.x_posts.forEach((p, i) => {
          rows.push({
            projectId,
            platform: 'X_TWITTER',
            postType: 'POST',
            content: `${p.content}\n\n[Image prompt: ${p.image_prompt}]`,
            orderIndex: i,
          });
        });

        // A single createMany instead of up to 13 sequential creates — far
        // fewer round-trips to a remote database, well within the timeout below.
        await tx.socialPost.createMany({ data: rows });
        await tx.project.update({ where: { id: projectId }, data: { status: 'READY' } });

        return tx.socialPost.findMany({ where: { projectId } });
      },
      // Prisma's default interactive-transaction timeout (5s) is tight for
      // any remote/serverless Postgres (Neon, etc.) even after batching —
      // give it real headroom.
      { timeout: 20_000, maxWait: 10_000 },
    );

    return saved;
  });
}
