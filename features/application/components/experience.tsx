"use client";

import {
  ArrowRight,
  Bookmark,
  Check,
  Compass,
  Feather,
  Highlighter,
  Home,
  Languages,
  Library,
  ListFilter,
  LoaderCircle,
  MessageCircle,
  Moon,
  MoreHorizontal,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Sun,
  TextSearch,
  UserRound,
  X,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { getSectionFromPathname, sectionPaths, type Section } from "@/features/application/section-routes";
import {
  isSampleReaderPath,
  sampleReaderPath,
} from "@/features/application/reader-route";
import {
  defaultReadingPreferences,
  parseReadingPreferences,
  type ReadingLanguage,
} from "@/features/application/reading-preferences";

type SavedVerse = {
  id: string;
  title: string;
  reference: string;
  note: string;
};
type SavedHighlight = {
  id: string;
  quote: string;
  reference: string;
};

function isSavedVerse(value: unknown): value is SavedVerse {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.reference === "string" &&
    typeof item.note === "string";
}

function isSavedHighlight(value: unknown): value is SavedHighlight {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" &&
    typeof item.quote === "string" &&
    typeof item.reference === "string";
}

const sampleVerse = {
  id: "11111111-1111-4111-8111-111111111111",
  textId: "demo-text",
  title: "A sample reading",
  reference: "Chapter 1 · Verse 1",
  devanagari: "विद्या ददाति विनयं",
  iast: "vidyā dadāti vinayaṃ",
  english: "Learning can open the way to humility.",
  telugu: "విద్య వినయానికి మార్గం చూపగలదు.",
  hindi: "विद्या विनम्रता का मार्ग खोल सकती है।",
  source: "Preview text · source and edition not yet verified",
};

const navItems: { name: Section; icon: typeof Home }[] = [
  { name: "Home", icon: Home },
  { name: "Library", icon: Library },
  { name: "Bookmarks", icon: Bookmark },
  { name: "Community", icon: MessageCircle },
];

const sampleLibrary = [
  { title: "Sanskrit reading", detail: "Sample reader available · edition unverified", mark: "अ", available: true },
  { title: "Reading collection", detail: "Preview only · text not available yet", mark: "ప", available: false },
  { title: "Sanskrit study notes", detail: "Preview only · text not available yet", mark: "वि", available: false },
];

const demoComment = {
  author: "Mira K.",
  initials: "MK",
  body: "I like seeing a smoother reading beside the original. I would love a short note on how key words are understood in context.",
};

export default function AksharaExperience() {
  const pathname = usePathname();
  const router = useRouter();
  const section = getSectionFromPathname(pathname);
  const isReader = isSampleReaderPath(pathname);
  const [language, setLanguage] = useState<ReadingLanguage>(defaultReadingPreferences.language);
  const [showIast, setShowIast] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedVerses, setSavedVerses] = useState<SavedVerse[]>([]);
  const [savedHighlights, setSavedHighlights] = useState<SavedHighlight[]>([]);
  const [noteText, setNoteText] = useState("");
  const [search, setSearch] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [aiState, setAiState] = useState<"idle" | "loading">("idle");
  const [aiMessage, setAiMessage] = useState("");
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<typeof demoComment[]>([]);
  const [dark, setDark] = useState(defaultReadingPreferences.dark);
  const [email, setEmail] = useState("");
  const [authUser, setAuthUser] = useState<string | null>(null);
  const [authConfigured, setAuthConfigured] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [readerResumePath, setReaderResumePath] = useState(sampleReaderPath);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  useEffect(() => {
    setMobileSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("akshara-bookmarks");
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed) || !parsed.every(isSavedVerse)) {
          throw new Error("Invalid local bookmark data.");
        }
        const values = parsed;
        setSavedVerses(values);
        const current = values.find((item) => item.id === sampleVerse.id);
        setSaved(Boolean(current));
        if (current) setNoteText(current.note);
      }
      const rawHighlights = window.localStorage.getItem("akshara-highlights");
      if (rawHighlights) {
        const parsed: unknown = JSON.parse(rawHighlights);
        if (!Array.isArray(parsed) || !parsed.every(isSavedHighlight)) {
          throw new Error("Invalid local highlight data.");
        }
        setSavedHighlights(parsed);
      }
      const storedProgress = window.localStorage.getItem("akshara-reading-progress");
      if (storedProgress && isSampleReaderPath(storedProgress)) {
        setReaderResumePath(storedProgress);
      }
      const storedPreferences = window.localStorage.getItem("akshara-reading-preferences");
      if (storedPreferences) {
        const preferences = parseReadingPreferences(storedPreferences);
        if (preferences) {
          setLanguage(preferences.language);
          setDark(preferences.dark);
        } else {
          setToast("Saved reading preferences were invalid; using the defaults on this device.");
        }
      }
    } catch {
      setToast("Saved reading could not be loaded from this browser.");
    } finally {
      setPreferencesLoaded(true);
    }

    let active = true;
    fetch("/api/auth/session")
      .then(async (response) => {
        if (!response.ok) throw new Error("session request failed");
        return (await response.json()) as { configured: boolean; user: { email: string | null } | null };
      })
      .then((result) => {
        if (!active) return;
        setAuthConfigured(result.configured);
        setAuthUser(result.user?.email ?? null);
      })
      .catch(() => {
        if (active) setAuthMessage("We could not check your sign-in status.");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!preferencesLoaded) return;
    try {
      window.localStorage.setItem(
        "akshara-reading-preferences",
        JSON.stringify({ language, dark }),
      );
    } catch {
      setToast("Reading preferences could not be saved on this device.");
    }
  }, [dark, language, preferencesLoaded]);

  useEffect(() => {
    if (!isReader) return;
    try {
      window.localStorage.setItem("akshara-reading-progress", pathname);
      setReaderResumePath(pathname);
    } catch {
      setToast("Reading position could not be saved on this device.");
    }
  }, [isReader, pathname]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredLibrary = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return sampleLibrary;
    return sampleLibrary.filter((item) =>
      `${item.title} ${item.detail}`.toLocaleLowerCase().includes(query),
    );
  }, [search]);

  function setSection(next: Section) {
    if (pathname !== sectionPaths[next]) router.push(sectionPaths[next]);
  }

  function changeSection(next: Section) {
    setSearch("");
    setMobileSearchOpen(false);
    setSection(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openReader() {
    router.push(readerResumePath);
  }

  function toggleBookmark() {
    const nextSaved = !saved;
    const nextVerses = nextSaved
      ? [
          {
            id: sampleVerse.id,
            title: sampleVerse.devanagari,
            reference: sampleVerse.reference,
            note: noteText.trim(),
          },
          ...savedVerses.filter((item) => item.id !== sampleVerse.id),
        ]
      : savedVerses.filter((item) => item.id !== sampleVerse.id);

    try {
      window.localStorage.setItem("akshara-bookmarks", JSON.stringify(nextVerses));
      setSaved(nextSaved);
      setSavedVerses(nextVerses);
      setToast(nextSaved ? "Saved privately on this device." : "Removed from your saved items.");
    } catch {
      setToast("This browser could not save the change. Please check storage permissions.");
    }
  }

  function savePrivateNote() {
    const nextVerses = [
      {
        id: sampleVerse.id,
        title: sampleVerse.devanagari,
        reference: sampleVerse.reference,
        note: noteText.trim(),
      },
      ...savedVerses.filter((item) => item.id !== sampleVerse.id),
    ];
    try {
      window.localStorage.setItem("akshara-bookmarks", JSON.stringify(nextVerses));
      setSaved(true);
      setSavedVerses(nextVerses);
      setToast("Your note and verse are saved privately on this device.");
    } catch {
      setToast("This browser could not save your note. Please check storage permissions.");
    }
  }

  function highlightSelection() {
    const quote = window.getSelection()?.toString().trim();
    if (!quote) {
      setToast("Select a few words in the sample verse or translation first.");
      return;
    }
    const nextHighlights = [
      { id: `${sampleVerse.id}:${Date.now()}`, quote, reference: sampleVerse.reference },
      ...savedHighlights,
    ].slice(0, 100);
    try {
      window.localStorage.setItem("akshara-highlights", JSON.stringify(nextHighlights));
      setSavedHighlights(nextHighlights);
      window.getSelection()?.removeAllRanges();
      setToast("Passage saved to your private highlights on this device.");
    } catch {
      setToast("This browser could not save the highlight. Please check storage permissions.");
    }
  }

  async function requestTranslation() {
    setAiState("loading");
    setAiMessage("");
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          textId: sampleVerse.textId,
          verseId: sampleVerse.id,
          targetLanguage: language,
          mode: "explanation",
        }),
      });
      const result = (await response.json()) as { error?: string; message?: string };
      setAiMessage(
        result.message ??
          result.error ??
          "Translation is unavailable. Please try again later.",
      );
    } catch {
      setAiMessage("The translation service could not be reached. Try again when online.");
    } finally {
      setAiState("idle");
    }
  }

  function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = comment.trim();
    if (body.length < 3) {
      setToast("Please add a little more detail before posting.");
      return;
    }
    if (body.length > 600) {
      setToast("Keep comments under 600 characters.");
      return;
    }
    setComments((current) => [{ ...demoComment, author: "You", initials: "YO", body }, ...current]);
    setComment("");
    setToast("Preview only: comments are not yet sent to a server or visible to others.");
  }

  async function submitSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthMessage("");
    try {
      const response = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = (await response.json()) as { message?: string };
      setAuthMessage(result.message ?? "Sign-in could not be completed.");
      if (response.ok) setEmail("");
    } catch {
      setAuthMessage("The sign-in service could not be reached. Please try again.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    setAuthBusy(true);
    setAuthMessage("");
    try {
      const response = await fetch("/api/auth/sign-out", { method: "POST" });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "Sign-out failed.");
      setAuthUser(null);
      setAuthMessage(result.message ?? "You are signed out.");
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Sign-out failed.");
    } finally {
      setAuthBusy(false);
    }
  }

  function renderLibrary() {
    return (
      <>
        <div className="eyebrow"><span className="eyebrow-dot" /> THE AKSHARA LIBRARY</div>
        <h1 className="view-title">A library for thoughtful reading.</h1>
        <p className="view-intro">
          Browse texts and study collections. Records shown here are previews until source editions and licenses are verified.
        </p>
        <div className="search-box" style={{ width: "100%", height: 48, marginBottom: 20 }}>
          <Search size={17} aria-hidden="true" />
          <input
            aria-label="Search library"
            placeholder="Search texts and collections"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <ListFilter size={16} aria-hidden="true" />
        </div>
        {filteredLibrary.length ? (
          <div className="library-grid">
            {filteredLibrary.map((item) => (
              item.available ? (
                <button className="library-card" key={item.title} onClick={openReader} type="button">
                  <span className="library-card-mark" aria-hidden="true">{item.mark}</span>
                  <span><h3>{item.title}</h3><p>{item.detail}</p></span>
                </button>
              ) : (
                <div className="library-card" key={item.title} aria-disabled="true">
                  <span className="library-card-mark" aria-hidden="true">{item.mark}</span>
                  <span><h3>{item.title}</h3><p>{item.detail}</p></span>
                </div>
              )
            ))}
          </div>
        ) : (
          <EmptyState icon={<TextSearch size={24} />} title="No matching texts" body="Try another title or clear your search." />
        )}
      </>
    );
  }

  function renderBookmarks() {
    return (
      <>
        <div className="eyebrow"><span className="eyebrow-dot" /> YOUR PRIVATE LIBRARY</div>
        <h1 className="view-title">Saved for another moment.</h1>
        <p className="view-intro">Your bookmarks are stored only in this browser in this prototype.</p>
        {savedVerses.length || savedHighlights.length ? (
          <div className="reading-card">
            {savedVerses.map((item) => (
              <div className="list-row" key={item.id}>
                <div className="list-row-main">
                  <p className="list-row-title">{item.title}</p>
                  <p className="list-row-meta">{item.reference} · {item.note || "Private bookmark, no note"}</p>
                </div>
                <button className="button-quiet" type="button" onClick={openReader}>Read <ArrowRight size={14} /></button>
              </div>
            ))}
            {savedHighlights.map((item) => (
              <div className="list-row" key={item.id}>
                <div className="list-row-main">
                  <p className="list-row-title">“{item.quote}”</p>
                  <p className="list-row-meta">{item.reference} · Private highlight</p>
                </div>
                <button
                  className="button-quiet"
                  type="button"
                  onClick={() => {
                    const next = savedHighlights.filter((highlight) => highlight.id !== item.id);
                    try {
                      window.localStorage.setItem("akshara-highlights", JSON.stringify(next));
                      setSavedHighlights(next);
                      setToast("Highlight removed from this device.");
                    } catch {
                      setToast("This browser could not remove the highlight. Please check storage permissions.");
                    }
                  }}
                >Remove</button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Bookmark size={24} />} title="Your reading shelf is ready" body="Save a verse as you read and it will appear here, private to this device." />
        )}
      </>
    );
  }

  function renderCommunity() {
    return (
      <>
        <div className="eyebrow"><span className="eyebrow-dot" /> THOUGHTFUL CONVERSATION</div>
        <h1 className="view-title">Meaning grows in good company.</h1>
        <p className="view-intro">
          Discussions will be tied to a passage and reviewed for safety. This local preview does not publish or transmit comments.
        </p>
        <div className="reading-card">
          <div className="reading-card-top">
            <div>
              <div className="small-label">A DISCUSSION FROM THE READER</div>
              <h2 className="chapter-title">What does learning ask of us?</h2>
            </div>
            <span className="demo-pill">Preview</span>
          </div>
          <p className="view-intro" style={{ marginTop: 15, marginBottom: 6 }}>
            {sampleVerse.devanagari} · {sampleVerse.reference}
          </p>
          {[...comments, demoComment].map((item, index) => (
            <div className="discussion-row" key={`${item.author}-${index}`}>
              <span className="discussion-avatar" aria-hidden="true">{item.initials}</span>
              <div className="discussion-copy"><strong>{item.author} · preview</strong>{item.body}</div>
            </div>
          ))}
          <form onSubmit={submitComment} style={{ marginTop: 18 }}>
            <label className="small-label" htmlFor="comment-input">ADD A THOUGHT · LOCAL PREVIEW</label>
            <textarea
              id="comment-input"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={600}
              placeholder="Ask a question or share a reflection…"
              rows={3}
              style={{
                display: "block",
                width: "100%",
                marginTop: 8,
                padding: 12,
                resize: "vertical",
                border: "1px solid var(--line)",
                borderRadius: 12,
                background: "var(--surface)",
                color: "var(--ink)",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
              <span style={{ color: "var(--quiet)", fontSize: 10 }}>Be kind. A real community will include reporting and moderation tools.</span>
              <button className="button-primary" type="submit"><Send size={14} /> Preview post</button>
            </div>
          </form>
        </div>
      </>
    );
  }

  function renderProfile() {
    return (
      <>
        <div className="eyebrow"><span className="eyebrow-dot" /> YOUR SPACE</div>
        <h1 className="view-title">A reading practice, your own.</h1>
        <p className="view-intro">Sign in to prepare for synced reading. Personal saves remain local-only until the database is connected.</p>
        <div className="reading-card" style={{ marginBottom: 16 }}>
          <div className="reading-card-top">
            <div><div className="small-label">YOUR AKSHARA ACCOUNT</div><h2 className="chapter-title">{authUser ? "You're signed in" : "Keep your place across devices"}</h2></div>
            {authUser && <span className="reviewed-pill"><ShieldCheck size={12} /> Signed in</span>}
          </div>
          <p className="side-card-copy" style={{ marginTop: 8, marginBottom: 14 }}>
            {authUser ?? (authConfigured ? "We will email you a secure sign-in link." : "Secure sign-in will be available after the project connects to Supabase.")}
          </p>
          {authUser ? (
            <button className="button-secondary" type="button" disabled={authBusy} onClick={signOut}>{authBusy ? "Please wait…" : "Sign out"}</button>
          ) : (
            <form onSubmit={submitSignIn} style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
              <label className="sr-only" htmlFor="sign-in-email">Email address</label>
              <input
                id="sign-in-email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={!authConfigured || authBusy}
                style={{ minWidth: 180, minHeight: 42, flex: "1 1 220px", padding: "0 12px", border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface)", color: "var(--ink)", fontSize: 12 }}
              />
              <button className="button-primary" disabled={!authConfigured || authBusy} type="submit">{authBusy ? "Sending…" : "Email me a sign-in link"} <ArrowRight size={14} /></button>
            </form>
          )}
          {authMessage && <p className="demo-notice" role="status">{authMessage}</p>}
        </div>
        <div className="reading-card">
          <div className="list-row">
            <div className="list-row-main"><p className="list-row-title">Reading language</p><p className="list-row-meta">Choose the language for translations and interface previews.</p></div>
            <label className="sr-only" htmlFor="profile-language">Reading language</label>
            <select id="profile-language" value={language} onChange={(event) => setLanguage(event.target.value as ReadingLanguage)} className="language-select">
              <option>English</option><option>తెలుగు</option><option>हिन्दी</option>
            </select>
          </div>
          <div className="list-row">
            <div className="list-row-main"><p className="list-row-title">Display preferences</p><p className="list-row-meta">A softer display for evening reading.</p></div>
            <button className="button-secondary" type="button" onClick={() => setDark((value) => !value)}>{dark ? <Sun size={15} /> : <Moon size={15} />}{dark ? "Light preview" : "Dark preview"}</button>
          </div>
          <div className="list-row">
            <div className="list-row-main"><p className="list-row-title">Privacy</p><p className="list-row-meta">Bookmarks and notes stay on this browser for now.</p></div>
            <ShieldCheck size={18} color="var(--accent)" />
          </div>
        </div>
      </>
    );
  }

  return (
    <main className="app-shell" data-theme={dark ? "dark" : "light"}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <aside className="sidebar" aria-label="Main navigation">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); changeSection("Home"); }}>
          <span className="brand-mark" aria-hidden="true">अ</span>
          <span><span className="brand-name">akshara</span><span className="brand-caption">read with meaning</span></span>
        </a>
        <div className="side-label">YOUR SPACE</div>
        <nav className="nav-list">
          {navItems.map(({ name, icon: Icon }) => (
            <button className={`nav-link ${section === name ? "active" : ""}`} key={name} onClick={() => changeSection(name)} type="button">
              <Icon size={17} strokeWidth={1.8} /><span>{name}</span>
            </button>
          ))}
          <button className={`nav-link ${section === "Profile" ? "active" : ""}`} onClick={() => changeSection("Profile")} type="button">
            <UserRound size={17} strokeWidth={1.8} /><span>Profile & settings</span>
          </button>
        </nav>
        <div className="side-label">YOUR READING</div>
        <div className="sidebar-note"><strong>Small steps, lasting meaning.</strong>Pick up where you left off, or find a new passage to explore.</div>
        <div className="sidebar-bottom">
          <label className="language-control">
            <span><Languages size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />Reading in</span>
            <select aria-label="Select reading language" value={language} onChange={(event) => setLanguage(event.target.value as ReadingLanguage)}>
              <option>English</option><option>తెలుగు</option><option>हिन्दी</option>
            </select>
          </label>
          <button className="theme-control" type="button" onClick={() => setDark((value) => !value)}>
            {dark ? <Sun size={15} /> : <Moon size={15} />}<span>{dark ? "Switch to light" : "Reading appearance"}</span>
          </button>
          <div className="sidebar-note"><strong>Early preview</strong>Sample passages and community content are not yet verified or shared.</div>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="breadcrumb">Akshara <span aria-hidden="true">/</span> <strong>{isReader ? "Reader" : section}</strong></div>
          <div className="topbar-actions">
            <label className="search-box desktop-search">
              <Search size={15} aria-hidden="true" />
              <input aria-label="Search the library" placeholder="Search texts, chapters…" value={search} onChange={(event) => { setSearch(event.target.value); if (event.target.value) setSection("Library"); }} />
            </label>
            <button className="mobile-search-trigger" type="button" aria-label="Search the library" onClick={() => setMobileSearchOpen(true)}><Search size={18} /></button>
            <button className="avatar" type="button" aria-label="Open profile" onClick={() => changeSection("Profile")}>A</button>
          </div>
          {mobileSearchOpen && (
            <form className="mobile-search-overlay" onSubmit={(event) => { event.preventDefault(); setSection("Library"); setMobileSearchOpen(false); }}>
              <Search size={16} aria-hidden="true" />
              <input
                aria-label="Search the library"
                autoFocus
                placeholder="Search texts, chapters…"
                value={search}
                onChange={(event) => { setSearch(event.target.value); if (event.target.value) setSection("Library"); }}
              />
              <button type="button" aria-label="Close search" onClick={() => setMobileSearchOpen(false)}><X size={17} /></button>
            </form>
          )}
        </header>

        <div className="content-wrap" id="main-content" tabIndex={-1}>
          {isReader && (
            <section className="reader-page">
              <div className="eyebrow"><span className="eyebrow-dot" /> READING PREVIEW · SOURCE PENDING</div>
              <h1 className="view-title">A thought on learning</h1>
              <p className="view-intro">
                Sanskrit reading · Chapter 1 of 1 · This illustrative passage is not a verified edition.
              </p>
              <div className="reader-toolbar" aria-label="Reader controls">
                <button className="button-secondary" type="button" disabled aria-label="Previous chapter">
                  <ArrowRight size={14} style={{ transform: "rotate(180deg)" }} /> Previous
                </button>
                <span className="demo-pill">Chapter 1 · Preview</span>
                <button className="button-secondary" type="button" disabled aria-label="Next chapter">
                  Next <ArrowRight size={14} />
                </button>
              </div>
              <section className="reading-card" aria-labelledby="reader-chapter-heading">
                <div className="reading-card-top">
                  <div>
                    <div className="small-label">SAMPLE TEXT · EDITION NOT VERIFIED</div>
                    <h2 className="chapter-title" id="reader-chapter-heading">Chapter 1 · A thought on learning</h2>
                  </div>
                  <span className="demo-pill">Preview only</span>
                </div>
                <div className="verse-block">
                  <div className="verse-reference">
                    <span className="verse-number">Verse 1</span>
                    <span>Source and edition pending</span>
                  </div>
                  <p className="verse-sanskrit" lang="sa-Deva" data-reader-selection>{sampleVerse.devanagari}</p>
                  {showIast && <p className="verse-iast" lang="sa-Latn">{sampleVerse.iast}</p>}
                  <p className="verse-translation" data-reader-selection lang={language === "తెలుగు" ? "te" : language === "हिन्दी" ? "hi" : "en"}>
                    {language === "తెలుగు" ? sampleVerse.telugu : language === "हिन्दी" ? sampleVerse.hindi : sampleVerse.english}
                  </p>
                  <div className="verse-actions">
                    <button className="button-quiet" type="button" onClick={() => setShowIast((value) => !value)}>
                      <Languages size={14} />{showIast ? "Hide IAST" : "Show IAST"}
                    </button>
                    <button className="button-quiet" type="button" onClick={toggleBookmark}>
                      {saved ? <Check size={14} /> : <Bookmark size={14} />}{saved ? "Saved privately" : "Save"}
                    </button>
                    <button className="button-quiet" type="button" onClick={() => changeSection("Community")}>
                      <MessageCircle size={14} />Discuss
                    </button>
                  </div>
                </div>
                <p className="demo-notice" role="note">
                  <strong>Preview content.</strong> This sample is illustrative, not an approved scripture edition or verified translation.
                </p>
                <div className="progress-row">
                  <span>Reading position saved on this device</span>
                  <span>Chapter 1 of 1</span>
                </div>
              </section>
              <details className="private-note-panel reader-private-tools">
                <summary><Feather size={14} /> Add a private note or highlight</summary>
                <p className="view-intro">
                  Only saved in this browser. Select words in the sample passage before creating a highlight.
                </p>
                <label className="sr-only" htmlFor="reader-private-note">Private note for this passage</label>
                <textarea
                  id="reader-private-note"
                  maxLength={2000}
                  placeholder="Write a thought for yourself…"
                  value={noteText}
                  onChange={(event) => setNoteText(event.target.value)}
                  rows={3}
                />
                <div className="private-note-actions">
                  <button className="button-secondary" type="button" onClick={highlightSelection}>
                    <Highlighter size={14} /> Save selected words
                  </button>
                  <button className="button-primary" type="button" onClick={savePrivateNote}>
                    <Bookmark size={14} /> Save private note
                  </button>
                </div>
              </details>
            </section>
          )}
          {section === "Home" && !isReader && (
            <>
              <section className="hero">
                <div>
                  <div className="eyebrow"><span className="eyebrow-dot" /> A QUIETER WAY TO EXPLORE</div>
                  <h1>Read slowly.<br />Understand deeply.</h1>
                  <p className="hero-copy">Explore enduring texts through their original words, thoughtful translations, and the perspectives of a generous community.</p>
                  <div className="hero-actions">
                    <button className="button-primary" type="button" onClick={openReader}>Continue reading <ArrowRight size={15} /></button>
                    <button className="button-secondary" type="button" onClick={() => changeSection("Library")}><Compass size={15} /> Explore library</button>
                  </div>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <div className="folio">
                    <div className="folio-label">A note on learning</div>
                    <div className="folio-script">विद्या ददाति</div>
                    <div className="folio-rule" />
                    <div className="folio-caption">a sample passage · not a verified edition</div>
                  </div>
                </div>
              </section>

              <div className="section-heading" id="continue-reading">
                <div><h2>Return to your reading</h2><p>Pick up where you left off.</p></div>
                <button className="text-link" type="button" onClick={() => changeSection("Library")}>Browse library <ArrowRight size={14} /></button>
              </div>

              <div className="reading-layout">
                <section className="reading-card" aria-labelledby="chapter-heading">
                  <div className="reading-card-top">
                    <div><div className="small-label">A SAMPLE TEXT · PREVIEW ONLY</div><h2 className="chapter-title" id="chapter-heading">A thought on learning</h2></div>
                    <span className="demo-pill"><span className="eyebrow-dot" /> Not verified</span>
                  </div>
                  <div className="verse-block">
                    <div className="verse-reference"><span className="verse-number">{sampleVerse.reference}</span><span>Sample text · Edition pending</span></div>
                    <p className="verse-sanskrit" lang="sa-Deva">{sampleVerse.devanagari}</p>
                    {showIast && <p className="verse-iast" lang="sa-Latn">{sampleVerse.iast}</p>}
                    <p className="verse-translation" lang={language === "తెలుగు" ? "te" : language === "हिन्दी" ? "hi" : "en"}>
                      {language === "తెలుగు" ? sampleVerse.telugu : language === "हिन्दी" ? sampleVerse.hindi : sampleVerse.english}
                    </p>
                    <div className="verse-actions">
                      <button className="button-quiet" type="button" onClick={() => setShowIast((value) => !value)}><Languages size={14} />{showIast ? "Hide IAST" : "Show IAST"}</button>
                      <button className="button-quiet" type="button" onClick={toggleBookmark}>{saved ? <Check size={14} /> : <Bookmark size={14} />}{saved ? "Saved privately" : "Save"}</button>
                      <button className="button-quiet" type="button" onClick={() => setSection("Community")}><MessageCircle size={14} />Discuss</button>
                      <button className="button-quiet" type="button" onClick={() => setToast(sampleVerse.source)}><MoreHorizontal size={15} />Source</button>
                    </div>
                  </div>
                  <details className="private-note-panel">
                    <summary><Feather size={14} /> Add a private note or highlight</summary>
                    <label className="sr-only" htmlFor="private-note">Private note for this passage</label>
                    <textarea
                      id="private-note"
                      maxLength={2000}
                      placeholder="Write a thought for yourself…"
                      value={noteText}
                      onChange={(event) => setNoteText(event.target.value)}
                      rows={3}
                    />
                    <div className="private-note-actions">
                      <button className="button-secondary" type="button" onClick={highlightSelection}><Highlighter size={14} /> Save selected words</button>
                      <button className="button-primary" type="button" onClick={savePrivateNote}><Bookmark size={14} /> Save private note</button>
                    </div>
                  </details>
                  <p className="demo-notice"><strong>Preview content.</strong> This illustrative line and its rendering are not an approved scripture edition or verified translation.</p>
                  <div className="progress-row"><span>Reading preview</span><span>One illustrative sample passage</span></div>
                </section>

                <aside className="reading-side" aria-label="Reading tools and community">
                  <section className="side-card ai-card">
                    <div className="ai-card-icon"><Sparkles size={17} /></div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}><h3>Need another perspective?</h3><span className="ai-pill">AI · preview</span></div>
                    <p className="side-card-copy">Request a contextual explanation in your chosen language. Provider setup is not complete, so no model call is made.</p>
                    <button className="button-primary" style={{ width: "100%" }} type="button" disabled={aiState === "loading"} onClick={requestTranslation}>
                      {aiState === "loading" ? <LoaderCircle size={15} className="spin" /> : <Sparkles size={15} />}
                      {aiState === "loading" ? "Checking availability…" : "Explain this verse"}
                    </button>
                    {aiMessage && <p className="demo-notice" role="status">{aiMessage}</p>}
                    <div className="side-card-footer" style={{ marginTop: 13 }}><span>AI output is not scholarly review.</span><ShieldCheck size={14} /></div>
                  </section>

                  <section className="community-card">
                    <div className="community-card-head"><h3>A shared reflection</h3><span className="demo-pill">Preview</span></div>
                    <div className="discussion-row"><span className="discussion-avatar" aria-hidden="true">MK</span><div className="discussion-copy"><strong>{demoComment.author}</strong>{demoComment.body}</div></div>
                    <button className="text-link" style={{ marginTop: 15 }} type="button" onClick={() => changeSection("Community")}>Join the conversation <ArrowRight size={14} /></button>
                  </section>
                </aside>
              </div>

              <div className="section-heading"><div><h2>Find your next reading</h2><p>Sample collections while the library is being prepared.</p></div></div>
              <div className="library-grid">
                {sampleLibrary.map((item) => (
                  item.available ? (
                    <button className="library-card" key={item.title} onClick={openReader} type="button">
                      <span className="library-card-mark" aria-hidden="true">{item.mark}</span><span><h3>{item.title}</h3><p>{item.detail}</p></span>
                    </button>
                  ) : (
                    <div className="library-card" key={item.title} aria-disabled="true">
                      <span className="library-card-mark" aria-hidden="true">{item.mark}</span><span><h3>{item.title}</h3><p>{item.detail}</p></span>
                    </div>
                  )
                ))}
              </div>
            </>
          )}
          {section === "Library" && renderLibrary()}
          {section === "Bookmarks" && renderBookmarks()}
          {section === "Community" && renderCommunity()}
          {section === "Profile" && renderProfile()}
        </div>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems.map(({ name, icon: Icon }) => (
          <button className={section === name ? "active" : ""} key={name} onClick={() => changeSection(name)} type="button" aria-current={section === name ? "page" : undefined}>
            <Icon size={19} strokeWidth={1.8} /><span>{name}</span>
          </button>
        ))}
      </nav>
      {toast && <div className="toast" role="status"><Check size={16} />{toast}<button className="button-quiet" aria-label="Dismiss notification" onClick={() => setToast("")} type="button"><X size={14} /></button></div>}
    </main>
  );
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return <div className="empty-state">{icon}<h3>{title}</h3><p>{body}</p></div>;
}
