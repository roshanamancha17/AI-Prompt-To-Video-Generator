import { prisma } from '@/lib/db/prisma';
import { getAIProvider } from '@/lib/providers/ai/GeminiTextProvider';
import { isPrimaryImageProviderSearchBased } from '@/lib/providers/image/registry';
import { ScenePromptListSchema, ScenePromptListJsonSchema } from '@/lib/schemas/imagePrompt.schema';
import type { CharacterBibleOutput } from '@/lib/schemas/imagePrompt.schema';
import { buildProjectBrief } from './promptBuilders';
import { generateCharacterBible, formatCharacterBibleForPrompt } from './characterBibleService';
import { runTrackedJob } from './jobService';

export async function generateImagePrompts(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { brand: true, scenes: { orderBy: { sceneNumber: 'asc' } } },
  });

  if (project.scenes.length === 0) throw new Error('Scenes must be generated before image prompts.');

  return runTrackedJob(projectId, 'IMAGE_PROMPTS', async () => {
    const brief = await buildProjectBrief(project);
    const usingSearchProvider = isPrimaryImageProviderSearchBased();

    // Search-based providers (Unsplash) match against real existing
    // photos by generic keyword, not by rendering an exact description —
    // so a hyper-specific prompt (exact ethnicity, wardrobe, accessories)
    // is wasted effort AND actively hurts search results (see
    // UnsplashImageProvider.ts, which was reliably getting zero matches
    // on the old detailed prompts). Skip character continuity entirely
    // in this mode too — a "recurring exact character" isn't something
    // stock photo search can honor regardless of prompt wording.
    let characterBible: CharacterBibleOutput | null = null;
    if (!usingSearchProvider) {
      characterBible = project.characterBible as CharacterBibleOutput | null;
      if (project.maintainCharacterContinuity && !characterBible) {
        characterBible = await generateCharacterBible(projectId);
      }
    }

    const prompt = usingSearchProvider
      ? buildSearchKeywordPrompt(brief, project.scenes)
      : buildGenerativePrompt(brief, project.scenes, characterBible);

    const { prompts } = await getAIProvider().generateStructured(prompt, ScenePromptListSchema, {
      jsonSchema: ScenePromptListJsonSchema,
      temperature: 0.85,
    });

    const sceneByNumber = new Map(project.scenes.map((s) => [s.sceneNumber, s]));

    const rowsToCreate = prompts
      .map((p) => {
        const scene = sceneByNumber.get(p.scene_number);
        if (!scene) return null;
        return {
          sceneId: scene.id,
          context: 'SCENE' as const,
          version: 1,
          isActive: true,
          subject: p.subject,
          environment: p.environment,
          action: p.action,
          emotion: p.emotion,
          lighting: p.lighting,
          camera: p.camera,
          style: p.style,
          composition: p.composition,
          negativeRequirements: p.negative_requirements,
          aspectRatio: '9:16',
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    const created = await prisma.$transaction(
      async (tx) => {
        // One updateMany for every scene in the project instead of one
        // per-scene round-trip, then one createMany instead of N creates —
        // far fewer queries than the previous per-scene loop, which could
        // do up to 40 sequential round-trips for a large scene count.
        await tx.imagePrompt.updateMany({
          where: { isActive: true, scene: { projectId } },
          data: { isActive: false },
        });
        await tx.imagePrompt.createMany({ data: rowsToCreate });

        return tx.imagePrompt.findMany({
          where: { isActive: true, scene: { projectId } },
          orderBy: { scene: { sceneNumber: 'asc' } },
        });
      },
      { timeout: 20_000, maxWait: 10_000 },
    );

    return created;
  });
}

function buildGenerativePrompt(
  brief: string,
  scenes: Array<{ sceneNumber: number; durationLabel: string; voiceover: string; visualGoal: string }>,
  characterBible: CharacterBibleOutput | null,
): string {
  return `You are a photo director writing Gemini image-generation prompts for each scene of a short-form video, optimized for realistic cinematic photography.

${brief}

${characterBible ? `CHARACTER CONTINUITY — reuse these exact traits in every prompt where a person appears:\n${formatCharacterBibleForPrompt(characterBible)}` : 'No fixed on-camera character — vary subjects naturally per scene.'}

Scenes to illustrate:
${scenes.map((s) => `Scene ${s.sceneNumber} (${s.durationLabel}): "${s.voiceover}" — visual goal: ${s.visualGoal}`).join('\n')}

For each scene write a distinct, specific image prompt with real visual progression across scenes — avoid repeating the same shot type twice in a row. Each prompt needs:
- subject: who/what is in frame, with age range and specifics
- environment: the setting
- action: what's happening (optional but preferred)
- emotion: the feeling the shot should convey
- lighting: specific lighting description
- camera: angle, lens feel, framing
- style: e.g. "realistic cinematic photography, shallow depth of field"
- composition: rule of thirds, framing details, vertical 9:16 composition
- negative_requirements: what must NOT appear (e.g. "no text overlays, no logos, no cartoonish style")

Do not put text inside the images unless the scene explicitly calls for on-screen text as a graphic element.

Return ONLY JSON matching the required schema, one entry per scene_number.`;
}

/**
 * Lightweight variant for search-based providers. Same output schema as
 * the generative prompt (subject/environment/emotion/lighting/camera/
 * style/composition all still required, non-empty strings) since the DB
 * columns and downstream code don't change — but the actual instructions
 * ask for short, generic, stock-photo-searchable keywords instead of an
 * exact rendered description, and the fields a search can't use anyway
 * (emotion/lighting/camera/composition) are asked for as short filler
 * rather than detailed direction, since writing real direction for them
 * would just be wasted tokens no provider in this mode reads closely.
 */
function buildSearchKeywordPrompt(
  brief: string,
  scenes: Array<{ sceneNumber: number; durationLabel: string; voiceover: string; visualGoal: string }>,
): string {
  return `You are choosing stock-photo search keywords for each scene of a short-form video. These keywords will be used to SEARCH an existing photo library (Unsplash) — not to generate a new image — so they must be short, generic, and likely to match a real photo that already exists. Do not invent specific ethnicity, exact age, wardrobe detail, or accessories; a search for that level of specificity reliably returns zero results.

${brief}

Scenes to illustrate:
${scenes.map((s) => `Scene ${s.sceneNumber} (${s.durationLabel}): "${s.voiceover}" — visual goal: ${s.visualGoal}`).join('\n')}

For each scene write:
- subject: 1-3 generic words for who/what should be in frame (e.g. "man", "woman", "couple", "coffee cup", "city street") — no age, ethnicity, or wardrobe detail
- action: 2-4 generic words for the activity/gesture (e.g. "using phone", "laughing together", "drinking coffee") — this IS used in the search, so keep it a common, photographable activity. If the scene's real action is very specific or culturally particular (a specific ritual, gesture, or object most stock libraries won't have), write the closest common equivalent instead (e.g. "tying a bracelet" or "hands close together" rather than a named specific ritual) — an approximate real match beats an exact search term with no results.
- environment: 2-5 generic words for the setting (e.g. "modern apartment window", "busy city street at night")
- style: 1-3 generic mood words (e.g. "cinematic", "candid", "bright and airy")
- emotion, lighting, camera, composition: brief filler is fine (e.g. "neutral", "natural light", "eye level", "centered") — these aren't used for search, just keep them short
- negative_requirements: leave as an empty string

Return ONLY JSON matching the required schema, one entry per scene_number.`;
}

export async function updateImagePromptField(imagePromptId: string, field: string, value: string) {
  const allowed = ['subject', 'environment', 'action', 'emotion', 'lighting', 'camera', 'style', 'composition', 'negativeRequirements'];
  if (!allowed.includes(field)) throw new Error('Invalid field.');
  return prisma.imagePrompt.update({ where: { id: imagePromptId }, data: { [field]: value } });
}