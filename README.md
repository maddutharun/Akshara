# Akshara

Akshara is a mobile-first multilingual reading and discussion app. Reader, translation, and community application/API paths are implemented locally, with Supabase schema foundations; live services and production content are not configured or verified.

## Run locally

Requirements: Node.js 22.12+ and npm.

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`.

## Quality checks

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

## Local Supabase database checks

Database migrations and pgTAP policy tests can be run against a disposable local Supabase stack. Docker Desktop must be running:

```powershell
npx supabase start
npx supabase db reset --local
npx supabase test db --local
npx supabase stop
```

The GitHub Actions workflow also starts a local database, applies all migrations to a clean instance, and runs the pgTAP suite. It does not require production Supabase credentials.

## Code organization

- `app/` contains addressable Home, Library, Bookmarks, Community, Profile, and reader pages plus thin API route adapters.
- `features/` owns product UI and server-side behavior by domain: application, auth, bookmarks, reading progress, community, moderation, and translation.
- `components/` is reserved for reusable interface primitives and shared layout components as they are extracted from feature screens.
- `lib/` contains shared infrastructure such as Supabase clients and API helpers.
- `supabase/` contains database migrations and policy tests; `tests/unit/` contains application unit tests; `docs/` contains product, design, and content/provider sourcing documents.

Each primary navigation destination and the available sample reader have direct URLs and can be opened or refreshed independently. The verified catalog and real passage-linked discussion paths are implemented against Supabase APIs; they remain unavailable until a configured project is populated and migrations are applied. The illustrative sample route is never sent to the community APIs.

## Current implementation boundary

- The UI contains illustrative, non-canonical preview text only. It is not a verified scripture edition or approved translation.
- Selected-text highlights persist only in the local browser. Bookmark/note/progress/preferences sync and authenticated community/moderation APIs are implemented for real database IDs, but account syncing and live service behavior are not yet verified.
- AI translations run only on authenticated requests for published passages from active, rights-cleared sources. A server-only OpenAI-compatible provider adapter labels model output, gates each `sa:<target>` pair behind an explicit allowlist, caches per account, applies database-enforced rate limits, and accepts private user feedback. Provider credentials are never sent to the browser.
- Phase 3 community paths connect passage-linked comments/replies, reports, block/mute controls, author edit/removal/appeals, moderator queues, and audit-logged decisions to authenticated Supabase APIs. Realtime refreshes discussions when configured and retains polling as a fallback. Database-backed behavior still requires applying and verifying migrations on the target Supabase project.
- The Supabase migrations define the content/community model, RLS policies, moderation functions, comment Realtime publication, same-passage reply constraint, private account reading preferences, source-rights checks, and AI translation cache/quota/feedback controls. GitHub Actions now applies them to a clean local Supabase database and runs pgTAP; they remain unapplied to a production Supabase project.

The Library and database-backed reader now use server APIs that only return active, rights-status-approved records and published verses with human-reviewed translations and source provenance. Account bookmarks/notes, reading progress, and language/appearance preference sync are connected in the UI for real database IDs. The single sample route remains local-only and is deliberately not written to Supabase. These integration paths still require the migrations, a populated rights-cleared catalog, and end-to-end verification on a configured project.

Do not use personal notes, private community content, licensed scripture text, or production data with this preview until the Supabase project is configured and the migration has been tested.

### Enabling AI translation

1. Apply all Supabase migrations, including `20261003040000_ai_translation_controls.sql`, and test RLS and the quota RPC against the target project. Schedule `public.prune_translation_controls()` at least daily using the deployment's trusted scheduler.
2. Configure `AI_PROVIDER=openai-compatible`, `AI_API_KEY`, `AI_MODEL`, and (if needed) an HTTPS `AI_API_URL` in server-only deployment secrets. Do not use a browser-prefixed variable for credentials.
3. Set provider-side monthly spend alerts and a hard spending limit. The app applies 3 requests/minute and 30 uncached requests/account/day and caps output tokens, but provider-side budget controls are required to bound actual spend.
4. Only after privacy/legal and native-speaker review, explicitly enable pairs such as `AI_ENABLED_LANGUAGE_PAIRS=sa:en,sa:te`. The default is empty, so all pairs remain disabled.
5. Evaluate each pair using [the translation quality review protocol](./docs/product/translation-quality-evaluation.md). AI output remains labeled unreviewed and is never promoted to the curated corpus.

## Before production data/integrations

1. Choose and clear the actual source editions, translations, and redistribution licenses; see [content/provider sourcing](./docs/product/content-and-provider-sourcing.md).
2. Select an AI provider only after language-pair evaluation, provider privacy/retention review, budget, and legal review.
3. Create a Supabase project, apply and test migrations/RLS, configure auth and recovery flows, and add environment variables server-side.
4. Populate rights-cleared texts and test reader/community/moderation flows with seeded accounts and real moderator roles.
5. Run migration/RLS tests against Supabase, then complete accessibility, performance, privacy, security, and abuse testing; configure deployment and monitoring.

## Implementation status

**Estimated overall completion: 76% of the three planned MVP phases.** This is a rough, equally weighted feature-readiness estimate—not a production-readiness claim or count of files: Phase 1 is estimated at 84%, Phase 2 at 70%, and Phase 3 at 75%. It credits implementation and automated tests, not unverified live services, editorial approval, or human quality evaluation.

**Implemented locally:** responsive reader/library/community preview; direct URLs for the five primary screens and an addressable one-chapter sample reader at `/reader/sanskrit-reading/1`; working client navigation under the production CSP; browser-local bookmarks, reader-accessible private notes/highlights, resume-to-last-opened reader position, and validated language/appearance preferences; search and language/script controls; unsupported sample reader paths return 404; auth/API/schema foundations; request-validation and route tests; lint, typecheck, unit-test, production-dependency audit, and production-build checks.

**Dependency audit gate:** `npm audit --omit=dev --audit-level=high` passes. The full audit currently reports GHSA-vfj7-8cjw-p6xm through the development-only `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces` chain. The advisory affects `braces` versions through 3.0.3; the registry has no patched release, and npm's forced fix downgrades the Next ESLint config to an incompatible major. CI keeps this full audit visible in its own job so it does not skip build and test jobs. Do not treat the full dependency audit as clean until a compatible upstream fix or safe toolchain replacement is available.

**Phase 1 remaining:** select and populate a complete rights-cleared edition/corpus, apply and verify database RLS against a configured Supabase project, and prove reader/catalog/bookmark/note/progress/preference flows end-to-end with seeded real records. Highlights still remain browser-local. Until those gates pass, do not claim Phase 1 complete.

**Phase 2 remaining:** configure and privacy-review a real provider, populate server secrets and a provider-side hard budget, apply and test the quota/cache/feedback migration, approve each source-target pair via documented native-speaker review, and run live end-to-end quality/cost tests. Until these gates pass, Phase 2 is not 100% or launch-ready.

**Phase 3 remaining:** apply and run the full database/RLS/trigger suite on a configured Supabase project; seed rights-cleared passages, users, comments and moderator roles; verify the full report/block/mute/reply/appeal flows and Realtime with real accounts; and test moderator authorization, audit entries, accessibility, abuse controls, and recovery behavior in a deployed environment.

**Dependency security remaining:** resolve the full-audit high-severity development-tool advisory without downgrading the Next.js/ESLint toolchain to incompatible major versions. The production dependency tree currently audits clean; keep monitoring for a patched `braces` release or use a reviewed compatible linter replacement.

**Not production-ready:** all three phases still need live Supabase migration/RLS validation; licensed source text; the AI provider and language quality decisions; end-to-end accessibility/security/performance checks; GitHub remote; and deployment/monitoring.

See the [implementation plan](./docs/product/implementation-plan.md) for product scope and launch gates, and the [frontend design direction](./docs/design/frontend-design-direction.md) for the visual system.

To enable the implemented magic-link sign-in, copy `.env.example` to `.env.local`, add the Supabase project URL and publishable/anon key, set `NEXT_PUBLIC_SITE_URL`, and allow the local and deployed `/auth/callback` URLs in Supabase Auth. Never place the Supabase service-role key in a `NEXT_PUBLIC_` variable or browser code.
