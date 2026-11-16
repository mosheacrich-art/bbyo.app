import "server-only";
import { notFound } from "next/navigation";
import { getChapters } from "@/lib/data";
import { requireSession, permissions } from "@/lib/auth/session";

export async function getManagedChapter(slug: string) {
  const session = await requireSession();
  const chapters = await getChapters();
  const perm = permissions(session, chapters);
  const chapter = chapters.find((c) => c.slug === slug);
  if (!chapter || !perm.managedChapters.some((c) => c.id === chapter.id)) notFound();
  return { session, chapter, perm };
}
