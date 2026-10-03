import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > 2048) {
    return NextResponse.json(
      { error: "request_too_large", message: "The sign-in request is too large." },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_request", message: "Enter a valid email address." },
      { status: 400 },
    );
  }

  const email =
    body && typeof body === "object" && "email" in body && typeof body.email === "string"
      ? body.email.trim().toLowerCase()
      : "";

  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return NextResponse.json(
      { error: "invalid_email", message: "Enter a valid email address." },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "auth_not_configured", message: "Sign-in is unavailable until Supabase Auth is configured." },
      { status: 503 },
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: new URL("/auth/callback?next=/", siteUrl).toString(),
      shouldCreateUser: true,
    },
  });

  if (error) {
    return NextResponse.json(
      { error: "sign_in_failed", message: "We could not send a sign-in link. Please try again later." },
      { status: 502 },
    );
  }

  return NextResponse.json({ message: "Check your email for a secure sign-in link." });
}
