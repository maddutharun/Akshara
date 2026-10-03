import { describe, expect, it } from "vitest";
import {
  isSampleReaderPath,
  isSampleReaderRoute,
  parseReaderPath,
  readerPath,
  sampleReaderPath,
} from "@/features/application/reader-route";

describe("sample reader route", () => {
  it("resolves the only available preview chapter", () => {
    expect(isSampleReaderRoute("sanskrit-reading", "1")).toBe(true);
    expect(isSampleReaderPath(sampleReaderPath)).toBe(true);
  });

  it("does not present unavailable texts or chapters as real content", () => {
    expect(isSampleReaderRoute("unknown-text", "1")).toBe(false);
    expect(isSampleReaderRoute("sanskrit-reading", "2")).toBe(false);
    expect(isSampleReaderPath("/reader/sanskrit-reading/2")).toBe(false);
  });

  it("parses safe database-backed text and chapter locations", () => {
    expect(parseReaderPath("/reader/bhagavad-gita/18")).toEqual({ slug: "bhagavad-gita", chapter: 18 });
    expect(parseReaderPath("/reader/bhagavad-gita/0")).toBeNull();
    expect(parseReaderPath("/reader/../../profile/1")).toBeNull();
    expect(readerPath("bhagavad-gita", 18)).toBe("/reader/bhagavad-gita/18");
    expect(() => readerPath("../profile", 1)).toThrow();
  });
});
