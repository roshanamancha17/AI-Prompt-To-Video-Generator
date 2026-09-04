import { z } from 'zod';

export const ContentTypeEnum = z.enum([
  'INSTAGRAM_REEL',
  'YOUTUBE_SHORT',
  'X_TWITTER',
  'FACEBOOK',
  'MULTI_PLATFORM',
]);

export const LanguageEnum = z.enum(['ENGLISH', 'HINDI', 'HINGLISH', 'CUSTOM']);

export const CtaLevelEnum = z.enum([
  'LEVEL_1_NONE',
  'LEVEL_2_SOFT_CURIOSITY',
  'LEVEL_3_PROFILE',
  'LEVEL_4_WEBSITE',
  'LEVEL_5_DIRECT',
]);

export const CreateProjectSchema = z.object({
  topic: z.string().min(10, 'Give at least a full sentence — this drives every downstream stage.').max(2000),
  contentType: ContentTypeEnum,
  language: LanguageEnum,
  customLanguage: z.string().max(100).optional(),
  audience: z.string().max(1000).optional(),
  brandId: z.string().optional(),
  pillarId: z.string().optional(),
  tone: z.array(z.string()).min(1, 'Pick at least one tone.'),
  targetDurationSec: z.coerce.number().int().min(5).max(120).default(30),
  imagePromptCount: z.coerce.number().int().min(1).max(20).default(7),
  thumbnailCount: z.coerce.number().int().min(1).max(6).default(2),
  xPostCount: z.coerce.number().int().min(0).max(10).default(5),
  ctaLevel: CtaLevelEnum.default('LEVEL_2_SOFT_CURIOSITY'),
  ctaText: z.string().max(300).optional(),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  additionalNotes: z.string().max(3000).optional(),
  maintainCharacterContinuity: z.boolean().default(true),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
