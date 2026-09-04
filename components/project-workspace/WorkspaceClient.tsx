'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { Card, CardBody, CardHeader, StatusBadge } from '@/components/ui/card';

const TABS = ['Script', 'Scenes', 'Images', 'Thumbnails', 'Voice', 'YouTube', 'Instagram', 'Facebook', 'X/Twitter', 'Publish'] as const;
type Tab = (typeof TABS)[number];

const PHASE_LATER: Partial<Record<Tab, string>> = {};

const REFINE_ACTIONS: { action: string; label: string }[] = [
  { action: 'shorter', label: 'Make Shorter' },
  { action: 'more_emotional', label: 'Make More Emotional' },
  { action: 'more_natural', label: 'Make More Natural' },
  { action: 'more_conversational', label: 'Make More Conversational' },
  { action: 'change_hook', label: 'Change Hook' },
  { action: 'change_cta', label: 'Change CTA' },
];

interface GeneratedImageInfo {
  id: string;
  asset: { url: string } | null;
}

interface ImagePromptInfo {
  id: string;
  subject: string;
  environment: string;
  action: string | null;
  emotion: string;
  lighting: string;
  camera: string;
  style: string;
  composition: string;
  negativeRequirements: string | null;
  generatedImages: GeneratedImageInfo[];
}

interface ProjectWithRelations {
  id: string;
  topic: string;
  status: string;
  contentType: string;
  language: string;
  targetDurationSec: number;
  strategyApproved: boolean;
  scriptApproved: boolean;
  strategy: {
    coreProblem: string;
    emotion: string;
    hook: string;
    message: string;
    ctaStrategy: string;
    contentAngle: string;
  } | null;
  scripts: {
    id: string;
    version: number;
    isActive: boolean;
    content: string;
    voiceoverVersion: string;
    onScreenText: string | null;
    estimatedDuration: number | null;
  }[];
  scenes: {
    id: string;
    sceneNumber: number;
    durationLabel: string;
    voiceover: string;
    onscreenText: string | null;
    visualGoal: string;
    imagePrompts: ImagePromptInfo[];
  }[];
  thumbnails: {
    id: string;
    text: string;
    visualConcept: string;
    emotionalTrigger: string;
    imagePrompt: ImagePromptInfo;
  }[];
  voiceovers: {
    id: string;
    voiceId: string;
    assetId: string | null;
    asset: { url: string } | null;
  }[];
  socialPosts: { id: string; platform: string; postType: string; content: string; orderIndex: number }[];
}

