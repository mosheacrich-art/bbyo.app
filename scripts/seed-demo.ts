/**
 * Crea usuarios de demostración con sus roles (necesita SUPABASE_SERVICE_ROLE_KEY).
 *   npx tsx --env-file=.env.local scripts/seed-demo.ts
 * Todos entran con enlace mágico a su correo; los correos son @demo.bbyo.test (no reciben nada):
 * en desarrollo local usa Inbucket/Mailpit de Supabase o genera enlaces con la API de admin.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
const admin = createClient(url, key, { auth: { persistSession: false } });

const years = (n: number, extraMonths = 0) => {
  const d = new Date(); d.setFullYear(d.getFullYear() - n); d.setMonth(d.getMonth() - extraMonths);
  return d.toISOString().slice(0, 10);
};

type P = { email: string; name: string; birth: string; chapter?: string; roles: { role: string; scope_type: string; scope?: string; pos?: string }[] };
const people: P[] = [
  { email: "staff@demo.bbyo.test", name: "Noa Staff", birth: "1988-03-02", roles: [{ role: "staff", scope_type: "global" }] },
  { email: "regional@demo.bbyo.test", name: "Ari Regional", birth: "2005-06-11", roles: [{ role: "regional_board", scope_type: "region" }] },
  { email: "board@demo.bbyo.test", name: "Lia Board BCN", birth: "2007-01-20", chapter: "bcn", roles: [{ role: "chapter_board", scope_type: "chapter", scope: "bcn", pos: "Presidenta" }] },
  { email: "dani@demo.bbyo.test", name: "Dani L.", birth: years(15), chapter: "bcn", roles: [{ role: "member", scope_type: "chapter", scope: "bcn" }] },
  { email: "sara@demo.bbyo.test", name: "Sara L. (madre de Dani)", birth: "1980-09-09", chapter: "bcn", roles: [{ role: "parent", scope_type: "chapter", scope: "bcn" }] },
  { email: "eli@demo.bbyo.test", name: "Eli R.", birth: years(14, 3), chapter: "bcn", roles: [{ role: "prospect", scope_type: "chapter", scope: "bcn" }] },
  { email: "raquel@demo.bbyo.test", name: "Raquel M.", birth: "2002-05-05", roles: [{ role: "alumni", scope_type: "region" }] },
];

async function main() {
  const { data: region } = await admin.from("regions").select("id").limit(1).single();
  const { data: chapters } = await admin.from("chapters").select("id, slug");
  const cid = (slug: string) => chapters!.find((c) => c.slug === slug)!.id;
  const ids = new Map<string, string>();

  for (const p of people) {
    let id: string | undefined;
    const created = await admin.auth.admin.createUser({ email: p.email, email_confirm: true, user_metadata: { full_name: p.name } });
    if (created.data.user) id = created.data.user.id;
    else {
      const list = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      id = list.data.users.find((u) => u.email === p.email)?.id;
    }
    if (!id) throw new Error(`No se pudo crear ${p.email}`);
    ids.set(p.email, id);
    await admin.from("profiles").update({ full_name: p.name, birth_date: p.birth, home_chapter_id: p.chapter ? cid(p.chapter) : null }).eq("id", id);
    await admin.from("role_assignments").delete().eq("user_id", id);
    for (const r of p.roles) {
      await admin.from("role_assignments").insert({
        user_id: id, role: r.role, scope_type: r.scope_type,
        scope_id: r.scope_type === "region" ? region!.id : r.scope_type === "chapter" ? cid(r.scope!) : null,
        board_position: r.pos ?? null,
      });
    }
  }
  await admin.from("guardianships").upsert({ guardian_id: ids.get("sara@demo.bbyo.test")!, child_id: ids.get("dani@demo.bbyo.test")!, verified: true }, { onConflict: "guardian_id,child_id" });
  await admin.from("prospect_pipeline").upsert({ person_id: ids.get("eli@demo.bbyo.test")!, chapter_id: cid("bcn"), stage: "invitado", notes: "Vino a la noche de juegos" });
  await admin.storage.createBucket("photos", { public: false }).catch(() => {});
  console.log("Usuarios de demo listos:", people.map((p) => p.email).join(", "));
}
main().catch((e) => { console.error(e); process.exit(1); });
