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
import { type FormEvent, useEffect, useState } from "react";
import { getSectionFromPathname, sectionPaths, type Section } from "@/features/application/section-routes";
import {
  isSampleReaderPath,
  parseReaderPath,
  readerPath,
  sampleReaderPath,
} from "@/features/application/reader-route";
import { subscribeToCommentChanges } from "@/features/community/client/subscribe-to-comment-changes";
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
  cloudBookmarkId?: string;
  path?: string | null;
};
type SavedHighlight = {
  id: string;
  quote: string;
  reference: string;
};
type LibraryText = {
  id: string;
  slug: string;
  title_en: string;
  title_te: string | null;
  title_hi: string | null;
  description_en: string | null;
  source: {
    title: string;
    author_or_translator: string | null;
    edition: string | null;
    publication_year: number | null;
    citation: string;
    source_url: string | null;
  };
  chapters: { chapter_number: number; name_en: string | null }[];
};
type ReaderChapter = {
  text: { id: string; slug: string; title_en: string; title_te: string | null; title_hi: string | null };
  chapter: { id: string; chapter_number: number; name_en: string | null; name_te: string | null; name_hi: string | null };
  navigation: { previous: number | null; next: number | null };
  source: LibraryText["source"];
  verses: {
    id: string;
    verse_number: number;
    devanagari_text: string;
    iast_text: string;
    source: LibraryText["source"];
    translations: { id: string; language: "en" | "te" | "hi"; translation_text: string; mode: "literal" | "fluent"; source_version: string }[];
  }[];
};
type AiTranslationMode = "literal" | "fluent" | "explanation" | "summary";
type GeneratedTranslation = {
  output: string;
  cacheKey: string;
  language: "en" | "te" | "hi";
  mode: AiTranslationMode;
  cached: boolean;
  provider: string;
  model: string;
  cacheWarning: string | null;
  source: { title: string; edition: string | null; chapter: number; verse: number };
  disclaimer: string;
};
type DiscussionContext = {
  textId: string;
  chapterId: string;
  verseId: string;
  textSlug: string;
  textTitle: string;
  chapterNumber: number;
  verseNumber: number;
};
type CommunityComment = {
  id: string;
  user_id: string;
  text_id: string;
  chapter_id: string;
  verse_id: string | null;
  parent_comment_id: string | null;
  body: string;
  language: "en" | "te" | "hi";
  status: "pending" | "approved" | "flagged" | "hidden" | "deleted";
  edited_at: string | null;
  created_at: string;
  author_name: string;
};
type CommunityRelationship = {
  target_user_id: string;
  relationship_type: "block" | "mute";
  created_at: string;
};
type CommunityReport = {
  id: string;
  comment_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
};
type CommunityAppeal = {
  id: string;
  comment_id: string;
  appeal_text: string;
  status: string;
  created_at: string;
};
type ModerationQueue = {
  comments: { id: string; body: string; status: string; user_id: string; created_at: string }[];
  reports: {
    id: string;
    comment_id: string;
    reason: string;
    details: string | null;
    status: string;
    comment: { user_id: string; body: string; status: string } | null;
  }[];
  appeals: { id: string; comment_id: string; user_id: string; appeal_text: string; status: string }[];
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isAiTranslationMode(value: string): value is AiTranslationMode {
  return value === "literal" || value === "fluent" || value === "explanation" || value === "summary";
}

function isSavedVerse(value: unknown): value is SavedVerse {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.reference === "string" &&
    typeof item.note === "string" &&
    (item.cloudBookmarkId === undefined || typeof item.cloudBookmarkId === "string") &&
    (item.path === undefined || item.path === null || typeof item.path === "string");
}

function isSavedHighlight(value: unknown): value is SavedHighlight {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" &&
    typeof item.quote === "string" &&
    typeof item.reference === "string";
}

function isGeneratedTranslation(value: unknown): value is GeneratedTranslation {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  const source = item.source;
  if (!source || typeof source !== "object") return false;
  const sourceRecord = source as Record<string, unknown>;
  return typeof item.output === "string" &&
    item.output.length > 0 &&
    item.output.length <= 12000 &&
    typeof item.cacheKey === "string" &&
    /^[0-9a-f]{64}$/.test(item.cacheKey) &&
    (item.language === "en" || item.language === "te" || item.language === "hi") &&
    typeof item.mode === "string" &&
    isAiTranslationMode(item.mode) &&
    typeof item.cached === "boolean" &&
    typeof item.provider === "string" &&
    typeof item.model === "string" &&
    (typeof item.cacheWarning === "string" || item.cacheWarning === null) &&
    typeof item.disclaimer === "string" &&
    typeof sourceRecord.title === "string" &&
    (typeof sourceRecord.edition === "string" || sourceRecord.edition === null) &&
    typeof sourceRecord.chapter === "number" &&
    typeof sourceRecord.verse === "number";
}

function persistLocalBookmarks(bookmarks: SavedVerse[]) {
  window.localStorage.setItem(
    "akshara-bookmarks",
    JSON.stringify(bookmarks.filter((bookmark) => !bookmark.cloudBookmarkId)),
  );
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
  const readerLocation = parseReaderPath(pathname);
  const isReader = readerLocation !== null;
  const readerSlug = readerLocation?.slug;
  const readerChapterNumber = readerLocation?.chapter;
  const [language, setLanguage] = useState<ReadingLanguage>(defaultReadingPreferences.language);
  const [showIast, setShowIast] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedVerses, setSavedVerses] = useState<SavedVerse[]>([]);
  const [savedHighlights, setSavedHighlights] = useState<SavedHighlight[]>([]);
  const [noteText, setNoteText] = useState("");
  const [catalogNotes, setCatalogNotes] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [aiTranslationMode, setAiTranslationMode] = useState<AiTranslationMode>("fluent");
  const [generatedTranslations, setGeneratedTranslations] = useState<Record<string, GeneratedTranslation>>({});
  const [translationErrors, setTranslationErrors] = useState<Record<string, string>>({});
  const [translationBusyVerseId, setTranslationBusyVerseId] = useState<string | null>(null);
  const [translationFeedback, setTranslationFeedback] = useState<Record<string, "sending" | "sent">>({});
  const [dark, setDark] = useState(defaultReadingPreferences.dark);
  const [email, setEmail] = useState("");
  const [authUser, setAuthUser] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authRole, setAuthRole] = useState("reader");
  const [authConfigured, setAuthConfigured] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [readerResumePath, setReaderResumePath] = useState(sampleReaderPath);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [preferencesSyncReady, setPreferencesSyncReady] = useState(false);
  const [libraryTexts, setLibraryTexts] = useState<LibraryText[]>([]);
  const [libraryStatus, setLibraryStatus] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
  const [readerChapter, setReaderChapter] = useState<ReaderChapter | null>(null);
  const [readerStatus, setReaderStatus] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
  const [discussionContext, setDiscussionContext] = useState<DiscussionContext | null>(null);
  const [communityComments, setCommunityComments] = useState<CommunityComment[]>([]);
  const [communityStatus, setCommunityStatus] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
  const [communityError, setCommunityError] = useState("");
  const [communityDraft, setCommunityDraft] = useState("");
  const [communityBusy, setCommunityBusy] = useState(false);
  const [replyTarget, setReplyTarget] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("harassment");
  const [reportDetails, setReportDetails] = useState("");
  const [relationships, setRelationships] = useState<CommunityRelationship[]>([]);
  const [myReports, setMyReports] = useState<CommunityReport[]>([]);
  const [myAppeals, setMyAppeals] = useState<CommunityAppeal[]>([]);
  const [relationshipTarget, setRelationshipTarget] = useState<{ userId: string; type: "block" | "mute" } | null>(null);
  const [communityEdit, setCommunityEdit] = useState<{ id: string; body: string } | null>(null);
  const [appealDrafts, setAppealDrafts] = useState<Record<string, string>>({});
  const [moderationQueue, setModerationQueue] = useState<ModerationQueue | null>(null);
  const [moderationReason, setModerationReason] = useState("");
  const [moderationMessage, setModerationMessage] = useState("");
  const [realtimeMessage, setRealtimeMessage] = useState("");

  async function loadCommunityComments(context: DiscussionContext, signal?: AbortSignal) {
    const response = await fetch(`/api/community/comments?verseId=${encodeURIComponent(context.verseId)}`, { signal });
    const result = (await response.json()) as {
      error?: string;
      message?: string;
      comments?: CommunityComment[];
    };
    if (!response.ok) throw new Error(result.message ?? "The discussion could not be loaded.");
    if (!Array.isArray(result.comments)) throw new Error("The discussion service returned an invalid response.");
    setCommunityComments(result.comments.filter((item) =>
      item && typeof item.id === "string" && uuidPattern.test(item.id) &&
      typeof item.user_id === "string" && uuidPattern.test(item.user_id) &&
      (item.parent_comment_id === null || uuidPattern.test(item.parent_comment_id)) &&
      typeof item.body === "string",
    ));
    setCommunityStatus("ready");
  }

  function openVerseDiscussion(verse: ReaderChapter["verses"][number]) {
    if (!readerChapter) return;
    const context: DiscussionContext = {
      textId: readerChapter.text.id,
      chapterId: readerChapter.chapter.id,
      verseId: verse.id,
      textSlug: readerChapter.text.slug,
      textTitle: readerChapter.text.title_en,
      chapterNumber: readerChapter.chapter.chapter_number,
      verseNumber: verse.verse_number,
    };
    setDiscussionContext(context);
    setCommunityComments([]);
    setCommunityStatus("loading");
    setCommunityError("");
    const query = new URLSearchParams({
      textId: context.textId,
      chapterId: context.chapterId,
      verseId: context.verseId,
      textSlug: context.textSlug,
      textTitle: context.textTitle,
      chapterNumber: String(context.chapterNumber),
      verseNumber: String(context.verseNumber),
    });
    router.push(`/community?${query.toString()}`);
  }

  async function submitCommunityPost(body: string, parentCommentId: string | null = null) {
    if (!discussionContext || !authUserId) {
      setCommunityError("Sign in before joining this discussion.");
      return;
    }
    setCommunityBusy(true);
    setCommunityError("");
    try {
      const response = await fetch("/api/community/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          textId: discussionContext.textId,
          chapterId: discussionContext.chapterId,
          verseId: discussionContext.verseId,
          parentCommentId,
          body,
          language: language === "తెలుగు" ? "te" : language === "हिन्दी" ? "hi" : "en",
        }),
      });
      const result = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.message ?? "Your comment could not be submitted.");
      setCommunityDraft("");
      setReplyTarget(null);
      setReplyDrafts((current) => {
        const next = { ...current };
        if (parentCommentId) delete next[parentCommentId];
        return next;
      });
      setModerationMessage(result.message ?? "Your contribution was submitted for review.");
      await loadCommunityComments(discussionContext);
    } catch (error) {
      setCommunityError(error instanceof Error ? error.message : "Your comment could not be submitted.");
    } finally {
      setCommunityBusy(false);
    }
  }

  async function submitCommunityReport(commentId: string) {
    setCommunityBusy(true);
    setCommunityError("");
    try {
      const response = await fetch("/api/community/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, reason: reportReason, details: reportDetails.trim() || null }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "The report could not be submitted.");
      setReportTarget(null);
      setReportDetails("");
      setModerationMessage(result.message ?? "The report was submitted.");
      void refreshSafetyActivity().catch((error: unknown) => {
        setCommunityError(error instanceof Error ? error.message : "Your reports could not be refreshed.");
      });
    } catch (error) {
      setCommunityError(error instanceof Error ? error.message : "The report could not be submitted.");
    } finally {
      setCommunityBusy(false);
    }
  }

  async function setCommunityRelationship(userId: string, type: "block" | "mute", remove = false) {
    setCommunityBusy(true);
    setCommunityError("");
    try {
      const response = remove
        ? await fetch(`/api/community/relationships?targetUserId=${encodeURIComponent(userId)}&relationshipType=${type}`, { method: "DELETE" })
        : await fetch("/api/community/relationships", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetUserId: userId, relationshipType: type }),
          });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "Your safety setting could not be saved.");
      setRelationships((current) => remove
        ? current.filter((item) => item.target_user_id !== userId || item.relationship_type !== type)
        : [...current.filter((item) => item.target_user_id !== userId || item.relationship_type !== type), {
            target_user_id: userId,
            relationship_type: type,
            created_at: new Date().toISOString(),
          }]);
      setRelationshipTarget(null);
    } catch (error) {
      setCommunityError(error instanceof Error ? error.message : "Your safety setting could not be saved.");
    } finally {
      setCommunityBusy(false);
    }
  }

  async function editCommunityComment() {
    if (!communityEdit) return;
    setCommunityBusy(true);
    try {
      const response = await fetch("/api/community/comments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId: communityEdit.id, body: communityEdit.body }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "Your comment could not be edited.");
      setCommunityEdit(null);
      if (discussionContext) await loadCommunityComments(discussionContext);
    } catch (error) {
      setCommunityError(error instanceof Error ? error.message : "Your comment could not be edited.");
    } finally {
      setCommunityBusy(false);
    }
  }

  async function deleteCommunityComment(commentId: string) {
    setCommunityBusy(true);
    try {
      const response = await fetch(`/api/community/comments?id=${encodeURIComponent(commentId)}`, { method: "DELETE" });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "Your comment could not be deleted.");
      if (discussionContext) await loadCommunityComments(discussionContext);
      setModerationMessage("Your comment was removed.");
    } catch (error) {
      setCommunityError(error instanceof Error ? error.message : "Your comment could not be deleted.");
    } finally {
      setCommunityBusy(false);
    }
  }

  async function submitCommunityAppeal(commentId: string) {
    const appealText = appealDrafts[commentId]?.trim() ?? "";
    setCommunityBusy(true);
    try {
      const response = await fetch("/api/community/appeals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, appealText }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "The appeal could not be submitted.");
      setAppealDrafts((current) => ({ ...current, [commentId]: "" }));
      setModerationMessage(result.message ?? "The appeal was submitted for review.");
      void refreshSafetyActivity().catch((error: unknown) => {
        setCommunityError(error instanceof Error ? error.message : "Your appeals could not be refreshed.");
      });
    } catch (error) {
      setCommunityError(error instanceof Error ? error.message : "The appeal could not be submitted.");
    } finally {
      setCommunityBusy(false);
    }
  }

  async function refreshSafetyActivity() {
    if (!authUserId) return;
    const [reportsResponse, appealsResponse] = await Promise.all([
      fetch("/api/community/reports"),
      fetch("/api/community/appeals"),
    ]);
    const [reportsResult, appealsResult] = await Promise.all([
      reportsResponse.json() as Promise<{ reports?: CommunityReport[]; message?: string }>,
      appealsResponse.json() as Promise<{ appeals?: CommunityAppeal[]; message?: string }>,
    ]);
    if (!reportsResponse.ok || !appealsResponse.ok) {
      throw new Error(reportsResult.message ?? appealsResult.message ?? "Your safety activity could not be refreshed.");
    }
    setMyReports(reportsResult.reports ?? []);
    setMyAppeals(appealsResult.appeals ?? []);
  }

  async function submitModerationDecision(action: "comment" | "report" | "appeal", id: string, status: string) {
    if (moderationReason.trim().length < 3) {
      setModerationMessage("Enter a brief decision reason before resolving this queue item.");
      return;
    }
    setCommunityBusy(true);
    setModerationMessage("");
    try {
      const response = await fetch("/api/moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id, status, reason: moderationReason.trim() }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "The moderation decision could not be saved.");
      const queueResponse = await fetch("/api/moderation");
      const queue = (await queueResponse.json()) as ModerationQueue & { message?: string };
      if (!queueResponse.ok) throw new Error(queue.message ?? "The moderation queue could not be refreshed.");
      setModerationQueue(queue);
      setModerationMessage("Decision recorded in the moderation audit log.");
    } catch (error) {
      setModerationMessage(error instanceof Error ? error.message : "The moderation decision could not be saved.");
    } finally {
      setCommunityBusy(false);
    }
  }

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
      if (storedProgress && parseReaderPath(storedProgress)) {
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
        return (await response.json()) as {
          configured: boolean;
          user: { id: string; email: string | null; role: string } | null;
        };
      })
      .then((result) => {
        if (!active) return;
        setAuthConfigured(result.configured);
        setAuthUser(result.user?.email ?? null);
        setAuthUserId(result.user?.id ?? null);
        setAuthRole(result.user?.role ?? "reader");
      })
      .catch(() => {
        if (active) setAuthMessage("We could not check your sign-in status.");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (section !== "Community") return;
    const params = new URLSearchParams(window.location.search);
    const textId = params.get("textId");
    const chapterId = params.get("chapterId");
    const verseId = params.get("verseId");
    const textSlug = params.get("textSlug");
    const textTitle = params.get("textTitle");
    const chapterNumber = Number(params.get("chapterNumber"));
    const verseNumber = Number(params.get("verseNumber"));
    if (
      textId && uuidPattern.test(textId) &&
      chapterId && uuidPattern.test(chapterId) &&
      verseId && uuidPattern.test(verseId) &&
      textSlug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(textSlug) &&
      textTitle && textTitle.length <= 200 &&
      Number.isSafeInteger(chapterNumber) && chapterNumber > 0 &&
      Number.isSafeInteger(verseNumber) && verseNumber > 0
    ) {
      setDiscussionContext({
        textId,
        chapterId,
        verseId,
        textSlug,
        textTitle,
        chapterNumber,
        verseNumber,
      });
    } else {
      setDiscussionContext(null);
      setCommunityComments([]);
      setCommunityStatus("idle");
    }
  }, [pathname, section]);

  useEffect(() => {
    if (section !== "Community" || !discussionContext) return;
    const controller = new AbortController();
    setCommunityStatus("loading");
    setCommunityError("");
    void loadCommunityComments(discussionContext, controller.signal).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setCommunityStatus("unavailable");
      setCommunityError(error instanceof Error ? error.message : "The discussion could not be loaded.");
    });

    const refresh = () => {
      void loadCommunityComments(discussionContext).catch((error: unknown) => {
        setRealtimeMessage(error instanceof Error ? error.message : "Live discussion refresh failed.");
      });
    };
    const poll = window.setInterval(refresh, 20_000);
    let unsubscribe: (() => void) | undefined;
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      try {
        unsubscribe = subscribeToCommentChanges(
          { verseId: discussionContext.verseId },
          refresh,
          (error) => setRealtimeMessage(`${error.message} Periodic refresh remains active.`),
        );
        setRealtimeMessage("");
      } catch (error) {
        setRealtimeMessage(`${error instanceof Error ? error.message : "Realtime is unavailable."} Periodic refresh remains active.`);
      }
    } else {
      setRealtimeMessage("Realtime is unavailable until Supabase is configured; discussion refreshes every 20 seconds.");
    }
    return () => {
      controller.abort();
      window.clearInterval(poll);
      unsubscribe?.();
    };
  }, [discussionContext, section]);

  useEffect(() => {
    if (!authUserId) {
      setRelationships([]);
      setMyReports([]);
      setMyAppeals([]);
      return;
    }
    let active = true;
    Promise.all([
      fetch("/api/community/relationships").then(async (response) => {
        const result = (await response.json()) as { relationships?: CommunityRelationship[]; message?: string };
        if (!response.ok) throw new Error(result.message ?? "Your safety settings could not be loaded.");
        return result.relationships ?? [];
      }),
      fetch("/api/community/reports").then(async (response) => {
        const result = (await response.json()) as { reports?: CommunityReport[]; message?: string };
        if (!response.ok) throw new Error(result.message ?? "Your reports could not be loaded.");
        return result.reports ?? [];
      }),
      fetch("/api/community/appeals").then(async (response) => {
        const result = (await response.json()) as { appeals?: CommunityAppeal[]; message?: string };
        if (!response.ok) throw new Error(result.message ?? "Your appeals could not be loaded.");
        return result.appeals ?? [];
      }),
    ])
      .then(([relationshipResult, reportResult, appealResult]) => {
        if (!active) return;
        setRelationships(relationshipResult);
        setMyReports(reportResult);
        setMyAppeals(appealResult);
      })
      .catch((error: unknown) => {
        if (active) setCommunityError(error instanceof Error ? error.message : "Your safety activity could not be loaded.");
      });
    return () => { active = false; };
  }, [authUserId]);

  useEffect(() => {
    if (!authUserId || !["moderator", "admin"].includes(authRole) || section !== "Community") {
      setModerationQueue(null);
      return;
    }
    let active = true;
    fetch("/api/moderation")
      .then(async (response) => {
        const result = (await response.json()) as ModerationQueue & { message?: string };
        if (!response.ok) throw new Error(result.message ?? "The moderation queue could not be loaded.");
        return result;
      })
      .then((result) => {
        if (active) setModerationQueue(result);
      })
      .catch((error: unknown) => {
        if (active) setModerationMessage(error instanceof Error ? error.message : "The moderation queue could not be loaded.");
      });
    return () => { active = false; };
  }, [authRole, authUserId, section]);

  useEffect(() => {
    if (!authUser) {
      setPreferencesSyncReady(false);
      return;
    }

    let active = true;
    setPreferencesSyncReady(false);
    fetch("/api/reading-preferences")
      .then(async (response) => {
        const result = (await response.json()) as {
          error?: string;
          message?: string;
          preferences: { reading_language: "en" | "te" | "hi"; appearance: "light" | "dark" } | null;
        };
        if (!response.ok) throw new Error(result.message ?? "Reading preferences could not be loaded.");
        return result.preferences;
      })
      .then((preferences) => {
        if (!active) return;
        if (preferences) {
          setLanguage(preferences.reading_language === "te" ? "తెలుగు" : preferences.reading_language === "hi" ? "हिन्दी" : "English");
          setDark(preferences.appearance === "dark");
        }
        setPreferencesSyncReady(true);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setToast(error instanceof Error ? error.message : "Cloud preferences could not be loaded.");
      });

    return () => { active = false; };
  }, [authUser]);

  useEffect(() => {
    if (!authUser || !preferencesSyncReady) return;
    fetch("/api/reading-preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        readingLanguage: language === "తెలుగు" ? "te" : language === "हिन्दी" ? "hi" : "en",
        appearance: dark ? "dark" : "light",
      }),
    }).then(async (response) => {
      if (!response.ok) {
        const result = (await response.json()) as { message?: string };
        throw new Error(result.message ?? "Reading preferences could not be synced.");
      }
    }).catch((error: unknown) => {
      setToast(error instanceof Error ? error.message : "Reading preferences could not be synced.");
    });
  }, [authUser, dark, language, preferencesSyncReady]);

  useEffect(() => {
    if (!authUser) {
      setSavedVerses((current) => current.filter((item) => !item.cloudBookmarkId));
      setCatalogNotes({});
      return;
    }
    let active = true;
    fetch("/api/bookmarks")
      .then(async (response) => {
        const result = (await response.json()) as {
          bookmarks?: {
            id: string;
            verse_id: string | null;
            chapter_id: string | null;
            text_id: string | null;
            title: string;
            reference: string;
            note: string | null;
            path: string | null;
          }[];
          message?: string;
        };
        if (!response.ok) throw new Error(result.message ?? "Saved reading could not be synced.");
        return result.bookmarks ?? [];
      })
      .then((bookmarks) => {
        if (!active) return;
        const cloudItems: SavedVerse[] = bookmarks.map((bookmark) => ({
          id: bookmark.verse_id ?? bookmark.chapter_id ?? bookmark.text_id ?? bookmark.id,
          title: bookmark.title,
          reference: bookmark.reference,
          note: bookmark.note ?? "",
          cloudBookmarkId: bookmark.id,
          path: bookmark.path,
        }));
        setSavedVerses((current) => {
          const localOnly = current.filter((item) => !item.cloudBookmarkId);
          const merged = [...cloudItems, ...localOnly.filter((item) => !cloudItems.some((cloud) => cloud.id === item.id))];
          return merged;
        });
        setCatalogNotes(Object.fromEntries(
          cloudItems
            .filter((item) => item.note)
            .map((item) => [item.id, item.note]),
        ));
        setSaved(cloudItems.some((item) => item.id === sampleVerse.id));
      })
      .catch((error: unknown) => {
        if (active) setToast(error instanceof Error ? error.message : "Saved reading could not be synced.");
      });
    return () => { active = false; };
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;
    let active = true;
    fetch("/api/reading-progress")
      .then(async (response) => {
        const result = (await response.json()) as { progress?: { path: string | null }[]; message?: string };
        if (!response.ok) throw new Error(result.message ?? "Reading progress could not be loaded.");
        return result.progress ?? [];
      })
      .then((progress) => {
        if (!active) return;
        const savedPath = progress.find((item) => item.path && parseReaderPath(item.path))?.path;
        if (savedPath) {
          setReaderResumePath(savedPath);
          window.localStorage.setItem("akshara-reading-progress", savedPath);
        }
      })
      .catch((error: unknown) => {
        if (active) setToast(error instanceof Error ? error.message : "Reading progress could not be loaded.");
      });
    return () => { active = false; };
  }, [authUser]);

  useEffect(() => {
    if (section !== "Library") return;
    let active = true;
    const controller = new AbortController();
    setLibraryStatus("loading");
    fetch(`/api/library${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ""}`, { signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json()) as { texts?: LibraryText[]; message?: string };
        if (!response.ok) throw new Error(result.message ?? "The verified library could not be loaded.");
        return result.texts ?? [];
      })
      .then((texts) => {
        if (!active) return;
        setLibraryTexts(texts);
        setLibraryStatus("ready");
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) return;
        setLibraryStatus("unavailable");
      });
    return () => { active = false; controller.abort(); };
  }, [search, section]);

  useEffect(() => {
    if (!readerSlug || !readerChapterNumber || isSampleReaderPath(pathname)) {
      setReaderChapter(null);
      setReaderStatus("idle");
      return;
    }
    let active = true;
    const controller = new AbortController();
    setReaderStatus("loading");
    fetch(`/api/library/${encodeURIComponent(readerSlug)}/${readerChapterNumber}`, { signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json()) as ReaderChapter & { message?: string };
        if (!response.ok) throw new Error(result.message ?? "This reading is unavailable.");
        return result;
      })
      .then((result) => {
        if (!active) return;
        setReaderChapter(result);
        setReaderStatus("ready");
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) return;
        setReaderChapter(null);
        setReaderStatus("unavailable");
      });
    return () => { active = false; controller.abort(); };
  }, [pathname, readerSlug, readerChapterNumber]);

  useEffect(() => {
    if (!authUser || !readerChapter) return;
    fetch("/api/reading-progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        textId: readerChapter.text.id,
        chapterId: readerChapter.chapter.id,
      }),
    }).then(async (response) => {
      if (!response.ok) {
        const result = (await response.json()) as { message?: string };
        throw new Error(result.message ?? "Reading progress could not be synced.");
      }
    }).catch((error: unknown) => {
      setToast(error instanceof Error ? error.message : "Reading progress could not be synced.");
    });
  }, [authUser, readerChapter]);

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
    setSaved(savedVerses.some((item) => item.id === sampleVerse.id));
  }, [savedVerses]);

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

  function setSection(next: Section) {
    if (pathname !== sectionPaths[next]) router.push(sectionPaths[next]);
  }

  function changeSection(next: Section) {
    setSearch("");
    setMobileSearchOpen(false);
    if (next === "Community") {
      setDiscussionContext(null);
      setCommunityComments([]);
      setCommunityStatus("idle");
      setCommunityError("");
      if (pathname === sectionPaths.Community) router.replace(sectionPaths.Community);
    }
    setSection(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openReader() {
    router.push(readerResumePath);
  }

  function openCatalogReader(textSlug: string, chapterNumber: number) {
    router.push(readerPath(textSlug, chapterNumber));
  }

  function openSavedPassage(path: string | null | undefined) {
    if (path?.startsWith("/reader/") && parseReaderPath(path)) {
      router.push(path);
      return;
    }
    if (path?.startsWith("/library?text=")) {
      router.push(path);
      return;
    }
    openReader();
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
      persistLocalBookmarks(nextVerses);
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
      persistLocalBookmarks(nextVerses);
      setSaved(true);
      setSavedVerses(nextVerses);
      setToast("Your note and verse are saved privately on this device.");
    } catch {
      setToast("This browser could not save your note. Please check storage permissions.");
    }
  }

  async function toggleCatalogBookmark(verse: ReaderChapter["verses"][number]) {
    const existing = savedVerses.find((item) => item.id === verse.id);
    try {
      if (existing?.cloudBookmarkId) {
        const response = await fetch(`/api/bookmarks?id=${encodeURIComponent(existing.cloudBookmarkId)}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          const result = (await response.json()) as { message?: string };
          throw new Error(result.message ?? "The synced bookmark could not be removed.");
        }
      } else if (!existing?.cloudBookmarkId && authUser) {
        const note = catalogNotes[verse.id] ?? existing?.note ?? "";
        const response = await fetch("/api/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            verseId: verse.id,
            note: note.trim() || null,
          }),
        });
        const result = (await response.json()) as {
          bookmark?: { id: string };
          message?: string;
        };
        if (!response.ok) throw new Error(result.message ?? "The passage could not be synced.");
        if (!result.bookmark?.id) throw new Error("The saved passage was returned without its account reference.");
        const nextVerses: SavedVerse[] = [
          {
            id: verse.id,
            title: verse.devanagari_text,
            reference: `Chapter ${readerChapter?.chapter.chapter_number ?? ""} · Verse ${verse.verse_number}`,
            note: catalogNotes[verse.id] ?? existing?.note ?? "",
            cloudBookmarkId: result.bookmark?.id,
            path: readerChapter ? readerPath(readerChapter.text.slug, readerChapter.chapter.chapter_number) : null,
          },
          ...savedVerses.filter((item) => item.id !== verse.id),
        ];
        persistLocalBookmarks(nextVerses);
        setSavedVerses(nextVerses);
        setToast("Passage synced to your private account library.");
        return;
      }

      const nextVerses = existing
        ? savedVerses.filter((item) => item.id !== verse.id)
        : [
            {
              id: verse.id,
              title: verse.devanagari_text,
              reference: `Chapter ${readerChapter?.chapter.chapter_number ?? ""} · Verse ${verse.verse_number}`,
              note: catalogNotes[verse.id] ?? "",
              path: readerChapter ? readerPath(readerChapter.text.slug, readerChapter.chapter.chapter_number) : null,
            },
            ...savedVerses,
          ];
      persistLocalBookmarks(nextVerses);
      setSavedVerses(nextVerses);
      setToast(existing ? "Removed from your saved reading." : "Saved privately on this device.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "The bookmark could not be saved.");
    }
  }

  async function saveCatalogNote(verse: ReaderChapter["verses"][number], noteTextValue: string) {
    const existing = savedVerses.find((item) => item.id === verse.id);
    const note = noteTextValue.trim();
    try {
      let cloudBookmarkId = existing?.cloudBookmarkId;
      if (authUser && cloudBookmarkId) {
        const response = await fetch("/api/bookmarks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookmarkId: cloudBookmarkId, note: note || null }),
        });
        if (!response.ok) {
          const result = (await response.json()) as { message?: string };
          throw new Error(result.message ?? "Your private note could not be synced.");
        }
      } else if (authUser && !cloudBookmarkId) {
        const response = await fetch("/api/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ verseId: verse.id, note: note || null }),
        });
        const result = (await response.json()) as { bookmark?: { id: string }; message?: string };
        if (!response.ok) throw new Error(result.message ?? "Your private note could not be synced.");
        if (!result.bookmark?.id) throw new Error("The private note was returned without its account reference.");
        cloudBookmarkId = result.bookmark?.id;
      }

      const nextVerses: SavedVerse[] = [
        {
          id: verse.id,
          title: verse.devanagari_text,
          reference: `Chapter ${readerChapter?.chapter.chapter_number ?? ""} · Verse ${verse.verse_number}`,
          note,
          ...(cloudBookmarkId ? { cloudBookmarkId } : {}),
          path: readerChapter ? readerPath(readerChapter.text.slug, readerChapter.chapter.chapter_number) : null,
        },
        ...savedVerses.filter((item) => item.id !== verse.id),
      ];
      persistLocalBookmarks(nextVerses);
      setSavedVerses(nextVerses);
      setCatalogNotes((current) => ({ ...current, [verse.id]: note }));
      setToast(authUser ? "Your private note is synced to your account." : "Your note is saved on this device.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Your private note could not be saved.");
    }
  }

  async function removeSavedVerse(item: SavedVerse) {
    try {
      if (item.cloudBookmarkId) {
        const response = await fetch(`/api/bookmarks?id=${encodeURIComponent(item.cloudBookmarkId)}`, { method: "DELETE" });
        if (!response.ok) {
          const result = (await response.json()) as { message?: string };
          throw new Error(result.message ?? "The saved passage could not be removed.");
        }
      }
      const nextVerses = savedVerses.filter((savedItem) => savedItem.id !== item.id);
      persistLocalBookmarks(nextVerses);
      setSavedVerses(nextVerses);
      setCatalogNotes((current) => {
        const updated = { ...current };
        delete updated[item.id];
        return updated;
      });
      if (item.id === sampleVerse.id) setSaved(false);
      setToast(item.cloudBookmarkId ? "Removed from your account library." : "Removed from this device.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "The saved passage could not be removed.");
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

  async function requestVerseTranslation(verse: ReaderChapter["verses"][number]) {
    if (!readerChapter) return;
    setTranslationBusyVerseId(verse.id);
    setTranslationErrors((current) => {
      const next = { ...current };
      delete next[verse.id];
      return next;
    });
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          textId: readerChapter.text.slug,
          verseId: verse.id,
          targetLanguage: language === "తెలుగు" ? "te" : language === "हिन्दी" ? "hi" : "en",
          mode: aiTranslationMode,
        }),
      });
      let result: { error?: string; message?: string; translation?: unknown };
      try {
        result = (await response.json()) as { error?: string; message?: string; translation?: unknown };
      } catch {
        throw new Error("The translation service returned an unreadable response.");
      }
      if (!response.ok) throw new Error(result.message ?? "The translation could not be generated.");
      const translation = result.translation;
      if (!isGeneratedTranslation(translation)) {
        throw new Error("The translation service returned an incomplete result.");
      }
      setGeneratedTranslations((current) => ({ ...current, [verse.id]: translation }));
    } catch (error) {
      setTranslationErrors((current) => ({
        ...current,
        [verse.id]: error instanceof Error ? error.message : "The translation could not be generated.",
      }));
    } finally {
      setTranslationBusyVerseId(null);
    }
  }

  async function submitTranslationFeedback(translation: GeneratedTranslation, rating: "helpful" | "issue") {
    setTranslationFeedback((current) => ({ ...current, [translation.cacheKey]: "sending" }));
    try {
      const response = await fetch("/api/translate/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cacheKey: translation.cacheKey,
          rating,
          ...(rating === "issue" ? { issueType: "inaccurate" } : {}),
        }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "Translation feedback could not be saved.");
      setTranslationFeedback((current) => ({ ...current, [translation.cacheKey]: "sent" }));
    } catch (error) {
      setTranslationFeedback((current) => {
        const next = { ...current };
        delete next[translation.cacheKey];
        return next;
      });
      setToast(error instanceof Error ? error.message : "Translation feedback could not be saved.");
    }
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
      setAuthUserId(null);
      setAuthRole("reader");
      setDiscussionContext(null);
      setCommunityComments([]);
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
        {libraryStatus === "loading" ? (
          <p className="demo-notice" role="status">Loading rights-cleared library records…</p>
        ) : libraryStatus === "unavailable" ? (
          <p className="demo-notice" role="alert">The verified library is unavailable. Check the Supabase connection and try again.</p>
        ) : libraryTexts.length ? (
          <div className="library-grid">
            {libraryTexts.map((text) => (
              <article className="library-card" key={text.id}>
                <span className="library-card-mark" aria-hidden="true">{text.title_en.slice(0, 2)}</span>
                <span>
                  <h3>{language === "తెలుగు" ? text.title_te ?? text.title_en : language === "हिन्दी" ? text.title_hi ?? text.title_en : text.title_en}</h3>
                  <p>{text.description_en ?? text.source.citation}</p>
                  <p>{text.source.title}{text.source.edition ? ` · ${text.source.edition}` : ""}</p>
                  <div className="verse-actions">
                    {text.chapters.map((chapter) => (
                      <button
                        className="button-quiet"
                        key={`${text.id}-${chapter.chapter_number}`}
                        type="button"
                        onClick={() => openCatalogReader(text.slug, chapter.chapter_number)}
                      >
                        {chapter.name_en ?? `Chapter ${chapter.chapter_number}`} <ArrowRight size={13} />
                      </button>
                    ))}
                  </div>
                </span>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<TextSearch size={24} />}
            title={search.trim() ? "No matching verified texts" : "The verified library is not populated yet"}
            body={search.trim() ? "Try another title or clear your search." : "Add a rights-cleared edition and its catalog records before a text can appear here."}
          />
        )}
      </>
    );
  }

  function renderBookmarks() {
    return (
      <>
        <div className="eyebrow"><span className="eyebrow-dot" /> YOUR PRIVATE LIBRARY</div>
        <h1 className="view-title">Saved for another moment.</h1>
        <p className="view-intro">{authUser ? "Your account bookmarks sync across devices. Private highlights remain on this browser." : "Your bookmarks and notes are stored only in this browser until you sign in."}</p>
        {savedVerses.length || savedHighlights.length ? (
          <div className="reading-card">
            {savedVerses.map((item) => (
              <div className="list-row" key={item.id}>
                <div className="list-row-main">
                  <p className="list-row-title">{item.title}</p>
                  <p className="list-row-meta">{item.reference} · {item.note || "Private bookmark, no note"}</p>
                </div>
                <div className="verse-actions">
                  <button className="button-quiet" type="button" onClick={() => openSavedPassage(item.path)}>Read <ArrowRight size={14} /></button>
                  <button className="button-quiet" type="button" onClick={() => void removeSavedVerse(item)}>Remove</button>
                </div>
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
    function renderThread(commentItem: CommunityComment, depth = 0): React.ReactNode {
      const replies = communityComments.filter((item) => item.parent_comment_id === commentItem.id);
      const isOwnComment = commentItem.user_id === authUserId;
      const isDeleted = commentItem.status === "deleted";
      return (
        <article className="community-comment" key={commentItem.id} style={{ marginLeft: Math.min(depth, 3) * 16 }}>
          <div className="discussion-row">
            <span className="discussion-avatar" aria-hidden="true">{commentItem.author_name.slice(0, 2).toUpperCase()}</span>
            <div className="discussion-copy">
              <strong>{commentItem.author_name} · {commentItem.language.toUpperCase()}</strong>
              <span className="list-row-meta">
                {new Date(commentItem.created_at).toLocaleDateString()} · {commentItem.status === "pending" ? "Pending review" : commentItem.status}
                {commentItem.edited_at ? " · edited" : ""}
              </span>
              {communityEdit?.id === commentItem.id ? (
                <div className="community-form">
                  <label className="sr-only" htmlFor={`edit-comment-${commentItem.id}`}>Edit your comment</label>
                  <textarea
                    id={`edit-comment-${commentItem.id}`}
                    value={communityEdit.body}
                    maxLength={6000}
                    onChange={(event) => setCommunityEdit({ ...communityEdit, body: event.target.value })}
                    rows={3}
                  />
                  <button className="button-primary" type="button" disabled={communityBusy} onClick={() => void editCommunityComment()}>Save edit</button>
                  <button className="button-quiet" type="button" onClick={() => setCommunityEdit(null)}>Cancel</button>
                </div>
              ) : (
                <p>{isDeleted ? "This comment was removed." : commentItem.body}</p>
              )}
            </div>
          </div>
          {!isDeleted && (
            <div className="community-comment-actions">
              {authUserId && commentItem.status === "approved" && (
                <button className="button-quiet" type="button" onClick={() => setReplyTarget(replyTarget === commentItem.id ? null : commentItem.id)}>Reply</button>
              )}
              {authUserId && isOwnComment && ["pending", "approved"].includes(commentItem.status) && (
                <>
                  <button className="button-quiet" type="button" onClick={() => setCommunityEdit({ id: commentItem.id, body: commentItem.body })}>Edit</button>
                  <button className="button-quiet" type="button" disabled={communityBusy} onClick={() => void deleteCommunityComment(commentItem.id)}>Remove</button>
                </>
              )}
              {authUserId && isOwnComment && ["flagged", "hidden"].includes(commentItem.status) && (
                <button className="button-quiet" type="button" onClick={() => setAppealDrafts((current) => ({ ...current, [commentItem.id]: current[commentItem.id] ?? "" }))}>Appeal decision</button>
              )}
              {authUserId && !isOwnComment && commentItem.status === "approved" && (
                <details className="community-action-details">
                  <summary>Safety options</summary>
                  <div className="community-form">
                    <button className="button-quiet" type="button" onClick={() => setReportTarget(reportTarget === commentItem.id ? null : commentItem.id)}>Report comment</button>
                    {(["mute", "block"] as const).map((type) => {
                      const active = relationships.some((item) => item.target_user_id === commentItem.user_id && item.relationship_type === type);
                      return (
                        <button
                          className="button-quiet"
                          key={type}
                          type="button"
                          disabled={communityBusy}
                          onClick={() => {
                            if (active) void setCommunityRelationship(commentItem.user_id, type, true);
                            else setRelationshipTarget({ userId: commentItem.user_id, type });
                          }}
                        >
                          {active ? `Un${type}` : type === "mute" ? "Mute reader" : "Block reader"}
                        </button>
                      );
                    })}
                  </div>
                </details>
              )}
              {relationshipTarget?.userId === commentItem.user_id && (
                <div className="community-form" role="group" aria-label="Confirm safety setting">
                  <span>Confirm {relationshipTarget.type} for this reader?</span>
                  <button
                    className="button-secondary"
                    type="button"
                    disabled={communityBusy}
                    onClick={() => void setCommunityRelationship(commentItem.user_id, relationshipTarget.type)}
                  >
                    Confirm {relationshipTarget.type}
                  </button>
                  <button className="button-quiet" type="button" onClick={() => setRelationshipTarget(null)}>Cancel</button>
                </div>
              )}
              {reportTarget === commentItem.id && (
                <div className="community-form">
                  <label htmlFor={`report-reason-${commentItem.id}`}>Report reason</label>
                  <select id={`report-reason-${commentItem.id}`} value={reportReason} onChange={(event) => setReportReason(event.target.value)}>
                    <option value="harassment">Harassment</option>
                    <option value="spam">Spam</option>
                    <option value="misinformation">Misleading or harmful claims</option>
                    <option value="copyright">Copyright concern</option>
                    <option value="other">Other</option>
                  </select>
                  <label htmlFor={`report-details-${commentItem.id}`}>Details (optional)</label>
                  <textarea id={`report-details-${commentItem.id}`} maxLength={2000} value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} rows={2} />
                  <button className="button-secondary" type="button" disabled={communityBusy} onClick={() => void submitCommunityReport(commentItem.id)}>Send report</button>
                  <button className="button-quiet" type="button" onClick={() => setReportTarget(null)}>Cancel</button>
                </div>
              )}
              {appealDrafts[commentItem.id] !== undefined && isOwnComment && ["flagged", "hidden"].includes(commentItem.status) && (
                <div className="community-form">
                  <label htmlFor={`appeal-${commentItem.id}`}>Appeal this decision</label>
                  <textarea
                    id={`appeal-${commentItem.id}`}
                    maxLength={2000}
                    value={appealDrafts[commentItem.id]}
                    onChange={(event) => setAppealDrafts((current) => ({ ...current, [commentItem.id]: event.target.value }))}
                    rows={3}
                  />
                  <button className="button-secondary" type="button" disabled={communityBusy} onClick={() => void submitCommunityAppeal(commentItem.id)}>Submit appeal</button>
                </div>
              )}
            </div>
          )}
          {replyTarget === commentItem.id && (
            <form className="community-form" onSubmit={(event) => {
              event.preventDefault();
              void submitCommunityPost(replyDrafts[commentItem.id] ?? "", commentItem.id);
            }}>
              <label htmlFor={`reply-${commentItem.id}`}>Reply to {commentItem.author_name}</label>
              <textarea
                id={`reply-${commentItem.id}`}
                maxLength={6000}
                required
                minLength={3}
                value={replyDrafts[commentItem.id] ?? ""}
                onChange={(event) => setReplyDrafts((current) => ({ ...current, [commentItem.id]: event.target.value }))}
                rows={3}
              />
              <button className="button-secondary" type="submit" disabled={communityBusy}>Send reply for review</button>
            </form>
          )}
          {depth < 4 && replies.map((reply) => renderThread(reply, depth + 1))}
        </article>
      );
    }

    const visibleRoots = communityComments.filter((item) =>
      !item.parent_comment_id || !communityComments.some((candidate) => candidate.id === item.parent_comment_id),
    );
    return (
      <>
        <div className="eyebrow"><span className="eyebrow-dot" /> THOUGHTFUL CONVERSATION</div>
        <h1 className="view-title">Meaning grows in good company.</h1>
        <p className="view-intro">
          Passage discussions are moderated before publication. Be thoughtful, protect private information, and report concerns.
        </p>
        <div className="reading-card">
          <div className="reading-card-top">
            <div>
              <div className="small-label">PASSAGE DISCUSSION</div>
              <h2 className="chapter-title">{discussionContext ? discussionContext.textTitle : "Choose a passage from the verified reader"}</h2>
            </div>
            <span className="demo-pill">{discussionContext ? `Chapter ${discussionContext.chapterNumber} · Verse ${discussionContext.verseNumber}` : "No passage selected"}</span>
          </div>
          {discussionContext ? (
            <>
              <p className="list-row-meta">
                {discussionContext.textSlug} · Chapter {discussionContext.chapterNumber} · Verse {discussionContext.verseNumber}
              </p>
              {realtimeMessage && <p className="list-row-meta" role="status">{realtimeMessage}</p>}
              {communityError && <p className="demo-notice" role="alert">{communityError}</p>}
              {moderationMessage && <p className="demo-notice" role="status">{moderationMessage}</p>}
              {communityStatus === "loading" && <p className="list-row-meta" role="status">Loading this passage discussion…</p>}
              {communityStatus === "unavailable" && (
                <div className="demo-notice" role="alert">
                  Discussion is unavailable. Check the database connection, then retry.
                  <button className="button-quiet" type="button" onClick={() => {
                    setCommunityStatus("loading");
                    void loadCommunityComments(discussionContext).catch((error: unknown) => {
                      setCommunityStatus("unavailable");
                      setCommunityError(error instanceof Error ? error.message : "Discussion refresh failed.");
                    });
                  }}>Retry</button>
                </div>
              )}
              {communityStatus === "ready" && visibleRoots.length === 0 && (
                <EmptyState icon={<MessageCircle size={24} />} title="Start a thoughtful discussion" body="No published comments yet. New comments enter a moderation queue before appearing publicly." />
              )}
              {visibleRoots.map((item) => renderThread(item))}
              {authUserId ? (
                <form className="community-form" onSubmit={(event) => {
                  event.preventDefault();
                  void submitCommunityPost(communityDraft);
                }}>
                  <label htmlFor="community-comment">Add a thought · reviewed before publication</label>
                  <textarea
                    id="community-comment"
                    value={communityDraft}
                    onChange={(event) => setCommunityDraft(event.target.value)}
                    maxLength={6000}
                    minLength={3}
                    required
                    placeholder="Ask a question or share a reflection…"
                    rows={3}
                  />
                  <button className="button-primary" type="submit" disabled={communityBusy}><Send size={14} /> Submit for review</button>
                </form>
              ) : (
                <p className="demo-notice">Sign in to comment, reply, report, block, or mute. <button className="button-quiet" type="button" onClick={() => changeSection("Profile")}>Open profile</button></p>
              )}
            </>
          ) : (
            <div className="empty-state">
              <MessageCircle size={24} />
              <h3>Open a verified passage to join its discussion</h3>
              <p>Discussions are never attached to the illustrative sample passage.</p>
              <button className="button-secondary" type="button" onClick={() => changeSection("Library")}>Browse the verified library</button>
            </div>
          )}
        </div>
        {authUserId && relationships.length > 0 && (
          <section className="reading-card">
            <h2 className="chapter-title">Your safety settings</h2>
            {relationships.map((item) => (
              <div className="list-row" key={`${item.target_user_id}:${item.relationship_type}`}>
                <span>{item.relationship_type === "block" ? "Blocked reader" : "Muted reader"} · {item.target_user_id.slice(0, 8)}</span>
                <button className="button-quiet" type="button" disabled={communityBusy} onClick={() => void setCommunityRelationship(item.target_user_id, item.relationship_type, true)}>
                  Remove {item.relationship_type}
                </button>
              </div>
            ))}
          </section>
        )}
        {authUserId && (myReports.length > 0 || myAppeals.length > 0) && (
          <section className="reading-card">
            <h2 className="chapter-title">Your safety activity</h2>
            {myReports.map((item) => (
              <div className="list-row" key={item.id}>
                <span>Report · {item.reason}{item.details ? ` · ${item.details}` : ""}</span>
                <span className="demo-pill">{item.status}</span>
              </div>
            ))}
            {myAppeals.map((item) => (
              <div className="list-row" key={item.id}>
                <span>Appeal · {item.appeal_text}</span>
                <span className="demo-pill">{item.status}</span>
              </div>
            ))}
          </section>
        )}
        {authUserId && ["moderator", "admin"].includes(authRole) && (
          <section className="reading-card moderator-queue">
            <div className="reading-card-top">
              <div><div className="small-label">TRUST & SAFETY</div><h2 className="chapter-title">Moderator queue</h2></div>
              <span className="reviewed-pill"><ShieldCheck size={12} /> {authRole}</span>
            </div>
            {moderationMessage && <p className="demo-notice" role="status">{moderationMessage}</p>}
            <label className="community-form-label" htmlFor="moderation-reason">Decision reason (required for audit)</label>
            <textarea id="moderation-reason" value={moderationReason} onChange={(event) => setModerationReason(event.target.value)} minLength={3} maxLength={2000} rows={2} />
            {!moderationQueue ? (
              <p className="list-row-meta" role="status">Loading the moderator queue…</p>
            ) : (
              <>
                <h3>Comments ({moderationQueue.comments.length})</h3>
                {moderationQueue.comments.map((item) => (
                  <div className="moderation-item" key={item.id}>
                    <p>{item.body}</p><span className="list-row-meta">{item.status} · {item.user_id.slice(0, 8)}</span>
                    <div className="verse-actions">
                      {item.status === "pending" && <button className="button-quiet" type="button" disabled={communityBusy} onClick={() => void submitModerationDecision("comment", item.id, "approved")}>Approve</button>}
                      <button className="button-quiet" type="button" disabled={communityBusy} onClick={() => void submitModerationDecision("comment", item.id, "flagged")}>Flag</button>
                      <button className="button-quiet" type="button" disabled={communityBusy} onClick={() => void submitModerationDecision("comment", item.id, "hidden")}>Hide</button>
                    </div>
                  </div>
                ))}
                <h3>Reports ({moderationQueue.reports.length})</h3>
                {moderationQueue.reports.map((item) => (
                  <div className="moderation-item" key={item.id}>
                    <p><strong>{item.reason}</strong>{item.details ? ` · ${item.details}` : ""}</p>
                    <p>{item.comment?.body ?? "The reported comment is no longer available."}</p>
                    {item.comment && <span className="list-row-meta">Comment status: {item.comment.status} · author {item.comment.user_id.slice(0, 8)}</span>}
                    {item.comment && item.comment.status === "approved" && (
                      <button className="button-quiet" type="button" disabled={communityBusy} onClick={() => void submitModerationDecision("comment", item.comment_id, "hidden")}>Hide reported comment</button>
                    )}
                    <button className="button-quiet" type="button" disabled={communityBusy} onClick={() => void submitModerationDecision("report", item.id, "resolved")}>Resolve</button>
                    <button className="button-quiet" type="button" disabled={communityBusy} onClick={() => void submitModerationDecision("report", item.id, "dismissed")}>Dismiss</button>
                  </div>
                ))}
                <h3>Appeals ({moderationQueue.appeals.length})</h3>
                {moderationQueue.appeals.map((item) => (
                  <div className="moderation-item" key={item.id}>
                    <p>{item.appeal_text}</p>
                    <button className="button-quiet" type="button" disabled={communityBusy} onClick={() => void submitModerationDecision("appeal", item.id, "overturned")}>Overturn</button>
                    <button className="button-quiet" type="button" disabled={communityBusy} onClick={() => void submitModerationDecision("appeal", item.id, "upheld")}>Uphold</button>
                  </div>
                ))}
                {!moderationQueue.comments.length && !moderationQueue.reports.length && !moderationQueue.appeals.length && (
                  <p className="list-row-meta">The moderation queue is clear.</p>
                )}
              </>
            )}
          </section>
        )}
      </>
    );
  }

  function renderProfile() {
    return (
      <>
        <div className="eyebrow"><span className="eyebrow-dot" /> YOUR SPACE</div>
        <h1 className="view-title">A reading practice, your own.</h1>
        <p className="view-intro">Sign in to sync bookmarks, notes, reading progress, and display preferences when the verified database is connected.</p>
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
            <div className="list-row-main"><p className="list-row-title">Privacy</p><p className="list-row-meta">{authUser ? "Account saves sync when the database is available; selected-text highlights stay on this browser." : "Bookmarks, notes, and highlights stay on this browser until you sign in to a configured database."}</p></div>
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
              {readerChapter ? (
                <>
                  <div className="eyebrow"><span className="eyebrow-dot" /> RIGHTS-CLEARED READING</div>
                  <h1 className="view-title">{readerChapter.text.title_en}</h1>
                  <p className="view-intro">
                    {readerChapter.source.title}{readerChapter.source.edition ? ` · ${readerChapter.source.edition}` : ""} · {readerChapter.chapter.name_en ?? `Chapter ${readerChapter.chapter.chapter_number}`}
                  </p>
                  <div className="reader-toolbar" aria-label="Reader controls">
                    <button
                      className="button-secondary"
                      type="button"
                      disabled={readerChapter.navigation.previous === null}
                      onClick={() => readerChapter.navigation.previous && openCatalogReader(readerChapter.text.slug, readerChapter.navigation.previous)}
                    >
                      <ArrowRight size={14} style={{ transform: "rotate(180deg)" }} /> Previous
                    </button>
                    <span className="demo-pill">{readerChapter.chapter.name_en ?? `Chapter ${readerChapter.chapter.chapter_number}`}</span>
                    <button
                      className="button-secondary"
                      type="button"
                      disabled={readerChapter.navigation.next === null}
                      onClick={() => readerChapter.navigation.next && openCatalogReader(readerChapter.text.slug, readerChapter.navigation.next)}
                    >
                      Next <ArrowRight size={14} />
                    </button>
                    <span className="demo-pill">{readerChapter.verses.length} published verses</span>
                  </div>
                  <label className="reader-toolbar-label" htmlFor="ai-translation-mode">AI assistance mode</label>
                  <select
                    id="ai-translation-mode"
                    className="reader-mode-select"
                    value={aiTranslationMode}
                    onChange={(event) => {
                      if (isAiTranslationMode(event.target.value)) setAiTranslationMode(event.target.value);
                    }}
                  >
                    <option value="literal">Literal translation</option>
                    <option value="fluent">Fluent translation</option>
                    <option value="explanation">Explanation</option>
                    <option value="summary">Summary</option>
                  </select>
                  <p className="list-row-meta">
                    Generated on request for {language}. The published verse, source title, and location are sent to the configured provider; private notes and profile data are not.
                  </p>
                  <section className="reading-card" aria-labelledby="reader-chapter-heading">
                    <div className="reading-card-top">
                      <div>
                        <div className="small-label">SOURCE AND EDITION</div>
                        <h2 className="chapter-title" id="reader-chapter-heading">{readerChapter.chapter.name_en ?? `Chapter ${readerChapter.chapter.chapter_number}`}</h2>
                      </div>
                      <span className="reviewed-pill"><ShieldCheck size={12} /> Verified record</span>
                    </div>
                    {readerChapter.verses.map((verse) => {
                      const verseIsSaved = savedVerses.some((item) => item.id === verse.id);
                      const translation = verse.translations.find((item) =>
                        item.language === (language === "తెలుగు" ? "te" : language === "हिन्दी" ? "hi" : "en"),
                      );
                      return (
                        <div className="verse-block" key={verse.id}>
                          <div className="verse-reference">
                            <span className="verse-number">Verse {verse.verse_number}</span>
                            <span>{verse.source.title}{verse.source.edition ? ` · ${verse.source.edition}` : ""}</span>
                          </div>
                          <p className="verse-sanskrit" lang="sa-Deva" data-reader-selection>{verse.devanagari_text}</p>
                          {showIast && <p className="verse-iast" lang="sa-Latn">{verse.iast_text}</p>}
                          {translation ? (
                            <>
                              <p className="verse-translation" data-reader-selection lang={translation.language}>{translation.translation_text}</p>
                              <p className="list-row-meta">Human-reviewed {translation.mode} translation · Source version {translation.source_version}</p>
                            </>
                          ) : (
                            <p className="demo-notice">No human-reviewed translation is available in {language} for this verse.</p>
                          )}
                          <div className="verse-actions">
                            <button
                              className="button-secondary"
                              type="button"
                              disabled={translationBusyVerseId !== null}
                              onClick={() => void requestVerseTranslation(verse)}
                            >
                              <Sparkles size={14} className={translationBusyVerseId === verse.id ? "spin" : undefined} />
                              {translationBusyVerseId === verse.id ? "Generating…" : `Generate AI ${aiTranslationMode}`}
                            </button>
                          </div>
                          {translationErrors[verse.id] && <p className="demo-notice" role="alert">{translationErrors[verse.id]}</p>}
                          {generatedTranslations[verse.id] && (
                            <div className="ai-generated-translation" aria-live="polite">
                              <div className="verse-reference">
                                <span className="verse-number">
                                  AI-generated {generatedTranslations[verse.id].language === "te"
                                    ? "Telugu"
                                    : generatedTranslations[verse.id].language === "hi" ? "Hindi" : "English"} · {generatedTranslations[verse.id].mode}
                                </span>
                                <span>{generatedTranslations[verse.id].cached ? "Cached result" : "Generated just now"}</span>
                              </div>
                              <p
                                className="verse-translation"
                                data-reader-selection
                                lang={generatedTranslations[verse.id].language}
                              >
                                {generatedTranslations[verse.id].output}
                              </p>
                              <p className="list-row-meta">
                                {generatedTranslations[verse.id].disclaimer} Provider: {generatedTranslations[verse.id].provider} · Model: {generatedTranslations[verse.id].model}. Source: {generatedTranslations[verse.id].source.title}
                                {generatedTranslations[verse.id].source.edition ? ` · ${generatedTranslations[verse.id].source.edition}` : ""}.
                              </p>
                              {generatedTranslations[verse.id].cacheWarning && (
                                <p className="demo-notice" role="status">{generatedTranslations[verse.id].cacheWarning}</p>
                              )}
                              <div className="verse-actions">
                                {translationFeedback[generatedTranslations[verse.id].cacheKey] === "sent" ? (
                                  <span className="list-row-meta" role="status">Thanks for your feedback.</span>
                                ) : (
                                  <>
                                    <button
                                      className="button-quiet"
                                      type="button"
                                      disabled={translationFeedback[generatedTranslations[verse.id].cacheKey] === "sending"}
                                      onClick={() => void submitTranslationFeedback(generatedTranslations[verse.id], "helpful")}
                                    >
                                      Helpful
                                    </button>
                                    <button
                                      className="button-quiet"
                                      type="button"
                                      disabled={translationFeedback[generatedTranslations[verse.id].cacheKey] === "sending"}
                                      onClick={() => void submitTranslationFeedback(generatedTranslations[verse.id], "issue")}
                                    >
                                      Report inaccurate
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                          <div className="verse-actions">
                            <button className="button-quiet" type="button" onClick={() => setShowIast((value) => !value)}>
                              <Languages size={14} />{showIast ? "Hide IAST" : "Show IAST"}
                            </button>
                            <button className="button-quiet" type="button" onClick={() => void toggleCatalogBookmark(verse)}>
                              {verseIsSaved ? <Check size={14} /> : <Bookmark size={14} />}{verseIsSaved ? "Saved" : "Save"}
                            </button>
                            <button className="button-quiet" type="button" onClick={() => openVerseDiscussion(verse)}>
                              <MessageCircle size={14} />Discuss
                            </button>
                          </div>
                          <details className="private-note-panel">
                            <summary><Feather size={14} /> Private note for verse {verse.verse_number}</summary>
                            <label className="sr-only" htmlFor={`catalog-note-${verse.id}`}>Private note for verse {verse.verse_number}</label>
                            <textarea
                              id={`catalog-note-${verse.id}`}
                              maxLength={4000}
                              placeholder="Write a thought for yourself…"
                              value={catalogNotes[verse.id] ?? savedVerses.find((item) => item.id === verse.id)?.note ?? ""}
                              onChange={(event) => setCatalogNotes((current) => ({ ...current, [verse.id]: event.target.value }))}
                              rows={3}
                            />
                            <button
                              className="button-primary"
                              type="button"
                              onClick={() => void saveCatalogNote(
                                verse,
                                catalogNotes[verse.id] ?? savedVerses.find((item) => item.id === verse.id)?.note ?? "",
                              )}
                            >
                              <Bookmark size={14} /> Save private note
                            </button>
                          </details>
                        </div>
                      );
                    })}
                    <p className="demo-notice" role="note">
                      <strong>Source provenance.</strong> {readerChapter.source.citation}
                      {readerChapter.source.source_url && <> · <a href={readerChapter.source.source_url} target="_blank" rel="noreferrer">View source edition</a></>}
                    </p>
                    <div className="progress-row">
                      <span>{authUser ? "Reading progress syncs to your account" : "Reading position saved on this device"}</span>
                      <span>Chapter {readerChapter.chapter.chapter_number}</span>
                    </div>
                  </section>
                </>
              ) : readerStatus === "loading" || (readerStatus === "idle" && !isSampleReaderPath(pathname)) ? (
                <p className="demo-notice" role="status">Loading the verified chapter and source attribution…</p>
              ) : readerStatus === "unavailable" || !isSampleReaderPath(pathname) ? (
                <div className="reading-card">
                  <h1 className="view-title">This verified reading is unavailable.</h1>
                  <p className="view-intro">Check that the text is active, its edition is approved for redistribution, and the database is connected.</p>
                  <button className="button-secondary" type="button" onClick={() => changeSection("Library")}>Return to library</button>
                </div>
              ) : (
                <>
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
                </>
              )}
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
                    <p className="side-card-copy">AI translation is available only for published, rights-cleared library passages. This illustrative preview is never sent to a model.</p>
                    <button className="button-primary" style={{ width: "100%" }} type="button" disabled>
                      <Sparkles size={15} /> Open a verified passage to translate
                    </button>
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
