'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input, Textarea, Select, Label, FieldHint } from '@/components/ui/field';
import { Card, CardBody, CardHeader } from '@/components/ui/card';

const TONE_OPTIONS = ['Emotional', 'Conversational', 'Psychological', 'Premium', 'Mysterious', 'Thought-provoking', 'Casual'];
const DURATION_OPTIONS = [10, 15, 30, 45, 60];

export default function NewProjectPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [topic, setTopic] = useState('');
  const [similarTopics, setSimilarTopics] = useState<{ id: string; topic: string; similarity: number }[]>([]);
  const [checkingSimilar, setCheckingSimilar] = useState(false);
  const [contentType, setContentType] = useState('INSTAGRAM_REEL');
  const [language, setLanguage] = useState('ENGLISH');
  const [customLanguage, setCustomLanguage] = useState('');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState<string[]>(['Emotional']);
  const [customTone, setCustomTone] = useState('');
  const [targetDurationSec, setTargetDurationSec] = useState(30);
  const [imagePromptCount, setImagePromptCount] = useState(7);
  const [thumbnailCount, setThumbnailCount] = useState(2);
  const [xPostCount, setXPostCount] = useState(5);
  const [ctaLevel, setCtaLevel] = useState('LEVEL_2_SOFT_CURIOSITY');
  const [ctaText, setCtaText] = useState('Discover more at [WEBSITE_URL]');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [maintainCharacterContinuity, setMaintainCharacterContinuity] = useState(true);

  const toggleTone = (t: string) => {
    setTone((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const checkSimilarTopics = async () => {
    if (topic.trim().length < 10) {
      setSimilarTopics([]);
      return;
    }
    setCheckingSimilar(true);
    try {
      const res = await fetch('/api/projects/check-similar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      });
      const body = await res.json();
      setSimilarTopics(body.similar ?? []);
    } finally {
      setCheckingSimilar(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const finalTone = customTone.trim() ? [...tone, customTone.trim()] : tone;

    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic,
        contentType,
        language,
        customLanguage: language === 'CUSTOM' ? customLanguage : undefined,
        audience,
        tone: finalTone,
        targetDurationSec,
        imagePromptCount,
        thumbnailCount,
        xPostCount,
        ctaLevel,
        ctaText,
        websiteUrl,
        additionalNotes,
        maintainCharacterContinuity,
      }),
    });

    const body = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setFormError(body.error ?? 'Something went wrong. Please try again.');
      if (body.fieldErrors) setFieldErrors(body.fieldErrors);
      return;
    }

    router.push(`/projects/${body.project.id}`);
  };

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-semibold text-paper-100">Create Content</h1>
      <p className="mt-1 text-sm text-ink-500">One idea in. Everything downstream is generated from what you set here.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-medium text-paper-100">The idea</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <Label htmlFor="topic">Topic / Content Idea</Label>
              <Textarea
                id="topic"
                required
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onBlur={checkSimilarTopics}
                placeholder="People aren't looking for perfection. They're looking for consistency."
              />
              {fieldErrors.topic && <p className="mt-1 text-xs text-alert-red">{fieldErrors.topic[0]}</p>}
              {checkingSimilar && <p className="mt-1 text-xs text-ink-500">Checking recent content…</p>}
              {!checkingSimilar && similarTopics.length > 0 && (
                <div className="mt-2 rounded-md border border-signal-amberDim bg-signal-amberDim/20 px-3 py-2">
                  <p className="text-xs font-medium text-signal-amber">Similar content detected</p>
                  <ul className="mt-1 space-y-0.5">
                    {similarTopics.map((s) => (
                      <li key={s.id} className="truncate text-xs text-ink-500">
                        &ldquo;{s.topic}&rdquo;
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contentType">Content Type</Label>
                <Select id="contentType" value={contentType} onChange={(e) => setContentType(e.target.value)}>
                  <option value="INSTAGRAM_REEL">Instagram Reel</option>
                  <option value="YOUTUBE_SHORT">YouTube Short</option>
                  <option value="X_TWITTER">X/Twitter</option>
                  <option value="FACEBOOK">Facebook</option>
                  <option value="MULTI_PLATFORM">Multi-platform</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="language">Language</Label>
                <Select id="language" value={language} onChange={(e) => setLanguage(e.target.value)}>
                  <option value="ENGLISH">English</option>
                  <option value="HINDI">Hindi</option>
                  <option value="HINGLISH">Hinglish</option>
                  <option value="CUSTOM">Custom</option>
                </Select>
                {language === 'CUSTOM' && (
                  <Input
                    className="mt-2"
                    placeholder="Describe the language mix"
                    value={customLanguage}
                    onChange={(e) => setCustomLanguage(e.target.value)}
                  />
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="audience">Audience</Label>
              <Textarea
                id="audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="Indian men aged 24–40 interested in relationships, psychology, loneliness, social connection and lifestyle."
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-medium text-paper-100">Tone &amp; format</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <Label>Tone</Label>
              <div className="flex flex-wrap gap-2">
                {TONE_OPTIONS.map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => toggleTone(t)}
                    className={`focus-ring rounded-sm border px-3 py-1.5 text-xs transition-colors ${
                      tone.includes(t)
                        ? 'border-signal-amber bg-signal-amberDim text-signal-amber'
                        : 'border-ink-600 text-ink-500 hover:text-paper-100'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <Input
                className="mt-2"
                placeholder="Custom tone (optional)"
                value={customTone}
                onChange={(e) => setCustomTone(e.target.value)}
              />
              {fieldErrors.tone && <p className="mt-1 text-xs text-alert-red">{fieldErrors.tone[0]}</p>}
            </div>

            <div>
              <Label htmlFor="duration">Target duration</Label>
              <Select id="duration" value={targetDurationSec} onChange={(e) => setTargetDurationSec(Number(e.target.value))}>
                {DURATION_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} sec
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="imageCount">Image prompts</Label>
                <Input id="imageCount" type="number" min={1} max={20} value={imagePromptCount} onChange={(e) => setImagePromptCount(Number(e.target.value))} />
              </div>
              <div>
                <Label htmlFor="thumbCount">Thumbnails</Label>
                <Input id="thumbCount" type="number" min={1} max={6} value={thumbnailCount} onChange={(e) => setThumbnailCount(Number(e.target.value))} />
              </div>
              <div>
                <Label htmlFor="xCount">X posts</Label>
                <Input id="xCount" type="number" min={0} max={10} value={xPostCount} onChange={(e) => setXPostCount(Number(e.target.value))} />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-paper-100">
              <input
                type="checkbox"
                checked={maintainCharacterContinuity}
                onChange={(e) => setMaintainCharacterContinuity(e.target.checked)}
                className="h-4 w-4 rounded-sm border-ink-600 bg-ink-900 accent-signal-amber"
              />
              Maintain character continuity across scenes
            </label>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-medium text-paper-100">Call to action</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <Label htmlFor="ctaLevel">CTA intensity</Label>
              <Select id="ctaLevel" value={ctaLevel} onChange={(e) => setCtaLevel(e.target.value)}>
                <option value="LEVEL_1_NONE">Level 1 — No CTA</option>
                <option value="LEVEL_2_SOFT_CURIOSITY">Level 2 — Soft curiosity</option>
                <option value="LEVEL_3_PROFILE">Level 3 — Profile CTA</option>
                <option value="LEVEL_4_WEBSITE">Level 4 — Website CTA</option>
                <option value="LEVEL_5_DIRECT">Level 5 — Direct CTA</option>
              </Select>
              <FieldHint>Defaults to Level 2 — most content shouldn&rsquo;t sell in every post.</FieldHint>
            </div>
            <div>
              <Label htmlFor="ctaText">CTA text</Label>
              <Input id="ctaText" value={ctaText} onChange={(e) => setCtaText(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="websiteUrl">Website URL</Label>
              <Input id="websiteUrl" type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://" />
              {fieldErrors.websiteUrl && <p className="mt-1 text-xs text-alert-red">{fieldErrors.websiteUrl[0]}</p>}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-medium text-paper-100">Anything else</h2>
          </CardHeader>
          <CardBody>
            <Textarea
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="Additional instructions for this piece of content…"
            />
          </CardBody>
        </Card>

        {formError && <p className="text-sm text-alert-red">{formError}</p>}

        <div className="flex justify-end gap-3 pb-10">
          <Button type="button" variant="ghost" onClick={() => router.push('/dashboard')}>
            Cancel
          </Button>
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? 'Creating…' : 'Generate Content'}
          </Button>
        </div>
      </form>
    </div>
  );
}
