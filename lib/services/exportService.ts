import JSZip from 'jszip';
import { prisma } from '@/lib/db/prisma';

async function fetchAsBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.error(`Could not fetch asset for export: ${url}`, err);
    return null;
  }
}

/**
 * Builds the content package exactly per spec section 24:
 *   script.txt, voiceover.mp3, images/scene-NN.png, thumbnails/thumbnail-NN.png,
 *   youtube.txt, instagram.txt, facebook.txt, twitter/post-NN.txt
 */
export async function buildContentPackage(projectId: string): Promise<Buffer> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      scripts: { where: { isActive: true }, take: 1 },
      voiceovers: { where: { isActive: true }, take: 1, include: { asset: true } },
      scenes: {
        orderBy: { sceneNumber: 'asc' },
        include: { imagePrompts: { where: { isActive: true }, include: { generatedImages: { where: { isActive: true }, include: { asset: true } } } } },
      },
      thumbnails: { include: { imagePrompt: { include: { generatedImages: { where: { isActive: true }, include: { asset: true } } } } } },
      socialPosts: true,
      videoRenders: { where: { status: 'COMPLETED' }, orderBy: { createdAt: 'desc' }, take: 1, include: { asset: true } },
    },
  });

  const zip = new JSZip();
  const script = project.scripts[0];

  if (script) {
    zip.file(
      'script.txt',
      `FULL SCRIPT\n${'='.repeat(40)}\n${script.content}\n\nVOICEOVER VERSION\n${'='.repeat(40)}\n${script.voiceoverVersion}\n\nON-SCREEN TEXT\n${'='.repeat(40)}\n${script.onScreenText ?? ''}\n`,
    );
  }

  const voiceover = project.voiceovers[0];
  if (voiceover?.asset?.url) {
    const audio = await fetchAsBuffer(voiceover.asset.url);
    if (audio) zip.file('voiceover.mp3', audio);
  }

  const latestVideo = project.videoRenders[0];
  if (latestVideo?.asset?.url) {
    const video = await fetchAsBuffer(latestVideo.asset.url);
    if (video) zip.file('video.mp4', video);
  }

  const imagesFolder = zip.folder('images');
  for (const scene of project.scenes) {
    const image = scene.imagePrompts[0]?.generatedImages[0];
    if (image?.asset?.url) {
      const buf = await fetchAsBuffer(image.asset.url);
      if (buf) imagesFolder?.file(`scene-${String(scene.sceneNumber).padStart(2, '0')}.png`, buf);
    }
  }

  const thumbsFolder = zip.folder('thumbnails');
  project.thumbnails.forEach((t, i) => {
    const image = t.imagePrompt.generatedImages[0];
    if (image?.asset?.url) {
      thumbsFolder?.file(`thumbnail-${String(i + 1).padStart(2, '0')}-info.txt`, `Text: ${t.text}\nEmotional trigger: ${t.emotionalTrigger}\nVisual concept: ${t.visualConcept}\n`);
    }
  });
  // Fetch thumbnail images in a second pass so the info.txt above stays readable even if an image fetch fails.
  for (let i = 0; i < project.thumbnails.length; i++) {
    const image = project.thumbnails[i].imagePrompt.generatedImages[0];
    if (image?.asset?.url) {
      const buf = await fetchAsBuffer(image.asset.url);
      if (buf) thumbsFolder?.file(`thumbnail-${String(i + 1).padStart(2, '0')}.png`, buf);
    }
  }

  const byPlatform = (platform: string) => project.socialPosts.filter((p) => p.platform === platform);

  const youtube = byPlatform('YOUTUBE');
  if (youtube.length) {
    const title = youtube.find((p) => p.postType === 'TITLE')?.content ?? '';
    const description = youtube.find((p) => p.postType === 'DESCRIPTION')?.content ?? '';
    const hashtags = youtube.find((p) => p.postType === 'HASHTAGS')?.content ?? '';
    const keywords = youtube.find((p) => p.postType === 'KEYWORDS')?.content ?? '';
    zip.file('youtube.txt', `TITLE\n${title}\n\nDESCRIPTION\n${description}\n\nHASHTAGS\n${hashtags}\n\nKEYWORDS\n${keywords}\n`);
  }

  const instagram = byPlatform('INSTAGRAM');
  if (instagram.length) {
    const caption = instagram.find((p) => p.postType === 'CAPTION')?.content ?? '';
    const hashtags = instagram.find((p) => p.postType === 'HASHTAGS')?.content ?? '';
    const firstComment = instagram.find((p) => p.postType === 'FIRST_COMMENT')?.content ?? '';
    const storyCta = instagram.find((p) => p.postType === 'STORY_CTA')?.content ?? '';
    zip.file('instagram.txt', `CAPTION\n${caption}\n\nHASHTAGS\n${hashtags}\n\nFIRST COMMENT\n${firstComment}\n\nSTORY CTA\n${storyCta}\n`);
  }

  const facebook = byPlatform('FACEBOOK');
  if (facebook.length) {
    const caption = facebook.find((p) => p.postType === 'CAPTION')?.content ?? '';
    const hashtags = facebook.find((p) => p.postType === 'HASHTAGS')?.content ?? '';
    zip.file('facebook.txt', `CAPTION\n${caption}\n\nHASHTAGS\n${hashtags}\n`);
  }

  const xPosts = byPlatform('X_TWITTER').sort((a, b) => a.orderIndex - b.orderIndex);
  if (xPosts.length) {
    const twitterFolder = zip.folder('twitter');
    xPosts.forEach((p, i) => {
      twitterFolder?.file(`post-${String(i + 1).padStart(2, '0')}.txt`, p.content);
    });
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return buffer;
}
