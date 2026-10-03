# Project Akshara (అక్షర / अक्षर)
## Master Product Plan v2.0 (AI Translation + Reading Community)

**Lead Architect:** @Tharun  
**Date:** October 2, 2026  
**Status:** Product Blueprint for Multi-Language Reading Community  
**Primary Stack:** Next.js + Supabase + AI Translation Layer + Community Features  
**Target Experience:** Mobile-first reader with AI translation, bookmarks, comments, discussions, and personal reading habits  
**Supported Languages:** Sanskrit (Devanagari script with IAST transliteration), Telugu, Hindi, English  

---

## 1. Product Vision

Project Akshara is a multilingual reading and learning platform built for people who want to read sacred and literary texts in their native language while also exploring deeper bilingual and multilingual meanings. The product combines:

- AI-assisted translation across languages
- faithful source-based reading experience
- community discussion and comments
- bookmarks, highlights, and saved reading lists
- polished mobile-first interface inspired by modern reading apps

The app should feel premium, calm, and intelligent, not overly technical. It should be a reading companion for daily use.

---

## 2. Core Experience

The product should focus on these user-facing outcomes:

1. Read Sanskrit-origin text in Devanagari and switch to IAST transliteration when useful.
2. View translations in English, Telugu, Hindi, or all together.
3. Compare literal meaning vs fluent meaning.
4. Save passages for later reading.
5. Comment on verses, passages, or notes.
6. Keep private reading history and progress.
7. Join discussions and discover useful community contributions.

---

## 3. Recommended Product Structure

| Module | Purpose | User Value |
| :--- | :--- | :--- |
| **Akshara Reader** | Read text with translation tabs | Core engagement |
| **AI Translation Layer** | Translate and explain across languages | Better understanding |
| **Comments & Discussion** | Ask questions, discuss verses | Community building |
| **Bookmarks & Notes** | Save favorite passages | Personal retention |
| **Library & Discover** | Browse text collections and themes | Content discovery |
| **Reader Profiles** | Basic identity and community participation | User recognition |
| **Reading Progress** | Track what the user has read | Habit formation |

---

## 4. Strong AI Translation System (Cross-Language)

A strong AI layer is important, but it must not replace editorial trust. The translation system should support multilingual understanding rather than raw machine-only output. IAST is a transliteration scheme for Sanskrit, not a separate language: users can convert the Sanskrit script/transliteration, then translate the text between languages.

### 4.1 Translation Pipeline

```text
Verified Sanskrit source + edition/provenance
   ↓
Script normalization (Devanagari ↔ IAST; do not change source text)
   ↓
Context assembly (verse + chapter + licensed glossary / approved references)
   ↓
AI translation (literal or fluent; selected target language)
   ↓
Output checks + source/context validation
   ↓
Clearly labeled result → user feedback → optional scholar review
```

### 4.2 AI Capabilities

- Translation from Sanskrit text into English, Telugu, and Hindi; translation between supported modern languages where quality has been evaluated
- Sanskrit script conversion between Devanagari and IAST transliteration (not language translation)
- Literal and natural-language interpretation modes
- Summary and explanation for difficult passages
- Cross-language comparison view
- Context-aware suggestions for meaning based on chapter and verse
- AI-assisted glossary and terminology matching
- Report incorrect or misleading output and request a corrected translation

### 4.3 AI Governance Rules

- AI output must be labeled “AI-generated” until a qualified human review is recorded; show source edition and translation status alongside it.
- Never rewrite, complete, or present AI output as the canonical source verse. Keep source text immutable and visually separate from translations and explanations.
- AI output is an on-demand aid, not an authoritative or automatically published edition. Only translations promoted to the curated library require scholar/editor approval and provenance.
- Preserve the input source, target language, provider/model identifier, prompt/template version, status, and reviewer/correction history for generated translations; do not expose hidden reasoning or provider secrets.
- Use approved reference material only where licensing permits; do not send private user notes or profile data to an AI provider unless explicitly necessary and disclosed.
- Community-submitted translations remain separate from canonical and AI-generated content, with attribution, edit history, and moderation.
- Give users clear loading, quota-limit, retry, and unavailable states; never silently substitute a different language or claim a failed request succeeded.
- The app should allow users to switch between:
  - Literal
  - Smooth reading translation
  - Scholar review mode
  - Simplified explanation

