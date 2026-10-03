import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/api/read-json";
import { requireAuthenticatedUser } from "@/lib/supabase/authenticated-user";

const languages = new Set(["en", "te", "hi"]);

export async function GET() {
  const session = await requireAuthenticatedUser();
  if (!session.ok) return session.response;

  const { data, error } = await session.supabase
    .from("reader_preferences")
    .select("reading_language, appearance, updated_at")
    .maybeSingle();
  if (error) {
    return NextResponse.json(
      { error: "preferences_unavailable", message: "Your reading preferences could not be loaded." },
      { status: 502 },
    );
  }
  return NextResponse.json({ preferences: data });
}

export async function PUT(request: Request) {
  const session = await requireAuthenticatedUser();
  if (!session.ok) return session.response;

  const parsed = await readJsonBody(request, 1024);
  if (!("value" in parsed)) return parsed.response;
  if (!parsed.value || typeof parsed.value !== "object") {
    return NextResponse.json(
      { error: "invalid_preferences", message: "Reading preferences are required." },
      { status: 400 },
    );
  }

  const input = parsed.value as Record<string, unknown>;
  if (
    typeof input.readingLanguage !== "string" ||
    !languages.has(input.readingLanguage) ||
    (input.appearance !== "light" && input.appearance !== "dark")
  ) {
    return NextResponse.json(
      { error: "invalid_preferences", message: "Choose a supported reading language and appearance." },
      { status: 400 },
    );
  }

  const { data, error } = await session.supabase
    .from("reader_preferences")
    .upsert(
      {
        user_id: session.user.id,
        reading_language: input.readingLanguage,
        appearance: input.appearance,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("reading_language, appearance, updated_at")
    .single();
  if (error) {
    return NextResponse.json(
      { error: "preferences_save_failed", message: "Your reading preferences could not be saved." },
      { status: 502 },
    );
  }
  return NextResponse.json({ preferences: data });
}
