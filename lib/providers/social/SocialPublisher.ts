export interface PlatformCredentials {
  accessToken: string;
  refreshToken?: string;
}

export interface PublishableSocialPost {
  platform: 'YOUTUBE' | 'INSTAGRAM' | 'FACEBOOK' | 'X_TWITTER';
  content: string;
  assetUrl?: string;
}

export interface PublishResult {
  externalId: string;
}

/**
 * Contract every social-platform publisher must satisfy. Not implemented
 * until Phase 7 — Phase 1–5 is export-only, per the "do not fake posting"
 * requirement. Defining the interface now means the export flow and this
 * flow can share the same SocialPost data without a rewrite later.
 */
export interface SocialPublisher {
  readonly platform: PublishableSocialPost['platform'];
  publish(post: PublishableSocialPost, credentials: PlatformCredentials): Promise<PublishResult>;
}
