import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { POST } from "@/features/translation/server/feedback";

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
}));

vi.mock("@/lib/supabase/authenticated-user", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/translate/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function authenticate(cacheFound = true) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn().mockResolvedValue({
      data: cacheFound ? { cache_key: "a".repeat(64) } : null,
      error: null,
    }),
    upsert: vi.fn(() => query),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(resolve, reject),
  };
  const supabase = { from: vi.fn(() => query) };
  mocks.requireAuthenticatedUser.mockResolvedValue({
    ok: true,
    user: { id: "650e8400-e29b-41d4-a716-446655440000" },
    supabase,
  });
  return { query, supabase };
}

afterEach(() => vi.clearAllMocks());

describe("POST /api/translate/feedback", () => {
  it("rejects unsupported feedback categories", async () => {
    authenticate();
    const response = await POST(request({
      cacheKey: "a".repeat(64),
      rating: "issue",
      issueType: "dangerous",
    }));

    expect(response.status).toBe(400);
  });

  it("requires an authenticated account", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "authentication_required" }, { status: 401 }),
    });
    const response = await POST(request({ cacheKey: "a".repeat(64), rating: "helpful" }));

    expect(response.status).toBe(401);
  });

  it("rejects feedback for a translation not owned by the signed-in account", async () => {
    authenticate(false);
    const response = await POST(request({ cacheKey: "a".repeat(64), rating: "helpful" }));

    expect(response.status).toBe(404);
  });

  it("stores bounded private feedback against the user's generated translation", async () => {
    const { query, supabase } = authenticate();
    const response = await POST(request({
      cacheKey: "a".repeat(64),
      rating: "issue",
      issueType: "terminology",
      note: "This word needs review.",
    }));

    expect(response.status).toBe(200);
    expect(supabase.from).toHaveBeenCalledWith("translation_feedback");
    expect(query.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        cache_key: "a".repeat(64),
        user_id: "650e8400-e29b-41d4-a716-446655440000",
        rating: "issue",
        issue_type: "terminology",
        note: "This word needs review.",
      }),
      { onConflict: "user_id,cache_key" },
    );
  });
});
