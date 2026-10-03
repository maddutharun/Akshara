import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AuthenticationResult =
  | { ok: true; supabase: SupabaseClient; user: User }
  | { ok: false; response: NextResponse };

export async function requireAuthenticatedUser(): Promise<AuthenticationResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "database_not_configured", message: "This feature is unavailable until Supabase is configured." },
        { status: 503 },
      ),
    };
  }

  const { data, error } = await supabase.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "session_unavailable", message: "Your sign-in could not be verified." },
        { status: 502 },
      ),
    };
  }

  if (!data.user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "authentication_required", message: "Sign in to use this feature." },
        { status: 401 },
      ),
    };
  }

  return { ok: true, supabase, user: data.user };
}
