import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/translate/route";

describe("POST /api/translate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects malformed JSON with a clear client error", async () => {
    const response = await POST(
      new Request("http://localhost/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "invalid_request" });
  });

  it("rejects unsupported translation languages and modes", async () => {
    const response = await POST(
      new Request("http://localhost/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          textId: "demo-text",
          verseId: "11111111-1111-4111-8111-111111111111",
          targetLanguage: "Sanskrit (IAST)",
          mode: "explanation",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "invalid_request" });
  });

  it("rejects invalid verse identifiers", async () => {
    const response = await POST(
      new Request("http://localhost/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          textId: "demo-text",
          verseId: "not-a-uuid",
          targetLanguage: "English",
          mode: "explanation",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "invalid_request" });
  });

  it("rejects oversized requests before parsing", async () => {
    const response = await POST(
      new Request("http://localhost/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: " ".repeat(4097),
      }),
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ error: "request_too_large" });
  });

  it("returns an explicit unavailable response until an AI provider is configured", async () => {
    vi.stubEnv("AI_PROVIDER", "");
    vi.stubEnv("AI_API_KEY", "");
    const response = await POST(
      new Request("http://localhost/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          textId: "demo-text",
          verseId: "11111111-1111-4111-8111-111111111111",
          targetLanguage: "English",
          mode: "explanation",
        }),
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "provider_not_configured",
    });
  });
});
