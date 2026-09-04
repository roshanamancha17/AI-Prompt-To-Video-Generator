export interface VoiceSettings {
  voiceId: string;
  stability?: number;
  similarity?: number;
  style?: number;
  speed?: number;
}

export interface SynthesizeResult {
  assetUrl: string;
  durationSec: number;
}

/** Contract every voice-synthesis provider must satisfy. See AIProvider.ts for the rationale. */
export interface VoiceProvider {
  readonly name: string;
  synthesize(text: string, settings: VoiceSettings): Promise<SynthesizeResult>;
}
