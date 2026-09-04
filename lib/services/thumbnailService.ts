import { prisma } from '@/lib/db/prisma';
import { getAIProvider } from '@/lib/providers/ai/GeminiTextProvider';
import { ThumbnailListSchema, ThumbnailListJsonSchema } from '@/lib/schemas/imagePrompt.schema';
import type { CharacterBibleOutput } from '@/lib/schemas/imagePrompt.schema';
import { buildProjectBrief } from './promptBuilders';
import { formatCharacterBibleForPrompt, generateCharacterBible } from './characterBibleService';
import { runTrackedJob } from './jobService';

export async function generateThumbnails(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { brand: true, strategy: true, scripts: { where: { isActive: true }, take: 1 } },
  });

  const script = project.scripts[0];
  if (!script) throw new Error('A script is required before generating thumbnails.');

  return runTrackedJob(projectId, 'IMAGE_PROMPTS', async () => {
    let characterBible: CharacterBibleOutput | null = project.characterBible as CharacterBibleOutput | null;
    if (project.maintainCharacterContinuity && !characterBible) {
      characterBible = await generateCharacterBible(projectId);
    }

    const brief = await buildProjectBrief(project);
    const prompt = `You are designing thumbnail concepts for a short-form video — the single frame that decides whether someone taps play.

${brief}
${project.strategy ? `Hook: ${project.strategy.hook}\nCore problem: ${project.strategy.coreProblem}` : ''}

Script for context:
"""
${script.content}
"""

${characterBible ? `If a person appears, reuse these exact traits:\n${formatCharacterBibleForPrompt(characterBible)}` : ''}

Generate exactly ${project.thumbnailCount} distinct thumbnail concepts. Each needs:
- text: 2-6 words, very short, curiosity-driven, easy to read on mobile at a glance — NOT clickbait (e.g. "WHY DOES IT HURT?" not "YOU WON'T BELIEVE THIS")
- visual_concept: what the thumbnail shows
- emotional_trigger: the specific emotion this thumbnail is designed to trigger
- composition: how the text and visual are laid out together
- image_prompt: a full structured image prompt (subject, environment, action, emotion, lighting, camera, style, composition, negative_requirements) for the background visual, vertical 9:16, no text baked into the image itself (text is added as a separate overlay)

Return ONLY JSON matching the required schema.`;

    const { thumbnails } = await getAIProvider().generateStructured(prompt, ThumbnailListSchema, {
      jsonSchema: ThumbnailListJsonSchema,
      temperature: 0.85,
    });

    const created = await prisma.$transaction(
      async (tx) => {
        await tx.thumbnail.deleteMany({ where: { projectId } });
        const rows = [];
        for (const t of thumbnails) {
          const imagePrompt = await tx.imagePrompt.create({
            data: {
              context: 'THUMBNAIL',
              subject: t.image_prompt.subject,
              environment: t.image_prompt.environment,
              action: t.image_prompt.action,
              emotion: t.image_prompt.emotion,
              lighting: t.image_prompt.lighting,
              camera: t.image_prompt.camera,
              style: t.image_prompt.style,
              composition: t.image_prompt.composition,
              negativeRequirements: t.image_prompt.negative_requirements,
              aspectRatio: '9:16',
            },
          });
          const thumbnail = await tx.thumbnail.create({
            data: {
              projectId,
              text: t.text,
              visualConcept: t.visual_concept,
              emotionalTrigger: t.emotional_trigger,
              imagePromptId: imagePrompt.id,
            },
          });
          rows.push(thumbnail);
        }
        return rows;
      },
      // Each thumbnail needs its ImagePrompt row's freshly-created id before
      // the Thumbnail row can reference it, so this can't batch into a
      // single createMany the way socialCopyService/imagePromptService
      // could — but the row count is small (max 6), so a generous timeout
      // is enough of a safety net against remote-DB latency.
      { timeout: 15_000, maxWait: 10_000 },
    );

    return created;
  });
}
