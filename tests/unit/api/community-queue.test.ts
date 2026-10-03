import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as getRelationships } from "@/features/community/server/relationships";
import { GET as getReports } from "@/features/community/server/reports";
import { GET as getAppeals } from "@/features/community/server/appeals";
import { GET as getModerationQueue, POST as submitModerationDecision } from "@/features/moderation/server/handlers";

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
}));

vi.mock("@/lib/supabase/authenticated-user", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

const signedInUser = { id: "650e8400-e29b-41d4-a716-446655440000" };
const reportedCommentId = "550e8400-e29b-41d4-a716-446655440000";

function queryFor(table: string, records: Record<string, unknown[]>, profile: { role: string } | null) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    is: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: table === "profiles" ? profile : null, error: null })),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve({ data: records[table] ?? [], error: null }).then(resolve, reject),
  };
  return query;
}

function authenticated(profile: { role: string } | null, records: Record<string, unknown[]>, rpc = vi.fn()) {
  const supabase = { from: vi.fn((table: string) => queryFor(table, records, profile)), rpc };
  mocks.requireAuthenticatedUser.mockResolvedValue({ ok: true, user: signedInUser, supabase });
  return supabase;
}

afterEach(() => vi.clearAllMocks());

describe("community and moderation APIs", () => {
  it("returns only the current user's mute and block relationships", async () => {
    const relationship = {
      target_user_id: "750e8400-e29b-41d4-a716-446655440000",
      relationship_type: "mute",
      created_at: "2026-10-03T00:00:00.000Z",
    };
    const supabase = authenticated({ role: "reader" }, { user_relationships: [relationship] });

    const response = await getRelationships();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ relationships: [relationship] });
    const query = supabase.from.mock.results[0].value;
    expect(query.eq).toHaveBeenCalledWith("actor_user_id", signedInUser.id);
  });

  it("returns only the signed-in user's report and appeal statuses", async () => {
    const report = { id: "850e8400-e29b-41d4-a716-446655440000", comment_id: reportedCommentId, status: "resolved" };
    const appeal = { id: "a50e8400-e29b-41d4-a716-446655440000", comment_id: reportedCommentId, status: "overturned" };
    const supabase = authenticated({ role: "reader" }, {
      comment_reports: [report],
      comment_appeals: [appeal],
    });

    const reportResponse = await getReports();
    const appealResponse = await getAppeals();

    expect(reportResponse.status).toBe(200);
    await expect(reportResponse.json()).resolves.toEqual({ reports: [report] });
    expect(appealResponse.status).toBe(200);
    await expect(appealResponse.json()).resolves.toEqual({ appeals: [appeal] });
    expect(supabase.from).toHaveBeenCalledWith("comment_reports");
    expect(supabase.from).toHaveBeenCalledWith("comment_appeals");
  });

  it("rejects a non-moderator before querying protected queue items", async () => {
    const supabase = authenticated({ role: "reader" }, {});

    const response = await getModerationQueue();

    expect(response.status).toBe(403);
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it("returns pending comments, open reports with their context, and appeals to moderators", async () => {
    const pendingComment = {
      id: reportedCommentId,
      body: "A pending reflection.",
      user_id: signedInUser.id,
      status: "pending",
      created_at: "2026-10-03T00:00:00.000Z",
    };
    const report = {
      id: "850e8400-e29b-41d4-a716-446655440000",
      comment_id: reportedCommentId,
      reporter_id: "950e8400-e29b-41d4-a716-446655440000",
      reason: "spam",
      details: null,
      status: "open",
      created_at: "2026-10-03T00:00:00.000Z",
    };
    const appeal = {
      id: "a50e8400-e29b-41d4-a716-446655440000",
      comment_id: reportedCommentId,
      user_id: signedInUser.id,
      appeal_text: "Please review the context.",
      status: "open",
    };
    const supabase = authenticated({ role: "moderator" }, {
      comments: [pendingComment],
      comment_reports: [report],
      comment_appeals: [appeal],
    });

    const response = await getModerationQueue();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      comments: [pendingComment],
      reports: [{ ...report, comment: pendingComment }],
      appeals: [appeal],
    });
    expect(supabase.from).toHaveBeenCalledWith("comment_reports");
  });

  it("routes a reasoned moderator action through the moderator-checked RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    authenticated({ role: "moderator" }, {}, rpc);

    const response = await submitModerationDecision(new Request("http://localhost/api/moderation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "comment",
        id: reportedCommentId,
        status: "hidden",
        reason: "Contains targeted harassment.",
      }),
    }));

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("moderate_comment", {
      target_comment_id: reportedCommentId,
      next_status: "hidden",
      decision_reason: "Contains targeted harassment.",
    });
  });
});
