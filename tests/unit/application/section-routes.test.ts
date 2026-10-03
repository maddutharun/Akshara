import { describe, expect, it } from "vitest";
import { getSectionFromPathname, sectionPaths } from "@/features/application/section-routes";

describe("application section routes", () => {
  it.each(Object.entries(sectionPaths))("maps %s to its addressable route", (section, path) => {
    expect(getSectionFromPathname(path)).toBe(section);
  });

  it("normalizes a trailing slash", () => {
    expect(getSectionFromPathname("/community/")).toBe("Community");
  });

  it("falls back to home for an unknown route", () => {
    expect(getSectionFromPathname("/unknown")).toBe("Home");
  });
});
