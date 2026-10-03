import { describe, expect, it } from "vitest";
import {
  isSampleReaderPath,
  isSampleReaderRoute,
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
});
