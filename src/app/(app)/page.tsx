import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getChapters, STATUS_LABEL, type EventRow, type RegRow } from "@/lib/data";
import { EventCard } from "@/components/event-card";

export default async function Home() {
  const session = await requireSession();
  const supabase = await createClient();
  const chapters = await getChapters();
  const byId = new Map(chapters.map((c) => [c.id, c]));
  const nowIso = new Date().toISOString();

  const [{ data: events }, { data: regs }, { data: kids }] = await Promise.all([
    supabase.from("events").select("*").eq("status", "publicado").gte("starts_at", nowIso).order("starts_at").limit(6),
    supabase.from("registrations").select("id, event_id, person_id, registered_by, status, checked_in_at, events(title, starts_at)").neq("status", "cancelada").order("created_at", { ascending: false }),
    supabase.from("guardianships").select("child_id, verified, profiles!guardianships_child_id_fkey(full_name)").eq("guardian_id", session.id),
  ]);
  const names = new Map<string, string>([[session.id, "Tú"]]);
  (kids ?? []).forEach((k) => names.set(k.child_id, (k.profiles as unknown as { full_name: string } | null)?.full_name ?? "Hijo/a"));
  const pendingParent = (regs ?? []).filter((r) => r.status === "pendiente_padres" && r.person_id !== session.id);
  const toPay = (regs ?? []).filter((r) => r.status === "pendiente_pago");
  const mine = (regs ?? []).filter((r) => ["confirmada", "lista_espera", "pendiente_padres", "pendiente_pago"].includes(r.status)).slice(0, 5);
  const noRole = session.assignments.length === 0;

  return (
    <div className="space-y-10">
      <section>
        <p className="text-sm font-bold uppercase tracking-widest text-indigo/60">Hola</p>
        <h1 className="h-display text-6xl md:text-7xl">{session.profile.full_name.split(" ")[0] || "bienvenido/a"}</h1>
      </section>

      {noRole && (
        <section className="card border-2 border-indigo bg-mist">
          <h2 className="text-xl font-extrabold text-indigo">Todavía no estás en ningún chapter</h2>
          <p className="mt-1 text-indigo/80">Pide un código de invitación a tu chapter board y úsalo aquí.</p>
          <Link href="/unirse" className="btn mt-4">Tengo un código</Link>
        </section>
      )}

      {(pendingParent.length > 0 || toPay.length > 0) && (
        <section className="space-y-3">
          <h2 className="text-xl font-extrabold text-indigo">Necesita tu atención</h2>
          {pendingParent.map((r) => (
            <Link key={r.id} href={`/events/${r.event_id}`} className="card flex items-center justify-between border-lox/40 bg-lox/5">
              <span><b>{names.get(r.person_id) ?? "Tu hijo/a"}</b> quiere ir a <b>{(r.events as unknown as { title: string }).title}</b></span>
              <span className="btn btn-sm">Autorizar</span>
            </Link>
          ))}
          {toPay.map((r) => (
            <Link key={r.id} href={`/events/${r.event_id}`} className="card flex items-center justify-between border-jaffa/40 bg-jaffa/5">
              <span>Pago pendiente: <b>{(r.events as unknown as { title: string }).title}</b> ({names.get(r.person_id) ?? ""})</span>
              <span className="btn btn-sm">Pagar</span>
            </Link>
          ))}
        </section>
      )}

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-2xl font-extrabold text-indigo">Próximos eventos</h2>
          <Link href="/calendar" className="text-sm font-bold text-indigo underline">Ver calendario</Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {((events ?? []) as EventRow[]).map((e) => (
            <EventCard key={e.id} e={e} chapterName={e.chapter_id ? byId.get(e.chapter_id)?.name : undefined} />
          ))}
          {(events ?? []).length === 0 && <p className="text-indigo/60">No hay eventos próximos.</p>}
        </div>
      </section>

      {mine.length > 0 && (
        <section>
          <h2 className="mb-3 text-2xl font-extrabold text-indigo">Mis inscripciones</h2>
          <ul className="divide-y divide-indigo/10 rounded-2xl border border-indigo/10">
            {mine.map((r) => (
              <li key={r.id}>
                <Link href={`/events/${r.event_id}`} className="flex items-center justify-between p-4 hover:bg-mist/40">
                  <span><b>{(r.events as unknown as { title: string }).title}</b>{r.person_id !== session.id && <span className="text-indigo/60"> · {names.get(r.person_id)}</span>}</span>
                  <span className="tag">{STATUS_LABEL[r.status as RegRow["status"]]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
