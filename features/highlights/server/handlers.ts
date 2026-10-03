import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/api/read-json";
import { requireAuthenticatedUser } from "@/lib/supabase/authenticated-user";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET() {
  const session = await requireAuthenticatedUser();
  if (!session.ok) return session.response;

  const { data, error } = await session.supabase
    .from("private_highlights")
    .select("id, verse_id, quote, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json(
      { error: "highlights_unavailable", message: "Your private highlights could not be loaded." },
      { status: 502 },
    );
  }

  const verseIds = [...new Set((data ?? []).map((item) => item.verse_id))];
  const { data: verses, error: versesError } = verseIds.length
    ? await session.supabase
        .from("verses")
        .select("id, verse_number, chapter_id, chapters!inner(chapter_number, text_id)")
        .in("id", verseIds)
    : { data: [], error: null };

  if (versesError) {
    return NextResponse.json(
      { error: "highlights_unavailable", message: "Highlight references could not be loaded." },
      { status: 502 },
    );
  }

  const chapters = [...new Set((verses ?? []).map((verse) => verse.chapter_id))];
  const { data: chapterRows, error: chaptersError } = chapters.length
    ? await session.supabase
        .from("chapters")
        .select("id, chapter_number, text_id")
        .in("id", chapters)
    : { data: [], error: null };

  if (chaptersError) {
    return NextResponse.json(
      { error: "highlights_unavailable", message: "Highlight references could not be loaded." },
      { status: 502 },
    );
  }

  const textIds = [...new Set((chapterRows ?? []).map((chapter) => chapter.text_id))];
  const { data: texts, error: textsError } = textIds.length
    ? await session.supabase.from("texts").select("id, title_en").in("id", textIds)
    : { data: [], error: null };

  if (textsError) {
    return NextResponse.json(
      { error: "highlights_unavailable", message: "Highlight references could not be loaded." },
      { status: 502 },
    );
  }

  const chaptersById = new Map((chapterRows ?? []).map((chapter) => [chapter.id, chapter]));
  const textsById = new Map((texts ?? []).map((text) => [text.id, text]));
  const versesById = new Map((verses ?? []).map((verse) => [verse.id, verse]));
  const highlights = (data ?? []).map((item) => {
    const verse = versesById.get(item.verse_id);
    const chapter = verse ? chaptersById.get(verse.chapter_id) : null;
    const text = chapter ? textsById.get(chapter.text_id) : null;
    return {
      id: item.id,
      verseId: item.verse_id,
      quote: item.quote,
      reference: text && chapter && verse
        ? `${text.title_en} · Chapter ${chapter.chapter_number} · Verse ${verse.verse_number}`
        : "Saved passage",
      createdAt: item.created_at,
    };
  });

  return NextResponse.json({ highlights });
}

export async function POST(request: Request) {
  const session = await requireAuthenticatedUser();
  if (!session.ok) return session.response;

  const parsed = await readJsonBody(request, 6000);
  if (!("value" in parsed)) return parsed.response;
  if (!parsed.value || typeof parsed.value !== "object") {
    return NextResponse.json(
      { error: "invalid_highlight", message: "A verse and selected text are required." },
      { status: 400 },
    );
  }

  const input = parsed.value as Record<string, unknown>;
  if (
    typeof input.verseId !== "string" ||
    !uuidPattern.test(input.verseId) ||
    typeof input.quote !== "string" ||
    input.quote.trim().length < 1 ||
    input.quote.length > 1000
  ) {
    return NextResponse.json(
      { error: "invalid_highlight", message: "Choose a valid published verse and select up to 1,000 characters." },
      { status: 400 },
    );
  }

  const { data, error } = await session.supabase
    .from("private_highlights")
    .insert({
      user_id: session.user.id,
      verse_id: input.verseId,
      quote: input.quote.trim(),
    })
    .select("id, verse_id, quote, created_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "highlight_save_failed", message: "The private highlight could not be saved." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    highlight: {
      id: data.id,
      verseId: data.verse_id,
      quote: data.quote,
      createdAt: data.created_at,
    },
  }, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await requireAuthenticatedUser();
  if (!session.ok) return session.response;

  const highlightId = new URL(request.url).searchParams.get("id");
  if (!highlightId || !uuidPattern.test(highlightId)) {
    return NextResponse.json(
      { error: "invalid_highlight", message: "A valid highlight id is required." },
      { status: 400 },
    );
  }

  const { data, error } = await session.supabase
    .from("private_highlights")
    .delete()
    .eq("id", highlightId)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "highlight_delete_failed", message: "The private highlight could not be removed." },
      { status: 502 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "highlight_not_found", message: "Highlight not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({ removed: true });
}
