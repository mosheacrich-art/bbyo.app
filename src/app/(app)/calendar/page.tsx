import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import { getChapters, LAYER_LABEL, type EventRow } from "@/lib/data";
import { EventCard } from "@/components/event-card";
import { monthOf } from "@/lib/format";

const sixHoursAgo = () => { const d = new Date(); d.setHours(d.getHours() - 6); return d.toISOString(); };
const LAYERS = ["todos", "global", "regional", "local"] as const;

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ capa?: string; chapter?: string; pasados?: string }> }) {
  await requireSession();
  const { capa = "todos", chapter, pasados } = await searchParams;
  const supabase = await createClient();
  const chapters = await getChapters();
  const byId = new Map(chapters.map((c) => [c.id, c]));
  const sel = chapters.find((c) => c.slug === chapter);

  let q = supabase.from("events").select("*").neq("status", "cancelado").order("starts_at");
  q = pasados ? q.lt("starts_at", new Date().toISOString()).order("starts_at", { ascending: false }) : q.gte("starts_at", sixHoursAgo());
  if (capa !== "todos" && LAYERS.includes(capa as never)) q = q.eq("layer", capa);
  if (sel) q = q.eq("chapter_id", sel.id);
  const { data } = await q;
  const events = (data ?? []) as EventRow[];
  const groups = new Map<string, EventRow[]>();
  events.forEach((e) => { const k = monthOf(e.starts_at); groups.set(k, [...(groups.get(k) ?? []), e]); });

  const href = (p: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    Object.entries({ capa, chapter, pasados, ...p }).forEach(([k, v]) => v && v !== "todos" && sp.set(k, v));
    return `/calendar${sp.size ? `?${sp}` : ""}`;
  };
  const pill = (on: boolean) => `rounded-full px-4 py-2 text-sm font-bold ${on ? "bg-indigo text-white" : "bg-mist text-indigo hover:bg-mist/70"}`;

  return (
    <div className="space-y-6">
      <h1 className="h-display text-6xl">Calendario</h1>
      <div className="flex flex-wrap gap-2">
        {LAYERS.map((l) => (
          <Link key={l} href={href({ capa: l })} className={pill(capa === l)}>{l === "todos" ? "Todo" : LAYER_LABEL[l]}</Link>
        ))}
        <span className="mx-1 w-px bg-indigo/20" />
        <Link href={href({ chapter: undefined })} className={pill(!sel)}>Todos los chapters</Link>
        {chapters.map((c) => <Link key={c.id} href={href({ chapter: c.slug })} className={pill(sel?.id === c.id)}>{c.name}</Link>)}
        <span className="mx-1 w-px bg-indigo/20" />
        <Link href={href({ pasados: pasados ? undefined : "1" })} className={pill(!!pasados)}>Pasados</Link>
      </div>
      {[...groups].map(([month, list]) => (
        <section key={month}>
          <h2 className="font-display mb-3 text-2xl font-extrabold uppercase text-indigo/70">{month}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {list.map((e) => <EventCard key={e.id} e={e} chapterName={e.chapter_id ? byId.get(e.chapter_id)?.name : undefined} />)}
          </div>
        </section>
      ))}
      {events.length === 0 && <p className="text-indigo/60">No hay eventos con estos filtros.</p>}
    </div>
  );
}
