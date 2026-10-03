import { notFound } from "next/navigation";
import AksharaExperience from "@/features/application/components/experience";
import { isSampleReaderRoute } from "@/features/application/reader-route";

export default async function ReaderPage({
  params,
}: {
  params: Promise<{ textSlug: string; chapter: string }>;
}) {
  const { textSlug, chapter } = await params;
  if (!isSampleReaderRoute(textSlug, chapter)) notFound();

  return <AksharaExperience />;
}
