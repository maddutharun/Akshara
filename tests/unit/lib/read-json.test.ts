import { describe, expect, it } from "vitest";
import { readJsonBody } from "@/lib/api/read-json";

describe("bounded JSON request parsing", () => {
  it("parses a valid body under the configured byte limit", async () => {
    const result = await readJsonBody(
      new Request("http://localhost/api/test", {
        method: "POST",
        body: JSON.stringify({ value: "ok" }),
      }),
      128,
    );

    expect(result).toEqual({ value: { value: "ok" } });
  });

  it("rejects bodies over the byte limit", async () => {
    const result = await readJsonBody(
      new Request("http://localhost/api/test", {
        method: "POST",
        body: JSON.stringify({ value: "long" }),
      }),
      4,
    );

    expect("response" in result).toBe(true);
    if ("response" in result && result.response) {
      expect(result.response.status).toBe(413);
    }
  });

  it("returns a validation response for malformed JSON", async () => {
    const result = await readJsonBody(
      new Request("http://localhost/api/test", {
        method: "POST",
        body: "{",
      }),
      128,
    );

    expect("response" in result).toBe(true);
    if ("response" in result && result.response) {
      expect(result.response.status).toBe(400);
    }
  });
});
