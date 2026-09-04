import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import ffmpegPath from 'ffmpeg-static';
import { prisma } from '@/lib/db/prisma';
import { getStorageProvider } from '@/lib/providers/storage/S3StorageProvider';
import { buildAssSubtitles, type SubtitleStyleKey } from './subtitleService';
import type { WordTiming } from '@/lib/providers/voice/ElevenLabsProvider';

const VIDEO_WIDTH = 1080;
const VIDEO_HEIGHT = 1920;
const CROSSFADE_DURATION = 0.5; // seconds

interface SceneForRender {
  sceneNumber: number;
  voiceover: string;
  imageUrl: string;
}

interface SceneTimeRange {
  sceneNumber: number;
  imagePath: string;
  startSec: number;
  endSec: number;
}

/**
 * Maps each scene to a time range within the full voiceover, proportional
 * to its share of total spoken words. This is a best-effort approximation
 * (not exact text alignment) — robust to minor script edits made after
 * scenes were generated, but assumes scenes are in spoken order and
 * collectively cover the script.
 */
function mapScenesToTimeRanges(scenes: SceneForRender[], wordTimings: WordTiming[]): Omit<SceneTimeRange, 'imagePath'>[] {
  const totalWords = wordTimings.length;
  const sceneWordCounts = scenes.map((s) => Math.max(1, s.voiceover.trim().split(/\s+/).filter(Boolean).length));
  const totalSceneWords = sceneWordCounts.reduce((a, b) => a + b, 0);

  let cumulative = 0;
  const ranges: Omit<SceneTimeRange, 'imagePath'>[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const startIndex = Math.min(totalWords - 1, Math.round((cumulative / totalSceneWords) * totalWords));
    cumulative += sceneWordCounts[i];
    const endIndex = i === scenes.length - 1 ? totalWords - 1 : Math.min(totalWords - 1, Math.round((cumulative / totalSceneWords) * totalWords) - 1);

    ranges.push({
      sceneNumber: scenes[i].sceneNumber,
      startSec: wordTimings[Math.max(0, startIndex)]?.startSec ?? 0,
      endSec: wordTimings[Math.max(startIndex, endIndex)]?.endSec ?? wordTimings[totalWords - 1]?.endSec ?? 0,
    });
  }

  return ranges;
}

async function downloadToFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download asset for render: ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(destPath, buffer);
}

/** ffmpeg's filter-argument parser treats ':' as a special character — escape it (and backslashes) for Windows-style paths and any path with a drive letter. */
function escapeFfmpegFilterPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/:/g, '\\:');
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error('ffmpeg-static did not resolve a binary path for this platform.'));
      return;
    }
    if (!existsSync(ffmpegPath)) {
      // Most common cause: Next.js webpack bundled ffmpeg-static into
      // .next/server/vendor-chunks instead of leaving it as an external
      // runtime require(), which breaks its internal binary-path resolution.
      // Fix: add 'ffmpeg-static' to experimental.serverComponentsExternalPackages
      // in next.config.mjs and restart the dev server.
      reject(new Error(
        `ffmpeg binary not found at resolved path: ${ffmpegPath}. ` +
        `This usually means ffmpeg-static got bundled by webpack instead of ` +
        `left as an external package — check next.config.mjs's ` +
        `experimental.serverComponentsExternalPackages includes 'ffmpeg-static', ` +
        `then restart the dev server.`
      ));
      return;
    }
    const proc = spawn(ffmpegPath as string, args);
    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else {
        console.error('ffmpeg failed:', stderr.slice(-4000));
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
  });
}

