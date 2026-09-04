# Content Studio

Turn one content idea into a complete short-form social content package — script, scenes, image prompts, thumbnails, voiceover, and platform-ready copy for YouTube, Instagram, Facebook, and X — with a review workspace and (eventually) scheduled publishing.

This is **Phases 1–6** of the build plus an early slice of Phase 7/8: authentication, database, dashboard shell, project creation, AI-driven content strategy → script → scene → social-copy generation, Gemini image generation with character continuity, ElevenLabs voiceover (with word-level timing), a downloadable content-package export, **FFmpeg video assembly** (images + voiceover + synced subtitles + transitions → MP4), and **YouTube Channel Insights** — connect your channel, sync your video performance, and get AI-synthesized learnings that automatically feed into every new piece of content you generate. Publishing to platforms (rest of Phase 7) and broader analytics (Phase 8) are next. See `ARCHITECTURE.md` for the full system design and phase plan.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- PostgreSQL + Prisma
- Auth.js (credentials provider for Phase 1)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   At minimum for Phase 1, set:
   - `DATABASE_URL` — your Postgres connection string
   - `NEXTAUTH_SECRET` — generate with `npx auth secret`
   - `NEXTAUTH_URL` — `http://localhost:3000` for local dev

   For Phase 2 (text generation), also set:
   - `GEMINI_API_KEY` — required for content strategy, script, scene, and social copy generation

   For Phase 3–5 (images, voice, export), also set:
   - `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_PUBLIC_URL` — an R2 or S3 bucket for generated images/audio. **`STORAGE_PUBLIC_URL` must be a publicly reachable base URL** — the export zip and the in-app image/audio previews both fetch assets directly from it.
   - `ELEVENLABS_API_KEY` — required for voiceover generation

   For Channel Insights (YouTube performance learning), also set:
   - `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` — from a Google Cloud Console OAuth client with the YouTube Data API v3 enabled, redirect URI `{your app URL}/api/platforms/youtube/callback`

   Video rendering (Phase 6) needs no extra env vars — `ffmpeg-static` bundles a working `ffmpeg` binary for your platform automatically on `npm install`. It does need a Node.js server (not an edge/serverless function) with a writable temp directory, since it downloads assets and spawns `ffmpeg` locally.

3. **Set up the database**

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

   The seed script creates one login user. Set `SEED_USER_EMAIL` and `SEED_USER_PASSWORD` env vars before seeding, or it defaults to `you@studio.com` / `change-me-now` — **change the password immediately if you use the default.**

4. **Run the dev server**

   ```bash
   npm run dev
   ```

   Visit `http://localhost:3000`, sign in, and click **+ Create Content**.

## Local development

- `npm run db:studio` — browse the database with Prisma Studio
- `npm run lint` — lint the codebase

## AI provider configuration (Phase 2+)

See `AI_PROVIDERS.md` for how the provider abstraction works and how to add a new one.

## Storage configuration

Any S3-compatible provider works. Cloudflare R2 is the suggested default (cheaper egress, same API surface). Set `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_PUBLIC_URL`.

## Deployment

Phase 1 deploys anywhere Next.js + Postgres run (Vercel + a managed Postgres like Neon/Supabase is the simplest path). Later phases that need a persistent job worker (BullMQ/Redis, FFmpeg rendering) will need a long-running Node process alongside — a small VM or container service, not just serverless functions.

## Troubleshooting

- **"Not authenticated" on every page** — check `NEXTAUTH_SECRET` and `NEXTAUTH_URL` are set and the dev server was restarted after editing `.env`.
- **Prisma errors on migrate** — confirm `DATABASE_URL` points to a reachable Postgres instance and the database exists.
- **Provider shows "Not configured"** — the corresponding env var is unset on the server; restart the dev server after adding it.
- **Images or voiceover generate but don't preview/download** — check `STORAGE_PUBLIC_URL` is set and actually publicly reachable (a private bucket with no public URL configured will still upload successfully but nothing can fetch it back).
- **Video render fails immediately** — generate a voiceover first (it needs `Voiceover.wordTimings`, which only exists on voiceovers generated after Phase 6 was added — regenerate an older voiceover if it predates this) and at least one scene image.
- **Hindi/Hinglish subtitles show empty boxes in the rendered video** — the render host needs a Devanagari-capable font installed (e.g. "Noto Sans Devanagari") for ffmpeg's subtitle filter to render those characters; install it system-wide on whatever machine runs the Next.js server.
- **Video render times out or the route errors on a serverless host** — video rendering needs a real Node.js process with a writable filesystem and can take a few minutes; it won't work on typical edge/serverless functions with short timeouts. Run it on a VM, container, or long-running Node host.

## Further reading

- `ARCHITECTURE.md` — system architecture, folder structure, generation pipeline, phase plan
- `DATABASE.md` — schema walkthrough and versioning model
- `AI_PROVIDERS.md` — provider abstraction and how to add a new AI/image/voice provider
- `SOCIAL_PUBLISHING.md` — publishing architecture (Phase 7) and the export-only Phase 1–5 approach
