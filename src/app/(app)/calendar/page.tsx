import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, List } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import { getChapters, LAYER_LABEL, type EventRow } from "@/lib/data";
import { EventListCard } from "@/components/event-poster";
import { PageHeader } from "@/components/page-header";
import { monthOf, timeOf } from "@/lib/format";

export const metadata = { title: "Eventos" };

const sixHoursAgo = () => { const d = new Date(); d.setHours(d.getHours() - 6); return d.toISOString(); };
const LAYERS = ["todos", "global", "regional", "local"] as const;
const WHEN = [["todo", "Todos"], ["semana", "Esta semana"], ["mes", "Este mes"], ["mios", "Para mí"]] as const;
const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(d);

type SP = { capa?: string; chapter?: string; pasados?: string; cuando?: string; vista?: string; mes?: string };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await requireSession();
  const sp = await searchParams;
  const { capa = "todos", chapter, pasados, cuando = "todo", vista = "lista" } = sp;
  const supabase = await createClient();
  const chapters = await getChapters();
  const byId = new Map(chapters.map((c) => [c.id, c]));
  const sel = chapters.find((c) => c.slug === chapter);

  // Mes que se muestra en la vista calendario
  const today = new Date();
  const [my, mm] = (sp.mes?.match(/^(\d{4})-(\d{2})$/) ? sp.mes.split("-").map(Number) : [today.getFullYear(), today.getMonth() + 1]);
  const monthStart = new Date(my, mm - 1, 1);
  const monthEnd = new Date(my, mm, 1);

  let q = supabase.from("events").select("*").neq("status", "cancelado").order("starts_at", { ascending: !pasados || vista === "mes" });
  if (vista === "mes") q = q.gte("starts_at", monthStart.toISOString()).lt("starts_at", monthEnd.toISOString());
  else if (pasados) q = q.lt("starts_at", new Date().toISOString());
  else {
    q = q.gte("starts_at", sixHoursAgo());
    if (cuando === "semana") q = q.lt("starts_at", new Date(today.getTime() + 7 * 864e5).toISOString());
    if (cuando === "mes") q = q.lt("starts_at", new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString());
  }
  if (capa !== "todos" && LAYERS.includes(capa as never)) q = q.eq("layer", capa);
  if (sel) q = q.eq("chapter_id", sel.id);
  const [{ data }, { data: regs }] = await Promise.all([
    q,
    supabase.from("registrations").select("event_id, person_id, status").neq("status", "cancelada"),
  ]);
  const mine = new Set((regs ?? []).filter((r) => r.person_id === session.id).map((r) => r.event_id as string));
  const seats = new Map<string, number>();
  (regs ?? []).filter((r) => ["confirmada", "pendiente_pago"].includes(r.status)).forEach((r) => seats.set(r.event_id, (seats.get(r.event_id) ?? 0) + 1));
  let events = (data ?? []) as EventRow[];
  if (cuando === "mios" && vista !== "mes") events = events.filter((e) => mine.has(e.id));

  const href = (p: Partial<SP>) => {
    const out = new URLSearchParams();
    Object.entries({ capa, chapter, pasados, cuando, vista, mes: sp.mes, ...p }).forEach(([k, v]) => v && !["todos", "todo", "lista"].includes(v) && out.set(k, v));
    return `/calendar${out.size ? `?${out}` : ""}`;
  };
  const accent = (e: EventRow) => (e.chapter_id ? byId.get(e.chapter_id)?.accent : e.layer === "regional" ? "#e42158" : "#1a03b5") ?? "#1a03b5";

  const groups = new Map<string, EventRow[]>();
  events.forEach((e) => { const k = monthOf(e.starts_at); groups.set(k, [...(groups.get(k) ?? []), e]); });

  // Rejilla del mes (lunes primero)
  const lead = (monthStart.getDay() + 6) % 7;
  const daysIn = new Date(my, mm, 0).getDate();
  const cells = Array.from({ length: Math.ceil((lead + daysIn) / 7) * 7 }, (_, i) => {
    const day = i - lead + 1;
    return day >= 1 && day <= daysIn ? new Date(my, mm - 1, day) : null;
  });
  const byDay = new Map<string, EventRow[]>();
  events.forEach((e) => { const k = ymd(new Date(e.starts_at)); byDay.set(k, [...(byDay.get(k) ?? []), e]); });
  const shift = (n: number) => { const d = new Date(my, mm - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
  const todayKey = ymd(today);

  return (
    <div>
      <PageHeader eyebrow="Calendario" title="Eventos" subtitle="Programas del chapter, de España y de BBYO en todo el mundo."
        actions={
          <div className="flex rounded-xl border border-indigo/10 bg-white p-1 text-sm font-semibold shadow-sm">
            <Link href={href({ vista: "lista" })} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 ${vista !== "mes" ? "bg-mist text-indigo" : "text-indigo/60"}`}><List size={15} aria-hidden />Lista</Link>
            <Link href={href({ vista: "mes" })} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 ${vista === "mes" ? "bg-mist text-indigo" : "text-indigo/60"}`}><CalendarDays size={15} aria-hidden />Mes</Link>
          </div>
        } />

      <div className="space-y-3">
        {vista !== "mes" && (
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {WHEN.map(([k, l]) => <Link key={k} href={href({ cuando: k, pasados: undefined })} className={`chip ${!pasados && cuando === k ? "chip-on" : ""}`}>{l}</Link>)}
            <Link href={href({ pasados: pasados ? undefined : "1", cuando: undefined })} className={`chip ${pasados ? "chip-on" : ""}`}>Pasados</Link>
          </div>
        )}
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {LAYERS.map((l) => <Link key={l} href={href({ capa: l })} className={`chip text-xs ${capa === l ? "chip-on" : ""}`}>{l === "todos" ? "Todas las capas" : LAYER_LABEL[l]}</Link>)}
          <span className="mx-1 w-px shrink-0 bg-indigo/15" />
          <Link href={href({ chapter: undefined })} className={`chip text-xs ${!sel ? "chip-on" : ""}`}>Todos los chapters</Link>
          {chapters.map((c) => (
            <Link key={c.id} href={href({ chapter: c.slug })} className={`chip text-xs ${sel?.id === c.id ? "chip-on" : ""}`}>
              <span className="h-2 w-2 rounded-full" style={{ background: c.accent ?? "#1a03b5" }} />{c.name}
            </Link>
          ))}
        </div>
      </div>

      {vista === "mes" ? (
        <section className="mt-6 overflow-hidden rounded-2xl border border-indigo/10 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-indigo/10 px-4 py-3">
            <Link href={href({ mes: shift(-1) })} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-mist" aria-label="Mes anterior"><ChevronLeft size={18} /></Link>
            <h2 className="font-display text-2xl font-extrabold uppercase text-indigo">{monthOf(monthStart.toISOString())}</h2>
            <Link href={href({ mes: shift(1) })} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-mist" aria-label="Mes siguiente"><ChevronRight size={18} /></Link>
          </div>
          <div className="grid grid-cols-7 border-b border-indigo/10 bg-paper text-center text-xs font-bold text-indigo/50">
            {WEEKDAYS.map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((d, i) => {
              const list = d ? byDay.get(ymd(d)) ?? [] : [];
              const isToday = d && ymd(d) === todayKey;
              return (
                <div key={i} className={`min-h-20 border-b border-r border-indigo/5 p-1 sm:min-h-28 sm:p-1.5 ${d ? "" : "bg-paper/60"}`}>
                  {d && <span className={`mb-1 grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${isToday ? "bg-lox text-white" : "text-indigo/60"}`}>{d.getDate()}</span>}
                  <div className="space-y-1">
                    {list.map((e) => (
                      <Link key={e.id} href={`/events/${e.id}`} title={e.title}
                        className="block truncate rounded px-1 py-0.5 text-[10px] font-semibold text-white sm:px-1.5 sm:text-[11px]" style={{ background: accent(e) }}>
                        <span className="hidden sm:inline">{timeOf(e.starts_at)} </span>{e.title}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <div className="mt-8 space-y-10">
          {[...groups].map(([month, list]) => (
            <section key={month}>
              <h2 className="mb-4 font-display text-2xl font-extrabold uppercase text-indigo/60">{month}</h2>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((e) => (
                  <EventListCard key={e.id} e={e} accent={e.chapter_id ? byId.get(e.chapter_id)?.accent : null}
                    chapterName={e.chapter_id ? byId.get(e.chapter_id)?.name : undefined}
                    badge={mine.has(e.id) ? "Inscrito" : undefined} seats={seats.get(e.id)} />
                ))}
              </div>
            </section>
          ))}
          {events.length === 0 && <p className="card text-center text-indigo/60">No hay eventos con estos filtros.</p>}
        </div>
      )}
    </div>
  );
}
