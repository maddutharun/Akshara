import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const requestedPath = request.nextUrl.searchParams.get("next") ?? "/";
  const candidate = new URL(requestedPath, request.url);
  const nextPath = candidate.origin === request.nextUrl.origin
    ? `${candidate.pathname}${candidate.search}${candidate.hash}`
    : "/";

  const supabase = await createSupabaseServerClient();
  if (!supabase || !code) {
    const target = new URL(nextPath, request.url);
    target.searchParams.set("auth", "unavailable");
    return NextResponse.redirect(target);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  const target = new URL(nextPath, request.url);
  if (error) target.searchParams.set("auth", "failed");
  return NextResponse.redirect(target);
}
