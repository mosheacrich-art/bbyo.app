import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import { getChapters, STATUS_LABEL, LAYER_LABEL, type EventRow, type RegRow } from "@/lib/data";
import { dateLong, timeOf, eur } from "@/lib/format";
import { ActionForm } from "@/components/forms";
import { registerAction, authorizeAction, cancelAction, payAction } from "../actions";

export default async function EventPage({ params, searchParams }: PageProps<"/events/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await requireSession();
  const supabase = await createClient();
  const { data: ev } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (!ev) notFound();
  const e = ev as EventRow;
  const chapters = await getChapters();
  const chapter = chapters.find((c) => c.id === e.chapter_id);

  const [{ data: regsData }, { data: kids }, { data: seats }] = await Promise.all([
    supabase.from("registrations").select("id, event_id, person_id, registered_by, status, checked_in_at, profiles!registrations_person_id_fkey(full_name)").eq("event_id", id).neq("status", "cancelada"),
    supabase.from("guardianships").select("child_id, profiles!guardianships_child_id_fkey(full_name)").eq("guardian_id", session.id).eq("verified", true),
    supabase.rpc("occupied_seats", { eid: id }),
  ]);
  const regs = (regsData ?? []) as unknown as (RegRow & { profiles: { full_name: string } | null })[];
  const people = [
    { id: session.id, name: "Yo", age: null as number | null },
    ...(kids ?? []).map((k) => ({ id: k.child_id as string, name: (k.profiles as unknown as { full_name: string } | null)?.full_name ?? "Hijo/a", age: null })),
  ];
  const regOf = (pid: string) => regs.find((r) => r.person_id === pid);
  const open = e.status === "publicado" && new Date(e.starts_at) > new Date();
  const full = e.capacity != null && (seats as number | null) != null && (seats as number) >= e.capacity;

  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <Link href="/calendar" className="text-sm font-bold text-indigo underline">← Calendario</Link>
      <header>
        <div className="flex flex-wrap gap-1.5">
          <span className="tag">{e.layer === "local" ? chapter?.name : LAYER_LABEL[e.layer]}</span>
          {e.overnight && <span className="tag">Con pernocta</span>}
          {e.boards_only && <span className="tag">Solo boards</span>}
          {e.status !== "publicado" && <span className="tag bg-sunrise">{e.status}</span>}
        </div>
        <h1 className="h-display mt-2 text-6xl">{e.title}</h1>
        <p className="mt-3 text-lg font-semibold text-indigo/80 capitalize">{dateLong(e.starts_at)} · {timeOf(e.starts_at)}{e.ends_at ? `–${timeOf(e.ends_at)}` : ""}</p>
        <p className="text-indigo/70">{e.location || "Lugar por confirmar"} · {eur(e.price_cents)}{e.capacity ? ` · ${seats ?? 0}/${e.capacity} plazas` : ""}</p>
      </header>

      {sp.pago === "ok" && <p className="rounded-xl bg-pistachio/15 p-3 font-semibold text-indigo">Pago recibido. Inscripción confirmada.</p>}
      {sp.pago === "cancelado" && <p className="rounded-xl bg-jaffa/10 p-3 font-semibold text-indigo">Pago cancelado. Puedes intentarlo de nuevo cuando quieras.</p>}
      {e.description && <p className="whitespace-pre-line text-lg text-indigo/90">{e.description}</p>}

      <section className="space-y-4">
        <h2 className="text-2xl font-extrabold text-indigo">Inscripción</h2>
        {!open && <p className="text-indigo/70">Las inscripciones no están abiertas para este evento.</p>}
        {people.map((p) => {
          const r = regOf(p.id);
          const mine = p.id === session.id;
          return (
            <div key={p.id} className="card">
              <div className="flex items-center justify-between gap-3">
                <b>{mine ? "Yo" : p.name}</b>
                {r && <span className="tag">{STATUS_LABEL[r.status]}</span>}
              </div>
              {!r && open && (
                <ActionForm action={registerAction} hidden={{ event: e.id, person: p.id }} submit={full ? "Apuntarme a la lista de espera" : "Inscribir"}>
                  {(e.overnight || e.price_cents > 0) && (
                    <p className="mt-2 text-sm text-indigo/70">
                      {e.overnight ? "Con pernocta" : "De pago"}: si eres menor de edad lo autorizará un padre o tutor verificado.
                    </p>
                  )}
                  <label className="label mt-3" htmlFor={`h-${p.id}`}>Alergias o salud (opcional)</label>
                  <textarea id={`h-${p.id}`} name="health" rows={2} className="input" placeholder="Solo lo verá quien organiza el evento, durante el evento." />
                </ActionForm>
              )}
              {r?.status === "pendiente_padres" && !mine && (
                <ActionForm action={authorizeAction} hidden={{ reg: r.id, event: e.id }} submit="Autorizar su asistencia">
                  <label className="label mt-3" htmlFor={`a-${r.id}`}>Alergias o salud</label>
                  <textarea id={`a-${r.id}`} name="health" rows={2} className="input" />
                </ActionForm>
              )}
              {r?.status === "pendiente_pago" && (
                <form action={payAction} className="mt-3">
                  <input type="hidden" name="reg" value={r.id} /><input type="hidden" name="event" value={e.id} />
                  <button className="btn btn-sm">Pagar {eur(e.price_cents)}</button>
                </form>
              )}
              {r && !r.checked_in_at && (
                <form action={cancelAction} className="mt-3">
                  <input type="hidden" name="reg" value={r.id} /><input type="hidden" name="event" value={e.id} />
                  <button className="text-sm font-bold text-lox underline">Cancelar inscripción</button>
                </form>
              )}
              {r?.checked_in_at && <p className="mt-2 text-sm font-semibold text-pistachio">Asistencia registrada ✓</p>}
            </div>
          );
        })}
      </section>
    </article>
  );
}
