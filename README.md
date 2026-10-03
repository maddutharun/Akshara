# Akshara

Akshara is a mobile-first multilingual reading and discussion app. The current milestone is an interactive frontend preview with Supabase auth/API/schema foundations; live services and production content are not configured.

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

## Code organization

- `app/` contains addressable Home, Library, Bookmarks, Community, Profile, and reader pages plus thin API route adapters.
- `features/` owns product UI and server-side behavior by domain: application, auth, bookmarks, reading progress, community, moderation, and translation.
- `components/` is reserved for reusable interface primitives and shared layout components as they are extracted from feature screens.
- `lib/` contains shared infrastructure such as Supabase clients and API helpers.
- `supabase/` contains database migrations and policy tests; `tests/unit/` contains application unit tests; `docs/` contains product, design, and content/provider sourcing documents.

Each primary navigation destination and the available sample reader have direct URLs and can be opened or refreshed independently. The routes compose a shared interactive preview; they do not imply that production content or account-backed persistence are connected. A Realtime subscription helper and database publication migration are present, but no production passage IDs or configured Supabase project connect them to the preview.

## Current implementation boundary

- The UI contains illustrative, non-canonical preview text only. It is not a verified scripture edition or approved translation.
- Bookmarks, private notes, and selected-text highlights persist only in the local browser. Supabase magic-link auth and authenticated bookmark, reading-progress, community, and moderation API routes are scaffolded, but account syncing and live service behavior are not yet verified.
- Community posts are local preview state and are not sent to a server or visible to other visitors. Server foundations now include comment reads/submission/edit/soft-delete, report and block/mute endpoints, appeal submission, moderation RPCs, and reply-location validation. The preview is not wired to those APIs; the live Supabase project, end-to-end moderation flows, and account controls are not configured.
- The translation route validates requests and responds honestly when provider setup is absent. It does not call an AI provider yet.
- The Supabase migrations define the initial content/community model, RLS policies, moderation functions, an RLS-filtered comment Realtime publication, and a same-passage approved-parent constraint for replies; they have not been applied to a Supabase project or tested against PostgreSQL/pgTAP.

Do not use personal notes, private community content, licensed scripture text, or production data with this preview until the Supabase project is configured and the migration has been tested.

## Before production data/integrations

1. Choose and clear the actual source editions, translations, and redistribution licenses; see [content/provider sourcing](./docs/product/content-and-provider-sourcing.md).
2. Select an AI provider only after language-pair evaluation, provider privacy/retention review, budget, and legal review.
3. Create a Supabase project, apply and test migrations/RLS, configure auth and recovery flows, and add environment variables server-side.
4. Connect the preview UI to the authenticated bookmark/progress/community APIs and complete report/moderation workflows.
5. Run the migration and database tests against Supabase, then complete browser, accessibility, performance, privacy, and security testing; configure deployment and monitoring.

## Implementation status

**Estimated overall completion: 39% of the three planned MVP phases.** This is a rough, equally weighted feature-readiness estimate—not a production-readiness claim or count of files: Phase 1 is estimated at 71%, Phase 2 at 10%, and Phase 3 at 36%. It credits local behavior and unverified integration scaffolding only partially; anything not connected and tested against a live service remains incomplete.

**Implemented locally:** responsive reader/library/community preview; direct URLs for the five primary screens and an addressable one-chapter sample reader at `/reader/sanskrit-reading/1`; working client navigation under the production CSP; browser-local bookmarks, reader-accessible private notes/highlights, resume-to-last-opened reader position, and validated language/appearance preferences; search and language/script controls; unsupported sample reader paths return 404; auth/API/schema foundations; request-validation and route tests; lint, typecheck, unit-test, audit, and production-build checks.

**Phase 1 remaining:** verified/licensed editions and provenance, a real searchable catalog and chapter corpus, and account-synced bookmarks/progress/preferences. Current local content and saved state are browser-specific and do not sync across devices.

**Phase 2 remaining:** approved AI provider adapter, quality-reviewed language pairs, output provenance/reporting, caching, quotas, and spend controls.

**Phase 3 remaining:** applying and testing migrations on Supabase, connecting real passage IDs and comment/realtime UI, replies UI, reports/block/mute UI, moderator queue UI and appeals workflow, and tested production RLS.

**Not production-ready:** all three phases still need live Supabase migration/RLS validation; licensed source text; the AI provider and language quality decisions; end-to-end accessibility/security/performance checks; GitHub remote; and deployment/monitoring.

See the [implementation plan](./docs/product/implementation-plan.md) for product scope and launch gates, and the [frontend design direction](./docs/design/frontend-design-direction.md) for the visual system.

To enable the implemented magic-link sign-in, copy `.env.example` to `.env.local`, add the Supabase project URL and publishable/anon key, set `NEXT_PUBLIC_SITE_URL`, and allow the local and deployed `/auth/callback` URLs in Supabase Auth. Never place the Supabase service-role key in a `NEXT_PUBLIC_` variable or browser code.
