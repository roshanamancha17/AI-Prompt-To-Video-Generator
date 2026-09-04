import type { WordTiming } from '@/lib/providers/voice/ElevenLabsProvider';

export type SubtitleStyleKey = 'BOLD_CENTER' | 'KARAOKE_HIGHLIGHT' | 'MINIMAL_BOTTOM';

function toAssTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}:${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}

/** Groups words into short, mobile-readable cues (per spec: large readable text, few words at a time). */
function groupIntoCues(words: WordTiming[], maxWordsPerCue = 4): WordTiming[][] {
  const cues: WordTiming[][] = [];
  for (let i = 0; i < words.length; i += maxWordsPerCue) {
    cues.push(words.slice(i, i + maxWordsPerCue));
  }
  return cues;
}

const STYLE_HEADERS: Record<SubtitleStyleKey, string> = {
  // Large, bold, centered, black outline — readable over any background.
  BOLD_CENTER: `Style: Default,Noto Sans,72,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,4,2,5,80,80,220,1`,
  // Same base look; word highlighting is applied per-cue via \k karaoke tags in the dialogue lines.
  KARAOKE_HIGHLIGHT: `Style: Default,Noto Sans,72,&H00FFFFFF,&H0000D7FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,4,2,5,80,80,220,1`,
  // Smaller, bottom-anchored, less intrusive.
  MINIMAL_BOTTOM: `Style: Default,Noto Sans,54,&H00FFFFFF,&H000000FF,&H00000000,&H60000000,0,0,0,0,100,100,0,0,1,2,1,2,60,60,120,1`,
};

/**
 * Builds an ASS (Advanced SubStation Alpha) subtitle file from word-level
 * timings. ASS (not SRT) is used because it supports the styling and
 * per-word karaoke highlighting the spec calls for; SRT can't. Uses a
 * bundled-friendly font name (Noto Sans / Noto Sans Devanagari) — install
 * that font on the render host for Hindi/Hinglish text to display correctly
 * (see AI_PROVIDERS.md).
 */
export function buildAssSubtitles(words: WordTiming[], style: SubtitleStyleKey, videoWidth = 1080, videoHeight = 1920): string {
  const cues = groupIntoCues(words, style === 'MINIMAL_BOTTOM' ? 6 : 4);

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${videoWidth}
PlayResY: ${videoHeight}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
${STYLE_HEADERS[style]}

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
`;

  const lines = cues.map((cue) => {
    const start = cue[0].startSec;
    const end = cue[cue.length - 1].endSec;

    let text: string;
    if (style === 'KARAOKE_HIGHLIGHT') {
      // \k tags take centiseconds per word — ASS's native karaoke timing.
      text = cue.map((w) => `{\\k${Math.max(1, Math.round((w.endSec - w.startSec) * 100))}}${escapeAssText(w.word)}`).join(' ');
    } else {
      text = cue.map((w) => escapeAssText(w.word)).join(' ');
    }

    return `Dialogue: 0,${toAssTime(start)},${toAssTime(end)},Default,,0,0,0,,${text}`;
  });

  return header + lines.join('\n');
}

function escapeAssText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\n/g, '\\N').replace(/\{/g, '\\{').replace(/\}/g, '\\}');
}
