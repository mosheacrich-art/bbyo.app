import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";

export const metadata = { title: "Toolbox" };

export default async function Toolbox() {
  await requireSession();
  const supabase = await createClient();
  const { data } = await supabase.from("resources").select("id, category, title, url, boards_only").order("category").order("sort");
  const groups = new Map<string, NonNullable<typeof data>>();
  (data ?? []).forEach((r) => groups.set(r.category, [...(groups.get(r.category) ?? []), r]));
  return (
    <div className="space-y-8">
      <div>
        <h1 className="h-display text-6xl">Toolbox</h1>
        <p className="mt-2 text-indigo/70">Plantillas, guías y documentos para organizar tu chapter.</p>
      </div>
      {[...groups].map(([cat, list]) => (
        <section key={cat}>
          <h2 className="font-display mb-3 text-2xl font-extrabold uppercase text-indigo/70">{cat}</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {list.map((r) => (
              <li key={r.id} className="card flex items-center justify-between gap-3">
                <span className="font-bold text-indigo">{r.title}{r.boards_only && <span className="tag ml-2">Boards</span>}</span>
                {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">Abrir</a> : <span className="text-xs text-indigo/50">Por añadir</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {(data ?? []).length === 0 && <p className="text-indigo/60">Aún no hay recursos.</p>}
    </div>
  );
}
