import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Enlaces importantes" };

export default async function Links() {
  await requireSession();
  const supabase = await createClient();
  const { data } = await supabase.from("links").select("id, title, url, note").order("sort");
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="BBYO" title="Enlaces" subtitle="Webs y portales importantes de BBYO." />
      <ul className="grid gap-3 md:grid-cols-2">
        {(data ?? []).map((l) => (
          <li key={l.id} className="card">
            <p className="text-lg font-extrabold text-indigo">{l.title}</p>
            {l.note && <p className="text-sm text-indigo/70">{l.note}</p>}
            {l.url ? <a href={l.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm mt-3">Abrir</a>
              : <p className="mt-3 text-xs font-semibold text-indigo/50">Enlace por configurar</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
