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

  if (!data.user) return NextResponse.json({ configured: true, user: null });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profileError) {
    return NextResponse.json(
      { error: "profile_unavailable", message: "Your account permissions could not be loaded." },
      { status: 502 },
    );
  }
  return NextResponse.json({
    configured: true,
    user: {
      id: data.user.id,
      email: data.user.email ?? null,
      role: profile?.role ?? "reader",
    },
  });
}
