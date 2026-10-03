# Akshara — Frontend Design Direction

## Purpose

This document translates the product plan into a distinctive, buildable visual and interaction direction. It is the design source of truth for the first web release: a multilingual reader with carefully governed AI translation, private reading tools, and a small, moderated verse-discussion community.

The target is a refined editorial product designed by people—not a generic AI dashboard, a social-media clone, or a shrine-themed template. The interface should make the text the hero, keep the experience calm and legible, and make every control feel intentional.

## Product design principles

1. **Reading comes first.** The verse and its source are more visually important than feeds, metrics, badges, or calls to action.
2. **Quiet confidence, not ornamental theming.** Use Indian-script support and cultural context respectfully; avoid decorative motifs, stock temple imagery, gold-on-saffron clichés, and visual claims of religious authority.
3. **Trust is visible at the point of use.** Keep edition/source details, translation language, AI status, and community visibility close to the content they describe.
4. **Progressive disclosure.** Show the reading essentials first. Put explanations, source notes, and discussion in secondary panels or sheets that never obscure the verse.
5. **Personal data stays personal.** Save and note actions are private by default; any sharing is explicit and reversible.
6. **Designed for real scripts.** Telugu, Devanagari, and Latin text are first-class content—not translations poured into an English-only layout.
7. **Mobile is the baseline.** The desktop layout may add breathing room and a secondary rail; it must not define a cramped mobile layout.

## Visual concept: The Living Folio

Use the visual language of a contemporary literary journal: warm paper, deep ink, considered whitespace, a small botanical/earth accent, delicate rules, and typography that makes long reading comfortable. The product should feel modern and tactile without imitating a printed manuscript or making unsupported claims of antiquity.

### Color roles

Use design tokens by semantic role; do not scatter raw hex values through components.

| Token | Direction | Use |
|---|---|---|
| `canvas` | Warm, very light neutral | Main page background |
| `surface` | Clean, subtly warm white | Reading panels, menus, cards |
| `ink` | Deep charcoal, not pure black | Primary text and headings |
| `muted-ink` | Warm grey with accessible contrast | Metadata, helper text |
| `line` | Soft neutral | Dividers and card boundaries |
| `accent` | Deep evergreen or mineral teal | Primary actions, links, selected states |
| `accent-soft` | Low-chroma tint of accent | Selected navigation and subtle callouts |
| `sacred-mark` | Restrained muted saffron/ochre | Rare editorial cue, never the only status signal |
| `success` / `warning` / `danger` | Accessible semantic colors | Status and moderation feedback |

Initial palette for visual prototypes (adjust only after contrast and script-rendering checks):

| Token | Prototype value |
|---|---|
| `canvas` | `#F6F5F0` |
| `surface` | `#FFFEFA` |
| `ink` | `#202823` |
| `muted-ink` | `#59645D` |
| `line` | `#E2E3DA` |
| `accent` | `#285B4A` |
| `accent-soft` | `#E7F0E9` |
| `sacred-mark` | `#93662F` |

Treat these as a starting point, not permission to skip contrast testing. Provide a separately tuned dark theme rather than mechanically inverting colors. Verify contrast for normal text, script samples, links, focus rings, and disabled states in both themes. Color must never be the only indication of state.

### Typography

- Use a restrained, highly legible sans family for navigation, controls, and body UI.
- Use a high-quality reading serif for English literary prose only if it remains comfortable at mobile sizes.
- Use script-appropriate fonts for Devanagari and Telugu; test conjuncts, vowel marks, punctuation, line height, and fallback behavior on Android and iOS.
- Preserve verse line breaks and alignment where editorially meaningful; do not justify Indic text or force Latin hyphenation into Indic scripts.
- Use tabular numerals for chapter/verse controls and metadata where helpful.
- Avoid faux small caps, over-tight tracking, and oversized all-caps labels.
- Define a type scale with a comfortable reading body size, generous script-specific line height, and clear separation between verse, translation, commentary, and metadata.

Typography must be tested using actual sample passages in Sanskrit Devanagari, IAST with diacritics, Telugu, Hindi, and English before font selection is final.

Prototype a restrained sans-serif UI family with a literary serif for English reading content, and script-specific Noto families for Devanagari and Telugu where needed. Confirm font licensing, file size, font-loading behavior, and native-script shaping on target devices before adopting. Use local fallbacks and avoid a flash of missing glyphs or layout shift while web fonts load.

## Information architecture

Keep the primary navigation deliberately small:

- **Home** — continue reading and a small set of curated entry points
- **Library** — texts, chapters, and search
- **Bookmarks** — private saved verses and notes
- **Community** — moderated discussions anchored to a verse
- **Profile / Settings** — account, language, appearance, privacy

