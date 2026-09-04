import { z } from 'zod';

export const ImagePromptFieldsSchema = z.object({
  subject: z.string().min(1),
  environment: z.string().min(1),
  action: z.string().optional().default(''),
  emotion: z.string().min(1),
  lighting: z.string().min(1),
  camera: z.string().min(1),
  style: z.string().min(1),
  composition: z.string().min(1),
  negative_requirements: z.string().optional().default(''),
});

export const ScenePromptListSchema = z.object({
  prompts: z.array(ImagePromptFieldsSchema.extend({ scene_number: z.number().int().positive() })).min(1),
});

export type ImagePromptFieldsOutput = z.infer<typeof ImagePromptFieldsSchema>;

const imagePromptObjectSchema = {
  type: 'object',
  properties: {
    subject: { type: 'string' },
    environment: { type: 'string' },
    action: { type: 'string' },
    emotion: { type: 'string' },
    lighting: { type: 'string' },
    camera: { type: 'string' },
    style: { type: 'string' },
    composition: { type: 'string' },
    negative_requirements: { type: 'string' },
  },
  required: ['subject', 'environment', 'emotion', 'lighting', 'camera', 'style', 'composition'],
};

export const ScenePromptListJsonSchema = {
  type: 'object',
  properties: {
    prompts: {
      type: 'array',
      items: {
        type: 'object',
        properties: { scene_number: { type: 'integer' }, ...imagePromptObjectSchema.properties },
        required: ['scene_number', ...imagePromptObjectSchema.required],
      },
    },
  },
  required: ['prompts'],
};

export const CharacterBibleSchema = z.object({
  gender_and_age: z.string().min(1),
  ethnicity_or_region: z.string().min(1),
  hair: z.string().min(1),
  facial_hair: z.string().optional().default(''),
  clothing: z.string().min(1),
  distinguishing_details: z.string().optional().default(''),
  recurring_setting: z.string().min(1),
});

export type CharacterBibleOutput = z.infer<typeof CharacterBibleSchema>;

export const CharacterBibleJsonSchema = {
  type: 'object',
  properties: {
    gender_and_age: { type: 'string' },
    ethnicity_or_region: { type: 'string' },
    hair: { type: 'string' },
    facial_hair: { type: 'string' },
    clothing: { type: 'string' },
    distinguishing_details: { type: 'string' },
    recurring_setting: { type: 'string' },
  },
  required: ['gender_and_age', 'ethnicity_or_region', 'hair', 'clothing', 'recurring_setting'],
};

export const ThumbnailConceptSchema = z.object({
  text: z.string().min(1),
  visual_concept: z.string().min(1),
  emotional_trigger: z.string().min(1),
  composition: z.string().min(1),
  image_prompt: ImagePromptFieldsSchema,
});

export const ThumbnailListSchema = z.object({
  thumbnails: z.array(ThumbnailConceptSchema).min(1),
});

export const ThumbnailListJsonSchema = {
  type: 'object',
  properties: {
    thumbnails: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          visual_concept: { type: 'string' },
          emotional_trigger: { type: 'string' },
          composition: { type: 'string' },
          image_prompt: imagePromptObjectSchema,
        },
        required: ['text', 'visual_concept', 'emotional_trigger', 'composition', 'image_prompt'],
      },
    },
  },
  required: ['thumbnails'],
};
