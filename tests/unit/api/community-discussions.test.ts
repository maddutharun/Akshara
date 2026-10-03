import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/features/community/server/comments";

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

const ids = {
  user: "650e8400-e29b-41d4-a716-446655440000",
  text: "750e8400-e29b-41d4-a716-446655440000",
  chapter: "850e8400-e29b-41d4-a716-446655440000",
  verse: "950e8400-e29b-41d4-a716-446655440000",
  comment: "a50e8400-e29b-41d4-a716-446655440000",
};

function queryFor(
  table: string,
  records: Record<string, unknown>,
  insertResult?: unknown,
) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    in: vi.fn(() => query),
    insert: vi.fn(() => query),
    single: vi.fn(async () => ({ data: insertResult ?? null, error: null })),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve({ data: records[table] ?? [], error: null }).then(resolve, reject),
  };
  return query;
}

afterEach(() => vi.clearAllMocks());

describe("passage discussion API", () => {
  it("rejects malformed or ambiguous discussion locations before connecting", async () => {
    mocks.createSupabaseServerClient.mockResolvedValue({ from: vi.fn() });
    const response = await GET(new Request("http://localhost/api/community/comments?verseId=bad&chapterId=bad"));

    expect(response.status).toBe(400);
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("loads a passage thread with safe public display names", async () => {
    const comment = {
      id: ids.comment,
      user_id: ids.user,
      text_id: ids.text,
      chapter_id: ids.chapter,
      verse_id: ids.verse,
      parent_comment_id: null,
      body: "A thoughtful reflection.",
      language: "en",
      status: "approved",
      edited_at: null,
      created_at: "2026-10-03T00:00:00.000Z",
    };
    const queries = new Map<string, ReturnType<typeof queryFor>>();
    const supabase = {
      from: vi.fn((table: string) => {
        const query = queryFor(table, {
          comments: [comment],
          profiles: [{ id: ids.user, display_name: "Reader" }],
        });
        queries.set(table, query);
        return query;
      }),
    };
    mocks.createSupabaseServerClient.mockResolvedValue(supabase);

    const response = await GET(new Request(`http://localhost/api/community/comments?verseId=${ids.verse}`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      comments: [{ ...comment, author_name: "Reader" }],
    });
    expect(queries.get("comments")?.eq).toHaveBeenCalledWith("verse_id", ids.verse);
    expect(queries.get("profiles")?.in).toHaveBeenCalledWith("id", [ids.user]);
  });

  it("submits a pending reply tied to the authenticated account and passage", async () => {
    const insertResult = {
      id: ids.comment,
      text_id: ids.text,
      chapter_id: ids.chapter,
      verse_id: ids.verse,
      parent_comment_id: ids.comment,
      body: "A considered reply.",
      language: "te",
      status: "pending",
      created_at: "2026-10-03T00:00:00.000Z",
    };
    const query = queryFor("comments", {}, insertResult);
    const supabase = { from: vi.fn(() => query) };
    mocks.requireAuthenticatedUser.mockResolvedValue({ ok: true, user: { id: ids.user }, supabase });

    const response = await POST(new Request("http://localhost/api/community/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        textId: ids.text,
        chapterId: ids.chapter,
        verseId: ids.verse,
        parentCommentId: ids.comment,
        body: "  A considered reply.  ",
        language: "te",
      }),
    }));

    expect(response.status).toBe(201);
    expect(query.insert).toHaveBeenCalledWith({
      user_id: ids.user,
      text_id: ids.text,
      chapter_id: ids.chapter,
      verse_id: ids.verse,
      parent_comment_id: ids.comment,
      body: "A considered reply.",
      language: "te",
      status: "pending",
    });
    await expect(response.json()).resolves.toMatchObject({
      comment: { status: "pending", parent_comment_id: ids.comment },
    });
  });
});
