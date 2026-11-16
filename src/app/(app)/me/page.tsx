import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSession, ROLE_LABEL } from "@/lib/auth/session";
import { getChapters } from "@/lib/data";
import { ActionForm } from "@/components/forms";

async function saveProfile(_: unknown, form: FormData) {
  "use server";
  const s = await requireSession();
  const name = String(form.get("full_name") ?? "").trim().slice(0, 120);
  const birth = String(form.get("birth_date") ?? "") || null;
  if (!name) return { error: "Escribe tu nombre." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: name, birth_date: birth }).eq("id", s.id);
  if (error) return { error: "No se pudo guardar." };
  revalidatePath("/", "layout");
  return { ok: true };
}

async function savePhotoConsent(_: unknown, form: FormData) {
  "use server";
  const s = await requireSession();
  const supabase = await createClient();
  const { error } = await supabase.from("photo_consents").upsert({ person_id: s.id, allowed: form.get("allowed") === "on", updated_by: s.id, updated_at: new Date().toISOString() });
  return error ? { error: "No se pudo guardar." } : { ok: true };
}

export const metadata = { title: "Mi perfil" };

export default async function Me() {
  const s = await requireSession();
  const supabase = await createClient();
  const chapters = await getChapters();
  const { data: consent } = await supabase.from("photo_consents").select("allowed").eq("person_id", s.id).maybeSingle();
  return (
    <div className="mx-auto max-w-xl space-y-8">
      <h1 className="h-display text-6xl">Mi perfil</h1>
      <p className="text-indigo/70">{s.email}</p>
      <ActionForm action={saveProfile} submit="Guardar" className="card space-y-3">
        <div><label className="label" htmlFor="full_name">Nombre</label><input id="full_name" name="full_name" defaultValue={s.profile.full_name} className="input" required /></div>
        <div><label className="label" htmlFor="birth_date">Fecha de nacimiento</label><input id="birth_date" name="birth_date" type="date" defaultValue={s.profile.birth_date ?? ""} className="input" /></div>
      </ActionForm>
      <ActionForm action={savePhotoConsent} submit="Guardar consentimiento" className="card">
        <label className="flex items-start gap-3"><input type="checkbox" name="allowed" defaultChecked={consent?.allowed ?? false} className="mt-1 h-5 w-5" />
          <span>Permito que aparezcan fotos mías en los álbumes de mi chapter. <span className="text-sm text-indigo/60">Si eres menor, lo decide tu padre o tutor.</span></span></label>
      </ActionForm>
      <section>
        <h2 className="mb-2 text-xl font-extrabold text-indigo">Mis roles</h2>
        <ul className="space-y-2">
          {s.assignments.map((a, i) => (
            <li key={i} className="card flex justify-between text-sm">
              <b>{ROLE_LABEL[a.role]}{a.board_position ? ` · ${a.board_position}` : ""}</b>
              <span className="text-indigo/70">{a.scope_type === "global" ? "Global" : a.scope_type === "region" ? "España" : chapters.find((c) => c.id === a.scope_id)?.name}</span>
            </li>
          ))}
          {s.assignments.length === 0 && <li className="text-indigo/60">Aún no tienes roles.</li>}
        </ul>
      </section>
    </div>
  );
}
