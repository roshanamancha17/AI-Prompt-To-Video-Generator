# Architecture

This is the reference copy of the architecture approved before implementation began. It's kept in the repo so future phases build against the same design without re-deriving it.

## Layers

```
UI (App Router pages) → Server Actions / Route Handlers (Zod-validated) → Service Layer → Provider Interfaces → Vendor SDKs
                                                                                 ↓
                                                                          Prisma / Postgres
```

- **UI never calls a provider directly.** Everything goes through the service layer.
- **Every provider is an interface first.** See `lib/providers/*/*.ts`. Implementations (`GeminiTextProvider`, `ElevenLabsProvider`, etc.) are added per phase; services depend only on the interface.
- **Every multi-stage generation is modeled as a `GenerationJob` row**, even in Phase 1–2 where jobs may run in-process rather than through a real queue. This means Phase 3+'s move to BullMQ/Redis is a swap of *how* a job runs, not a redesign of status tracking or the UI that polls it.
- **Nothing generated is ever overwritten.** Script, Voiceover, ImagePrompt, and SocialPost all carry `version` + `isActive` — regenerating creates a new version.

## Generation pipeline (Phase 2 onward)

```
IDEA → STRATEGY → SCRIPT (human approval) → SCENES → IMAGE_PROMPTS → IMAGES → VOICEOVER (human-triggered) → SOCIAL_COPY → READY
```

Human approval gates sit after STRATEGY and after SCRIPT — the pipeline does not auto-advance past those without an explicit `[Approve & Continue]`. Voiceover generation is always user-triggered, never automatic after script generation.

## Folder structure

```
/app                    — routes (App Router), grouped into (auth) and (dashboard)
/components/ui           — shared primitives (Button, Input, Card, ...)
/components/dashboard     — dashboard-specific widgets
/components/project-workspace  — workspace tabs (added Phase 2+)
/lib/providers/{ai,image,voice,storage,social}  — provider interfaces + implementations
/lib/services            — business logic, one file per generation stage (added Phase 2+)
/lib/schemas             — Zod schemas, one per structured AI response
/lib/db                  — Prisma client singleton
/lib/auth                — Auth.js config
/prisma                  — schema.prisma, migrations, seed
```

## Phase plan

| Phase | Scope |
|---|---|
| 1 (done) | Auth, database, dashboard shell, project creation — no AI calls |
| 2 (done) | Content strategy, script, scene, social copy generation via Gemini text; script editor with refine actions; approval gates |
| 3 (done) | Gemini image integration, character bible, image prompt engine, thumbnail generation |
| 4 (done) | ElevenLabs voice integration (with character-level timing alignment) |
| 5 (done) | Export system (downloadable content package) |
| 6 (done) | FFmpeg video assembly — images + voiceover + synced subtitles + transitions → MP4 |
| — (early slice) | YouTube read-only connection + AI-synthesized channel insights, feeding back into generation |
| 7 | OAuth + social publishing adapters (Instagram/Facebook/X), scheduling |
| 8 | Broader analytics ingestion + AI recommendations across all platforms |

## Extensibility

- **New AI/image/voice provider** — new class implementing the existing interface, registered in a provider registry. No service-layer changes.
- **New social platform** — new `SocialPublisher` implementation + OAuth route + `PlatformConnection` row; `SocialPlatform` enum extends.
- **Video assembly** — consumes existing `GeneratedImage`/`Voiceover` assets already in storage; only adds `Asset(type: VIDEO)` rows.
- **Analytics** — additive `PostMetric` table, populated by future platform-API pollers; no rework of the generation pipeline.

## Video assembly (Phase 6)

`lib/services/videoAssemblyService.ts` shells out to `ffmpeg` (via `ffmpeg-static`, a bundled binary — no separate system install needed) to combine scene images, the active voiceover, and burned-in subtitles into an MP4.

- **Scene timing**: ElevenLabs' `with-timestamps` endpoint returns character-level alignment; the provider groups this into word timings, stored on `Voiceover.wordTimings`. Each scene's on-screen duration is derived by proportionally allocating that word-timing timeline across scenes by word count — a best-effort approximation (not exact text matching), robust to minor script edits made after scenes were generated.
- **Subtitles**: `lib/services/subtitleService.ts` builds an `.ass` (Advanced SubStation Alpha) file, not `.srt` — ASS supports the styling and per-word karaoke highlighting the presets need, which SRT can't express. Three presets: bold-centered, karaoke word-highlight, and minimal-bottom.
- **Transitions**: `CUT` (concat demuxer, fast and reliable — the default) or `CROSSFADE` (an `xfade` filter chain — slower to render, more moving parts). `CUT` is recommended unless crossfades matter enough to accept the render-time and reliability tradeoff.
- **Rendering is synchronous within the request** (Phase 1–6 pattern — see the job-tracking note above) and can take a few minutes for longer content; the API route sets `maxDuration = 300` and requires the Node.js runtime (not edge) since it writes temp files and spawns a child process. This will not run on purely serverless/edge deployments without a longer-running compute target (a small VM or container works fine).
- **Fonts**: subtitles use "Noto Sans" by default. For Hindi/Hinglish text to render correctly, the render host needs a Devanagari-capable font installed (e.g. Noto Sans Devanagari) — otherwise ffmpeg's `subtitles` filter will fall back to tofu boxes for non-Latin characters. See the README troubleshooting section.
