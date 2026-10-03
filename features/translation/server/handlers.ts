import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import {
  TranslationProviderError,
  getTranslationProviderMetadata,
  translateWithProvider,
  type TranslationLanguage,
  type TranslationMode,
} from "@/features/translation/server/provider";

const supportedLanguages = new Set<TranslationLanguage>(["en", "te", "hi"]);
const supportedModes = new Set<TranslationMode>(["literal", "fluent", "explanation", "summary"]);
const validTextId = /^[a-z0-9][a-z0-9-]{0,79}$/;
const validVerseId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clearedLicenseStatuses = ["public_domain", "permission_granted", "commissioned"];
const cacheDurationMs = 30 * 24 * 60 * 60 * 1000;

function errorResponse(error: string, message: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ error, message }, { status, headers });
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 4096) {
    return errorResponse("request_too_large", "The translation request is too large.", 413);
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return errorResponse("invalid_request", "The translation request could not be read.", 400);
  }
  if (new TextEncoder().encode(rawBody).byteLength > 4096) {
    return errorResponse("request_too_large", "The translation request is too large.", 413);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return errorResponse("invalid_request", "The translation request was not valid JSON.", 400);
  }
  if (!payload || typeof payload !== "object") {
    return errorResponse("invalid_request", "A translation request is required.", 400);
  }

  const input = payload as Record<string, unknown>;
  if (
    typeof input.textId !== "string" ||
    typeof input.verseId !== "string" ||
    !validTextId.test(input.textId) ||
    !validVerseId.test(input.verseId) ||
    typeof input.targetLanguage !== "string" ||
    !supportedLanguages.has(input.targetLanguage as TranslationLanguage) ||
    typeof input.mode !== "string" ||
    !supportedModes.has(input.mode as TranslationMode)
  ) {
    return errorResponse(
      "invalid_request",
      "The selected language, verse, or translation mode is not supported.",
      400,
    );
  }

  const authentication = await requireAuthenticatedUser();
  if (!authentication.ok) return authentication.response;
  const { supabase, user } = authentication;
  const targetLanguage = input.targetLanguage as TranslationLanguage;
  const mode = input.mode as TranslationMode;

  const { data: text, error: textError } = await supabase
    .from("texts")
    .select("id, slug, title_en, is_active")
    .eq("slug", input.textId)
    .eq("is_active", true)
    .maybeSingle();
  if (textError) {
    return errorResponse("content_unavailable", "The requested source could not be checked.", 502);
  }
  if (!text) {
    return errorResponse("verse_not_found", "This passage is not available in the verified library.", 404);
  }

  const { data: verse, error: verseError } = await supabase
    .from("verses")
    .select("id, text_id, chapter_id, verse_number, devanagari_text, iast_text, source_id, created_at")
    .eq("id", input.verseId)
    .eq("text_id", text.id)
    .eq("status", "published")
    .maybeSingle();
  if (verseError) {
    return errorResponse("content_unavailable", "The requested passage could not be checked.", 502);
  }
  if (!verse) {
    return errorResponse("verse_not_found", "This passage is not available in the verified library.", 404);
  }

  const [{ data: source, error: sourceError }, { data: chapter, error: chapterError }] =
    await Promise.all([
      supabase
        .from("sources")
        .select("id, title, edition, license_status, is_active, created_at")
        .eq("id", verse.source_id)
        .eq("is_active", true)
        .in("license_status", clearedLicenseStatuses)
        .maybeSingle(),
      supabase
        .from("chapters")
        .select("chapter_number")
        .eq("id", verse.chapter_id)
        .eq("text_id", text.id)
        .maybeSingle(),
    ]);
  if (sourceError || chapterError) {
    return errorResponse("content_unavailable", "Source rights and passage context could not be checked.", 502);
  }
  if (!source || !chapter) {
    return errorResponse("source_not_cleared", "This passage is unavailable until its source edition is rights-cleared.", 403);
  }

  const languagePair = `sa:${targetLanguage}`;
  const approvedPairs = new Set(
    (process.env.AI_ENABLED_LANGUAGE_PAIRS ?? "")
      .split(",")
      .map((pair) => pair.trim().toLowerCase())
      .filter(Boolean),
  );
  if (!approvedPairs.has(languagePair)) {
    return errorResponse(
      "language_pair_not_approved",
      "AI translation is not enabled for this language pair until it passes the editorial quality and privacy review.",
      403,
    );
  }

  const sourceVersion = `${source.id}:${source.created_at}:${verse.created_at ?? verse.id}`;
  let providerConfiguration: ReturnType<typeof getTranslationProviderMetadata>;
  try {
    providerConfiguration = getTranslationProviderMetadata();
  } catch (error) {
    if (error instanceof TranslationProviderError) {
      return errorResponse(error.code, error.message, error.status);
    }
    throw error;
  }
  const providerName = providerConfiguration.provider;
  const modelName = providerConfiguration.model;
  const cacheKey = createHash("sha256")
    .update(JSON.stringify([
      user.id,
      verse.id,
      sourceVersion,
      verse.devanagari_text,
      verse.iast_text,
      targetLanguage,
      mode,
      providerName,
      providerConfiguration.endpoint,
      modelName,
      source.title,
      source.edition,
      "akshara-translation-v1",
    ]))
    .digest("hex");

  const now = new Date();
  const { data: cached, error: cacheReadError } = await supabase
    .from("translation_cache")
    .select("output, provider, model, prompt_version, source_version, expires_at")
    .eq("cache_key", cacheKey)
    .eq("user_id", user.id)
    .gt("expires_at", now.toISOString())
    .maybeSingle();
  if (cacheReadError) {
    return errorResponse("translation_storage_unavailable", "Translation cache is unavailable. Please retry later.", 503);
  }
  if (cached) {
    return NextResponse.json({
      translation: {
        output: cached.output,
        language: targetLanguage,
        mode,
        status: "ai_generated",
        provider: cached.provider,
        model: cached.model,
        promptVersion: cached.prompt_version,
        sourceVersion: cached.source_version,
        cacheKey,
        cached: true,
        cacheWarning: null,
        disclaimer: "AI-generated; not a human-reviewed or authoritative translation.",
        source: { title: source.title, edition: source.edition, chapter: chapter.chapter_number, verse: verse.verse_number },
      },
    });
  }

  const { data: quota, error: quotaError } = await supabase.rpc("consume_translation_quota");
  if (quotaError) {
    return errorResponse("translation_quota_unavailable", "Translation limits could not be checked. Please retry later.", 503);
  }
  const quotaStatus = Array.isArray(quota) ? quota[0] : quota;
  if (!quotaStatus || typeof quotaStatus.allowed !== "boolean") {
    return errorResponse("translation_quota_unavailable", "Translation limits returned an invalid response. Please retry later.", 503);
  }
  if (!quotaStatus.allowed) {
    const resetAt = typeof quotaStatus.reset_at === "string" ? quotaStatus.reset_at : undefined;
    const resetTime = resetAt ? new Date(resetAt).getTime() : Number.NaN;
    const retryAfter = Number.isFinite(resetTime)
      ? Math.max(1, Math.ceil((resetTime - Date.now()) / 1000))
      : 3600;
    return errorResponse(
      "translation_quota_exceeded",
      "You have reached the translation limit. Please try again after the limit resets.",
      429,
      { "Retry-After": String(retryAfter) },
    );
  }

  let generated: Awaited<ReturnType<typeof translateWithProvider>>;
  try {
    generated = await translateWithProvider({
      devanagariText: verse.devanagari_text,
      iastText: verse.iast_text,
      sourceTitle: source.title,
      chapterNumber: chapter.chapter_number,
      verseNumber: verse.verse_number,
      targetLanguage,
      mode,
    });
  } catch (error) {
    if (error instanceof TranslationProviderError) {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error("Unexpected AI translation failure");
    return errorResponse("translation_failed", "The translation could not be completed. Please retry.", 502);
  }

  const expiresAt = new Date(now.getTime() + cacheDurationMs).toISOString();
  const { error: cacheWriteError } = await supabase
    .from("translation_cache")
    .upsert({
      cache_key: cacheKey,
      user_id: user.id,
      verse_id: verse.id,
      language: targetLanguage,
      mode,
      source_version: sourceVersion,
      provider: generated.provider,
      model: generated.model,
      prompt_version: generated.promptVersion,
      glossary_version: "none",
      output: generated.output,
      expires_at: expiresAt,
    }, { onConflict: "cache_key" });
  if (cacheWriteError) {
    console.error("AI translation cache write failed", { code: cacheWriteError.code });
  }

  return NextResponse.json({
    translation: {
      output: generated.output,
      language: targetLanguage,
      mode,
      status: "ai_generated",
      provider: generated.provider,
      model: generated.model,
      promptVersion: generated.promptVersion,
      sourceVersion,
      cacheKey,
      cached: false,
      cacheWarning: cacheWriteError
        ? "This result could not be cached. Requesting it again may use another translation from your daily limit."
        : null,
      quotaRemaining: typeof quotaStatus.remaining === "number" ? quotaStatus.remaining : null,
      disclaimer: "AI-generated; not a human-reviewed or authoritative translation.",
      source: { title: source.title, edition: source.edition, chapter: chapter.chapter_number, verse: verse.verse_number },
    },
  });
}
