export const sampleReaderPath = "/reader/sanskrit-reading/1";
export const sampleReaderTextSlug = "sanskrit-reading";
export const sampleReaderChapter = "1";

export function isSampleReaderRoute(textSlug: string, chapter: string): boolean {
  return textSlug === sampleReaderTextSlug && chapter === sampleReaderChapter;
}

export function isSampleReaderPath(pathname: string): boolean {
  const match = /^\/reader\/([^/]+)\/([^/]+)\/?$/.exec(pathname);
  return match !== null && isSampleReaderRoute(match[1], match[2]);
}

export function parseReaderPath(pathname: string): { slug: string; chapter: number } | null {
  const match = /^\/reader\/([a-z0-9]+(?:-[a-z0-9]+)*)\/([1-9]\d{0,5})\/?$/.exec(pathname);
  if (!match) return null;
  return { slug: match[1], chapter: Number(match[2]) };
}

export function readerPath(slug: string, chapter: number): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !Number.isSafeInteger(chapter) || chapter < 1) {
    throw new Error("A valid text slug and positive chapter number are required.");
  }
  return `/reader/${slug}/${chapter}`;
}
