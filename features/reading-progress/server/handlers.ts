import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/api/read-json";
import { requireAuthenticatedUser } from "@/lib/supabase/authenticated-user";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET() {
  const session = await requireAuthenticatedUser();
  if (!session.ok) return session.response;

  const { data, error } = await session.supabase
    .from("reading_progress")
    .select("text_id, chapter_id, verse_id, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) {
    return NextResponse.json({ error: "progress_unavailable", message: "Reading progress could not be loaded." }, { status: 502 });
  }
  if (!data?.length) return NextResponse.json({ progress: [] });

  const textIds = [...new Set(data.map((item) => item.text_id))];
  const chapterIds = [...new Set(data.flatMap((item) => item.chapter_id ? [item.chapter_id] : []))];
  const [{ data: texts, error: textsError }, { data: chapters, error: chaptersError }] = await Promise.all([
    session.supabase.from("texts").select("id, slug").in("id", textIds),
    chapterIds.length
      ? session.supabase.from("chapters").select("id, chapter_number").in("id", chapterIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (textsError || chaptersError) {
    return NextResponse.json({ error: "progress_unavailable", message: "Reading destinations could not be loaded." }, { status: 502 });
  }

  const slugsByTextId = new Map((texts ?? []).map((item) => [item.id, item.slug]));
  const chapterNumbersById = new Map((chapters ?? []).map((item) => [item.id, item.chapter_number]));
  return NextResponse.json({
    progress: data.map((item) => {
      const slug = slugsByTextId.get(item.text_id);
      const chapterNumber = item.chapter_id ? chapterNumbersById.get(item.chapter_id) : undefined;
      return {
        ...item,
        path: slug && chapterNumber ? `/reader/${slug}/${chapterNumber}` : null,
      };
    }),
  });
}

export async function PUT(request: Request) {
  const session = await requireAuthenticatedUser();
  if (!session.ok) return session.response;

  const parsed = await readJsonBody(request, 2048);
  if (!("value" in parsed)) return parsed.response;
  const payload = parsed.value;
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "invalid_request", message: "A text id is required." }, { status: 400 });
  }
  const input = payload as Record<string, unknown>;
  const textId = input.textId;
  const chapterId = input.chapterId ?? null;
  const verseId = input.verseId ?? null;
  if (
    typeof textId !== "string" ||
    !uuidPattern.test(textId) ||
    (chapterId !== null && (typeof chapterId !== "string" || !uuidPattern.test(chapterId))) ||
    (verseId !== null && (typeof verseId !== "string" || !uuidPattern.test(verseId))) ||
    (verseId !== null && chapterId === null)
  ) {
    return NextResponse.json({ error: "invalid_progress", message: "The text, chapter, or verse location is invalid." }, { status: 400 });
  }

  const { data, error } = await session.supabase
    .from("reading_progress")
    .upsert(
      {
        user_id: session.user.id,
        text_id: textId,
        chapter_id: chapterId,
        verse_id: verseId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,text_id" },
    )
    .select("text_id, chapter_id, verse_id, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "progress_save_failed", message: "Reading progress could not be saved." }, { status: 502 });
  }
  return NextResponse.json({ progress: data });
}
