import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const maximumQueryLength = 100;

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "database_not_configured", message: "The verified library is unavailable until Supabase is configured." },
      { status: 503 },
    );
  }

  const query = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (query.length > maximumQueryLength) {
    return NextResponse.json(
      { error: "invalid_query", message: "Search terms must be 100 characters or fewer." },
      { status: 400 },
    );
  }

  const selection = "id, slug, title_en, title_te, title_hi, description_en, source_id";
  let texts: { id: string; slug: string; title_en: string; title_te: string | null; title_hi: string | null; description_en: string | null; source_id: string }[] = [];
  if (query) {
    const titleFields = ["title_en", "title_te", "title_hi"] as const;
    const matches = await Promise.all(titleFields.map((field) =>
      supabase
        .from("texts")
        .select(selection)
        .eq("is_active", true)
        .ilike(field, `%${query}%`)
        .limit(100),
    ));
    if (matches.some((match) => match.error)) {
      return NextResponse.json(
        { error: "library_unavailable", message: "The library could not be searched." },
        { status: 502 },
      );
    }
    texts = [...new Map(matches.flatMap((match) => match.data ?? []).map((text) => [text.id, text])).values()]
      .sort((left, right) => left.title_en.localeCompare(right.title_en));
  } else {
    const { data, error } = await supabase
      .from("texts")
      .select(selection)
      .eq("is_active", true)
      .order("title_en", { ascending: true })
      .limit(100);
    if (error) {
      return NextResponse.json(
        { error: "library_unavailable", message: "The library could not be loaded." },
        { status: 502 },
      );
    }
    texts = data ?? [];
  }
  if (!texts.length) return NextResponse.json({ texts: [] });

  const sourceIds = [...new Set(texts.map((text) => text.source_id))];
  const textIds = texts.map((text) => text.id);
  const [{ data: sources, error: sourcesError }, { data: chapters, error: chaptersError }] = await Promise.all([
    supabase
      .from("sources")
      .select("id, title, author_or_translator, edition, publication_year, citation, source_url")
      .in("id", sourceIds)
      .eq("is_active", true)
      .in("license_status", ["public_domain", "permission_granted", "commissioned"]),
    supabase
      .from("chapters")
      .select("text_id, chapter_number, name_en, name_te, name_hi")
      .in("text_id", textIds)
      .order("chapter_number", { ascending: true }),
  ]);

  if (sourcesError || chaptersError) {
    return NextResponse.json(
      { error: "library_unavailable", message: "The library records could not be loaded." },
      { status: 502 },
    );
  }

  const sourcesById = new Map((sources ?? []).map((source) => [source.id, source]));
  const chaptersByTextId = new Map<string, typeof chapters>();
  for (const chapter of chapters ?? []) {
    const items = chaptersByTextId.get(chapter.text_id) ?? [];
    items.push(chapter);
    chaptersByTextId.set(chapter.text_id, items);
  }

  const availableTexts = texts.flatMap((text) => {
    const source = sourcesById.get(text.source_id);
    if (!source) return [];
    return [{
      ...text,
      source,
      chapters: chaptersByTextId.get(text.id) ?? [],
    }];
  });

  return NextResponse.json({ texts: availableTexts });
}
