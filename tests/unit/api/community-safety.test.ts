import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as reportComment } from "@/features/community/server/reports";
import { POST as createRelationship } from "@/features/community/server/relationships";

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
}));

vi.mock("@/lib/supabase/authenticated-user", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

const userId = "650e8400-e29b-41d4-a716-446655440000";
const targetUserId = "750e8400-e29b-41d4-a716-446655440000";
const commentId = "850e8400-e29b-41d4-a716-446655440000";

function authWith(query: object) {
  const supabase = { from: vi.fn(() => query) };
  mocks.requireAuthenticatedUser.mockResolvedValue({ ok: true, user: { id: userId }, supabase });
  return supabase;
}

function request(url: string, body: Record<string, unknown>) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => vi.clearAllMocks());

describe("community safety APIs", () => {
  it("records a report against an approved comment as the authenticated reporter", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const supabase = authWith({ insert });

    const response = await reportComment(request("http://localhost/api/community/reports", {
      commentId,
      reason: "misinformation",
      details: "This claim misrepresents the cited passage.",
    }));

    expect(response.status).toBe(201);
    expect(supabase.from).toHaveBeenCalledWith("comment_reports");
    expect(insert).toHaveBeenCalledWith({
      comment_id: commentId,
      reporter_id: userId,
      reason: "misinformation",
      details: "This claim misrepresents the cited passage.",
    });
  });

  it("returns a conflict when a user reports the same comment twice", async () => {
    const insert = vi.fn().mockResolvedValue({ error: { code: "23505" } });
    authWith({ insert });

    const response = await reportComment(request("http://localhost/api/community/reports", {
      commentId,
      reason: "spam",
      details: "",
    }));

    expect(response.status).toBe(409);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ reporter_id: userId }));
  });

  it("rejects self-blocking and invalid relationship types", async () => {
    const upsert = vi.fn();
    authWith({ upsert });
    const selfResponse = await createRelationship(request("http://localhost/api/community/relationships", {
      targetUserId: userId,
      relationshipType: "block",
    }));
    const invalidTypeResponse = await createRelationship(request("http://localhost/api/community/relationships", {
      targetUserId,
      relationshipType: "follow",
    }));

    expect(selfResponse.status).toBe(400);
    expect(invalidTypeResponse.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("stores block and mute actions for the authenticated actor only", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const supabase = authWith({ upsert });

    const response = await createRelationship(request("http://localhost/api/community/relationships", {
      targetUserId,
      relationshipType: "mute",
    }));

    expect(response.status).toBe(200);
    expect(supabase.from).toHaveBeenCalledWith("user_relationships");
    expect(upsert).toHaveBeenCalledWith({
      actor_user_id: userId,
      target_user_id: targetUserId,
      relationship_type: "mute",
    }, { onConflict: "actor_user_id,target_user_id,relationship_type" });
  });
});
