import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/translate/route";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/authenticated-user", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

type Fixtures = Record<string, unknown>;

function queryFor(table: string, fixtures: Fixtures) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    gt: vi.fn(() => query),
    upsert: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: fixtures[table] ?? null, error: null })),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(resolve, reject),
  };
  return query;
}

const verse = {
  id: "11111111-1111-4111-8111-111111111111",
  text_id: "text-id",
  chapter_id: "chapter-id",
  verse_number: 4,
  devanagari_text: "विद्या ददाति विनयम्",
  iast_text: "vidyā dadāti vinayam",
  source_id: "source-id",
  created_at: "2026-10-03T00:00:00.000Z",
};

function useFixtures(fixtures: Fixtures = {}) {
  const supabase = {
    from: vi.fn((table: string) => queryFor(table, fixtures)),
    rpc: mocks.rpc,
  };
  mocks.requireAuthenticatedUser.mockResolvedValue({
    ok: true,
    user: { id: "650e8400-e29b-41d4-a716-446655440000" },
    supabase,
  });
  return supabase;
}

function withContent(fixtures: Fixtures = {}) {
  return {
    texts: { id: "text-id", slug: "sample-text", title_en: "Sample", is_active: true },
    verses: verse,
    sources: {
      id: "source-id",
      title: "Approved source",
      edition: "Test edition",
      license_status: "permission_granted",
      is_active: true,
      created_at: "2026-01-01T00:00:00.000Z",
    },
    chapters: { chapter_number: 2 },
    ...fixtures,
  };
}

function request(body: string | Record<string, unknown>) {
  return new Request("http://localhost/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const validPayload = {
  textId: "sample-text",
  verseId: verse.id,
  targetLanguage: "en",
  mode: "fluent",
};

beforeEach(() => {
  vi.stubEnv("AI_PROVIDER", "openai-compatible");
  vi.stubEnv("AI_API_KEY", "test-secret");
  vi.stubEnv("AI_MODEL", "test-model");
  vi.stubEnv("AI_ENABLED_LANGUAGE_PAIRS", "sa:en");
  mocks.rpc.mockResolvedValue({
    data: [{ allowed: true, remaining: 29, reset_at: "2026-10-04T00:00:00.000Z" }],
    error: null,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("POST /api/translate", () => {
  it("rejects malformed JSON with a clear client error", async () => {
    const response = await POST(request("{"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "invalid_request" });
    expect(mocks.requireAuthenticatedUser).not.toHaveBeenCalled();
  });

  it("rejects unsupported language and translation modes", async () => {
    const response = await POST(request({
      ...validPayload,
      targetLanguage: "Sanskrit (IAST)",
      mode: "scholarly authority",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "invalid_request" });
  });

  it("rejects invalid verse identifiers", async () => {
    const response = await POST(request({ ...validPayload, verseId: "not-a-uuid" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "invalid_request" });
  });

  it("rejects oversized requests before parsing", async () => {
    const response = await POST(request(" ".repeat(4097)));

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ error: "request_too_large" });
  });

  it("requires a signed-in account before accessing passage data", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "authentication_required" }, { status: 401 }),
    });

    const response = await POST(request(validPayload));

    expect(response.status).toBe(401);
  });

  it("does not send a passage to the model unless the source is rights-cleared", async () => {
    useFixtures(withContent({ sources: null }));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request(validPayload));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "source_not_cleared" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("fails explicitly when the provider is not configured", async () => {
    useFixtures(withContent());
    vi.stubEnv("AI_PROVIDER", "");
    vi.stubEnv("AI_API_KEY", "");

    const response = await POST(request(validPayload));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: "provider_not_configured" });
  });

  it("does not enable a language pair until its quality gate is approved", async () => {
    useFixtures(withContent());
    vi.stubEnv("AI_ENABLED_LANGUAGE_PAIRS", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request(validPayload));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "language_pair_not_approved" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("generates, labels, caches, and attributes a translation for a verified passage", async () => {
    const supabase = useFixtures(withContent());
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "Learning brings humility." } }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request(validPayload));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.translation).toMatchObject({
      output: "Learning brings humility.",
      language: "en",
      mode: "fluent",
      status: "ai_generated",
      provider: "openai-compatible",
      model: "test-model",
      cached: false,
      source: { title: "Approved source", edition: "Test edition", chapter: 2, verse: 4 },
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const providerRequest = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(providerRequest.messages[1].content).toContain(verse.devanagari_text);
    expect(providerRequest.messages[1].content).not.toContain("private");
    expect(supabase.from).toHaveBeenCalledWith("translation_cache");
    expect(mocks.rpc).toHaveBeenCalledWith("consume_translation_quota");
  });

  it("uses an unexpired per-account cache entry without consuming quota or calling a provider", async () => {
    useFixtures(withContent({
      translation_cache: {
        output: "Cached reading.",
        provider: "openai-compatible",
        model: "test-model",
        prompt_version: "akshara-translation-v1",
        source_version: "source-version",
        expires_at: "2026-12-01T00:00:00.000Z",
      },
    }));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request(validPayload));
    const body = await response.json();

    expect(body.translation).toMatchObject({ output: "Cached reading.", cached: true });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a retryable quota response without calling the provider", async () => {
    useFixtures(withContent());
    mocks.rpc.mockResolvedValue({
      data: [{ allowed: false, remaining: 0, reset_at: "2026-10-04T00:00:00.000Z" }],
      error: null,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request(validPayload));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();
    await expect(response.json()).resolves.toMatchObject({ error: "translation_quota_exceeded" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not misreport a missing quota response as a user limit", async () => {
    useFixtures(withContent());
    mocks.rpc.mockResolvedValue({ data: null, error: null });

    const response = await POST(request(validPayload));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: "translation_quota_unavailable" });
  });

  it("maps provider outages to a clear retryable response", async () => {
    useFixtures(withContent());
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));

    const response = await POST(request(validPayload));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ error: "provider_unavailable" });
  });
});
