export type ReadingLanguage = "English" | "తెలుగు" | "हिन्दी";

export type ReadingPreferences = {
  language: ReadingLanguage;
  dark: boolean;
};

export const defaultReadingPreferences: ReadingPreferences = {
  language: "English",
  dark: false,
};

export function parseReadingPreferences(raw: string): ReadingPreferences | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const language = candidate.language;
  const dark = candidate.dark;

  if (
    (language !== "English" && language !== "తెలుగు" && language !== "हिन्दी") ||
    typeof dark !== "boolean"
  ) {
    return null;
  }

  return { language, dark };
}
