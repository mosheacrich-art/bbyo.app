import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import { eur } from "@/lib/format";
import { ActionForm } from "@/components/forms";
import { donateAction } from "./actions";

export const metadata = { title: "Donar" };

export default async function Donate({ searchParams }: { searchParams: Promise<{ pago?: string }> }) {
  const { pago } = await searchParams;
  const session = await requireSession();
  const supabase = await createClient();
  const [{ data: campaigns }, { data: paid }, { data: mine }] = await Promise.all([
    supabase.from("campaigns").select("id, title, goal_cents, active, chapter_id").eq("active", true),
    supabase.rpc("campaign_totals"),
    supabase.from("donations").select("id, amount_cents, status, created_at, campaigns(title)").eq("donor_id", session.id).order("created_at", { ascending: false }).limit(10),
  ]);
  const raised = new Map<string, number>(((paid ?? []) as { campaign_id: string; total_cents: number | string }[]).map((r) => [r.campaign_id, Number(r.total_cents)]));
  return (
    <div className="space-y-8">
      <h1 className="h-display text-6xl">Donar</h1>
      {pago === "ok" && <p className="rounded-xl bg-pistachio/15 p-3 font-semibold">¡Gracias por tu donación!</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {(campaigns ?? []).map((c) => {
          const got = raised.get(c.id) ?? 0;
          const pct = Math.min(100, Math.round((got / c.goal_cents) * 100));
          return (
            <div key={c.id} className="card">
              <h2 className="text-xl font-extrabold text-indigo">{c.title}</h2>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-mist" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-lox" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-sm text-indigo/70">{eur(got)} de {eur(c.goal_cents)}</p>
              <ActionForm action={donateAction} hidden={{ campaign: c.id }} submit="Donar" className="mt-3">
                <label className="label" htmlFor={`d-${c.id}`}>Importe (€)</label>
                <input id={`d-${c.id}`} name="euros" type="number" min={1} step={1} defaultValue={20} className="input" />
              </ActionForm>
            </div>
          );
        })}
      </div>
      {(mine ?? []).length > 0 && (
        <section>
          <h2 className="mb-2 text-xl font-extrabold text-indigo">Mis donaciones</h2>
          <ul className="divide-y divide-indigo/10 rounded-2xl border border-indigo/10">
            {(mine ?? []).map((d) => (
              <li key={d.id} className="flex justify-between p-3 text-sm">
                <span>{(d.campaigns as unknown as { title: string } | null)?.title}</span>
                <span className="font-bold">{eur(d.amount_cents)} · {d.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-xs text-indigo/50">El certificado de donación (Ley 49/2002) requiere definir la entidad receptora con BBYO.</p>
    </div>
  );
}
