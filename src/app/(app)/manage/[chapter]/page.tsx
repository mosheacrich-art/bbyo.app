import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getManagedChapter } from "@/lib/manage";
import { eur } from "@/lib/format";

export default async function Overview({ params }: PageProps<"/manage/[chapter]">) {
  const { chapter: slug } = await params;
  const { chapter, perm } = await getManagedChapter(slug);
  const supabase = await createClient();
  const now = new Date().toISOString();
  const c = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);
  const [people, upcoming, pending, prospects, paid, unpaid, pendingParents] = await Promise.all([
    c(supabase.from("profiles").select("id", { count: "exact", head: true }).eq("home_chapter_id", chapter.id)),
    c(supabase.from("events").select("id", { count: "exact", head: true }).eq("chapter_id", chapter.id).eq("status", "publicado").gte("starts_at", now)),
    c(supabase.from("events").select("id", { count: "exact", head: true }).eq("chapter_id", chapter.id).eq("status", "pendiente")),
    c(supabase.from("prospect_pipeline").select("person_id", { count: "exact", head: true }).eq("chapter_id", chapter.id).neq("stage", "miembro")),
    supabase.from("payments").select("amount_cents").eq("chapter_id", chapter.id).eq("status", "pagado"),
    c(supabase.from("memberships").select("id", { count: "exact", head: true }).eq("chapter_id", chapter.id).eq("paid", false)),
    c(supabase.from("registrations").select("id, events!inner(chapter_id)", { count: "exact", head: true }).eq("status", "pendiente_padres").eq("events.chapter_id", chapter.id)),
  ]);
  const total = (paid.data ?? []).reduce((a, p) => a + p.amount_cents, 0);
  const stats: [string, string | number, string?][] = [
    ["Personas", people], ["Eventos próximos", upcoming], ["Eventos por aprobar", pending, perm.canApprove ? `/manage/${slug}/events` : undefined],
    ["Prospects en seguimiento", prospects, `/manage/${slug}/pipeline`], ["Cobrado", eur(total) === "Gratis" ? "0 €" : eur(total), `/manage/${slug}/money`],
    ["Cuotas sin pagar", unpaid], ["Esperando a padres", pendingParents],
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map(([label, value, href]) => {
        const inner = <><p className="font-display text-5xl font-extrabold text-indigo">{value}</p><p className="text-sm font-bold text-indigo/70">{label}</p></>;
        return href ? <Link key={label} href={href} className="card hover:border-indigo/40">{inner}</Link> : <div key={label} className="card">{inner}</div>;
      })}
    </div>
  );
}
