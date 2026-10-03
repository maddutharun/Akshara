import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/api/read-json";
import { requireAuthenticatedUser } from "@/lib/supabase/authenticated-user";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reasons = new Set(["harassment", "spam", "misinformation", "copyright", "other"]);

export async function GET() {
  const session = await requireAuthenticatedUser();
  if (!session.ok) return session.response;

  const { data, error } = await session.supabase
    .from("comment_reports")
    .select("id, comment_id, reason, details, status, created_at")
    .eq("reporter_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    return NextResponse.json(
      { error: "reports_unavailable", message: "Your reports could not be loaded." },
      { status: 502 },
    );
  }
  return NextResponse.json({ reports: data });
}

export async function POST(request: Request) {
  const session = await requireAuthenticatedUser();
  if (!session.ok) return session.response;
  const parsed = await readJsonBody(request, 3000);
  if (!("value" in parsed)) return parsed.response;
  if (!parsed.value || typeof parsed.value !== "object") {
    return NextResponse.json({ error: "invalid_report", message: "A report is required." }, { status: 400 });
  }

  const input = parsed.value as Record<string, unknown>;
  if (
    typeof input.commentId !== "string" ||
    !uuidPattern.test(input.commentId) ||
    typeof input.reason !== "string" ||
    !reasons.has(input.reason) ||
    (input.details !== undefined && input.details !== null &&
      (typeof input.details !== "string" || input.details.length > 2000))
  ) {
    return NextResponse.json({ error: "invalid_report", message: "Check the report reason and details." }, { status: 400 });
  }

  const { error } = await session.supabase.from("comment_reports").insert({
    comment_id: input.commentId,
    reporter_id: session.user.id,
    reason: input.reason,
    details: input.details ?? null,
  });
  if (error?.code === "23505") {
    return NextResponse.json({ error: "already_reported", message: "You have already reported this comment." }, { status: 409 });
  }
  if (error) {
    return NextResponse.json(
      { error: "report_failed", message: "This report could not be submitted." },
      {
        status: error.code === "P0001"
          ? 429
          : error.code === "42501" || error.code === "23503"
            ? 403
            : 502,
      },
    );
  }
  return NextResponse.json({ message: "Thank you. The report has been sent to moderators." }, { status: 201 });
}
