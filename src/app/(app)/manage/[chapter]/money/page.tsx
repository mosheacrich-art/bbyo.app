import { createClient } from "@/lib/supabase/server";
import { getManagedChapter } from "@/lib/manage";
import { eur, dateShort } from "@/lib/format";

export default async function Money({ params }: PageProps<"/manage/[chapter]/money">) {
  const { chapter: slug } = await params;
  const { chapter } = await getManagedChapter(slug);
  const supabase = await createClient();
  const [{ data: pays }, { data: dons }] = await Promise.all([
    supabase.from("payments").select("id, amount_cents, status, provider, created_at, registration_id, donation_id, profiles!payments_payer_id_fkey(full_name)").eq("chapter_id", chapter.id).order("created_at", { ascending: false }).limit(100),
    supabase.from("donations").select("id, amount_cents, status, created_at, profiles!donations_donor_id_fkey(full_name), campaigns(title)").eq("chapter_id", chapter.id).order("created_at", { ascending: false }).limit(100),
  ]);
  const paid = (pays ?? []).filter((p) => p.status === "pagado");
  const sum = (f: (p: (typeof paid)[number]) => boolean) => paid.filter(f).reduce((a, p) => a + p.amount_cents, 0);
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card"><p className="font-display text-5xl font-extrabold text-indigo">{eur(sum(() => true))}</p><p className="text-sm font-bold text-indigo/70">Total cobrado</p></div>
        <div className="card"><p className="font-display text-5xl font-extrabold text-indigo">{eur(sum((p) => !!p.registration_id))}</p><p className="text-sm font-bold text-indigo/70">Eventos y viajes</p></div>
        <div className="card"><p className="font-display text-5xl font-extrabold text-indigo">{eur(sum((p) => !!p.donation_id))}</p><p className="text-sm font-bold text-indigo/70">Donaciones</p></div>
      </div>
      <section>
        <h3 className="mb-2 text-xl font-extrabold text-indigo">Pagos</h3>
        <ul className="divide-y divide-indigo/10 rounded-2xl border border-indigo/10 text-sm">
          {(pays ?? []).map((p) => (
            <li key={p.id} className="flex justify-between p-3"><span>{dateShort(p.created_at)} · {(p.profiles as unknown as { full_name: string } | null)?.full_name} · {p.registration_id ? "Evento" : "Donación"}</span><b>{eur(p.amount_cents)} <span className="tag ml-1">{p.status}{p.provider === "simulado" ? " (sim.)" : ""}</span></b></li>
          ))}
          {(pays ?? []).length === 0 && <li className="p-3 text-indigo/60">Sin pagos todavía.</li>}
        </ul>
      </section>
      <section>
        <h3 className="mb-2 text-xl font-extrabold text-indigo">Donantes</h3>
        <ul className="divide-y divide-indigo/10 rounded-2xl border border-indigo/10 text-sm">
          {(dons ?? []).map((d) => (
            <li key={d.id} className="flex justify-between p-3"><span>{(d.profiles as unknown as { full_name: string } | null)?.full_name} · {(d.campaigns as unknown as { title: string } | null)?.title}</span><b>{eur(d.amount_cents)} <span className="tag ml-1">{d.status}</span></b></li>
          ))}
          {(dons ?? []).length === 0 && <li className="p-3 text-indigo/60">Sin donaciones todavía.</li>}
        </ul>
      </section>
    </div>
  );
}
