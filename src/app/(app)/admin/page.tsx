import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession, permissions, ROLE_LABEL, type Role } from "@/lib/auth/session";
import { getChapters } from "@/lib/data";
import { ActionForm } from "@/components/forms";
import { dateShort, timeOf } from "@/lib/format";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Administración" };

export default async function Admin() {
  const session = await requireSession();
  const chapters = await getChapters();
  const perm = permissions(session, chapters);
  if (!perm.isStaff) redirect("/");
  const supabase = await createClient();
  const [{ data: roles }, { data: audit }] = await Promise.all([
    supabase.from("role_assignments").select("id, role, scope_type, scope_id, board_position, profiles!role_assignments_user_id_fkey(full_name)").in("role", ["staff", "regional_board", "chapter_board"]).order("role"),
    supabase.from("audit_log").select("id, at, action, entity, actor_id").order("at", { ascending: false }).limit(30),
  ]);
  const regionId = chapters[0]?.region_id ?? null;

  async function grant(_: unknown, form: FormData) {
    "use server";
    const s = await requireSession();
    if (!permissions(s, await getChapters()).isStaff) return { error: "No autorizado." };
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const role = String(form.get("role")) as Role;
    const scope = String(form.get("scope"));
    if (!email) return { error: "Escribe el correo." };
    // Buscar el usuario por correo requiere la API de administración; la concesión la valida RLS (role_grantable).
    const admin = createAdminClient();
    const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const target = users?.users.find((u) => u.email?.toLowerCase() === email);
    if (!target) return { error: "Esa persona aún no ha entrado a la app. Pídele que inicie sesión una vez." };
    const row = scope === "global" ? { scope_type: "global", scope_id: null } : scope === "region" ? { scope_type: "region", scope_id: regionId } : { scope_type: "chapter", scope_id: scope };
    const supabase = await createClient();
    const { error } = await supabase.from("role_assignments").insert({ user_id: target.id, role, board_position: String(form.get("position") ?? "") || null, ...row });
    if (error) return { error: "No se pudo conceder (revisa que el rol y el ámbito sean compatibles)." };
    revalidatePath("/admin");
    return { ok: true };
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Staff" title="Administración" subtitle="Roles de toda la región y registro de cambios." />
      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="mb-2 text-xl font-extrabold text-indigo">Staff y boards</h2>
          <ul className="divide-y divide-indigo/10 rounded-2xl border border-indigo/10 text-sm">
            {(roles ?? []).map((r) => (
              <li key={r.id} className="flex justify-between p-3">
                <b>{(r.profiles as unknown as { full_name: string } | null)?.full_name}</b>
                <span>{ROLE_LABEL[r.role as Role]}{r.board_position ? ` · ${r.board_position}` : ""} · {r.scope_type === "global" ? "Global" : r.scope_type === "region" ? "España" : chapters.find((c) => c.id === r.scope_id)?.name}</span>
              </li>
            ))}
          </ul>
        </section>
        <ActionForm action={grant} submit="Conceder rol" className="card space-y-3">
          <h2 className="text-xl font-extrabold text-indigo">Conceder rol</h2>
          <div><label className="label" htmlFor="email">Correo</label><input id="email" name="email" type="email" required className="input" /></div>
          <div><label className="label" htmlFor="role">Rol</label>
            <select id="role" name="role" className="input">{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></div>
          <div><label className="label" htmlFor="scope">Ámbito</label>
            <select id="scope" name="scope" className="input"><option value="global">Global</option><option value="region">España (regional)</option>{chapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label className="label" htmlFor="position">Cargo (opcional)</label><input id="position" name="position" className="input" placeholder="Presidente/a, Tesorero/a…" /></div>
        </ActionForm>
      </div>
      <section>
        <h2 className="mb-2 text-xl font-extrabold text-indigo">Registro de cambios</h2>
        <ul className="divide-y divide-indigo/10 rounded-2xl border border-indigo/10 text-sm">
          {(audit ?? []).map((a) => <li key={a.id} className="flex justify-between p-3"><span>{a.action} · {a.entity}</span><span className="text-indigo/60">{dateShort(a.at)} {timeOf(a.at)}</span></li>)}
        </ul>
      </section>
    </div>
  );
}