### 4.4 Translation Output Modes

| Mode | Purpose |
| :--- | :--- |
| **Literal** | Word-by-word meaning |
| **Fluent** | Smooth natural reading |
| **Commentary** | Explanation with context |
| **Summary** | Short key idea |
| **Compare** | Side-by-side translation across languages |

### 4.5 Quality, Privacy, and Cost Controls

- Before launch, evaluate every supported source/target language pair using a fixed set of representative passages reviewed by native speakers and Sanskrit scholars. Include accuracy, faithfulness, terminology consistency, readability, and harmful/misleading interpretation checks.
- Track quality separately by language pair. Release a pair only after it meets the review threshold agreed by the editorial team; otherwise label it experimental or do not offer it.
- Cache generated results by immutable source/edition and verse identifiers, source text version, target language, output mode, model/provider version, glossary version, and prompt version. Invalidate or version the cache when any of these inputs change.
- Generate on demand, apply database-enforced per-account quotas and trusted ingress/IP throttling, cap token/output length, set provider spend alerts and a hard monthly budget, and log cost without storing unnecessary personal data. Do not trust client-supplied forwarding headers for IP identity.
- Keep provider calls behind a server-side adapter so the app can change providers without coupling product code to one vendor. Select one primary provider for launch after a documented quality, privacy, latency, language coverage, and cost evaluation; define a fallback only if it passes the same quality gate.
- Do not send user comments, private notes, or other personal data as translation context by default. Disclose provider processing and retention practices before enabling a feature that sends user content.

---

## 5. Community Module Design

The design should feel like a premium modern reading community, similar to the reference mobile app style shown in the image: elegant left menu, compact cards, simple navigation, clear reading center, communities and user actions.

### 5.1 Core Community Features

- User comments on each verse or chapter
- Discussion threads and replies
- Bookmarking favorite passages
- Highlighting and notes
- Saved lists such as “My Favorites”, “Read Later”, “Study Notes”
- Report, mute, and block controls
- “Ask the community” entry point from a verse
- Basic discussion discovery, with trending/recommendation feeds deferred until there is enough quality content

### 5.2 Community UX Pattern

```text
Home / Library / Bookmarks / Community / Profile
```

Use a left-side navigation panel similar to:

- Home
- Library
- Bookmarks
- Community
- Reading History
- Settings

### 5.3 Community Content Model

```sql
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  text_id text not null,
  chapter_id uuid,
  verse_id uuid,
  user_id uuid references auth.users(id),
  parent_comment_id uuid references public.comments(id),
  body text not null,
  language text not null default 'en',
  status text not null default 'pending' check (status in ('pending', 'approved', 'flagged', 'hidden')),
  created_at timestamptz default now()
);

create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  text_id text,
  verse_id uuid,
  chapter_id uuid,
  label text,
  note text,
  created_at timestamptz default now()
);

create table public.highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  verse_id uuid,
  start_index int,
  end_index int,
  color text,
  note text,
  created_at timestamptz default now()
);
```

The SQL above is a starting point, not a complete production migration. Before implementation, add `not null` constraints where required, foreign keys to the actual text/chapter/verse tables, uniqueness rules to prevent duplicate bookmarks, and indexes for verse discussions and a user's saved items. Use database-generated timestamps and validate comment length, language codes, and highlight ranges at both API and database boundaries.

### Community Data and Privacy Requirements

