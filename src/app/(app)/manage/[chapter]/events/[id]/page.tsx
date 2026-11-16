import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getManagedChapter } from "@/lib/manage";
import { STATUS_LABEL, type RegStatus } from "@/lib/data";
import { dateLong, timeOf, eur, ageOn } from "@/lib/format";

async function checkIn(form: FormData) {
  "use server";
  const slug = String(form.get("slug"));
  await getManagedChapter(slug);
  const supabase = await createClient();
  await supabase.rpc("check_in", { p_reg: String(form.get("reg")) });
  revalidatePath(`/manage/${slug}/events/${String(form.get("event"))}`);
}

export default async function EventAttendees({ params }: PageProps<"/manage/[chapter]/events/[id]">) {
  const { chapter: slug, id } = await params;
  const { chapter } = await getManagedChapter(slug);
  const supabase = await createClient();
  const { data: e } = await supabase.from("events").select("*").eq("id", id).eq("chapter_id", chapter.id).maybeSingle();
  if (!e) notFound();
  const [{ data: regs }, { data: health }] = await Promise.all([
    supabase.from("registrations").select("id, status, checked_in_at, profiles!registrations_person_id_fkey(full_name, birth_date)").eq("event_id", id).order("created_at"),
    supabase.from("registration_health").select("registration_id, notes"),
  ]);
  const hm = new Map((health ?? []).map((h) => [h.registration_id, h.notes]));
  const rows = (regs ?? []) as unknown as { id: string; status: RegStatus; checked_in_at: string | null; profiles: { full_name: string; birth_date: string | null } }[];
  const active = rows.filter((r) => r.status !== "cancelada");
  const counts = (s: RegStatus) => rows.filter((r) => r.status === s).length;
  return (
    <div className="space-y-4">
      <div>
        <h2 className="h-display text-5xl">{e.title}</h2>
        <p className="first-letter:uppercase text-indigo/70">{dateLong(e.starts_at)} · {timeOf(e.starts_at)} · {eur(e.price_cents)} · {e.status}</p>
        <p className="mt-2 text-sm font-semibold text-indigo">
          {counts("confirmada")} confirmadas · {counts("pendiente_padres")} esperando padres · {counts("pendiente_pago")} sin pagar · {counts("lista_espera")} en espera · {rows.filter((r) => r.checked_in_at).length} han llegado
        </p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-indigo/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-mist text-xs uppercase text-indigo/70"><tr><th className="p-3">Nombre</th><th>Edad</th><th>Estado</th><th>Salud (solo durante el evento)</th><th></th></tr></thead>
          <tbody className="divide-y divide-indigo/10">
            {active.map((r) => (
              <tr key={r.id}>
                <td className="p-3 font-bold text-indigo">{r.profiles.full_name}</td>
                <td>{ageOn(r.profiles.birth_date) ?? "—"}</td>
                <td><span className="tag">{STATUS_LABEL[r.status]}</span></td>
                <td className="max-w-xs text-xs">{hm.get(r.id) ?? "—"}</td>
                <td className="pr-3 text-right">
                  {r.checked_in_at ? <span className="font-bold text-pistachio">✓ Llegó</span> : r.status === "confirmada" && (
                    <form action={checkIn}><input type="hidden" name="slug" value={slug} /><input type="hidden" name="reg" value={r.id} /><input type="hidden" name="event" value={id} />
                      <button className="btn btn-sm">Check-in</button></form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {active.length === 0 && <p className="p-4 text-indigo/60">Nadie inscrito todavía.</p>}
      </div>
    </div>
  );
}
