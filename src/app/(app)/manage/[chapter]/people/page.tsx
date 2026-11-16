import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getManagedChapter } from "@/lib/manage";
import { ROLE_LABEL, type Role } from "@/lib/auth/session";
import { ageOn } from "@/lib/format";

async function setPaid(form: FormData) {
  "use server";
  const slug = String(form.get("slug"));
  const { chapter } = await getManagedChapter(slug);
  const person = String(form.get("person"));
  const paid = form.get("paid") === "1";
  const supabase = await createClient();
  await supabase.from("memberships").upsert(
    { person_id: person, chapter_id: chapter.id, paid, valid_until: paid ? `${new Date().getFullYear()}-12-31` : null },
    { onConflict: "person_id,chapter_id" },
  );
  revalidatePath(`/manage/${slug}/people`);
}

export default async function People({ params }: PageProps<"/manage/[chapter]/people">) {
  const { chapter: slug } = await params;
  const { chapter } = await getManagedChapter(slug);
  const supabase = await createClient();
  const [{ data: people }, { data: roles }, { data: ms }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, birth_date").eq("home_chapter_id", chapter.id).order("full_name"),
    supabase.from("role_assignments").select("user_id, role, board_position, scope_id").eq("scope_id", chapter.id),
    supabase.from("memberships").select("person_id, paid, valid_until").eq("chapter_id", chapter.id),
  ]);
  const roleOf = (id: string) => (roles ?? []).filter((r) => r.user_id === id);
  const mem = new Map((ms ?? []).map((m) => [m.person_id, m]));
  return (
    <div className="overflow-x-auto rounded-2xl border border-indigo/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-mist text-xs uppercase text-indigo/70"><tr><th className="p-3">Nombre</th><th>Edad</th><th>Rol</th><th>Cuota</th></tr></thead>
        <tbody className="divide-y divide-indigo/10">
          {(people ?? []).map((p) => {
            const m = mem.get(p.id);
            return (
              <tr key={p.id}>
                <td className="p-3 font-bold text-indigo">{p.full_name}</td>
                <td>{ageOn(p.birth_date) ?? "—"}</td>
                <td>{roleOf(p.id).map((r) => ROLE_LABEL[r.role as Role] + (r.board_position ? ` (${r.board_position})` : "")).join(", ") || "—"}</td>
                <td>
                  <form action={setPaid} className="flex items-center gap-2">
                    <input type="hidden" name="slug" value={slug} /><input type="hidden" name="person" value={p.id} /><input type="hidden" name="paid" value={m?.paid ? "0" : "1"} />
                    <span className={`tag ${m?.paid ? "bg-pistachio/25" : "bg-sunrise"}`}>{m?.paid ? `Pagada${m.valid_until ? ` hasta ${m.valid_until}` : ""}` : "Pendiente"}</span>
                    <button className="text-xs font-bold text-indigo underline">{m?.paid ? "Marcar sin pagar" : "Marcar pagada"}</button>
                  </form>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {(people ?? []).length === 0 && <p className="p-4 text-indigo/60">Aún no hay personas en este chapter.</p>}
    </div>
  );
}