async function buildCutVideo(ranges: SceneTimeRange[], subsPath: string, outputPath: string): Promise<void> {
  const listPath = path.join(path.dirname(outputPath), 'concat-list.txt');
  const lines: string[] = [];
  for (const r of ranges) {
    const duration = Math.max(0.5, r.endSec - r.startSec);
    lines.push(`file '${r.imagePath.replace(/'/g, "'\\''")}'`);
    lines.push(`duration ${duration.toFixed(3)}`);
  }
  // ffmpeg's concat demuxer ignores the last entry's duration unless the
  // final file is repeated — a well-known quirk of the format.
  lines.push(`file '${ranges[ranges.length - 1].imagePath.replace(/'/g, "'\\''")}'`);
  await fs.writeFile(listPath, lines.join('\n'));

  const vf = `scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=increase,crop=${VIDEO_WIDTH}:${VIDEO_HEIGHT},subtitles='${escapeFfmpegFilterPath(subsPath)}'`;

  await runFfmpeg([
    '-y',
    '-f', 'concat', '-safe', '0', '-i', listPath,
    '-vf', vf,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30',
    outputPath,
  ]);
}

async function buildCrossfadeVideo(ranges: SceneTimeRange[], subsPath: string, outputPath: string): Promise<void> {
  const inputs: string[] = [];
  const durations = ranges.map((r) => Math.max(1, r.endSec - r.startSec) + (ranges.length > 1 ? CROSSFADE_DURATION : 0));

  ranges.forEach((r, i) => {
    inputs.push('-loop', '1', '-t', durations[i].toFixed(3), '-i', r.imagePath);
  });

  const scaleFilters = ranges.map((_, i) => `[${i}:v]scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=increase,crop=${VIDEO_WIDTH}:${VIDEO_HEIGHT},setsar=1[s${i}]`);

  let chain = '';
  let cumulative = 0;
  let lastLabel = 's0';
  for (let i = 1; i < ranges.length; i++) {
    cumulative += durations[i - 1] - CROSSFADE_DURATION;
    const outLabel = i === ranges.length - 1 ? 'vout' : `x${i}`;
    chain += `[${lastLabel}][s${i}]xfade=transition=fade:duration=${CROSSFADE_DURATION}:offset=${cumulative.toFixed(3)}[${outLabel}];`;
    lastLabel = outLabel;
  }
  const finalLabel = ranges.length === 1 ? 's0' : 'vout';

  const filterComplex = [...scaleFilters, chain].join(';').replace(/;;/g, ';').replace(/;$/, '');
  const subsFilter = `[${finalLabel}]subtitles='${escapeFfmpegFilterPath(subsPath)}'[final]`;

  await runFfmpeg([
    '-y',
    ...inputs,
    '-filter_complex', `${filterComplex};${subsFilter}`,
    '-map', '[final]',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30',
    outputPath,
  ]);
}

