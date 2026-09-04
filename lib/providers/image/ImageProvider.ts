export interface ResolvedImagePrompt {
  subject: string;
  environment: string;
  action?: string;
  emotion: string;
  lighting: string;
  camera: string;
  style: string;
  composition: string;
  negativeRequirements?: string;
  aspectRatio: string;
}

export interface GeneratedImageResult {
  assetUrl: string;
  model: string;
  /** Which ImageProvider actually produced this (matches that provider's `.name`) — needed once more than one provider can produce a result for the same call, e.g. a fallback chain. */
  provider: string;
}

/** Contract every image-generation provider must satisfy. See AIProvider.ts for the rationale. */
export interface ImageProvider {
  readonly name: string;
  generateImage(prompt: ResolvedImagePrompt): Promise<GeneratedImageResult>;
}