- Add `comment_reports` with reporter, comment, reason, status, and timestamps; add an append-only moderation audit record with moderator, action, reason, and appeal outcome.
- Add user block/mute relationships with a unique `(actor_user_id, target_user_id, relationship_type)` constraint and prohibit self-blocking.
- Keep notes, bookmarks, highlights, and reading progress private by default. Sharing requires an explicit user action and a separate visibility setting.
- Enable RLS on every user/community table. Users can manage only their own private data; public reads return only approved comments; pending/hidden comments are visible only to their author and authorized moderators. Moderator powers must be server-verified and tested.
- Rate-limit comment creation, replies, reports, and AI requests. Use soft deletion where moderation/audit retention is required; clearly document retention and account-deletion behavior.

---

## 6. Personal Reading Experience

The first release should feel personal without requiring a complex social graph or recommendation engine.

### 6.1 Personal Features

- Continue-reading shortcut and recently read texts
- Saved verse collections
- Reading progress by chapter, book, and language
- Reading streaks, daily goals, and personalized recommendations are later features, gated on user research and opt-in privacy review.

### 6.2 Example User Journey

1. User opens the app and sees recent reading and library search.
2. Opens a chapter and reads the source text with a chosen translation.
3. Requests an AI explanation for a difficult verse and sees its source and AI status.
4. Saves the verse privately or adds a personal note.
5. Optionally joins a moderated verse discussion.
6. Returns later to continue from the same place.

---

## 7. Product UI Direction (Inspired by the Screenshot)

The app should borrow the reference's compact mobile navigation and clear discovery pattern without copying its branding or novel-specific features:

For detailed visual principles, component behavior, responsive layouts, typography, accessibility, and design QA, see [frontend-design-direction.md](../design/frontend-design-direction.md).

- rounded top search bar and status area
- clean left navigation drawer
- active menu highlight on Home / Library / Community
- compact cards for featured reading and relevant discussions
- simple actions such as “Join discussion”, “See more”, and “Saved”
- minimal but premium visual hierarchy
- quiet neutral colors with accent green / blue for actions

### UI Menu Example

- Home
- Library
- Bookmarks
- Community
- Reading History
- Discover (start with curated content and search; personalized feeds come later)
- Settings
- Language Selector

### Reading Screen Layout

- Top header: chapter name + language switch
- Main content: verse in original script + translation tabs
- Right panel or bottom sheet: AI meaning, comments, bookmarks
- Actions: Save, Comment, Share, Translate

---

## 8. Stronger Technical Architecture

```text
[ Mobile App / Web Client ]
          │
          ▼
[ Next.js App Router ]
   ├── Localization (en, te, hi)
   ├── Reader UI
   ├── Bookmarks / Notes / Comments
   ├── AI Translation UI
   └── Community Feed
          │
          ▼
[ Supabase Postgres + RLS ]
   ├── texts
   ├── verses
   ├── comments
   ├── bookmarks
   ├── highlights
   ├── reading_progress
   └── user_followers
          │
          ▼
[ AI Translation Service ]
   ├── Sanskrit parsing
   ├── translation models
   ├── explanation engine
   └── source validation layer
```

### Stack Recommendation

| Layer | Technology |
| :--- | :--- |
| **Frontend** | Next.js, Tailwind, shadcn/ui |
| **Database & Auth** | Supabase Postgres + RLS |
| **AI Translation** | One evaluated provider for launch behind a provider adapter; keep the integration replaceable |
| **Search** | pg_trgm + full-text indexing |
| **Realtime** | Supabase Realtime |
| **Storage** | Supabase Storage |
| **Notifications** | In-app + email |
| **Analytics** | PostHog / Supabase analytics |

---

## 9. Community & Trust Model

This is critical. Community features create engagement only when trust is built.

### Rules

- User comments must be moderated before public visibility.
- AI-generated translations and explanations must be visibly labeled and reportable.
- Scholar verification must have published criteria; badges indicate identity/role verification, not that every post is endorsed.
- Bookmarks and notes are personal by default.
- Public discussions may cite sources, but ordinary questions must not be blocked for lacking citations.
- Users can report content and block or mute accounts; moderators can hide content, document reasons, and process appeals.
- Enforce posting limits and anti-spam controls; provide edit/delete controls and show when a post has been edited.
- Store moderation decisions and actions in an audit trail with least-privilege moderator access.

