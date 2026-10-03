import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/auth/sign-in/route";

describe("POST /api/auth/sign-in", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects malformed and invalid email requests", async () => {
    const response = await POST(
      new Request("http://localhost/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "not-an-email" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "invalid_email" });
  });

  it("returns an explicit unavailable response when Supabase is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    const response = await POST(
      new Request("http://localhost/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "reader@example.com" }),
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: "auth_not_configured" });
  });
});
