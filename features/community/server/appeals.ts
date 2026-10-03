import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/api/read-json";
import { requireAuthenticatedUser } from "@/lib/supabase/authenticated-user";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request): Promise<NextResponse> {
  const session = await requireAuthenticatedUser();
  if (!session.ok) return session.response;

  const parsed = await readJsonBody(request, 3000);
  if (!("value" in parsed)) return parsed.response;
  if (!parsed.value || typeof parsed.value !== "object") {
    return NextResponse.json({ error: "invalid_appeal", message: "An appeal is required." }, { status: 400 });
  }

  const input = parsed.value as Record<string, unknown>;
  const appealText = typeof input.appealText === "string" ? input.appealText.trim() : "";
  if (
    typeof input.commentId !== "string" ||
    !uuidPattern.test(input.commentId) ||
    appealText.length < 3 ||
    appealText.length > 2000
  ) {
    return NextResponse.json(
      { error: "invalid_appeal", message: "Check the comment id and appeal length." },
      { status: 400 },
    );
  }

  const { error } = await session.supabase.from("comment_appeals").insert({
    comment_id: input.commentId,
    user_id: session.user.id,
    appeal_text: appealText,
  });

  if (error?.code === "23505") {
    return NextResponse.json(
      { error: "appeal_already_submitted", message: "An appeal has already been submitted for this comment." },
      { status: 409 },
    );
  }
  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "23503" || error.code === "23514" ? 400 : 502;
    return NextResponse.json(
      {
        error: "appeal_submission_failed",
        message: status === 403
          ? "Only the author of a hidden or flagged comment can appeal."
          : "The appeal could not be submitted.",
      },
      { status },
    );
  }
  return NextResponse.json(
    { message: "Your appeal has been sent for moderator review." },
    { status: 201 },
  );
}