### Role Model

| Role | Access |
| :--- | :--- |
| **Reader** | Read, translate, bookmark, save private notes, comment, report, block/mute |
| **Contributor** | Participate in discussions and suggest corrections |
| **Verified Scholar** | Review or contribute within explicitly granted permissions |
| **Moderator** | Review reports, hide content, manage appeals |
| **Admin** | Full moderation and system controls |

---

## 10. Feature Priorities

### Phase 1: Trusted Reader
- Mobile-first text and chapter reading
- Search and language/script controls
- Source and edition attribution
- Private bookmarks, notes, and last-read position

### Phase 2: Evaluated AI Translation
- On-demand literal and fluent translation for launch-approved language pairs
- Visible AI label, context, error states, and report/correction feedback
- Quality evaluation, caching, quotas, and spend controls

### Phase 3: Safe Community
- Verse-level comments and replies
- Report, block/mute, edit/delete, moderator queue, and audit trail
- Basic community discovery

### Later, Based on Usage
- Following, reading circles, recommendation feed, trending topics, streaks, and advanced personalization

---

## 11. What to Remove / Simplify

To suit the tone of a clean, modern reading app, remove features that are not needed in the first version:

- heavy temple-map ecosystem
- large video generation and media pipeline
- elaborate GPU render pipeline
- large iconographic generation rules
- deep pilgrimage atlas if it is not the core user need
- elaborate temple, media, or institutional governance workflows that do not support launch; retain essential source attribution, copyright clearance, user safety, moderation, and privacy controls from day one
- large 500+ content modules that distract from core reading experience

The app should first win by being:

- useful
- clear
- mobile-native
- community-driven
- strong in translation and understanding

---

## 12. MVP Scope for Launch

### Must-Have

- Multi-language reader
- AI translation switcher
- Search and chapter navigation
- Bookmarks and notes
- Verse-level comments and replies with basic moderation and reporting
- Basic user profile needed for authorship and account controls
- Reading progress tracking
- Block/mute, edit/delete, and moderator review for reported content
- Basic analytics
- AI translation quality and privacy gates for each enabled language pair

### Nice-to-Have Later

- audio recitation
- scholar review dashboard
- advanced AI explanation and glossary features
- reading challenges
- collaborative reading circles
- public curated lists
- follow graph and personalized recommendation feed

---

## 13. Success Metrics

- Daily active readers
- Average number of bookmarks per user
- Comment engagement rate
- Translation usage per chapter
- Translation quality score by language pair from structured native-speaker review
- AI translation correction/report rate and resolution time
- AI provider cost per successful translation and quota-limit rate
- Community reports per 1,000 comments and moderation response time
- Return rate after 7 days
- Reading completion rate
- Number of saved notes and discussions

Launch gates should include:

- Every enabled language pair passes a documented native-speaker and scholar evaluation; do not use a single aggregate score to hide weak language pairs.
- AI outputs consistently identify their source and generated/reviewed status, and users can report a result.
- Provider privacy review, per-user quotas, spend alerts, hard budget limit, caching, and failure/retry states are verified.
- Private notes and bookmarks are inaccessible to other users under database policy tests.
- Community report, block/mute, edit/delete, moderation, and appeal flows pass end-to-end tests.

---

## 14. Final Recommendation

The best version of Akshara is not a huge all-in-one sacred media platform. It should be a premium multilingual reading app with:

- clean reader experience
- strong, quality-gated AI translation with clear provenance and privacy/cost controls
- comment and discussion community
- bookmarks, notes, and saved study lists
- modern app-like UX matching the reference design

Launch with the reader, source-based translations, personal saves, and a modest moderated comments feature. Add language pairs only when they meet quality gates, and defer social graph and recommendation complexity until real usage supports them. This creates product value and community engagement while keeping the first release focused, trustworthy, and manageable.

## 15. Implementation Status (October 2026)