On mobile, use a compact top bar and a bottom navigation for the four most common destinations; place less frequent settings and history in the profile/menu surface. On desktop, use a slim left rail or sidebar with a clear active state. Do not reproduce the reference screenshot's long menu: borrow its compact drawer, clear active item, simple labels, and discovery pattern—not its visual identity or novel-specific feature list.

## Core screen compositions

### Home

- A restrained greeting and one prominent **Continue reading** card with title, chapter, progress, and resume action.
- One low-friction search field for finding a text, chapter, or verse.
- A small curated section such as “Explore the library”; no algorithmic “For You” feed in the MVP.
- A modest “Recent discussions” entry only when there is useful, moderated content.
- Keep one dominant action per card. Do not fill the first screen with streaks, rankings, banners, or repeated signup prompts.

### Library and search

- Organize content by text and chapter, with clear language/script metadata.
- Search should accept supported scripts and transliteration where available; show the matched fragment and result location.
- Include useful empty, loading, no-match, and network-error states. Do not present transliteration search as comprehensive until verified.
- Use compact, editorially styled result rows rather than a grid of decorative covers when no real cover art exists.

### Reader (signature screen)

**Desktop:** centered reading column with a comfortable maximum measure; optional narrow chapter rail on the left and a secondary details/discussion panel on the right. Side panels can collapse. The primary text column remains dominant.

**Mobile:** single-column flow. Verse actions open a bottom sheet or inline expansion, never a squeezed side-by-side layout.

Each verse block should present, in order:

1. Chapter and verse reference with a stable link.
2. Original Sanskrit in Devanagari, with an optional IAST view/toggle.
3. Translation in the selected target language.
4. A clear “AI-generated” or “Human reviewed” status plus the source/edition affordance.
5. Compact actions: **Translate / Explain**, **Save**, **Discuss**, and **More**.

Use a subtle rule, spacing, or background shift to distinguish adjacent verses. Avoid boxing every verse like a dashboard widget. Keep the translation mode (literal/fluent) and target language visible; preserve them when navigating verses. A mode change must not silently replace or overwrite a reviewed translation.

### AI translation and explanation

- Trigger on demand from a verse; show the target language and mode before generation.
- Use an unobtrusive inline progress state that preserves the original verse.
- Label generated content persistently, with source edition and a short explanation of what AI status means.
- Provide actions to report an issue, retry, and compare modes/languages where enabled.
- Explain unavailable, rate-limited, and provider-failure states clearly. Never fake a successful result or silently change providers/languages.
- Keep any uncertainty or interpretation caveat near the generated output, not hidden in settings.
- Do not show model “chain of thought.” Offer concise, user-facing explanations and citations to approved source material instead.

### Bookmarks and private notes

- A save action should respond immediately with a clear saved state and undo.
- Allow an optional collection and private note without interrupting the reading flow.
- Clearly mark private content and do not suggest that a private note is a public comment.
- Bookmarks should retain the source edition and verse reference, even when the user changes display language.

### Community

- Anchor every thread to a visible text/chapter/verse reference.
- Show author, language, timestamp, edited state, and verified-role badge only when justified.
- Separate scholar/editorial status from popularity; avoid “most liked = most true” framing.
- Provide reply, report, mute/block, and moderation feedback with accessible labels and confirmation.
- Use a compact discussion list and readable thread view; avoid infinite-scroll engagement traps.
- Pending or hidden comments must never appear public. Explain moderation states to the author without exposing private reports.

## Component and interaction language

- Prefer a consistent spacing scale, restrained radii, subtle borders, and a small number of elevation levels.
- Use icons with visible labels for essential actions; tooltips supplement labels but do not replace them on touch.
- Buttons must have default, hover, pressed, focus-visible, disabled, loading, and success/error states.
- Keyboard focus is visible and never removed for aesthetic reasons.
- Use small, purposeful motion for sheet transitions and saved-state feedback; respect reduced-motion preferences.
- Avoid glassmorphism, gratuitous gradients, oversized pill controls, noisy card shadows, and generic dashboard charts.
- Use skeletons only when layout stability benefits; for scripture, prefer a quiet loading line that does not resemble placeholder sacred text.

## Responsive behavior

| Viewport | Layout |
|---|---|
| Small mobile | One-column reader; compact header; bottom navigation; verse actions in a sheet |
| Large mobile / tablet | One-column reader with optional collapsible chapter navigation |
| Desktop | Reading column plus optional secondary rail; persistent but restrained navigation |
| Wide desktop | Increase margins and rail flexibility, not text measure; keep reading column bounded |

