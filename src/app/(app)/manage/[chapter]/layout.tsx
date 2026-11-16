import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSession, permissions } from "@/lib/auth/session";
import { getChapters } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { ManageTabs } from "@/components/manage-tabs";

export default async function ManageLayout({ children, params }: LayoutProps<"/manage/[chapter]">) {
  const { chapter: slug } = await params;
  const s = await requireSession();
  const chapters = await getChapters();
  const perm = permissions(s, chapters);
  const chapter = chapters.find((c) => c.slug === slug);
  if (!chapter) notFound();
  if (!perm.managedChapters.some((c) => c.id === chapter.id)) redirect("/");
  const supabase = await createClient();
  const [{ count: pend }, { count: pros }] = await Promise.all([
    supabase.from("events").select("id", { count: "exact", head: true }).eq("chapter_id", chapter.id).eq("status", "pendiente"),
    supabase.from("prospect_pipeline").select("person_id", { count: "exact", head: true }).eq("chapter_id", chapter.id).neq("stage", "miembro"),
  ]);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 lg:pr-14">
        <div>
          <p className="eyebrow">Gestión del chapter</p>
          <h1 className="h-display mt-2 flex items-center gap-3 text-5xl md:text-6xl">
            <span className="h-4 w-4 rounded-full" style={{ background: chapter.accent ?? "#1a03b5" }} />{chapter.name}
          </h1>
        </div>
        {perm.managedChapters.length > 1 && (
          <div className="no-scrollbar flex max-w-full gap-1 overflow-x-auto">
            {perm.managedChapters.map((c) => (
              <Link key={c.id} href={`/manage/${c.slug}`} className={`chip text-xs ${c.id === chapter.id ? "chip-on" : ""}`}>{c.name}</Link>
            ))}
          </div>
        )}
      </div>
      <ManageTabs slug={slug} badges={{ "/events": pend ?? 0, "/pipeline": pros ?? 0 }} />
      {children}
    </div>
  );
}