The repository currently contains a polished, interactive local preview and initial application/backend foundations. The UI uses illustrative text only; it is not a production reading service.

### Progress estimate

**Estimated overall completion: 78% of the three planned MVP phases**, using equal phase weighting and rough feature-readiness estimates of Phase 1: 84%, Phase 2: 70%, and Phase 3: 80%. This estimate is not a production-readiness score. It credits implementation and automated tests, including successful local Supabase migration/pgTAP CI, but does not count provider configuration, production integration, editorial approval, native-speaker evaluation, or untested production flows as complete.

| Phase | Estimate | Implemented | Remaining |
| --- | ---: | --- | --- |
| Phase 1 — Trusted Reader | 84% | Responsive reading preview plus database-backed catalog/chapter APIs and UI, multilingual title search, chapter navigation, source provenance and human-reviewed translation display, account bookmark/note/progress/preference sync code with RLS foundations | Select and ingest a rights-cleared corpus, apply migrations and verify RLS/live sync with actual seeded records, sync highlights or explicitly exclude them from Phase 1 |
| Phase 2 — Evaluated AI Translation | 70% | Authenticated and rights-cleared passage boundary; server-side OpenAI-compatible adapter; literal/fluent/explanation/summary modes; explicit language-pair allowlist; generated/unreviewed provenance; per-account cache; DB-enforced per-account quotas; private feedback/reporting; request/provider/API tests | Configure and review the real provider and hard spend cap; apply/test migration and schedule cleanup; add trusted ingress/IP throttling; complete native-speaker review per pair before allowlisting; run live cost, quality, privacy, reliability, and UX acceptance tests |
| Phase 3 — Safe Community | 80% | Authenticated passage discussions with replies, live Supabase API reads/writes, author edit/removal, reports, block/mute, appeal submission; moderator-only queue for pending/flagged comments, reports and appeals; reasoned audited moderation RPC decisions; Realtime subscription with periodic refresh fallback; local migration application and 25 passing pgTAP schema/RLS assertions in GitHub Actions | Apply migrations to the configured production project; validate all workflows with seeded real roles/data; verify cross-account Realtime, audit records, moderation recovery, accessibility, and abuse controls in a deployed environment |

### Implemented locally

- Responsive reader, library, and community-preview surfaces with explicit sample/source status, direct URLs for the primary navigation screens, and an addressable one-chapter reader preview.
- Browser-local bookmarks, notes, and highlights.
- Browser-local last-opened reader position with a Continue reading action.
- Browser-local reading language and appearance preferences, validated on load and retained across app routes/reloads.
- Reader-accessible browser-local private note and selected-text highlight controls.
- Database-backed catalog/search and chapter APIs that return only active, rights-status-approved sources and texts, published verses, and human-reviewed translations; direct database reader routes include chapter navigation and source attribution.
- Signed-in bookmark/note and reading-progress synchronization against real catalog IDs; account language/appearance preferences have a private RLS-protected table and authenticated read/write API.
- Supabase magic-link auth and authenticated API route foundations for bookmarks, reading progress, comments, reports, relationships, and moderation.
- Authenticated passage discussion UI/API for comments and threaded replies, author edit/soft-delete, reports, block/mute, appeals, moderator queue/decisions, and audited database RPCs. Reports, relationships, and appeals have explicit owner/role RLS boundaries.
- Supabase Realtime subscription for UUID-backed verse discussions, backed by 20-second polling as a recoverable fallback when realtime is unavailable.
- Initial Supabase schema/RLS migrations and database policy tests, plus request-validation and API unit tests. CI starts a disposable local database, applies migrations, and runs pgTAP without production credentials.
- AI translation provider adapter, account-scoped cache and quota RPC, explicit source-target pair gate, generated-output labeling, and feedback submission path with RLS design and focused tests.
- Lint, type-check, unit-test, dependency-audit, and production-build checks.

### Remaining before production

