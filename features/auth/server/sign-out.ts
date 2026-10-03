import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json(
      { error: "invalid_origin", message: "This sign-out request was not from this site." },
      { status: 403 },
    );
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "auth_not_configured", message: "Sign-in is not configured." },
      { status: 503 },
    );
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    return NextResponse.json(
      { error: "sign_out_failed", message: "We could not end the session. Please try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({ message: "You are signed out." });
}