export function WorkspaceClient({ project }: { project: ProjectWithRelations }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('Script');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeScript = project.scripts.find((s) => s.isActive) ?? project.scripts[0] ?? null;
  const [draftContent, setDraftContent] = useState(activeScript?.content ?? '');
  const [draftVoiceover, setDraftVoiceover] = useState(activeScript?.voiceoverVersion ?? '');

useEffect(() => {
  setDraftContent(activeScript?.content ?? '');
  setDraftVoiceover(activeScript?.voiceoverVersion ?? '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [activeScript?.id]);

  const run = async (key: string, fn: () => Promise<Response>) => {
    setBusy(key);
    setError(null);
    try {
      const res = await fn();
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Something went wrong. Please try again.');
        setBusy(null);
        return;
      }
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const generateStrategy = () =>
    run('strategy', () => fetch('/api/generate/strategy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: project.id }) }));

  const approveStrategy = () =>
    run('approve-strategy', () => fetch('/api/generate/strategy', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: project.id }) }));

  const generateScript = () =>
    run('script', () => fetch('/api/generate/script', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: project.id }) }));

  const approveScript = () =>
    run('approve-script', () => fetch('/api/generate/script', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: project.id }) }));

  const refineScript = (action: string) =>
    run(`refine-${action}`, () =>
      fetch('/api/generate/script/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId: activeScript?.id, action }),
      }),
    );

  const saveScript = () =>
    run('save', () =>
      fetch(`/api/scripts/${activeScript?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draftContent, voiceoverVersion: draftVoiceover }),
      }),
    );

  const generateScenes = () =>
    run('scenes', () => fetch('/api/generate/scenes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: project.id }) }));

  const generateSocial = () =>
    run('social', () => fetch('/api/generate/social', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: project.id }) }));

  const generateImagePrompts = () =>
    run('image-prompts', () => fetch('/api/generate/image-prompts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: project.id }) }));

  const generateAllImages = () =>
    run('images-all', () => fetch('/api/images/generate-all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: project.id }) }));

  const generateOneImage = (promptId: string) =>
    run(`image-${promptId}`, () => fetch(`/api/images/${promptId}/generate`, { method: 'POST' }));

  const generateThumbnails = () =>
    run('thumbnails', () => fetch('/api/generate/thumbnails', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: project.id }) }));

  const [voiceId, setVoiceId] = useState('21m00Tcm4TlvDq8ikWAM');
  const [stability, setStability] = useState(0.5);
  const [similarity, setSimilarity] = useState(0.75);
  const [voiceStyle, setVoiceStyle] = useState(0);
  const [speed, setSpeed] = useState(1.0);

  const generateVoiceover = () =>
    run('voiceover', () =>
      fetch('/api/generate/voiceover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptId: activeScript?.id,
          voiceId,
          stability,
          similarity,
          style: voiceStyle,
          speed,
          scriptOverride: draftVoiceover,
        }),
      }),
    );

  const [transition, setTransition] = useState<'CUT' | 'CROSSFADE'>('CUT');
  const [subtitleStyle, setSubtitleStyle] = useState<'BOLD_CENTER' | 'KARAOKE_HIGHLIGHT' | 'MINIMAL_BOTTOM'>('BOLD_CENTER');
  const [musicUrl, setMusicUrl] = useState('');
  const [renders, setRenders] = useState<{ id: string; status: string; errorMessage: string | null; asset: { url: string } | null; createdAt: string }[]>([]);
  const [renderError, setRenderError] = useState<string | null>(null);

  const loadRenders = async () => {
    const res = await fetch(`/api/video-renders?projectId=${project.id}`);
    const body = await res.json();
    if (res.ok) setRenders(body.renders ?? []);
  };

  const renderVideo = async () => {
    setBusy('render');
    setRenderError(null);
    await fetch('/api/video-render-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.id, transition, subtitleStyle, backgroundMusicUrl: musicUrl }),
    });
    const res = await fetch('/api/generate/video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.id }),
    });
    const body = await res.json();
    setBusy(null);
    if (!res.ok) {
      setRenderError(body.error);
      return;
    }
    loadRenders();
  };

  useEffect(() => {
    if (activeTab === 'Publish') loadRenders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-paper-100">{project.topic}</h1>
          <p className="mt-1 text-xs text-ink-500">
            {project.contentType.replace(/_/g, ' ')} · {project.language} · target {project.targetDurationSec}s
          </p>
        </div>
        <StatusBadge status={project.status} />
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-ink-700 pb-px">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`focus-ring whitespace-nowrap px-3 py-2 text-sm transition-colors ${
              activeTab === tab ? 'border-b-2 border-signal-amber text-paper-100' : 'text-ink-500 hover:text-paper-100'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-alert-red">{error}</p>}

      {activeTab === 'Script' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-paper-100">Content strategy</h2>
              {project.strategyApproved && <span className="text-xs text-ready-mint">Approved</span>}
            </CardHeader>
            <CardBody>
              {!project.strategy ? (
                <div className="py-6 text-center">
                  <p className="text-sm text-ink-500">No strategy generated yet — this drives the script.</p>
                  <Button className="mt-3" onClick={generateStrategy} disabled={busy === 'strategy'}>
                    {busy === 'strategy' ? 'Generating…' : 'Generate Strategy'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  <StrategyRow label="Core problem" value={project.strategy.coreProblem} />
                  <StrategyRow label="Emotion" value={project.strategy.emotion} />
                  <StrategyRow label="Hook" value={project.strategy.hook} />
                  <StrategyRow label="Message" value={project.strategy.message} />
                  <StrategyRow label="CTA strategy" value={project.strategy.ctaStrategy} />
                  <StrategyRow label="Content angle" value={project.strategy.contentAngle} />
                  {!project.strategyApproved ? (
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" onClick={approveStrategy} disabled={busy === 'approve-strategy'}>
                        Approve & Continue
                      </Button>
                      <Button size="sm" variant="secondary" onClick={generateStrategy} disabled={busy === 'strategy'}>
                        {busy === 'strategy' ? 'Regenerating…' : 'Regenerate'}
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
            </CardBody>
          </Card>

          {project.strategyApproved && (
            <Card>
              <CardHeader className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-paper-100">
                  Script {activeScript && <span className="text-ink-500">· v{activeScript.version}</span>}
                </h2>
                {project.scriptApproved && <span className="text-xs text-ready-mint">Approved</span>}
              </CardHeader>
              <CardBody>
                {!activeScript ? (
                  <div className="py-6 text-center">
                    <Button onClick={generateScript} disabled={busy === 'script'}>
                      {busy === 'script' ? 'Generating…' : 'Generate Script'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-500">Full script</p>
                      <Textarea value={draftContent} onChange={(e) => setDraftContent(e.target.value)} className="min-h-[180px]" />
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-500">Voiceover-ready version</p>
                      <Textarea value={draftVoiceover} onChange={(e) => setDraftVoiceover(e.target.value)} className="min-h-[140px]" />
                    </div>
                    {activeScript.estimatedDuration && (
                      <p className="text-xs text-ink-500">Estimated duration: {activeScript.estimatedDuration}s</p>
                    )}

                    <div className="flex flex-wrap gap-2 border-t border-ink-700 pt-4">
                      <Button size="sm" onClick={saveScript} disabled={busy === 'save'}>
                        Save
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => refineScript('regenerate')} disabled={busy === 'refine-regenerate'}>
                        Regenerate
                      </Button>
                      {REFINE_ACTIONS.map((r) => (
                        <Button
                          key={r.action}
                          size="sm"
                          variant="ghost"
                          onClick={() => refineScript(r.action)}
                          disabled={busy === `refine-${r.action}`}
                        >
                          {busy === `refine-${r.action}` ? '…' : r.label}
                        </Button>
                      ))}
                    </div>

                    {!project.scriptApproved && (
                      <div className="border-t border-ink-700 pt-4">
                        <Button onClick={approveScript} disabled={busy === 'approve-script'}>
                          Approve & Continue
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'Scenes' && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-paper-100">Scene breakdown</h2>
            {project.scriptApproved && (
              <Button size="sm" onClick={generateScenes} disabled={busy === 'scenes'}>
                {busy === 'scenes' ? 'Generating…' : project.scenes.length ? 'Regenerate' : 'Generate Scenes'}
              </Button>
            )}
          </CardHeader>
          <CardBody>
            {!project.scriptApproved ? (
              <p className="py-6 text-center text-sm text-ink-500">Approve the script first — scenes are generated from it.</p>
            ) : project.scenes.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-500">No scenes yet.</p>
            ) : (
              <div className="space-y-3">
                {project.scenes.map((s) => (
                  <div key={s.id} className="rounded-md border border-ink-700 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-medium text-paper-100">Scene {s.sceneNumber}</p>
                      <p className="text-xs text-ink-500">{s.durationLabel}</p>
                    </div>
                    <p className="text-sm text-paper-100">{s.voiceover}</p>
                    {s.onscreenText && <p className="mt-1 text-xs text-signal-amber">On-screen: {s.onscreenText}</p>}
                    <p className="mt-2 text-xs text-ink-500">Visual goal: {s.visualGoal}</p>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {(['YouTube', 'Instagram', 'Facebook', 'X/Twitter'] as Tab[]).includes(activeTab) && (
        <SocialTab
          tab={activeTab}
          posts={project.socialPosts}
          hasScript={Boolean(activeScript)}
          onGenerate={generateSocial}
          busy={busy === 'social'}
        />
      )}

      {activeTab === 'Images' && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-paper-100">Scene images</h2>
            {project.scenes.some((s) => s.imagePrompts.length > 0) && (
              <Button size="sm" onClick={generateAllImages} disabled={busy === 'images-all'}>
                {busy === 'images-all' ? 'Generating…' : 'Generate All Images'}
              </Button>
            )}
          </CardHeader>
          <CardBody>
            {project.scenes.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-500">Generate scenes first.</p>
            ) : !project.scenes.some((s) => s.imagePrompts.length > 0) ? (
              <div className="py-6 text-center">
                <Button onClick={generateImagePrompts} disabled={busy === 'image-prompts'}>
                  {busy === 'image-prompts' ? 'Writing prompts…' : 'Generate Image Prompts'}
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {project.scenes.map((scene) =>
                  scene.imagePrompts.map((prompt) => (
                    <div key={prompt.id} className="rounded-md border border-ink-700 p-3">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500">Scene {scene.sceneNumber}</p>
                      {prompt.generatedImages[0]?.asset?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={prompt.generatedImages[0].asset.url} alt={`Scene ${scene.sceneNumber}`} className="mb-2 aspect-[9/16] w-full rounded-sm object-cover" />
                      ) : (
                        <div className="mb-2 flex aspect-[9/16] w-full items-center justify-center rounded-sm bg-ink-800 text-xs text-ink-500">No image yet</div>
                      )}
                      <p className="mb-2 line-clamp-3 text-xs text-ink-500">{prompt.subject}</p>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full"
                        onClick={() => generateOneImage(prompt.id)}
                        disabled={busy === `image-${prompt.id}`}
                      >
                        {busy === `image-${prompt.id}` ? 'Generating…' : prompt.generatedImages[0] ? 'Regenerate' : 'Generate Image'}
                      </Button>
                    </div>
                  )),
                )}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {activeTab === 'Thumbnails' && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-paper-100">Thumbnail concepts</h2>
            {activeScript && (
              <Button size="sm" onClick={generateThumbnails} disabled={busy === 'thumbnails'}>
                {busy === 'thumbnails' ? 'Generating…' : project.thumbnails.length ? 'Regenerate' : 'Generate Thumbnails'}
              </Button>
            )}
          </CardHeader>
          <CardBody>
            {!activeScript ? (
              <p className="py-6 text-center text-sm text-ink-500">Generate a script first.</p>
            ) : project.thumbnails.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-500">No thumbnail concepts yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {project.thumbnails.map((t) => (
                  <div key={t.id} className="rounded-md border border-ink-700 p-3">
                    {t.imagePrompt.generatedImages[0]?.asset?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.imagePrompt.generatedImages[0].asset.url} alt={t.text} className="mb-2 aspect-[9/16] w-full rounded-sm object-cover" />
                    ) : (
                      <div className="mb-2 flex aspect-[9/16] w-full items-center justify-center rounded-sm bg-ink-800 text-xs text-ink-500">No image yet</div>
                    )}
                    <p className="mb-1 text-sm font-semibold text-signal-amber">{t.text}</p>
                    <p className="mb-2 text-xs text-ink-500">{t.emotionalTrigger}</p>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      onClick={() => generateOneImage(t.imagePrompt.id)}
                      disabled={busy === `image-${t.imagePrompt.id}`}
                    >
                      {busy === `image-${t.imagePrompt.id}` ? 'Generating…' : t.imagePrompt.generatedImages[0] ? 'Regenerate' : 'Generate Image'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {activeTab === 'Voice' && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-medium text-paper-100">Voiceover</h2>
          </CardHeader>
          <CardBody>
            {!activeScript ? (
              <p className="py-6 text-center text-sm text-ink-500">Generate and approve a script first.</p>
            ) : (
              <div className="space-y-4">
                {project.voiceovers[0]?.asset?.url && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-500">Current voiceover</p>
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <audio controls src={project.voiceovers[0].asset.url} className="w-full" />
                    <a href={project.voiceovers[0].asset.url} download className="mt-2 inline-block text-xs text-signal-amber hover:underline">
                      Download MP3
                    </a>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-500">Voice ID</label>
                    <input value={voiceId} onChange={(e) => setVoiceId(e.target.value)} className="w-full rounded-md border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-paper-100" />
                  </div>
                  <div />
                  <SliderField label="Stability" value={stability} onChange={setStability} />
                  <SliderField label="Similarity" value={similarity} onChange={setSimilarity} />
                  <SliderField label="Style" value={voiceStyle} onChange={setVoiceStyle} />
                  <SliderField label="Speed" value={speed} onChange={setSpeed} min={0.7} max={1.2} />
                </div>

                <p className="text-xs text-ink-500">
                  Uses the voiceover-ready script from the Script tab — edit and save it there before generating if you want changes reflected.
                </p>

                <Button onClick={generateVoiceover} disabled={busy === 'voiceover'}>
                  {busy === 'voiceover' ? 'Generating…' : 'Generate Voiceover'}
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {activeTab === 'Publish' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h2 className="text-sm font-medium text-paper-100">Assemble video</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              {renderError && <p className="text-sm text-alert-red">{renderError}</p>}
              <p className="text-sm text-ink-500">
                Combines your scene images, voiceover, and word-synced subtitles into a 9:16 MP4. Requires an active voiceover and at least one generated scene image.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-500">Transition</label>
                  <select
                    value={transition}
                    onChange={(e) => setTransition(e.target.value as 'CUT' | 'CROSSFADE')}
                    className="w-full rounded-md border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-paper-100"
                  >
                    <option value="CUT">Cut (reliable, fast)</option>
                    <option value="CROSSFADE">Crossfade (slower to render)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-500">Subtitle style</label>
                  <select
                    value={subtitleStyle}
                    onChange={(e) => setSubtitleStyle(e.target.value as typeof subtitleStyle)}
                    className="w-full rounded-md border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-paper-100"
                  >
                    <option value="BOLD_CENTER">Bold, centered</option>
                    <option value="KARAOKE_HIGHLIGHT">Karaoke word highlight</option>
                    <option value="MINIMAL_BOTTOM">Minimal, bottom</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-500">Background music URL (optional)</label>
                <input
                  value={musicUrl}
                  onChange={(e) => setMusicUrl(e.target.value)}
                  placeholder="https://…"
                  className="w-full rounded-md border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-paper-100"
                />
              </div>

              <Button onClick={renderVideo} disabled={busy === 'render'}>
                {busy === 'render' ? 'Rendering… this can take a few minutes' : 'Render Video'}
              </Button>

              {renders.length > 0 && (
                <div className="space-y-2 border-t border-ink-700 pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Renders</p>
                  {renders.map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded-md border border-ink-700 px-3 py-2 text-sm">
                      <span className="text-ink-500">{new Date(r.createdAt).toLocaleString()}</span>
                      {r.status === 'COMPLETED' && r.asset?.url ? (
                        <a href={r.asset.url} download className="text-signal-amber hover:underline">
                          Download MP4
                        </a>
                      ) : r.status === 'FAILED' ? (
                        <span className="text-alert-red" title={r.errorMessage ?? ''}>Failed</span>
                      ) : (
                        <span className="text-ink-500">Processing…</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-medium text-paper-100">Export</h2>
            </CardHeader>
            <CardBody>
              <p className="mb-3 text-sm text-ink-500">
                Downloads a zip with your script, voiceover, images, thumbnails, and platform copy — everything generated so far.
              </p>
              <a href={`/api/export/${project.id}`}>
                <Button>Download Everything</Button>
              </a>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="py-8 text-center text-sm text-ink-500">
              Scheduled/direct publishing to platforms arrives in Phase 7 (OAuth + official APIs).
            </CardBody>
          </Card>
        </div>
      )}

      {PHASE_LATER[activeTab] && (
        <Card>
          <CardBody className="py-10 text-center text-sm text-ink-500">{PHASE_LATER[activeTab]}</CardBody>
        </Card>
      )}
    </div>
  );
}

function SliderField({ label, value, onChange, min = 0, max = 1 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div>
      <label className="mb-1.5 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-ink-500">
        <span>{label}</span>
        <span className="text-paper-100">{value.toFixed(2)}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-signal-amber"
      />
    </div>
  );
}

function StrategyRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-0.5 text-paper-100">{value}</p>
    </div>
  );
}

const PLATFORM_MAP: Record<string, string> = {
  YouTube: 'YOUTUBE',
  Instagram: 'INSTAGRAM',
  Facebook: 'FACEBOOK',
  'X/Twitter': 'X_TWITTER',
};

function SocialTab({
  tab,
  posts,
  hasScript,
  onGenerate,
  busy,
}: {
  tab: Tab;
  posts: { id: string; platform: string; postType: string; content: string; orderIndex: number }[];
  hasScript: boolean;
  onGenerate: () => void;
  busy: boolean;
}) {
  const platform = PLATFORM_MAP[tab];
  const platformPosts = posts.filter((p) => p.platform === platform).sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-paper-100">{tab} copy</h2>
        {hasScript && (
          <Button size="sm" onClick={onGenerate} disabled={busy}>
            {busy ? 'Generating…' : posts.length ? 'Regenerate all' : 'Generate Social Copy'}
          </Button>
        )}
      </CardHeader>
      <CardBody>
        {!hasScript ? (
          <p className="py-6 text-center text-sm text-ink-500">Generate a script first — social copy is derived from it.</p>
        ) : platformPosts.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-500">Nothing generated for {tab} yet.</p>
        ) : (
          <div className="space-y-3">
            {platformPosts.map((p) => (
              <div key={p.id} className="rounded-md border border-ink-700 p-4">
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-500">{p.postType.replace(/_/g, ' ')}</p>
                <p className="whitespace-pre-wrap text-sm text-paper-100">{p.content}</p>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
