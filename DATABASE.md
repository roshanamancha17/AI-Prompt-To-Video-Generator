# Database

PostgreSQL via Prisma. Full schema: `prisma/schema.prisma`.

## Entity map

```
User ──< Brand ──< ContentPillar
  │        │
  │        └──< Project >── ContentPillar
  │
  └──< Project ──1:1── ContentStrategy
         │
         ├──< Script (versioned) ──< Voiceover (versioned, carries wordTimings for subtitle sync)
         ├──< Scene ──< ImagePrompt (versioned) ──< GeneratedImage ──1:1── Asset
         ├──< Thumbnail ──1:1── ImagePrompt
         ├──< SocialPost (versioned, optionally ──1:1── ImagePrompt for X posts)
         ├──< Asset (includes rendered videos, type: VIDEO)
         ├──< GenerationJob
         ├──1:1── VideoRenderSettings (transition, subtitle style, music)
         ├──< VideoRender (each render attempt, ──0:1── Asset once complete)
         └──1:1── Schedule

User ──< PlatformConnection (OAuth credentials — YouTube read connection live now, publishing scopes Phase 7)
User ──< ChannelVideoMetric (synced video performance data)
User ──< ChannelInsight (AI-synthesized learnings from ChannelVideoMetric, versioned by generatedAt)
User ──< ApiUsage (cost tracking)
```

## Why relational, not one JSON blob

Every generated artifact (script, scene, image prompt, social post) is its own row with real foreign keys — not a JSON document per project. This is required by three things the spec calls for:

1. **Versioning** — regenerating a script creates a new `Script` row (`version` incremented, previous row's `isActive` flips false). A JSON blob can't cheaply keep history without becoming an array-of-blobs anti-pattern.
2. **Independent regeneration** — regenerating Scene 4's image must not touch Scenes 1–3. Rows scoped to a single scene make that a single `UPDATE`/`INSERT`, not a partial JSON patch.
3. **Querying across projects** — "show me all generated images this month" or "flag similar recent topics" needs SQL-level querying, not blob scanning.

JSON columns are used only where the content is genuinely a flexible bag with no independent identity of its own:

- `Project.characterBible` — a reusable trait bag injected into prompts (the prompts themselves still have structured columns).
- `Brand.languageRules` — free-form rules (e.g. Hinglish script-mixing guidance) that don't need to be queried individually.
- `PlatformConnection.oauthTokens` — provider-shaped token payloads, encrypted at the app layer before write.

## Versioning pattern

`Script`, `ImagePrompt`, `Voiceover`, and `SocialPost` all follow the same pattern:

```
version   Int      @default(1)
isActive  Boolean  @default(true)
```

Regenerating: create a new row with `version = previous + 1`, flip the previous row's `isActive` to `false`. Nothing is ever deleted — the "Compare" / "Restore" UI (Phase 2+) reads all versions for a given parent.

## Status lifecycle

`Project.status` moves through: `IDEA → GENERATING → DRAFT → REVIEW → APPROVED → READY → SCHEDULED → PUBLISHED`, with `FAILED` reachable from any generating state. `GenerationJob.status` (`QUEUED → PROCESSING → COMPLETED`/`FAILED`) tracks each pipeline stage independently, so one failed stage doesn't require re-running the whole project.

## Migrations

```bash
npm run db:migrate   # creates + applies a migration from schema.prisma changes
npm run db:studio     # visual browser
```
