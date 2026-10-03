import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ configured: false, user: null });
  }

  const { data, error } = await supabase.auth.getUser();
  if (error) {
    return NextResponse.json(
      { error: "session_unavailable", message: "Your sign-in status could not be checked." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    configured: true,
    user: data.user ? { email: data.user.email ?? null } : null,
  });
}
