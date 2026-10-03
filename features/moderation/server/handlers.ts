import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/api/read-json";
import { requireAuthenticatedUser } from "@/lib/supabase/authenticated-user";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET() {
  const session = await requireAuthenticatedUser();
  if (!session.ok) return session.response;

  const { data: profile, error: profileError } = await session.supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .maybeSingle();
  if (profileError) {
    return NextResponse.json(
      { error: "moderation_unavailable", message: "Moderator permissions could not be checked." },
      { status: 502 },
    );
  }
  if (!profile || !["moderator", "admin"].includes(profile.role)) {
    return NextResponse.json(
      { error: "moderator_required", message: "Moderator permissions are required." },
      { status: 403 },
    );
  }

  const [commentsResult, reportsResult, appealsResult] = await Promise.all([
    session.supabase
      .from("comments")
      .select("id, user_id, text_id, chapter_id, verse_id, parent_comment_id, body, language, status, created_at")
      .in("status", ["pending", "flagged"])
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(100),
    session.supabase
      .from("comment_reports")
      .select("id, comment_id, reporter_id, reason, details, status, created_at")
      .in("status", ["open", "reviewing"])
      .order("created_at", { ascending: true })
      .limit(100),
    session.supabase
      .from("comment_appeals")
      .select("id, comment_id, user_id, appeal_text, status, created_at")
      .in("status", ["open", "reviewing"])
      .order("created_at", { ascending: true })
      .limit(100),
  ]);
  if (commentsResult.error || reportsResult.error || appealsResult.error) {
    return NextResponse.json(
      { error: "moderation_queue_unavailable", message: "The moderation queue could not be loaded." },
      { status: 502 },
    );
  }
  const reportedCommentIds = [...new Set((reportsResult.data ?? []).map((report) => report.comment_id))];
  const { data: reportedComments, error: reportedCommentsError } = reportedCommentIds.length
    ? await session.supabase
        .from("comments")
        .select("id, user_id, body, status")
        .in("id", reportedCommentIds)
    : { data: [], error: null };
  if (reportedCommentsError) {
    return NextResponse.json(
      { error: "moderation_queue_unavailable", message: "Reported comment context could not be loaded." },
      { status: 502 },
    );
  }
  const commentsById = new Map((reportedComments ?? []).map((comment) => [comment.id, comment]));
  return NextResponse.json({
    comments: commentsResult.data ?? [],
    reports: (reportsResult.data ?? []).map((report) => ({
      ...report,
      comment: commentsById.get(report.comment_id) ?? null,
    })),
    appeals: appealsResult.data ?? [],
  });
}

export async function POST(request: Request) {
  const session = await requireAuthenticatedUser();
  if (!session.ok) return session.response;
  const parsed = await readJsonBody(request, 3000);
  if (!("value" in parsed)) return parsed.response;
  if (!parsed.value || typeof parsed.value !== "object") {
    return NextResponse.json({ error: "invalid_decision", message: "A moderation action is required." }, { status: 400 });
  }

  const input = parsed.value as Record<string, unknown>;
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (
    typeof input.action !== "string" ||
    typeof input.id !== "string" ||
    !uuidPattern.test(input.id) ||
    reason.length < 3 ||
    reason.length > 2000
  ) {
    return NextResponse.json({ error: "invalid_decision", message: "Check the action, item id, and decision reason." }, { status: 400 });
  }

  let rpcName: "moderate_comment" | "resolve_comment_report" | "resolve_comment_appeal";
  let rpcArgs:
    | { target_comment_id: string; next_status: string; decision_reason: string }
    | { target_report_id: string; resolution: string; decision_reason: string }
    | { target_appeal_id: string; resolution: string; decision_reason: string };

  if (input.action === "comment") {
    if (!["approved", "flagged", "hidden", "deleted"].includes(String(input.status))) {
      return NextResponse.json({ error: "invalid_status", message: "That comment status is not supported." }, { status: 400 });
    }
    rpcName = "moderate_comment";
    rpcArgs = { target_comment_id: input.id, next_status: String(input.status), decision_reason: reason };
  } else if (input.action === "report") {
    if (input.status !== "resolved" && input.status !== "dismissed") {
      return NextResponse.json({ error: "invalid_status", message: "That report resolution is not supported." }, { status: 400 });
    }
    rpcName = "resolve_comment_report";
    rpcArgs = { target_report_id: input.id, resolution: input.status, decision_reason: reason };
  } else if (input.action === "appeal") {
    if (input.status !== "upheld" && input.status !== "overturned") {
      return NextResponse.json({ error: "invalid_status", message: "That appeal resolution is not supported." }, { status: 400 });
    }
    rpcName = "resolve_comment_appeal";
    rpcArgs = { target_appeal_id: input.id, resolution: input.status, decision_reason: reason };
  } else {
    return NextResponse.json({ error: "invalid_action", message: "That moderation action is not supported." }, { status: 400 });
  }

  const { error } = await session.supabase.rpc(rpcName, rpcArgs);
  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : error.code === "22023" ? 400 : 502;
    return NextResponse.json(
      { error: "moderation_failed", message: status === 403 ? "Moderator permissions are required." : "The moderation action could not be completed." },
      { status },
    );
  }
  return NextResponse.json({ completed: true });
}
