import { z } from 'zod';

export const ChannelInsightSchema = z.object({
  top_performing_patterns: z.string().min(1),
  common_mistakes: z.string().min(1),
  recommended_improvements: z.string().min(1),
  best_posting_times: z.string().min(1),
  top_hook_styles: z.string().min(1),
  topic_recommendations: z.string().min(1),
});

export type ChannelInsightOutput = z.infer<typeof ChannelInsightSchema>;

export const ChannelInsightJsonSchema = {
  type: 'object',
  properties: {
    top_performing_patterns: { type: 'string' },
    common_mistakes: { type: 'string' },
    recommended_improvements: { type: 'string' },
    best_posting_times: { type: 'string' },
    top_hook_styles: { type: 'string' },
    topic_recommendations: { type: 'string' },
  },
  required: [
    'top_performing_patterns',
    'common_mistakes',
    'recommended_improvements',
    'best_posting_times',
    'top_hook_styles',
    'topic_recommendations',
  ],
};
