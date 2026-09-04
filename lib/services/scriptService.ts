import { prisma } from '@/lib/db/prisma';
import { getAIProvider } from '@/lib/providers/ai/GeminiTextProvider';
import { ScriptSchema, ScriptJsonSchema, type ScriptRefineAction } from '@/lib/schemas/script.schema';
import { buildProjectBrief } from './promptBuilders';
import { runTrackedJob } from './jobService';

const SCRIPT_WRITING_RULES = `The script must:
- Hook immediately in the first line — no throat-clearing or setup
- Sound like a real person talking, not a brand or a narrator
- Avoid corporate language and generic motivational clichés entirely
- Use short sentences with natural pauses (write it the way it should be spoken, not the way it would be written in an essay)
- Match the requested duration — pace the word count accordingly (roughly 2.3 words per second of spoken audio)
- Carry a clear emotional progression from the hook to the close
- End with a CTA only if the CTA strategy calls for one at this intensity — otherwise end on the idea itself`;

async function generateScriptCore(prompt: string, temperature: number) {
  return getAIProvider().generateStructured(prompt, ScriptSchema, { jsonSchema: ScriptJsonSchema, temperature });
}

async function nextVersionNumber(projectId: string): Promise<number> {
  const latest = await prisma.script.findFirst({ where: { projectId }, orderBy: { version: 'desc' } });
  return (latest?.version ?? 0) + 1;
}

async function saveNewScriptVersion(projectId: string, output: { full_script: string; voiceover_script: string; on_screen_text: string; estimated_duration_sec: number }) {
  return prisma.$transaction(async (tx) => {
    const version = await nextVersionNumber(projectId);
    await tx.script.updateMany({ where: { projectId }, data: { isActive: false } });
    return tx.script.create({
      data: {
        projectId,
        version,
        isActive: true,
        content: output.full_script,
        voiceoverVersion: output.voiceover_script,
        onScreenText: output.on_screen_text,
        estimatedDuration: output.estimated_duration_sec,
      },
    });
  });
}

export async function generateScript(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { brand: true, strategy: true },
  });

  if (!project.strategy) {
    throw new Error('Content strategy must be generated before the script.');
  }

  return runTrackedJob(projectId, 'SCRIPT', async () => {
    const brief = await buildProjectBrief(project);
    const prompt = `You are a senior short-form video scriptwriter. Write the full script for this piece.

${brief}

Strategy to follow:
- Core problem: ${project.strategy!.coreProblem}
- Target emotion: ${project.strategy!.emotion}
- Hook direction: ${project.strategy!.hook}
- Core message: ${project.strategy!.message}
- CTA strategy: ${project.strategy!.ctaStrategy}
- Content angle: ${project.strategy!.contentAngle}

${SCRIPT_WRITING_RULES}

Return:
- full_script: the complete script as it would be read/shown, including any on-screen text markers inline
- voiceover_script: the script formatted purely for voiceover recording (clean prose, no stage directions)
- on_screen_text: the short on-screen text overlays, one per line
- estimated_duration_sec: your estimate of spoken duration in seconds

Return ONLY JSON matching the required schema.`;

    const output = await generateScriptCore(prompt, 0.85);
    const script = await saveNewScriptVersion(projectId, output);
    await prisma.project.update({ where: { id: projectId }, data: { status: 'REVIEW', scriptApproved: false } });
    return script;
  });
}

const REFINE_INSTRUCTIONS: Record<ScriptRefineAction, string> = {
  shorter: 'Make this script noticeably shorter and tighter while keeping the hook and the core message intact. Cut anything that doesn\u2019t earn its place.',
  more_emotional: 'Deepen the emotional resonance of this script — more specific, felt language — without becoming melodramatic or losing its natural, conversational voice.',
  more_natural: 'Rewrite this script so it sounds exactly like a real person talking off the cuff — remove anything that sounds written or rehearsed.',
  more_conversational: 'Make this script feel more like a conversation with one person than a broadcast — more direct address, more natural rhythm.',
  change_hook: 'Keep everything after the first line the same, but write a new, stronger opening hook.',
  change_cta: 'Keep the rest of the script the same, but rewrite only the closing CTA line to better match the CTA strategy.',
  regenerate: 'Write an entirely new take on this script from the same strategy — a different angle on the hook, structure, or delivery.',
};

export async function refineScript(scriptId: string, action: ScriptRefineAction, customInstruction?: string) {
  const current = await prisma.script.findUniqueOrThrow({
    where: { id: scriptId },
    include: { project: { include: { brand: true, strategy: true } } },
  });

  const project = current.project;

  return runTrackedJob(project.id, 'SCRIPT', async () => {
    const brief = await buildProjectBrief(project);
    const prompt = `You are refining an existing short-form video script. Apply exactly one change; preserve everything else the instruction doesn't ask you to touch.

${brief}

Current script:
"""
${current.content}
"""

Refinement instruction: ${REFINE_INSTRUCTIONS[action]}
${customInstruction ? `Additional detail: ${customInstruction}` : ''}

${SCRIPT_WRITING_RULES}

Return the complete revised script as JSON matching the required schema — full_script, voiceover_script, on_screen_text, estimated_duration_sec.`;

    const output = await generateScriptCore(prompt, 0.85);
    const script = await saveNewScriptVersion(project.id, output);
    await prisma.project.update({ where: { id: project.id }, data: { scriptApproved: false } });
    return script;
  });
}

export async function saveScriptEdit(scriptId: string, content: string, voiceoverVersion: string, onScreenText?: string) {
  return prisma.script.update({
    where: { id: scriptId },
    data: { content, voiceoverVersion, onScreenText },
  });
}

export async function approveScript(projectId: string) {
  return prisma.project.update({ where: { id: projectId }, data: { scriptApproved: true, status: 'DRAFT' } });
}
