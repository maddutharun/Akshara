import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/supabase/authenticated-user";

const cacheKeyPattern = /^[0-9a-f]{64}$/;
const feedbackIssues = new Set(["inaccurate", "misleading", "terminology", "other"]);

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 2048) {
    return NextResponse.json(
      { error: "request_too_large", message: "The feedback request is too large." },
      { status: 413 },
    );
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      { error: "invalid_request", message: "The feedback request could not be read." },
      { status: 400 },
    );
  }
  if (new TextEncoder().encode(rawBody).byteLength > 2048) {
    return NextResponse.json(
      { error: "request_too_large", message: "The feedback request is too large." },
      { status: 413 },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "invalid_request", message: "The feedback request was not valid JSON." },
      { status: 400 },
    );
  }
  if (!payload || typeof payload !== "object") {
    return NextResponse.json(
      { error: "invalid_request", message: "Translation feedback is required." },
      { status: 400 },
    );
  }

  const input = payload as Record<string, unknown>;
  const issueType = input.issueType;
  if (
    typeof input.cacheKey !== "string" ||
    !cacheKeyPattern.test(input.cacheKey) ||
    (input.rating !== "helpful" && input.rating !== "issue") ||
    (input.rating === "issue" && (typeof issueType !== "string" || !feedbackIssues.has(issueType))) ||
    (input.rating === "helpful" && issueType !== undefined) ||
    (input.note !== undefined && (typeof input.note !== "string" || input.note.trim().length > 1000))
  ) {
    return NextResponse.json(
      { error: "invalid_request", message: "The translation feedback is not valid." },
      { status: 400 },
    );
  }

  const authentication = await requireAuthenticatedUser();
  if (!authentication.ok) return authentication.response;
  const { supabase, user } = authentication;
  const { data: cachedTranslation, error: cacheError } = await supabase
    .from("translation_cache")
    .select("cache_key")
    .eq("cache_key", input.cacheKey)
    .eq("user_id", user.id)
    .maybeSingle();
  if (cacheError) {
    return NextResponse.json(
      { error: "translation_feedback_unavailable", message: "Your translation could not be verified." },
      { status: 502 },
    );
  }
  if (!cachedTranslation) {
    return NextResponse.json(
      { error: "translation_not_found", message: "This generated translation is no longer available." },
      { status: 404 },
    );
  }

  const { error: feedbackError } = await supabase
    .from("translation_feedback")
    .upsert({
      cache_key: input.cacheKey,
      user_id: user.id,
      rating: input.rating,
      issue_type: input.rating === "issue" ? issueType : null,
      note: typeof input.note === "string" && input.note.trim() ? input.note.trim() : null,
    }, { onConflict: "user_id,cache_key" });
  if (feedbackError) {
    return NextResponse.json(
      { error: "translation_feedback_unavailable", message: "Your feedback could not be saved. Please retry." },
      { status: 502 },
    );
  }

  return NextResponse.json({ submitted: true });
}
