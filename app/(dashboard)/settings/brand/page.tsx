'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Textarea, Label, FieldHint } from '@/components/ui/field';
import { Card, CardBody, CardHeader } from '@/components/ui/card';

export default function BrandSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [audience, setAudience] = useState('');
  const [positioning, setPositioning] = useState('');
  const [tone, setTone] = useState('');
  const [ctaStyle, setCtaStyle] = useState('');
  const [wordsToUse, setWordsToUse] = useState('');
  const [wordsToAvoid, setWordsToAvoid] = useState('');

  useEffect(() => {
    fetch('/api/brand')
      .then((r) => r.json())
      .then(({ brand }) => {
        if (brand) {
          setName(brand.name ?? '');
          setDescription(brand.description ?? '');
          setAudience(brand.audience ?? '');
          setPositioning(brand.positioning ?? '');
          setTone(brand.tone ?? '');
          setCtaStyle(brand.ctaStyle ?? '');
          setWordsToUse((brand.wordsToUse ?? []).join(', '));
          setWordsToAvoid((brand.wordsToAvoid ?? []).join(', '));
        }
        setLoading(false);
      });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    await fetch('/api/brand', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        audience,
        positioning,
        tone,
        ctaStyle,
        wordsToUse: wordsToUse.split(',').map((w) => w.trim()).filter(Boolean),
        wordsToAvoid: wordsToAvoid.split(',').map((w) => w.trim()).filter(Boolean),
      }),
    });

    setSaving(false);
    setSaved(true);
  };

  if (loading) return <p className="text-sm text-ink-500">Loading…</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-semibold text-paper-100">Brand voice</h1>
      <p className="mt-1 text-sm text-ink-500">Used to guide every generation stage — you won&rsquo;t need to repeat this per project.</p>

      <form onSubmit={handleSave} className="mt-6 space-y-5">
        <Card>
          <CardBody className="space-y-4">
            <div>
              <Label htmlFor="name">Brand name</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Premium social connection / lifestyle brand" />
            </div>
            <div>
              <Label htmlFor="positioning">Positioning</Label>
              <Textarea id="positioning" value={positioning} onChange={(e) => setPositioning(e.target.value)} placeholder="Premium social connection and lifestyle experience." />
            </div>
            <div>
              <Label htmlFor="audience">Target audience</Label>
              <Textarea id="audience" value={audience} onChange={(e) => setAudience(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="tone">Tone</Label>
              <Input id="tone" value={tone} onChange={(e) => setTone(e.target.value)} placeholder="Premium, mysterious, human, emotional" />
            </div>
            <div>
              <Label htmlFor="ctaStyle">CTA style</Label>
              <Input id="ctaStyle" value={ctaStyle} onChange={(e) => setCtaStyle(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="wordsToUse">Words to use</Label>
              <Input id="wordsToUse" value={wordsToUse} onChange={(e) => setWordsToUse(e.target.value)} placeholder="comma, separated, list" />
            </div>
            <div>
              <Label htmlFor="wordsToAvoid">Words to avoid</Label>
              <Input id="wordsToAvoid" value={wordsToAvoid} onChange={(e) => setWordsToAvoid(e.target.value)} placeholder="cheap, desperate, cringe, generic motivation" />
              <FieldHint>Applied as guardrails during script and social copy generation.</FieldHint>
            </div>
          </CardBody>
        </Card>

        <div className="flex items-center gap-3 pb-10">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save brand voice'}
          </Button>
          {saved && <span className="text-sm text-ready-mint">Saved.</span>}
        </div>
      </form>
    </div>
  );
}
