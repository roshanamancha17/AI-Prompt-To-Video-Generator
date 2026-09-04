import { z } from 'zod';

export const SocialCopySchema = z.object({
  youtube: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    hashtags: z.array(z.string()).min(1),
    keywords: z.array(z.string()).default([]),
  }),
  instagram: z.object({
    caption: z.string().min(1),
    hashtags: z.array(z.string()).min(1),
    first_comment: z.string().optional().default(''),
    story_cta: z.string().optional().default(''),
  }),
  facebook: z.object({
    caption: z.string().min(1),
    hashtags: z.array(z.string()).default([]),
  }),
  x_posts: z
    .array(
      z.object({
        content: z.string().min(1),
        image_prompt: z.string().min(1),
      }),
    )
    .default([]),
});

export type SocialCopyOutput = z.infer<typeof SocialCopySchema>;

export const SocialCopyJsonSchema = {
  type: 'object',
  properties: {
    youtube: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        hashtags: { type: 'array', items: { type: 'string' } },
        keywords: { type: 'array', items: { type: 'string' } },
      },
      required: ['title', 'description', 'hashtags'],
    },
    instagram: {
      type: 'object',
      properties: {
        caption: { type: 'string' },
        hashtags: { type: 'array', items: { type: 'string' } },
        first_comment: { type: 'string' },
        story_cta: { type: 'string' },
      },
      required: ['caption', 'hashtags'],
    },
    facebook: {
      type: 'object',
      properties: {
        caption: { type: 'string' },
        hashtags: { type: 'array', items: { type: 'string' } },
      },
      required: ['caption'],
    },
    x_posts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          content: { type: 'string' },
          image_prompt: { type: 'string' },
        },
        required: ['content', 'image_prompt'],
      },
    },
  },
  required: ['youtube', 'instagram', 'facebook', 'x_posts'],
};
