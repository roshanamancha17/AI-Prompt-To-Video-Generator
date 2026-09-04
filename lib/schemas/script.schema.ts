import { z } from 'zod';

export const ScriptSchema = z.object({
  full_script: z.string().min(1),
  voiceover_script: z.string().min(1),
  on_screen_text: z.string().min(1),
  estimated_duration_sec: z.number().int().positive(),
});

export type ScriptOutput = z.infer<typeof ScriptSchema>;

export const ScriptJsonSchema = {
  type: 'object',
  properties: {
    full_script: { type: 'string' },
    voiceover_script: { type: 'string' },
    on_screen_text: { type: 'string' },
    estimated_duration_sec: { type: 'integer' },
  },
  required: ['full_script', 'voiceover_script', 'on_screen_text', 'estimated_duration_sec'],
};

export const ScriptRefineActionSchema = z.enum([
  'shorter',
  'more_emotional',
  'more_natural',
  'more_conversational',
  'change_hook',
  'change_cta',
  'regenerate',
]);

export type ScriptRefineAction = z.infer<typeof ScriptRefineActionSchema>;
