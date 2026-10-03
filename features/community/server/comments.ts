import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/api/read-json";
import { requireAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const languages = new Set(["en", "te", "hi"]);

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "database_not_configured", message: "Community discussions are unavailable until Supabase is configured." },
      { status: 503 },
    );
  }

  const params = new URL(request.url).searchParams;
  const verseId = params.get("verseId");
  const chapterId = params.get("chapterId");
  if (
    Number(Boolean(verseId)) + Number(Boolean(chapterId)) !== 1 ||
    (verseId && !uuidPattern.test(verseId)) ||
    (chapterId && !uuidPattern.test(chapterId))
  ) {
    return NextResponse.json(
      { error: "invalid_location", message: "Choose one valid verse or chapter." },
      { status: 400 },
    );
  }

  let query = supabase
    .from("comments")
    .select("id, user_id, text_id, chapter_id, verse_id, parent_comment_id, body, language, status, edited_at, created_at")
    .order("created_at", { ascending: true })
    .limit(100);
  query = verseId ? query.eq("verse_id", verseId) : query.eq("chapter_id", chapterId!);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: "comments_unavailable", message: "This discussion could not be loaded." },
      { status: 502 },
    );
  }
  return NextResponse.json({ comments: data });
}

export async function POST(request: Request) {
  const session = await requireAuthenticatedUser();
  if (!session.ok) return session.response;

  const parsed = await readJsonBody(request, 10_000);
  if (!("value" in parsed)) return parsed.response;
  if (!parsed.value || typeof parsed.value !== "object") {
    return NextResponse.json({ error: "invalid_comment", message: "A comment is required." }, { status: 400 });
  }

  const input = parsed.value as Record<string, unknown>;
  const textId = input.textId;
  const chapterId = input.chapterId;
  const verseId = input.verseId ?? null;
  const parentCommentId = input.parentCommentId ?? null;
  const body = typeof input.body === "string" ? input.body.trim() : "";
  const language = input.language;
  if (
    typeof textId !== "string" ||
    !uuidPattern.test(textId) ||
    typeof chapterId !== "string" ||
    !uuidPattern.test(chapterId) ||
    (verseId !== null && (typeof verseId !== "string" || !uuidPattern.test(verseId))) ||
    (parentCommentId !== null && (typeof parentCommentId !== "string" || !uuidPattern.test(parentCommentId))) ||
    body.length < 3 ||
    body.length > 6000 ||
    typeof language !== "string" ||
    !languages.has(language)
  ) {
    return NextResponse.json(
      { error: "invalid_comment", message: "Check the passage, language, and comment length." },
      { status: 400 },
    );
  }

  const { data, error } = await session.supabase
    .from("comments")
    .insert({
      user_id: session.user.id,
      text_id: textId,
      chapter_id: chapterId,
      verse_id: verseId,
      parent_comment_id: parentCommentId,
      body,
      language,
      status: "pending",
    })
    .select("id, text_id, chapter_id, verse_id, parent_comment_id, body, language, status, created_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "comment_submission_failed", message: "The comment could not be submitted for review." },
      {
        status: error.code === "P0001"
          ? 429
          : error.code === "42501" || error.code === "23503" || error.code === "23514"
            ? 403
            : 502,
      },
    );
  }
  return NextResponse.json({ comment: data, message: "Your comment is pending moderation." }, { status: 201 });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const session = await requireAuthenticatedUser();
  if (!session.ok) return session.response;

  const parsed = await readJsonBody(request, 10_000);
  if (!("value" in parsed)) return parsed.response;
  if (!parsed.value || typeof parsed.value !== "object") {
    return NextResponse.json({ error: "invalid_comment", message: "A comment update is required." }, { status: 400 });
  }

  const input = parsed.value as Record<string, unknown>;
  const commentId = input.commentId;
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (typeof commentId !== "string" || !uuidPattern.test(commentId) || body.length < 3 || body.length > 6000) {
    return NextResponse.json(
      { error: "invalid_comment", message: "Check the comment id and comment length." },
      { status: 400 },
    );
  }

  const { data, error } = await session.supabase
    .from("comments")
    .update({ body })
    .eq("id", commentId)
    .select("id, body, edited_at, updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "comment_update_failed", message: "The comment could not be edited." },
      { status: error.code === "42501" || error.code === "23514" ? 403 : 502 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "comment_not_editable", message: "The comment was not found or can no longer be edited." },
      { status: 404 },
    );
  }
  return NextResponse.json({ comment: data });
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const session = await requireAuthenticatedUser();
  if (!session.ok) return session.response;

  const commentId = new URL(request.url).searchParams.get("id");
  if (!commentId || !uuidPattern.test(commentId)) {
    return NextResponse.json({ error: "invalid_comment", message: "A valid comment id is required." }, { status: 400 });
  }

  const { error } = await session.supabase.rpc("soft_delete_own_comment", {
    target_comment_id: commentId,
  });
  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 502;
    return NextResponse.json(
      {
        error: "comment_delete_failed",
        message: status === 404
          ? "The comment was not found or can no longer be deleted."
          : "The comment could not be deleted.",
      },
      { status },
    );
  }
  return NextResponse.json({ deleted: true });
}
