import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as getCatalog } from "@/features/library/server/catalog";
import { GET as getChapter } from "@/features/library/server/chapter";
import { PUT as savePreferences } from "@/features/reading-preferences/server/handlers";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

vi.mock("@/lib/supabase/authenticated-user", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("Phase 1 library and reading preference APIs", () => {
  it("reports that the catalog is unavailable when Supabase is not configured", async () => {
    mocks.createSupabaseServerClient.mockResolvedValue(null);

    const response = await getCatalog(new Request("http://localhost/api/library"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: "database_not_configured" });
  });

  it("rejects malformed chapter paths before accessing the database", async () => {
    const response = await getChapter(
      new Request("http://localhost/api/library/../0"),
      { params: Promise.resolve({ slug: "../unsafe", chapter: "0" }) },
    );

    expect(response.status).toBe(400);
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("rejects unsupported cloud reading preferences", async () => {
    const from = vi.fn();
    mocks.requireAuthenticatedUser.mockResolvedValue({
      ok: true,
      user: { id: "650e8400-e29b-41d4-a716-446655440000" },
      supabase: { from },
    });

    const response = await savePreferences(new Request("http://localhost/api/reading-preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ readingLanguage: "sa", appearance: "light" }),
    }));

    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it("upserts supported preferences for the authenticated account only", async () => {
    const query = {
      upsert: vi.fn(),
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({
        data: { reading_language: "te", appearance: "dark", updated_at: "2026-10-03T00:00:00Z" },
        error: null,
      }),
    };
    query.upsert.mockReturnValue(query);
    query.select.mockReturnValue(query);
    const from = vi.fn().mockReturnValue(query);
    mocks.requireAuthenticatedUser.mockResolvedValue({
      ok: true,
      user: { id: "650e8400-e29b-41d4-a716-446655440000" },
      supabase: { from },
    });

    const response = await savePreferences(new Request("http://localhost/api/reading-preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ readingLanguage: "te", appearance: "dark" }),
    }));

    expect(response.status).toBe(200);
    expect(from).toHaveBeenCalledWith("reader_preferences");
    expect(query.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "650e8400-e29b-41d4-a716-446655440000",
        reading_language: "te",
        appearance: "dark",
      }),
      { onConflict: "user_id" },
    );
  });
});
