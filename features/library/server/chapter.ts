import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const chapterPattern = /^[1-9]\d{0,5}$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; chapter: string }> },
) {
  const { slug, chapter: chapterValue } = await params;
  if (!slugPattern.test(slug) || !chapterPattern.test(chapterValue)) {
    return NextResponse.json(
      { error: "invalid_location", message: "Choose a valid text and chapter." },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "database_not_configured", message: "Verified chapter content is unavailable until Supabase is configured." },
      { status: 503 },
    );
  }

  const { data: text, error: textError } = await supabase
    .from("texts")
    .select("id, slug, title_en, title_te, title_hi, description_en, source_id")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (textError) {
    return NextResponse.json(
      { error: "chapter_unavailable", message: "The requested reading could not be loaded." },
      { status: 502 },
    );
  }
  if (!text) {
    return NextResponse.json(
      { error: "text_not_found", message: "This text is not available in the verified library." },
      { status: 404 },
    );
  }

  const chapterNumber = Number(chapterValue);
  const [
    { data: chapter, error: chapterError },
    { data: source, error: sourceError },
    { data: siblingChapters, error: siblingChaptersError },
  ] = await Promise.all([
    supabase
      .from("chapters")
      .select("id, chapter_number, name_en, name_te, name_hi")
      .eq("text_id", text.id)
      .eq("chapter_number", chapterNumber)
      .maybeSingle(),
    supabase
      .from("sources")
      .select("id, title, author_or_translator, edition, publication_year, citation, source_url")
      .eq("id", text.source_id)
      .eq("is_active", true)
      .in("license_status", ["public_domain", "permission_granted", "commissioned"])
      .maybeSingle(),
    supabase
      .from("chapters")
      .select("chapter_number, name_en")
      .eq("text_id", text.id)
      .order("chapter_number", { ascending: true }),
  ]);
  if (chapterError || sourceError || siblingChaptersError) {
    return NextResponse.json(
      { error: "chapter_unavailable", message: "The requested chapter could not be loaded." },
      { status: 502 },
    );
  }
  if (!chapter || !source) {
    return NextResponse.json(
      { error: "chapter_not_found", message: "This chapter is not available in the verified library." },
      { status: 404 },
    );
  }
  const chapterNumbers = (siblingChapters ?? []).map((item) => item.chapter_number);
  const chapterIndex = chapterNumbers.indexOf(chapter.chapter_number);
  const navigation = {
    previous: chapterIndex > 0 ? chapterNumbers[chapterIndex - 1] : null,
    next: chapterIndex >= 0 && chapterIndex < chapterNumbers.length - 1 ? chapterNumbers[chapterIndex + 1] : null,
  };

  const { data: verses, error: versesError } = await supabase
    .from("verses")
    .select("id, verse_number, canon_order, devanagari_text, iast_text, search_normalized, source_id")
    .eq("text_id", text.id)
    .eq("chapter_id", chapter.id)
    .eq("status", "published")
    .order("verse_number", { ascending: true });
  if (versesError) {
    return NextResponse.json(
      { error: "chapter_unavailable", message: "The verses could not be loaded." },
      { status: 502 },
    );
  }

  const verseIds = (verses ?? []).map((verse) => verse.id);
  const verseSourceIds = [...new Set((verses ?? []).map((verse) => verse.source_id))];
  const [{ data: translations, error: translationsError }, { data: verseSources, error: verseSourcesError }] =
    verseIds.length
      ? await Promise.all([
          supabase
            .from("verse_translations")
            .select("id, verse_id, language, translation_text, mode, source_version, source_id, reviewed_at")
            .in("verse_id", verseIds)
            .eq("status", "human_reviewed")
            .order("language", { ascending: true }),
          supabase
            .from("sources")
            .select("id, title, author_or_translator, edition, publication_year, citation, source_url")
            .in("id", verseSourceIds)
            .eq("is_active", true)
            .in("license_status", ["public_domain", "permission_granted", "commissioned"]),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];

  if (translationsError || verseSourcesError) {
    return NextResponse.json(
      { error: "chapter_unavailable", message: "Translation or source provenance could not be loaded." },
      { status: 502 },
    );
  }

  const translationsByVerseId = new Map<
    string,
    {
      id: string;
      verse_id: string;
      language: "en" | "te" | "hi";
      translation_text: string;
      mode: "literal" | "fluent";
      source_version: string;
      source_id: string | null;
      reviewed_at: string | null;
    }[]
  >();
  for (const translation of translations ?? []) {
    const items = translationsByVerseId.get(translation.verse_id) ?? [];
    items.push(translation);
    translationsByVerseId.set(translation.verse_id, items);
  }
  const sourcesById = new Map((verseSources ?? []).map((item) => [item.id, item]));

  return NextResponse.json({
    text,
    chapter,
    navigation,
    source,
    verses: (verses ?? []).flatMap((verse) => {
      const verseSource = sourcesById.get(verse.source_id);
      if (!verseSource) return [];
      return [{
        ...verse,
        source: verseSource,
        translations: translationsByVerseId.get(verse.id) ?? [],
      }];
    }),
  });
}
