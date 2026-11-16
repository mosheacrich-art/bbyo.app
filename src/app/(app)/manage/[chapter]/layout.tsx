import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSession, permissions } from "@/lib/auth/session";
import { getChapters } from "@/lib/data";

export default async function ManageLayout({ children, params }: LayoutProps<"/manage/[chapter]">) {
  const { chapter: slug } = await params;
  const s = await requireSession();
  const chapters = await getChapters();
  const perm = permissions(s, chapters);
  const chapter = chapters.find((c) => c.slug === slug);
  if (!chapter) notFound();
  if (!perm.managedChapters.some((c) => c.id === chapter.id)) redirect("/");
  const tabs = [
    ["", "Resumen"], ["/people", "Personas"], ["/events", "Eventos"], ["/pipeline", "Prospects"], ["/money", "Dinero"], ["/invites", "Invitaciones"],
  ];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="h-display text-6xl">{chapter.name}</h1>
        {perm.managedChapters.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {perm.managedChapters.map((c) => (
              <Link key={c.id} href={`/manage/${c.slug}`} className={`rounded-full px-3 py-1 text-xs font-bold ${c.id === chapter.id ? "bg-indigo text-white" : "bg-mist text-indigo"}`}>{c.name}</Link>
            ))}
          </div>
        )}
      </div>
      <nav className="flex gap-1 overflow-x-auto border-b border-indigo/10 pb-3" aria-label="Gestión">
        {tabs.map(([p, l]) => <Link key={l} href={`/manage/${slug}${p}`} className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold text-indigo hover:bg-mist">{l}</Link>)}
      </nav>
      {children}
    </div>
  );
}
