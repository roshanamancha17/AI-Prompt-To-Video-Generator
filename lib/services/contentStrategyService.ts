import { prisma } from '@/lib/db/prisma';
import { getAIProvider } from '@/lib/providers/ai/GeminiTextProvider';
import { ContentStrategySchema, ContentStrategyJsonSchema } from '@/lib/schemas/contentStrategy.schema';
import { buildProjectBrief } from './promptBuilders';
import { runTrackedJob } from './jobService';

export async function generateContentStrategy(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { brand: true },
  });

  return runTrackedJob(projectId, 'STRATEGY', async () => {
    const brief = await buildProjectBrief(project);
    const prompt = `You are a senior short-form content strategist. Analyze this content brief and determine the strategic foundation for the piece.

${brief}

Determine:
- core_problem: the specific emotional problem or pain point the audience feels
- emotion: the single dominant emotion this content should evoke
- hook: a punchy, specific opening line concept (not the full script — just the strategic hook idea)
- message: the core message/insight the content delivers
- cta_strategy: how and where a CTA fits, in plain language (not the literal text)
- content_angle: the unique angle that makes this different from generic content on the topic

Return ONLY JSON matching the required schema. Be specific to this exact topic — avoid generic statements that could apply to any content piece.`;

    const strategy = await getAIProvider().generateStructured(prompt, ContentStrategySchema, {
      jsonSchema: ContentStrategyJsonSchema,
      temperature: 0.8,
    });

    const saved = await prisma.$transaction(async (tx) => {
      await tx.contentStrategy.deleteMany({ where: { projectId } });
      const created = await tx.contentStrategy.create({
        data: {
          projectId,
          coreProblem: strategy.core_problem,
          emotion: strategy.emotion,
          hook: strategy.hook,
          message: strategy.message,
          ctaStrategy: strategy.cta_strategy,
          contentAngle: strategy.content_angle,
        },
      });
      await tx.project.update({ where: { id: projectId }, data: { status: 'REVIEW', strategyApproved: false } });
      return created;
    });

    return saved;
  });
}

export async function approveStrategy(projectId: string) {
  return prisma.project.update({ where: { id: projectId }, data: { strategyApproved: true, status: 'DRAFT' } });
}
