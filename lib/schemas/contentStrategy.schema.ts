import { z } from 'zod';

export const ContentStrategySchema = z.object({
  core_problem: z.string().min(1),
  emotion: z.string().min(1),
  hook: z.string().min(1),
  message: z.string().min(1),
  cta_strategy: z.string().min(1),
  content_angle: z.string().min(1),
});

export type ContentStrategyOutput = z.infer<typeof ContentStrategySchema>;

// Plain JSON Schema mirror for Gemini's response_schema param — kept in sync
// by hand with the Zod schema above (see AI_PROVIDERS.md for why both exist).
export const ContentStrategyJsonSchema = {
  type: 'object',
  properties: {
    core_problem: { type: 'string' },
    emotion: { type: 'string' },
    hook: { type: 'string' },
    message: { type: 'string' },
    cta_strategy: { type: 'string' },
    content_angle: { type: 'string' },
  },
  required: ['core_problem', 'emotion', 'hook', 'message', 'cta_strategy', 'content_angle'],
};
