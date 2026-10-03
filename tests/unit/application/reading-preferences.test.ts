import { describe, expect, it } from "vitest";
import {
  defaultReadingPreferences,
  parseReadingPreferences,
} from "@/features/application/reading-preferences";

describe("local reading preferences", () => {
  it("uses defaults when the browser has no saved preferences", () => {
    expect(defaultReadingPreferences).toEqual({ language: "English", dark: false });
  });

  it.each(["English", "తెలుగు", "हिन्दी"])("accepts the supported language %s", (language) => {
    expect(parseReadingPreferences(JSON.stringify({ language, dark: true }))).toEqual({
      language,
      dark: true,
    });
  });

  it("rejects malformed or unsupported preference values", () => {
    expect(parseReadingPreferences("{")).toBeNull();
    expect(parseReadingPreferences(JSON.stringify({ language: "Sanskrit (IAST)", dark: true }))).toBeNull();
    expect(parseReadingPreferences(JSON.stringify({ language: "English", dark: "yes" }))).toBeNull();
  });
});
