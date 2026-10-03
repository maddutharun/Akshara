import { afterEach, describe, expect, it, vi } from "vitest";
import { DELETE, PATCH } from "@/features/community/server/comments";
import { POST as submitAppeal } from "@/features/community/server/appeals";

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
}));

vi.mock("@/lib/supabase/authenticated-user", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

const validCommentId = "550e8400-e29b-41d4-a716-446655440000";

function authenticatedWith(supabase: object) {
  mocks.requireAuthenticatedUser.mockResolvedValue({
    ok: true,
    supabase,
    user: { id: "650e8400-e29b-41d4-a716-446655440000" },
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("community comment author controls", () => {
  it("edits a comment through the owner-scoped database policy", async () => {
    const query = {
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: validCommentId, body: "An edited reflection.", edited_at: "2026-10-02T00:00:00Z" },
        error: null,
      }),
    };
    query.update.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.select.mockReturnValue(query);
    const supabase = { from: vi.fn().mockReturnValue(query) };
    authenticatedWith(supabase);

    const response = await PATCH(new Request("http://localhost/api/community/comments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId: validCommentId, body: "  An edited reflection.  " }),
    }));

    expect(response.status).toBe(200);
    expect(query.update).toHaveBeenCalledWith({ body: "An edited reflection." });
    await expect(response.json()).resolves.toMatchObject({
      comment: { id: validCommentId, body: "An edited reflection." },
    });
  });

  it("rejects invalid comment IDs before calling the delete RPC", async () => {
    const rpc = vi.fn();
    authenticatedWith({ rpc });

    const response = await DELETE(new Request("http://localhost/api/community/comments?id=bad", {
      method: "DELETE",
    }));

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("soft-deletes via the owner-checked RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    authenticatedWith({ rpc });

    const response = await DELETE(new Request(
      `http://localhost/api/community/comments?id=${validCommentId}`,
      { method: "DELETE" },
    ));

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("soft_delete_own_comment", {
      target_comment_id: validCommentId,
    });
    await expect(response.json()).resolves.toEqual({ deleted: true });
  });

  it("submits an appeal through the RLS-protected table", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn().mockReturnValue({ insert }) };
    authenticatedWith(supabase);

    const response = await submitAppeal(new Request("http://localhost/api/community/appeals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId: validCommentId, appealText: "Please review the context." }),
    }));

    expect(response.status).toBe(201);
    expect(supabase.from).toHaveBeenCalledWith("comment_appeals");
    expect(insert).toHaveBeenCalledWith({
      comment_id: validCommentId,
      user_id: "650e8400-e29b-41d4-a716-446655440000",
      appeal_text: "Please review the context.",
    });
  });

  it("returns a conflict when the database rejects a duplicate appeal", async () => {
    const insert = vi.fn().mockResolvedValue({ error: { code: "23505" } });
    authenticatedWith({ from: vi.fn().mockReturnValue({ insert }) });

    const response = await submitAppeal(new Request("http://localhost/api/community/appeals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId: validCommentId, appealText: "Please review the context." }),
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: "appeal_already_submitted" });
  });
});
