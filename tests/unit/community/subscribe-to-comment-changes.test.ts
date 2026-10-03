import { afterEach, describe, expect, it, vi } from "vitest";
import { subscribeToCommentChanges } from "@/features/community/client/subscribe-to-comment-changes";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("subscribeToCommentChanges", () => {
  it("rejects a malformed passage ID before creating a subscription", () => {
    expect(() =>
      subscribeToCommentChanges({ verseId: "not-a-uuid" }, vi.fn(), vi.fn()),
    ).toThrow("A valid verse or chapter ID is required");
  });

  it("surfaces missing Supabase configuration", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    expect(() =>
      subscribeToCommentChanges(
        { chapterId: "550e8400-e29b-41d4-a716-446655440000" },
        vi.fn(),
        vi.fn(),
      ),
    ).toThrow("Supabase browser access is unavailable");
  });
});
