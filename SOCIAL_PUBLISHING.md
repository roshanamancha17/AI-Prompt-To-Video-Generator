# Social Publishing

## YouTube — Channel Insights (implemented)

Before publishing exists, a **read-only** YouTube connection is implemented for a different purpose: learning from your channel's actual performance to improve future content.

- `app/api/platforms/youtube/connect` → `app/api/platforms/youtube/callback` — standard OAuth 2.0 authorization-code flow (`access_type=offline`, `prompt=consent` to guarantee a refresh token), scopes `youtube.readonly` + `yt-analytics.readonly`. Tokens are stored on `PlatformConnection` and refreshed transparently by `lib/services/channelConnectionService.ts`.
- `lib/services/channelSyncService.ts` pulls your uploads (via the uploads-playlist + `videos.list`, not `search.list`, to stay well under the 10,000-unit/day quota) into `ChannelVideoMetric` — title, description, publish time, duration, views, likes, comments.
- `lib/services/channelInsightsService.ts` computes real quantitative signals from that data (top/bottom performers by views, engagement rate, posting-time correlation) and asks Gemini to synthesize them — grounded in the actual numbers, not invented — into: what's working, common mistakes, recommended improvements, best posting times, hook styles that perform, and topic directions to try. Stored versioned in `ChannelInsight`.
- **These learnings feed back into generation automatically** — `buildProjectBrief()` (`lib/services/promptBuilders.ts`) pulls the latest `ChannelInsight` for the user and includes it in every content-strategy, script, scene, and social-copy prompt. This isn't just a report; it changes what gets generated next.

This uses the same `PlatformConnection` table Phase 7 publishing will use — a publishing scope (e.g. `youtube.upload`) can be added to the same connection later via incremental authorization, without a schema change.

## Phase 1–5 (video output): export only

No platform publishing exists yet, and nothing fakes it. The `SocialPublisher` interface (`lib/providers/social/SocialPublisher.ts`) is defined now so the data model (`SocialPost`, `Schedule`, `PlatformConnection`) doesn't need to change when Phase 7 implements it — but calling it before then would throw "not implemented," not silently succeed.

Until Phase 7, the user's path is: generate → review/edit → **[Download Everything]** (Phase 5) → post manually.

## Phase 7: publishing architecture

```
SocialPublisher (interface)
├── YouTubePublisher
├── InstagramPublisher
├── FacebookPublisher
└── XPublisher
```

Each adapter:

- Uses the platform's official API and OAuth flow only. No scraping, no browser automation.
- Reads credentials from `PlatformConnection` (per-user, per-platform, tokens encrypted at the app layer before write).
- Implements `publish(post, credentials) → { externalId }`.
- Never runs automatically — a project only moves to `SCHEDULED`/`PUBLISHED` after an explicit **[Schedule]** or **[Publish Now]** action from the user, per the "never auto-publish" engineering rule.

## OAuth

Each platform needs its own app registration (YouTube via Google Cloud Console, Instagram/Facebook via Meta for Developers, X via the X Developer Portal). Client ID/secret pairs go in `.env` (`YOUTUBE_CLIENT_ID`, etc.) — see `.env.example`. The OAuth callback flow is a Route Handler per platform (`/api/platforms/[platform]/callback`), added in Phase 7, storing the resulting tokens in `PlatformConnection`.

## Scheduling

`Schedule` (one per `Project`, `platform` + `scheduledFor` + `status`) is modeled now but has no worker yet. Phase 7 adds a scheduler (cron-triggered job that finds `Schedule` rows due and calls the matching `SocialPublisher`) — additive, no schema change required.

## Rate limits & retries

Each platform's adapter is responsible for respecting that platform's own rate limits and implementing retry/backoff for transient failures, consistent with the general error-handling rule: timeout, retry, log the real error server-side, surface a friendly message, offer a retry action.
