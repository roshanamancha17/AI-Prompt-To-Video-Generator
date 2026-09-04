# AI Providers

The app never calls a vendor SDK from a service or route handler directly — everything goes through the interfaces in `lib/providers/`.

## Interfaces (defined in Phase 1, implemented Phase 2–4)

- `lib/providers/ai/AIProvider.ts` — structured text generation (`generateStructured<T>(prompt, zodSchema)`)
- `lib/providers/image/ImageProvider.ts` — image generation from a resolved prompt
- `lib/providers/voice/VoiceProvider.ts` — text-to-speech synthesis
- `lib/providers/storage/StorageProvider.ts` — object storage upload/delete
- `lib/providers/social/SocialPublisher.ts` — publishing (Phase 7)

## Adding a new provider

1. Implement the relevant interface in a new file, e.g. `lib/providers/ai/OpenAIProvider.ts`.
2. Register it (a simple provider registry keyed by name — added in Phase 2 — so services resolve `AIProvider` by config rather than importing a concrete class).
3. Add its API key to `.env.example` and the Settings → Provider Status page's list.
4. No changes needed in `lib/services/*` — they depend on the interface only.

## Structured output contract

Every AI call must validate against a Zod schema before the result is used anywhere else in the app (`lib/schemas/*`). If validation fails:

1. Attempt one structured repair (re-prompt with the validation error and the malformed output, asking for corrected JSON only).
2. Re-validate.
3. If still invalid, the job is marked `FAILED` with a friendly user-facing message — the raw provider error is logged server-side only, never shown to the user.

## Gemini — text (implemented, Phase 2)

`lib/providers/ai/GeminiTextProvider.ts` calls `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent` with `response_mime_type: "application/json"` and `response_schema` set together (verified against the current Gemini API docs as of this build — `response_mime_type` alone is only a hint, both fields together are required for guaranteed schema-conformant JSON). Each Zod schema in `lib/schemas/` has a hand-maintained plain-JSON-Schema mirror passed as `response_schema`; keep the two in sync when a schema changes.

On validation failure, the provider re-prompts once with the validation error and the malformed output, asking for corrected JSON only, before raising `GenerationValidationError`. API/network failures raise `ProviderRequestError` or `ProviderTimeoutError` (30s timeout) — route handlers catch these and return the generic "check your provider configuration" message, logging the real error server-side.

Model names and API surface change — re-verify `ai.google.dev/gemini-api/docs` before bumping `GEMINI_TEXT_MODEL`.

## Gemini — image (implemented, Phase 3)

`lib/providers/image/GeminiImageProvider.ts` calls `gemini-3.1-flash-image` via `generateContent` with `response_modalities: ["TEXT", "IMAGE"]`, reading the result out of `candidates[0].content.parts[].inlineData` (base64). Imagen-family models are deprecated (shutdown Aug 17, 2026) — this deliberately uses the native Gemini image model instead. Re-verify the model name against `ai.google.dev/gemini-api/docs/generate-content/image-generation` before bumping it.

The provider returns the image as a data URL; `imageGenerationService.ts` decodes it and hands the bytes to `StorageProvider` — the provider itself never touches storage, keeping the two concerns swappable independently.

## ElevenLabs — voice (implemented, Phase 4; now with timing alignment for Phase 6)

`lib/providers/voice/ElevenLabsProvider.ts` calls `POST /v1/text-to-speech/{voice_id}/with-timestamps` — not the plain `/text-to-speech/{voice_id}` endpoint — with header `xi-api-key`, body `{ text, model_id: "eleven_multilingual_v2", voice_settings: { stability, similarity_boost, style, speed, use_speaker_boost } }`. The response includes `audio_base64` plus `alignment` (character-level start/end timestamps), which the provider groups into word-level timings. There's no reason to use the non-timestamped endpoint: the request/response otherwise match, and the timing data is what makes synced subtitles (Phase 6) possible. `eleven_multilingual_v2` is the default model — appropriate given Hindi/Hinglish is a first-class language option. Voiceover generation is only ever invoked from an explicit **[Generate Voiceover]** click (`app/api/generate/voiceover/route.ts` is never called from any other service) — never automatically after script generation or approval, per the spec.

## Cost tracking

Every provider call writes an `ApiUsage` row (`provider`, `model`, `requestType`, `units`, `estimatedCostUsd`, `success`). The Settings dashboard aggregates this into today's/this month's usage — implemented alongside the provider that generates the first billable call (Phase 2).

## Security

- All provider keys are server-side environment variables only (`GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, storage keys). Never referenced in any Client Component.
- Route handlers that call providers run entirely server-side (Next.js Route Handlers / Server Actions).
- Raw provider errors (auth failures, rate limits, malformed responses) are logged server-side and translated to a generic, actionable message for the user.
