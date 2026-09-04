import { z } from 'zod';

export const SceneSchema = z.object({
  scene_number: z.number().int().positive(),
  duration_label: z.string().min(1),
  voiceover: z.string().min(1),
  onscreen_text: z.string().optional().default(''),
  visual_goal: z.string().min(1),
});

export const SceneListSchema = z.object({
  scenes: z.array(SceneSchema).min(1),
});

export type SceneOutput = z.infer<typeof SceneSchema>;

export const SceneListJsonSchema = {
  type: 'object',
  properties: {
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          scene_number: { type: 'integer' },
          duration_label: { type: 'string' },
          voiceover: { type: 'string' },
          onscreen_text: { type: 'string' },
          visual_goal: { type: 'string' },
        },
        required: ['scene_number', 'duration_label', 'voiceover', 'visual_goal'],
      },
    },
  },
  required: ['scenes'],
};
