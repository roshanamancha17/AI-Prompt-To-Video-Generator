import { prisma } from '@/lib/db/prisma';
import { getAIProvider } from '@/lib/providers/ai/GeminiTextProvider';
import { SceneListSchema, SceneListJsonSchema } from '@/lib/schemas/scene.schema';
import { buildProjectBrief } from './promptBuilders';
import { runTrackedJob } from './jobService';

export async function generateScenes(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { brand: true, scripts: { where: { isActive: true }, take: 1 } },
  });

  const script = project.scripts[0];
  if (!script) throw new Error('An approved script is required before generating scenes.');
  if (!project.scriptApproved) throw new Error('Approve the script before generating scenes.');

  return runTrackedJob(projectId, 'SCENES', async () => {
    const brief = await buildProjectBrief(project);
    const prompt = `You are a short-form video director breaking a script into scenes for visual production.

${brief}

Script to break down:
"""
${script.content}
"""

Break this into scenes, each visually supporting the exact line being spoken at that moment. Create clear visual progression across the scenes (e.g. hook \u2192 problem \u2192 emotional escalation \u2192 insight \u2192 resolution \u2192 CTA) — avoid repeating the same type of shot twice in a row.

For each scene return:
- scene_number: sequential starting at 1
- duration_label: an approximate time range like "0-2 sec"
- voiceover: the exact line(s) of voiceover spoken during this scene
- onscreen_text: any on-screen text for this scene (empty string if none)
- visual_goal: one sentence describing what this scene needs to visually communicate

Return ONLY JSON matching the required schema.`;

    const { scenes } = await getAIProvider().generateStructured(prompt, SceneListSchema, {
      jsonSchema: SceneListJsonSchema,
      temperature: 0.8,
    });

    const saved = await prisma.$transaction(
      async (tx) => {
        await tx.scene.deleteMany({ where: { projectId } });
        await tx.scene.createMany({
          data: scenes.map((s) => ({
            projectId,
            sceneNumber: s.scene_number,
            durationLabel: s.duration_label,
            voiceover: s.voiceover,
            onscreenText: s.onscreen_text,
            visualGoal: s.visual_goal,
          })),
        });
        return tx.scene.findMany({ where: { projectId }, orderBy: { sceneNumber: 'asc' } });
      },
      { timeout: 15_000, maxWait: 10_000 },
    );

    return saved;
  });
}
