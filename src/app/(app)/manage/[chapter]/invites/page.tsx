import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getManagedChapter } from "@/lib/manage";
import { ActionForm } from "@/components/forms";
import { randomBytes } from "node:crypto";

const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString(); };

export default async function Invites({ params }: PageProps<"/manage/[chapter]/invites">) {
  const { chapter: slug } = await params;
  const { chapter } = await getManagedChapter(slug);
  const supabase = await createClient();
  const { data } = await supabase.from("invites").select("code, role, uses_left, expires_at").eq("chapter_id", chapter.id).order("expires_at", { ascending: false, nullsFirst: true });

  async function create(_: unknown, form: FormData) {
    "use server";
    const { chapter, session } = await getManagedChapter(slug);
    const role = String(form.get("role"));
    if (!["member", "prospect", "parent", "alumni"].includes(role)) return { error: "Rol no válido." };
    const uses = Math.min(500, Math.max(1, Number(form.get("uses")) || 1));
    const code = `${chapter.slug.slice(0, 3).toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`;
    const supabase = await createClient();
    const { error } = await supabase.from("invites").insert({
      code, chapter_id: chapter.id, role, uses_left: uses, created_by: session.id,
      expires_at: inDays(30),
    });
    if (error) return { error: "No se pudo crear la invitación." };
    revalidatePath(`/manage/${slug}/invites`);
    return { ok: true };
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <ActionForm action={create} submit="Crear código" className="card space-y-3">
        <h3 className="text-xl font-extrabold text-indigo">Nueva invitación</h3>
        <div><label className="label" htmlFor="role">Para</label>
          <select id="role" name="role" className="input"><option value="member">Miembro</option><option value="prospect">Prospect</option><option value="parent">Padre / madre</option><option value="alumni">Alumni</option></select></div>
        <div><label className="label" htmlFor="uses">Usos</label><input id="uses" name="uses" type="number" min={1} max={500} defaultValue={1} className="input" /></div>
        <p className="text-xs text-indigo/60">Caduca a los 30 días. Los roles de board los concede Regional o Staff.</p>
      </ActionForm>
      <ul className="space-y-2">
        {(data ?? []).map((i) => (
          <li key={i.code} className="card flex items-center justify-between">
            <span className="font-mono text-lg font-bold text-indigo">{i.code}</span>
            <span className="text-sm text-indigo/70">{i.role} · {i.uses_left} usos</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
