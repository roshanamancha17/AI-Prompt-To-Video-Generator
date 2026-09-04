import type { Project, Brand } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

const CTA_LEVEL_GUIDANCE: Record<string, string> = {
  LEVEL_1_NONE: 'No call to action anywhere in this content. End on the idea itself.',
  LEVEL_2_SOFT_CURIOSITY: 'A soft, curiosity-driven closing line. No links, no asks — just a thought that lingers. e.g. "Maybe connection matters more than we realize."',
  LEVEL_3_PROFILE: 'A gentle nudge toward the profile/bio link. e.g. "Discover more through the link in bio."',
  LEVEL_4_WEBSITE: 'A direct but calm mention of the website. e.g. "Discover more: [WEBSITE_URL]"',
  LEVEL_5_DIRECT: 'A direct, confident call to action. e.g. "Applications are now open."',
};

const LANGUAGE_GUIDANCE: Record<string, string> = {
  ENGLISH: 'Write entirely in natural, conversational English.',
  HINDI: 'Write in Hindi using Devanagari script for Hindi words.',
  HINGLISH: `LANGUAGE RULE — this is critical:
Hindi words must be written in Devanagari script. English words that are naturally used in everyday Indian speech (dating, apps, connection, options, content, vibe, energy, etc.) should stay in English/Roman script — do not translate them into formal Hindi.
Do not use unnecessarily fancy or literary Hindi vocabulary (e.g. do not write "अनंत विकल्प" for "infinite options" — write "infinite options" in English within the Hindi sentence).
The result should read exactly like a real Indian person speaking casually — natural code-switching, not a translated document.
Example of CORRECT style: "Dating apps ने हमें infinite options दिए। लेकिन connection पहले से कम हो गया।"
Example of WRONG style (too formal/translated): "डेटिंग ऐप्स ने हमें अनंत विकल्प दिए।"`,
  CUSTOM: 'Follow the custom language description provided below exactly.',
};

export function buildBrandContext(project: Project & { brand?: Brand | null }): string {
  const brand = project.brand;
  const lines: string[] = [];

  if (brand?.name) lines.push(`Brand: ${brand.name}`);
  if (brand?.positioning) lines.push(`Positioning: ${brand.positioning}`);
  if (brand?.tone) lines.push(`Brand tone: ${brand.tone}`);
  if (brand?.wordsToAvoid?.length) lines.push(`NEVER use these words/tones: ${brand.wordsToAvoid.join(', ')}`);
  if (brand?.wordsToUse?.length) lines.push(`Prefer this vocabulary where natural: ${brand.wordsToUse.join(', ')}`);
  if (brand?.ctaStyle) lines.push(`CTA style: ${brand.ctaStyle}`);

  lines.push('Avoid corporate language, generic motivational clichés, and anything that reads as an advertisement.');

  return lines.join('\n');
}

export function buildLanguageInstruction(project: Project): string {
  const base = LANGUAGE_GUIDANCE[project.language] ?? LANGUAGE_GUIDANCE.ENGLISH;
  if (project.language === 'CUSTOM' && project.customLanguage) {
    return `${base}\nCustom language description: ${project.customLanguage}`;
  }
  return base;
}

export function buildCtaInstruction(project: Project): string {
  const guidance = CTA_LEVEL_GUIDANCE[project.ctaLevel] ?? CTA_LEVEL_GUIDANCE.LEVEL_2_SOFT_CURIOSITY;
  const ctaText = project.ctaText ? `\nUse this CTA text as the basis where a CTA is called for: "${project.ctaText}"` : '';
  const website = project.websiteUrl ? `\nWebsite: ${project.websiteUrl}` : '';
  return `CTA intensity — ${guidance}${ctaText}${website}`;
}

export async function buildChannelLearningsInstruction(userId: string): Promise<string> {
  const insight = await prisma.channelInsight.findFirst({
    where: { userId, platform: 'YOUTUBE' },
    orderBy: { generatedAt: 'desc' },
  });
  if (!insight) return '';

  return `LEARNINGS FROM YOUR CHANNEL'S PAST PERFORMANCE (based on ${insight.videosAnalyzed} recent videos — apply these, don't ignore them):
- What's working: ${insight.topPerformingPatterns}
- What to avoid: ${insight.commonMistakes}
- Hook style that performs: ${insight.topHookStyles}
- Recommended direction: ${insight.recommendedImprovements}`;
}

export async function buildProjectBrief(project: Project & { brand?: Brand | null; userId: string }): Promise<string> {
  const channelLearnings = await buildChannelLearningsInstruction(project.userId);

  return [
    `Topic / content idea: "${project.topic}"`,
    `Content type: ${project.contentType.replace(/_/g, ' ')}`,
    `Audience: ${project.audience || 'general audience'}`,
    `Tone: ${project.tone.join(', ') || 'conversational'}`,
    `Target duration: ${project.targetDurationSec} seconds`,
    project.additionalNotes ? `Additional instructions: ${project.additionalNotes}` : '',
    buildBrandContext(project),
    buildLanguageInstruction(project),
    buildCtaInstruction(project),
    channelLearnings,
  ]
    .filter(Boolean)
    .join('\n');
}
