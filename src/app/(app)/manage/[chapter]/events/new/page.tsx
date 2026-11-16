import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getManagedChapter } from "@/lib/manage";
import { friendly } from "@/lib/errors";
import { ActionForm } from "@/components/forms";
import { z } from "zod";

const schema = z.object({
  title: z.string().min(3).max(120), description: z.string().max(4000),
  starts: z.string().min(1), ends: z.string().optional(), location: z.string().max(200),
  euros: z.coerce.number().min(0).max(5000), capacity: z.coerce.number().int().min(1).max(5000).optional(),
});

export default async function NewEvent({ params }: PageProps<"/manage/[chapter]/events/new">) {
  const { chapter: slug } = await params;
  await getManagedChapter(slug);

  async function create(_: unknown, form: FormData) {
    "use server";
    const { chapter, perm } = await getManagedChapter(slug);
    const raw = Object.fromEntries(form);
    const p = schema.safeParse({ ...raw, capacity: raw.capacity || undefined, ends: raw.ends || undefined });
    if (!p.success) return { error: "Revisa título, fecha y precio." };
    const cents = Math.round(p.data.euros * 100);
    const overnight = form.get("overnight") === "on";
    const needsApproval = cents > 0 || overnight;
    const wantsPublish = form.get("publish") === "1";
    const status = !wantsPublish ? "borrador" : needsApproval && !perm.canApprove ? "pendiente" : "publicado";
    const supabase = await createClient();
    const { data, error } = await supabase.from("events").insert({
      layer: "local", chapter_id: chapter.id, title: p.data.title, description: p.data.description,
      starts_at: new Date(p.data.starts).toISOString(), ends_at: p.data.ends ? new Date(p.data.ends).toISOString() : null,
      location: p.data.location, price_cents: cents, capacity: p.data.capacity ?? null, overnight,
      is_open: form.get("is_open") === "on", alumni_ok: form.get("alumni_ok") === "on", boards_only: form.get("boards_only") === "on", status,
    }).select("id").single();
    if (error || !data) return { error: friendly(error?.message) };
    redirect(`/manage/${slug}/events/${data.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h2 className="text-2xl font-extrabold text-indigo">Nuevo evento</h2>
      <ActionForm action={create} submit="Guardar como borrador" className="card space-y-3">
        <div><label className="label" htmlFor="title">Título</label><input id="title" name="title" required className="input" /></div>
        <div><label className="label" htmlFor="description">Descripción</label><textarea id="description" name="description" rows={3} className="input" /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="starts">Empieza</label><input id="starts" name="starts" type="datetime-local" required className="input" /></div>
          <div><label className="label" htmlFor="ends">Termina</label><input id="ends" name="ends" type="datetime-local" className="input" /></div>
        </div>
        <div><label className="label" htmlFor="location">Lugar</label><input id="location" name="location" className="input" /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="euros">Precio (€)</label><input id="euros" name="euros" type="number" min={0} step="0.5" defaultValue={0} className="input" /></div>
          <div><label className="label" htmlFor="capacity">Aforo (vacío = sin límite)</label><input id="capacity" name="capacity" type="number" min={1} className="input" /></div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
          {[["overnight", "Con pernocta"], ["is_open", "Abierto a prospects"], ["alumni_ok", "Abierto a alumni"], ["boards_only", "Solo boards"]].map(([n, l]) => (
            <label key={n} className="flex items-center gap-2"><input type="checkbox" name={n} className="h-4 w-4" />{l}</label>
          ))}
        </div>
        <p className="text-xs text-indigo/60">Los eventos con coste o pernocta necesitan la aprobación de Staff o Regional Board antes de publicarse.</p>
      </ActionForm>
    </div>
  );
}
