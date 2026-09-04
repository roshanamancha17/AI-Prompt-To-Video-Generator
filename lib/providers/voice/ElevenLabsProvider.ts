import type { VoiceProvider, VoiceSettings, SynthesizeResult } from './VoiceProvider';
import { ProviderConfigError, ProviderRequestError, ProviderTimeoutError } from '@/lib/providers/ai/GeminiTextProvider';

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';
// eleven_multilingual_v2 for quality across 32 languages including Hindi —
// appropriate default given Hindi/Hinglish is a first-class language option.
const DEFAULT_MODEL = 'eleven_multilingual_v2';

export interface WordTiming {
  word: string;
  startSec: number;
  endSec: number;
}

interface AlignmentResponse {
  audio_base64: string;
  alignment: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  };
}

/** Groups character-level alignment into word-level timings by splitting on whitespace. */
function alignmentToWordTimings(alignment: AlignmentResponse['alignment']): WordTiming[] {
  const words: WordTiming[] = [];
  let current: { chars: string[]; start: number; end: number } | null = null;

  for (let i = 0; i < alignment.characters.length; i++) {
    const ch = alignment.characters[i];
    if (/\s/.test(ch)) {
      if (current) {
        words.push({ word: current.chars.join(''), startSec: current.start, endSec: current.end });
        current = null;
      }
      continue;
    }
    if (!current) current = { chars: [], start: alignment.character_start_times_seconds[i], end: alignment.character_end_times_seconds[i] };
    current.chars.push(ch);
    current.end = alignment.character_end_times_seconds[i];
  }
  if (current) words.push({ word: current.chars.join(''), startSec: current.start, endSec: current.end });

  return words;
}

/**
 * ElevenLabs text-to-speech with character-level timing alignment. Verified
 * against the current ElevenLabs API docs at build time: POST
 * /v1/text-to-speech/{voice_id}/with-timestamps returns
 * { audio_base64, alignment: { characters, character_start_times_seconds,
 * character_end_times_seconds } } — the same request body as the plain
 * endpoint, so there's no reason to use the non-timestamped endpoint at all;
 * this always gives us subtitle-ready timing for free.
 */
export class ElevenLabsProvider implements VoiceProvider {
  readonly name = 'elevenlabs';

  private get apiKey(): string {
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) throw new ProviderConfigError('ELEVENLABS_API_KEY is not configured.');
    return key;
  }

  async synthesize(text: string, settings: VoiceSettings): Promise<SynthesizeResult & { audioBuffer: Buffer; wordTimings: WordTiming[] }> {
    const url = `${ELEVENLABS_API_BASE}/text-to-speech/${settings.voiceId}/with-timestamps`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': this.apiKey },
        body: JSON.stringify({
          text,
          model_id: DEFAULT_MODEL,
          voice_settings: {
            stability: settings.stability ?? 0.5,
            similarity_boost: settings.similarity ?? 0.75,
            style: settings.style ?? 0,
            speed: settings.speed ?? 1.0,
            use_speaker_boost: true,
          },
        }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      if ((err as Error).name === 'AbortError') throw new ProviderTimeoutError('ElevenLabs request timed out.');
      throw new ProviderRequestError('Could not reach ElevenLabs.', err);
    }
    clearTimeout(timeout);

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`ElevenLabs API error ${res.status}:`, body);
      throw new ProviderRequestError(`ElevenLabs API responded with status ${res.status}.`);
    }

    const data: AlignmentResponse = await res.json();
    const audioBuffer = Buffer.from(data.audio_base64, 'base64');
    const wordTimings = alignmentToWordTimings(data.alignment);
    const durationSec = wordTimings.length ? wordTimings[wordTimings.length - 1].endSec : 0;

    return { assetUrl: '', durationSec, audioBuffer, wordTimings };
  }
}

let _instance: ElevenLabsProvider | null = null;
export function getVoiceProvider(): ElevenLabsProvider {
  if (!_instance) _instance = new ElevenLabsProvider();
  return _instance;
}
