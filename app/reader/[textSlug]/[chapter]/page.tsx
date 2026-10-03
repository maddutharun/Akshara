import { notFound } from "next/navigation";
import AksharaExperience from "@/features/application/components/experience";
import { isSampleReaderRoute } from "@/features/application/reader-route";

export default async function ReaderPage({
  params,
}: {
  params: Promise<{ textSlug: string; chapter: string }>;
}) {
  const { textSlug, chapter } = await params;
  if (
    !isSampleReaderRoute(textSlug, chapter) &&
    (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(textSlug) || !/^[1-9]\d{0,5}$/.test(chapter))
  ) notFound();

  return <AksharaExperience />;
}