async function muxAudio(videoOnlyPath: string, voicePath: string, musicPath: string | null, musicVolume: number, finalOutputPath: string): Promise<void> {
  if (!musicPath) {
    await runFfmpeg([
      '-y',
      '-i', videoOnlyPath,
      '-i', voicePath,
      '-map', '0:v', '-map', '1:a',
      '-c:v', 'copy', '-c:a', 'aac',
      '-shortest',
      finalOutputPath,
    ]);
    return;
  }

  await runFfmpeg([
    '-y',
    '-i', videoOnlyPath,
    '-i', voicePath,
    '-i', musicPath,
    '-filter_complex', `[2:a]volume=${musicVolume}[music];[1:a][music]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
    '-map', '0:v', '-map', '[aout]',
    '-c:v', 'copy', '-c:a', 'aac',
    '-shortest',
    finalOutputPath,
  ]);
}

export async function renderProjectVideo(projectId: string): Promise<{ renderId: string; assetUrl: string }> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      scenes: {
        orderBy: { sceneNumber: 'asc' },
        include: { imagePrompts: { where: { isActive: true }, include: { generatedImages: { where: { isActive: true }, include: { asset: true } } } } },
      },
      voiceovers: { where: { isActive: true }, take: 1, include: { asset: true } },
      videoRenderSettings: true,
    },
  });

  const voiceover = project.voiceovers[0];
  if (!voiceover?.asset?.url) throw new Error('Generate a voiceover before rendering the video.');
  if (!voiceover.wordTimings) throw new Error('This voiceover has no timing data — regenerate it to enable video rendering.');

  const scenesWithImages = project.scenes
    .map((s) => ({
      sceneNumber: s.sceneNumber,
      voiceover: s.voiceover,
      imageUrl: s.imagePrompts[0]?.generatedImages[0]?.asset?.url,
    }))
    .filter((s): s is SceneForRender => Boolean(s.imageUrl));

  if (scenesWithImages.length === 0) throw new Error('Generate at least one scene image before rendering the video.');

  const settings = project.videoRenderSettings ?? { transition: 'CUT' as const, subtitleStyle: 'BOLD_CENTER' as const, backgroundMusicUrl: null, musicVolume: 0.15 };

  const render = await prisma.videoRender.create({ data: { projectId, status: 'PROCESSING', startedAt: new Date() } });

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `render-${projectId}-`));

  try {
    // Download all assets locally — ffmpeg needs local files, not remote URLs.
    const imagePaths: Record<number, string> = {};
    for (const s of scenesWithImages) {
      const p = path.join(tempDir, `scene-${String(s.sceneNumber).padStart(2, '0')}.jpg`);
      await downloadToFile(s.imageUrl, p);
      imagePaths[s.sceneNumber] = p;
    }

    const voicePath = path.join(tempDir, 'voice.mp3');
    await downloadToFile(voiceover.asset.url, voicePath);

    let musicPath: string | null = null;
    if (settings.backgroundMusicUrl) {
      musicPath = path.join(tempDir, 'music.mp3');
      await downloadToFile(settings.backgroundMusicUrl, musicPath);
    }

    const wordTimings = voiceover.wordTimings as unknown as WordTiming[];
    const timeRanges = mapScenesToTimeRanges(scenesWithImages, wordTimings).map((r) => ({ ...r, imagePath: imagePaths[r.sceneNumber] }));

    const subsPath = path.join(tempDir, 'subs.ass');
    await fs.writeFile(subsPath, buildAssSubtitles(wordTimings, settings.subtitleStyle as SubtitleStyleKey, VIDEO_WIDTH, VIDEO_HEIGHT));

    const videoOnlyPath = path.join(tempDir, 'video-only.mp4');
    if (settings.transition === 'CROSSFADE') {
      await buildCrossfadeVideo(timeRanges, subsPath, videoOnlyPath);
    } else {
      await buildCutVideo(timeRanges, subsPath, videoOnlyPath);
    }

    const finalPath = path.join(tempDir, 'final.mp4');
    await muxAudio(videoOnlyPath, voicePath, musicPath, settings.musicVolume, finalPath);

    const finalBuffer = await fs.readFile(finalPath);
    const key = `projects/${projectId}/renders/${render.id}.mp4`;
    const uploaded = await getStorageProvider().upload(key, finalBuffer, 'video/mp4');

    const asset = await prisma.asset.create({
      data: { projectId, type: 'VIDEO', url: uploaded.url, storageProvider: getStorageProvider().name, sizeBytes: uploaded.sizeBytes, mimeType: 'video/mp4' },
    });

    await prisma.videoRender.update({ where: { id: render.id }, data: { status: 'COMPLETED', assetId: asset.id, completedAt: new Date() } });

    return { renderId: render.id, assetUrl: uploaded.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown render error';
    await prisma.videoRender.update({ where: { id: render.id }, data: { status: 'FAILED', errorMessage: message, completedAt: new Date() } });
    throw err;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function getOrCreateRenderSettings(projectId: string) {
  const existing = await prisma.videoRenderSettings.findUnique({ where: { projectId } });
  if (existing) return existing;
  return prisma.videoRenderSettings.create({ data: { projectId } });
}

export async function updateRenderSettings(projectId: string, data: { transition?: 'CUT' | 'CROSSFADE'; subtitleStyle?: 'BOLD_CENTER' | 'KARAOKE_HIGHLIGHT' | 'MINIMAL_BOTTOM'; backgroundMusicUrl?: string | null; musicVolume?: number }) {
  return prisma.videoRenderSettings.upsert({
    where: { projectId },
    create: { projectId, ...data },
    update: data,
  });
}