import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/auth/session";
import { getChapters } from "@/lib/data";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Fotos" };

export default async function Photos() {
  await requireSession();
  const supabase = await createClient();
  const chapters = await getChapters();
  const byId = new Map(chapters.map((c) => [c.id, c.name]));
  const { data: albums } = await supabase.from("albums").select("id, title, chapter_id, created_at, photos(id, storage_path, status)").order("created_at", { ascending: false });

  // RLS ya filtró qué álbumes/fotos puede ver esta persona; las URLs firmadas caducan en 1 h.
  const admin = createAdminClient();
  const withUrls = await Promise.all((albums ?? []).map(async (a) => {
    const ok = (a.photos as { id: string; storage_path: string; status: string }[]).filter((p) => p.status === "publicada");
    const { data: signed } = ok.length ? await admin.storage.from("photos").createSignedUrls(ok.map((p) => p.storage_path), 3600) : { data: [] };
    return { ...a, urls: (signed ?? []).map((s) => s.signedUrl).filter(Boolean) as string[] };
  }));

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Galería" title="Fotos" subtitle="Solo aparecen fotos publicadas por tu board y de personas con consentimiento." />
      {withUrls.map((a) => (
        <section key={a.id}>
          <h2 className="text-xl font-extrabold text-indigo">{a.title} <span className="tag ml-2">{byId.get(a.chapter_id)}</span></h2>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            {a.urls.map((u) => (
              <div key={u} className="relative aspect-square overflow-hidden rounded-xl bg-mist">
                <Image src={u} alt={`Foto de ${a.title}`} fill unoptimized className="object-cover" />
              </div>
            ))}
          </div>
          {a.urls.length === 0 && <p className="mt-2 text-sm text-indigo/60">Todavía no hay fotos publicadas.</p>}
        </section>
      ))}
      {withUrls.length === 0 && <p className="text-indigo/60">No hay álbumes todavía.</p>}
    </div>
  );
}
