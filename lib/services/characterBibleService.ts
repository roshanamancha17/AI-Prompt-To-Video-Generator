import { prisma } from '@/lib/db/prisma';
import { getAIProvider } from '@/lib/providers/ai/GeminiTextProvider';
import { CharacterBibleSchema, CharacterBibleJsonSchema, type CharacterBibleOutput } from '@/lib/schemas/imagePrompt.schema';
import { buildProjectBrief } from './promptBuilders';

export async function generateCharacterBible(projectId: string): Promise<CharacterBibleOutput> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { brand: true, strategy: true } });

  const brief = await buildProjectBrief(project);
  const prompt = `You are defining a recurring on-camera character for a short-form video, so every scene featuring this person stays visually consistent.

${brief}
${project.strategy ? `Content angle: ${project.strategy.contentAngle}` : ''}

Define one realistic, specific character appropriate for this audience and content:
- gender_and_age: e.g. "Indian male, 28 years old"
- ethnicity_or_region: e.g. "North Indian, medium complexion"
- hair: e.g. "short black hair, neatly styled"
- facial_hair: e.g. "trimmed beard" (empty string if not applicable)
- clothing: a specific, consistent outfit, e.g. "dark charcoal shirt, black watch"
- distinguishing_details: any other consistent visual trait
- recurring_setting: the default environment this character appears in, e.g. "modern minimalist apartment, warm evening light"

Return ONLY JSON matching the required schema.`;

  const bible = await getAIProvider().generateStructured(prompt, CharacterBibleSchema, {
    jsonSchema: CharacterBibleJsonSchema,
    temperature: 0.8,
  });

  await prisma.project.update({ where: { id: projectId }, data: { characterBible: bible } });

  return bible;
}

export function formatCharacterBibleForPrompt(bible: CharacterBibleOutput): string {
  return [
    `Character: ${bible.gender_and_age}, ${bible.ethnicity_or_region}`,
    `Hair: ${bible.hair}`,
    bible.facial_hair ? `Facial hair: ${bible.facial_hair}` : '',
    `Clothing: ${bible.clothing}`,
    bible.distinguishing_details ? `Distinguishing details: ${bible.distinguishing_details}` : '',
    `Recurring setting: ${bible.recurring_setting}`,
  ]
    .filter(Boolean)
    .join('\n');
}
