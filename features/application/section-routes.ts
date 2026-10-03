export const sectionPaths = {
  Home: "/",
  Library: "/library",
  Bookmarks: "/bookmarks",
  Community: "/community",
  Profile: "/profile",
} as const;

export type Section = keyof typeof sectionPaths;

export function getSectionFromPathname(pathname: string): Section {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  switch (normalizedPath) {
    case sectionPaths.Library:
      return "Library";
    case sectionPaths.Bookmarks:
      return "Bookmarks";
    case sectionPaths.Community:
      return "Community";
    case sectionPaths.Profile:
      return "Profile";
    default:
      return "Home";
  }
}