At every breakpoint, verify that script text does not clip, action targets remain comfortably tappable, and the reader does not cause horizontal scrolling.

## Accessibility and localization requirements

- Target WCAG 2.2 AA for key journeys; test with keyboard, screen reader, zoom, and automated checks.
- Use semantic landmarks, a logical heading hierarchy, accessible names, and live announcements for translation/loading/save results.
- Minimum target sizes and contrast must meet accessibility requirements; support text resizing without truncation.
- Test right-to-left only if/when an RTL language is added; do not assume English layout behavior transfers.
- All UI strings are localized. Dates, numerals, punctuation, and language names should follow locale conventions.
- Set correct `lang` attributes for each text segment so screen readers select suitable pronunciation.
- Keep language switching separate from Sanskrit script/transliteration switching. Persist preferences with a visible way to change them.
- Do not concatenate translated fragments to form sentences; provide complete localized messages.

## Frontend quality bar

Before calling the visual system ready:

- Review key flows at narrow mobile, tablet, laptop, and wide desktop sizes.
- Inspect real multilingual text, long verses, long translation strings, empty states, and slow-network behavior.
- Test light/dark themes, keyboard-only usage, reduced motion, and high text zoom.
- Confirm all actions have feedback, all panels have close/back behavior, and no modal traps keyboard or screen-reader focus.
- Use real product copy and licensed/approved content; avoid lorem ipsum in final visual review.
- Use commissioned or clearly licensed covers/illustrations only; if no suitable art exists, prefer typography-led text rows over fabricated cover art or generic AI-generated religious imagery.
- Capture and review screenshots for Home, Library/Search, Reader, translation error/success, Bookmarks, and Community.
- Keep reusable tokens/components in one design system; do not add one-off styling to make individual screenshots look polished.

## Research and reference policy

The attached mobile navigation screenshot is an information-architecture reference only. Borrow the compact drawer, strong active state, approachable labels, and clear discovery cues. Do not copy the source product's branding, exact layout, assets, icons, or proprietary visual styling.

### Product references reviewed (2 October 2026)

These references inform interaction choices; they are not visual templates. Availability and coverage can vary by product, text, language, region, or plan.

| Product | Useful pattern for Akshara | Akshara adaptation / caution |
|---|---|---|
| [YouVersion Bible App](https://www.youversion.com/bible-app) | Keeps bookmarks, highlights, notes, audio, and reading plans close to reading. | Make language/audio coverage explicit; keep social plans out of the MVP. |
| [Quran.com](https://quran.com/about-us) | Organizes translation, commentary, recitation, search, and notes around passages. | Use the passage as the anchor; do not imply uniform availability across editions or languages. |
| [Sefaria](https://apps.apple.com/us/app/sefaria-jewish-texts-library/id1163273965) | Connects source texts, translations, commentary, search, and study. | Show textual/source relationships clearly and communicate corpus coverage honestly. |
| [Gita Supersite](https://www.gitasupersite.in/) | Relevant model for presenting Sanskrit with multiple Indian-language translations and commentaries. | Learn from its multilingual depth while designing a calmer, more contemporary mobile reading flow. |
| [Fable](https://apps.apple.com/us/app/fable-track-discuss-books/id1488170618) | Links highlights and annotations with chapter-level discussion; private reading and club activity can be distinct. | Adapt passage-linked discussion, not engagement mechanics or contemporary-book styling. |
| [Readwise Reader / Ghostreader](https://docs.readwise.io/reader/guides/ghostreader/quick-lookup) | Selection-triggered lookup in a contextual panel; saving a result is a deliberate action. | Offer optional, on-demand translation/explanation without interrupting reading; disclose connectivity and availability limitations. |

**Design takeaway:** Combine the passage-centered study depth of scripture libraries, the private annotation model of reading tools, and the contextual help of AI lookup. Do not import feed-first social patterns, notification pressure, streaks, or popularity signals that could make interpretation seem like a contest.

Product inspiration is not a substitute for testing with Akshara's intended readers and native speakers. Recheck product capabilities and accessibility before implementation decisions that rely on them.

## MVP design decisions

- No public-facing follower counts, leaderboards, streak pressure, recommendation feed, or gamified ranking in the first release.
- No map, video studio, generated sacred imagery, or decorative media surfaces in the MVP.
- AI output is a reading aid; human-reviewed source editions remain visibly distinct.
- Reader, private saves, and safe verse discussion are the visual priorities.
- The tone is literary, respectful, calm, and contemporary—not a generic “AI app” and not a religious authority.
