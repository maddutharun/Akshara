import { NextResponse } from "next/server";

const supportedLanguages = new Set(["English", "తెలుగు", "हिन्दी"]);
const supportedModes = new Set(["literal", "fluent", "explanation", "summary"]);
const validTextId = /^[a-z0-9][a-z0-9-]{0,79}$/;
const validVerseId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 4096) {
    return NextResponse.json(
      { error: "request_too_large", message: "The translation request is too large." },
      { status: 413 },
    );
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      { error: "invalid_request", message: "The translation request could not be read." },
      { status: 400 },
    );
  }

  if (new TextEncoder().encode(rawBody).byteLength > 4096) {
    return NextResponse.json(
      { error: "request_too_large", message: "The translation request is too large." },
      { status: 413 },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "invalid_request", message: "The translation request was not valid JSON." },
      { status: 400 },
    );
  }

  if (!payload || typeof payload !== "object") {
    return NextResponse.json(
      { error: "invalid_request", message: "A translation request is required." },
      { status: 400 },
    );
  }

  const input = payload as Record<string, unknown>;
  if (
    typeof input.textId !== "string" ||
    typeof input.verseId !== "string" ||
    !validTextId.test(input.textId) ||
    !validVerseId.test(input.verseId) ||
    typeof input.targetLanguage !== "string" ||
    typeof input.mode !== "string" ||
    !supportedLanguages.has(input.targetLanguage) ||
    !supportedModes.has(input.mode)
  ) {
    return NextResponse.json(
      { error: "invalid_request", message: "The selected language or translation mode is not supported." },
      { status: 400 },
    );
  }

  const provider = process.env.AI_PROVIDER;
  const apiKey = process.env.AI_API_KEY;
  if (!provider || !apiKey) {
    return NextResponse.json(
      {
        error: "provider_not_configured",
        message: "AI translation is not enabled yet. The team must select and configure a provider and approve this language pair first.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      error: "provider_adapter_pending",
      message: "Provider credentials are present, but no provider adapter has been approved or implemented yet.",
    },
    { status: 501 },
  );
}
