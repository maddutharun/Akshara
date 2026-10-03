import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/api/read-json";
import { requireAuthenticatedUser } from "@/lib/supabase/authenticated-user";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET() {
  const session = await requireAuthenticatedUser();
  if (!session.ok) return session.response;

  const { data, error } = await session.supabase
    .from("bookmarks")
    .select("id, text_id, chapter_id, verse_id, collection_name, note, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json(
      { error: "bookmarks_unavailable", message: "Your saved reading could not be loaded." },
      { status: 502 },
    );
  }
  return NextResponse.json({ bookmarks: data });
}

export async function POST(request: Request) {
  const session = await requireAuthenticatedUser();
  if (!session.ok) return session.response;
  const parsed = await readJsonBody(request, 6000);
  if (!("value" in parsed)) return parsed.response;
  const payload = parsed.value;
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "invalid_request", message: "A bookmark target is required." }, { status: 400 });
  }

  const input = payload as Record<string, unknown>;
  const targetFields = ["textId", "chapterId", "verseId"] as const;
  const provided = targetFields.filter((field) => input[field] !== undefined && input[field] !== null);
  if (
    provided.length !== 1 ||
    provided.some((field) => typeof input[field] !== "string" || !uuidPattern.test(input[field] as string))
  ) {
    return NextResponse.json({ error: "invalid_target", message: "Choose exactly one valid text, chapter, or verse." }, { status: 400 });
  }

  const collectionName = input.collectionName ?? "Saved";
  const note = input.note ?? null;
  if (
    typeof collectionName !== "string" ||
    collectionName.trim().length < 1 ||
    collectionName.length > 80 ||
    (note !== null && (typeof note !== "string" || note.length > 4000))
  ) {
    return NextResponse.json({ error: "invalid_bookmark", message: "Check the collection name and note length." }, { status: 400 });
  }

  const { data, error } = await session.supabase
    .from("bookmarks")
    .insert({
      user_id: session.user.id,
      text_id: input.textId ?? null,
      chapter_id: input.chapterId ?? null,
      verse_id: input.verseId ?? null,
      collection_name: collectionName.trim(),
      note,
    })
    .select("id, text_id, chapter_id, verse_id, collection_name, note, created_at")
    .single();

  if (error?.code === "23505") {
    return NextResponse.json({ error: "already_saved", message: "That passage is already in this collection." }, { status: 409 });
  }
  if (error) {
    return NextResponse.json({ error: "bookmark_failed", message: "The bookmark could not be saved." }, { status: 502 });
  }
  return NextResponse.json({ bookmark: data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await requireAuthenticatedUser();
  if (!session.ok) return session.response;
  const bookmarkId = new URL(request.url).searchParams.get("id");
  if (!bookmarkId || !uuidPattern.test(bookmarkId)) {
    return NextResponse.json({ error: "invalid_bookmark", message: "A valid bookmark id is required." }, { status: 400 });
  }

  const { data, error } = await session.supabase
    .from("bookmarks")
    .delete()
    .eq("id", bookmarkId)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "bookmark_delete_failed", message: "The bookmark could not be removed." }, { status: 502 });
  }
  if (!data) {
    return NextResponse.json({ error: "bookmark_not_found", message: "Bookmark not found." }, { status: 404 });
  }
  return NextResponse.json({ removed: true });
}
