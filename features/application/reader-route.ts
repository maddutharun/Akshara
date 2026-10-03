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
