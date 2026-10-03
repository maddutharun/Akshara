import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TranslationProviderError,
  translateWithProvider,
} from "@/features/translation/server/provider";

const input = {
  devanagariText: "विद्या ददाति विनयम्",
  iastText: "vidyā dadāti vinayam",
  sourceTitle: "Approved edition",
  chapterNumber: 1,
  verseNumber: 2,
  targetLanguage: "te" as const,
  mode: "literal" as const,
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("server-side translation provider", () => {
  it("sends a bounded, no-store request and returns the configured model output", async () => {
    vi.stubEnv("AI_PROVIDER", "openai-compatible");
    vi.stubEnv("AI_API_KEY", "secret-token");
    vi.stubEnv("AI_MODEL", "approved-model");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "విద్య వినయాన్ని ఇస్తుంది." } }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await translateWithProvider(input);

    expect(result).toMatchObject({
      output: "విద్య వినయాన్ని ఇస్తుంది.",
      provider: "openai-compatible",
      model: "approved-model",
      promptVersion: "akshara-translation-v1",
    });
    const [, init] = fetchMock.mock.calls[0];
    expect(init).toMatchObject({
      method: "POST",
      cache: "no-store",
      headers: { Authorization: "Bearer secret-token" },
    });
    const payload = JSON.parse(init.body as string);
    expect(payload.max_tokens).toBe(512);
    expect(payload.messages[0].content).toContain("Telugu");
    expect(payload.messages[1].content).toContain(input.devanagariText);
  });

  it("does not make a provider request without server-side credentials", async () => {
    vi.stubEnv("AI_PROVIDER", "");
    vi.stubEnv("AI_API_KEY", "");
    vi.stubEnv("AI_MODEL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(translateWithProvider(input)).rejects.toMatchObject({
      code: "provider_not_configured",
      status: 503,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects insecure custom provider endpoints outside local development", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_PROVIDER", "openai-compatible");
    vi.stubEnv("AI_API_KEY", "secret-token");
    vi.stubEnv("AI_MODEL", "approved-model");
    vi.stubEnv("AI_API_URL", "http://provider.invalid/v1/chat/completions");

    await expect(translateWithProvider(input)).rejects.toBeInstanceOf(TranslationProviderError);
    await expect(translateWithProvider(input)).rejects.toMatchObject({ code: "provider_not_configured" });
  });

  it("rejects invalid output limits rather than silently widening the provider call", async () => {
    vi.stubEnv("AI_PROVIDER", "openai-compatible");
    vi.stubEnv("AI_API_KEY", "secret-token");
    vi.stubEnv("AI_MODEL", "approved-model");
    vi.stubEnv("AI_MAX_OUTPUT_TOKENS", "50000");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(translateWithProvider(input)).rejects.toMatchObject({
      code: "provider_not_configured",
      status: 503,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps provider throttling and malformed output to explicit errors", async () => {
    vi.stubEnv("AI_PROVIDER", "openai-compatible");
    vi.stubEnv("AI_API_KEY", "secret-token");
    vi.stubEnv("AI_MODEL", "approved-model");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 429 })));
    await expect(translateWithProvider(input)).rejects.toMatchObject({
      code: "provider_rate_limited",
      status: 503,
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [] }), { status: 200 })));
    await expect(translateWithProvider(input)).rejects.toMatchObject({
      code: "provider_invalid_response",
      status: 502,
    });
  });
});
