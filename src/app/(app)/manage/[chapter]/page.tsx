import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getManagedChapter } from "@/lib/manage";
import { eur, dateShort } from "@/lib/format";
import { STATUS_LABEL, type RegStatus } from "@/lib/data";
import { CalendarDays, Coins, UserPlus, Users } from "lucide-react";

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
  const [{ data: evs }, { data: recentPays }] = await Promise.all([
    supabase.from("events").select("id, title").eq("chapter_id", chapter.id),
    supabase.from("payments").select("id, amount_cents, created_at, registration_id, profiles!payments_payer_id_fkey(full_name)").eq("chapter_id", chapter.id).eq("status", "pagado").order("created_at", { ascending: false }).limit(5),
  ]);
  const evTitle = new Map((evs ?? []).map((e) => [e.id as string, e.title as string]));
  const { data: recentRegs } = evTitle.size
    ? await supabase.from("registrations").select("id, event_id, status, created_at, profiles!registrations_person_id_fkey(full_name)").in("event_id", [...evTitle.keys()]).order("created_at", { ascending: false }).limit(8)
    : { data: [] };
  type Act = { at: string; what: string; who: string; status: string; tone: string };
  const activity: Act[] = [
    ...((recentRegs ?? []) as unknown as { created_at: string; event_id: string; status: string; profiles: { full_name: string } | null }[]).map((r) => ({
      at: r.created_at, what: `Inscripción · ${evTitle.get(r.event_id)}`, who: r.profiles?.full_name ?? "—", status: STATUS_LABEL[r.status as RegStatus],
      tone: r.status === "confirmada" ? "bg-pistachio/15 text-[#3d6e00]" : r.status === "cancelada" ? "bg-indigo/10 text-indigo/60" : "bg-sunrise/50 text-indigo",
    })),
    ...((recentPays ?? []) as unknown as { created_at: string; amount_cents: number; registration_id: string | null; profiles: { full_name: string } | null }[]).map((p) => ({
      at: p.created_at, what: `${p.registration_id ? "Pago de evento" : "Donación"} · ${eur(p.amount_cents)}`, who: p.profiles?.full_name ?? "—", status: "Pagado", tone: "bg-pistachio/15 text-[#3d6e00]",
    })),
  ].sort((x, y) => (x.at < y.at ? 1 : -1)).slice(0, 8);

  const total = (paid.data ?? []).reduce((a, p) => a + p.amount_cents, 0);
  const kpis = [
    { label: "Personas", value: people, sub: `${unpaid} cuotas sin pagar`, subTone: unpaid ? "text-jaffa" : "text-[#3d6e00]", icon: Users, href: `/manage/${slug}/people` },
    { label: "Eventos próximos", value: upcoming, sub: pending ? `${pending} por aprobar` : "Todo aprobado", subTone: pending ? "text-jaffa" : "text-[#3d6e00]", icon: CalendarDays, href: `/manage/${slug}/events` },
    { label: "Prospects", value: prospects, sub: "en seguimiento", subTone: "text-indigo/55", icon: UserPlus, href: `/manage/${slug}/pipeline` },
    { label: "Cobrado", value: total ? eur(total) : "0 €", sub: pendingParents ? `${pendingParents} esperando a padres` : "Sin pagos bloqueados", subTone: pendingParents ? "text-lox" : "text-[#3d6e00]", icon: Coins, href: `/manage/${slug}/money` },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="card transition hover:shadow-md">
            <p className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-indigo/55">{k.label}<k.icon size={16} className="text-indigo/40" aria-hidden /></p>
            <p className="mt-2 font-display text-4xl font-extrabold text-indigo sm:text-5xl">{k.value}</p>
            <p className={`mt-1 text-xs font-semibold ${k.subTone}`}>{k.sub}</p>
          </Link>
        ))}
      </div>
      <section className="overflow-hidden rounded-2xl border border-indigo/10 bg-white shadow-sm">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="font-extrabold text-indigo">Actividad reciente</h2>
          {perm.canApprove && pending > 0 && <Link href={`/manage/${slug}/events`} className="text-sm font-bold text-lox hover:underline">{pending} eventos por aprobar</Link>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-y border-indigo/10 bg-paper text-left text-[11px] font-bold uppercase tracking-wide text-indigo/50">
              <tr><th className="px-5 py-2.5">Acción</th><th className="px-5 py-2.5">Persona</th><th className="px-5 py-2.5">Fecha</th><th className="px-5 py-2.5">Estado</th></tr>
            </thead>
            <tbody className="divide-y divide-indigo/5">
              {activity.map((a, i) => (
                <tr key={i}>
                  <td className="px-5 py-3 font-semibold text-indigo">{a.what}</td>
                  <td className="px-5 py-3 text-indigo/75">{a.who}</td>
                  <td className="px-5 py-3 text-indigo/60">{dateShort(a.at)}</td>
                  <td className="px-5 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${a.tone}`}>{a.status}</span></td>
                </tr>
              ))}
              {activity.length === 0 && <tr><td colSpan={4} className="px-5 py-6 text-center text-indigo/50">Sin actividad todavía.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