- Select an exact source edition, confirm its redistribution rights/attribution/share-alike terms, prepare and verify corpus completeness, and populate source/text/chapter/verse/translation records.
- Configure a production Supabase project and apply all migrations; local Supabase migration and pgTAP tests pass in CI.
- Execute database/RLS/trigger tests against seeded production Supabase data; verify authenticated catalog reading, private bookmarks/notes, progress, preferences, reports, relationships, replies, appeals, moderator authorization, and audit history end-to-end. Selected-text highlights remain browser-local.
- Configure and privacy-review an AI provider, set a provider-side hard spending limit, and apply/test the AI cache/quota/feedback migration.
- Complete and record native-speaker/scholar evaluation for every enabled language pair; the deployment allowlist remains empty by default.
- Resolve the current high-severity advisory in the development-only Next.js ESLint dependency chain without taking npm's incompatible major-version downgrade; production dependencies currently pass `npm audit --omit=dev --audit-level=high`.
- Configure GitHub remote access, deployment, monitoring, and production accessibility/security/performance checks.

### Plan audit: acceptance status

| Planned outcome | Status | Evidence or remaining acceptance test |
| --- | --- | --- |
| Mobile-first reader, library, primary navigation | **Application integration implemented; live content pending** | Responsive UI, searchable database catalog, dynamic database-backed chapter route, source attribution, and chapter navigation; no catalog is populated in the current unconfigured project. |
| Multi-language source presentation and script controls | **Application integration implemented; edition/translation choices pending** | Database reader shows Devanagari, IAST toggle, and only human-reviewed translations for the selected language; no reviewed corpus is configured. |
| Source/edition provenance and search | **Application/API implemented; rights-cleared corpus pending** | Catalog and chapter endpoints require active sources with approved license status and include citation links; no work-level source has yet been selected and ingested. |
| Private bookmarks, notes, highlights, reading progress | **Account sync implemented in code; live verification pending** | Bookmarks/notes, reading progress, and preferences have authenticated sync paths and RLS schema; selected-text highlights remain explicitly device-local in this MVP. Real seeded records and a Supabase RLS test run are outstanding. |
| AI translation and explanations | **Server implementation and unit coverage present; launch gates open** | Authenticated published/rights-cleared verses only; server-side configurable provider; four modes; language-pair allowlist; per-account cache; 3/minute and 30/day uncached request quota; output token ceiling; provenance and feedback. Live provider, external budget, trusted ingress/IP limits, pair reviews, migration/RLS, cleanup schedule, and production tests remain. |
| Community comments and replies | **Connected application/API implementation; live database validation pending** | Reader Discuss opens the UUID-backed verse thread; visible comments and replies load through authenticated/anonymous RLS APIs, writes enter moderation, authors can edit/remove, and a Realtime refresh plus polling fallback is wired. Seeded Supabase and cross-account browser tests remain. |
| Reports, block/mute, moderation, appeals | **User and moderator flows implemented; production authorization validation pending** | Report UI, owner controls, relationships, appeal submission, moderator queue, reasoned RPC decisions and audit foundation are connected. Must still verify RLS and audit results against real moderator and reader accounts. |
| Realtime updates | **Application wired with fallback; live Supabase operation unverified** | Verse subscription refreshes discussion; periodic refresh remains active if Realtime cannot connect. Publication migration and credentials must be applied/configured and tested in deployment. |
| GitHub CI and deployment | **Local workflow only** | CI workflow exists but there is no configured Git remote or authenticated repository; Actions and deployment have not run. |
| Production security, accessibility, privacy, monitoring | **Not launch-verified** | Local lint/build/tests/audit pass; end-to-end checks, configuration, monitoring, and deployment are outstanding. |

Content and provider candidates, together with rights/privacy gates, are documented in [content and provider sourcing](./content-and-provider-sourcing.md). Per-pair human evaluation is specified in [the translation quality review protocol](./translation-quality-evaluation.md). “100%” requires the remaining acceptance tests above to pass—not merely writing more code. Current blockers include missing external service access, rights-cleared content, provider and spend configuration, language-pair approval, and live community/RLS verification. See [README.md](../../README.md) for setup boundaries.
