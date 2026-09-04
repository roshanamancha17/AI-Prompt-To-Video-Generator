'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';

interface InsightData {
  id: string;
  videosAnalyzed: number;
  topPerformingPatterns: string;
  commonMistakes: string;
  recommendedImprovements: string;
  bestPostingTimes: string;
  topHookStyles: string;
  topicRecommendations: string;
  generatedAt: string;
}

interface StatusData {
  connected: boolean;
  channelTitle: string | null;
  lastSyncedAt: string | null;
  videoCount: number;
  latestInsight: InsightData | null;
}

export default function ChannelInsightsPage() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const loadStatus = async () => {
    const res = await fetch('/api/channel/status');
    const body = await res.json();
    setStatus(body);
    setLoading(false);
  };

  useEffect(() => {
    loadStatus();
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'not-configured') {
      setError('YouTube isn\u2019t configured yet — add YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET to your environment first.');
    } else if (params.get('error')) {
      setError('Could not connect your YouTube channel. Please try again.');
    }
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    setSyncResult(null);
    const res = await fetch('/api/channel/sync', { method: 'POST' });
    const body = await res.json();
    setSyncing(false);
    if (!res.ok) {
      setError(body.error);
      return;
    }
    setSyncResult(`Synced ${body.videoCount} videos from ${body.channel.title}.`);
    loadStatus();
  };

  const handleGenerateInsights = async () => {
    setGenerating(true);
    setError(null);
    const res = await fetch('/api/channel/insights', { method: 'POST' });
    const body = await res.json();
    setGenerating(false);
    if (!res.ok) {
      setError(body.error);
      return;
    }
    loadStatus();
  };

  const handleDisconnect = async () => {
    await fetch('/api/channel/status', { method: 'DELETE' });
    loadStatus();
  };

  if (loading) return <p className="text-sm text-ink-500">Loading…</p>;

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl font-semibold text-paper-100">Channel Insights</h1>
      <p className="mt-1 text-sm text-ink-500">
        Connect your YouTube channel so past performance — what worked, what didn&rsquo;t, and why — shapes every new piece of content you generate.
      </p>

      {error && <p className="mt-4 text-sm text-alert-red">{error}</p>}
      {syncResult && <p className="mt-4 text-sm text-ready-mint">{syncResult}</p>}

      <Card className="mt-6">
        <CardHeader className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-paper-100">YouTube channel</h2>
          {status?.connected && (
            <Button size="sm" variant="ghost" onClick={handleDisconnect}>
              Disconnect
            </Button>
          )}
        </CardHeader>
        <CardBody>
          {!status?.connected ? (
            <div className="py-6 text-center">
              <p className="mb-3 text-sm text-ink-500">No channel connected yet.</p>
              <a href="/api/platforms/youtube/connect">
                <Button>Connect YouTube Channel</Button>
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-paper-100">{status.channelTitle}</span>
                <span className="text-xs text-ink-500">
                  {status.videoCount} videos synced{status.lastSyncedAt ? ` · last synced ${new Date(status.lastSyncedAt).toLocaleString()}` : ''}
                </span>
              </div>
              <Button size="sm" onClick={handleSync} disabled={syncing}>
                {syncing ? 'Syncing…' : 'Sync Recent Videos'}
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      {status?.connected && status.videoCount > 0 && (
        <Card className="mt-4">
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-paper-100">Learnings & recommendations</h2>
            <Button size="sm" onClick={handleGenerateInsights} disabled={generating}>
              {generating ? 'Analyzing…' : status.latestInsight ? 'Regenerate' : 'Generate Insights'}
            </Button>
          </CardHeader>
          <CardBody>
            {!status.latestInsight ? (
              <p className="py-6 text-center text-sm text-ink-500">No insights generated yet.</p>
            ) : (
              <div className="space-y-4 text-sm">
                <p className="text-xs text-ink-500">
                  Based on {status.latestInsight.videosAnalyzed} videos · generated {new Date(status.latestInsight.generatedAt).toLocaleString()}
                </p>
                <InsightRow label="What's working" value={status.latestInsight.topPerformingPatterns} tone="positive" />
                <InsightRow label="What to avoid" value={status.latestInsight.commonMistakes} tone="negative" />
                <InsightRow label="Recommended improvements" value={status.latestInsight.recommendedImprovements} />
                <InsightRow label="Best posting times" value={status.latestInsight.bestPostingTimes} />
                <InsightRow label="Hook styles that perform" value={status.latestInsight.topHookStyles} />
                <InsightRow label="Topic directions to try" value={status.latestInsight.topicRecommendations} />
                <p className="border-t border-ink-700 pt-3 text-xs text-ink-500">
                  These learnings are automatically included in the brief for every new piece of content you generate.
                </p>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function InsightRow({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'negative' }) {
  const color = tone === 'positive' ? 'text-ready-mint' : tone === 'negative' ? 'text-alert-red' : 'text-signal-amber';
  return (
    <div>
      <p className={`text-xs font-medium uppercase tracking-wide ${color}`}>{label}</p>
      <p className="mt-1 text-paper-100">{value}</p>
    </div>
  );
}
