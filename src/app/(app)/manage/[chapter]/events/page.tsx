import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getManagedChapter } from "@/lib/manage";
import { friendly } from "@/lib/errors";
import { dateShort, timeOf, eur } from "@/lib/format";
import type { EventRow } from "@/lib/data";

async function setStatus(form: FormData) {
  "use server";
  const slug = String(form.get("slug"));
  const { chapter } = await getManagedChapter(slug);
  const status = String(form.get("status"));
  if (!["publicado", "cancelado", "borrador", "pendiente"].includes(status)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("events").update({ status }).eq("id", String(form.get("id"))).eq("chapter_id", chapter.id);
  if (error) console.error(friendly(error.message));
  revalidatePath(`/manage/${slug}/events`);
}

export default async function EventsAdmin({ params }: PageProps<"/manage/[chapter]/events">) {
  const { chapter: slug } = await params;
  const { chapter, perm } = await getManagedChapter(slug);
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("*").eq("chapter_id", chapter.id).order("starts_at", { ascending: false });
  return (
    <div className="space-y-4">
      <Link href={`/manage/${slug}/events/new`} className="btn">+ Crear evento</Link>
      <ul className="space-y-2">
        {((data ?? []) as EventRow[]).map((e) => (
          <li key={e.id} className="card flex flex-wrap items-center justify-between gap-3">
            <div>
              <Link href={`/manage/${slug}/events/${e.id}`} className="text-lg font-extrabold text-indigo underline-offset-2 hover:underline">{e.title}</Link>
              <p className="text-sm text-indigo/70">{dateShort(e.starts_at)} {timeOf(e.starts_at)} · {eur(e.price_cents)}{e.overnight ? " · pernocta" : ""} · <span className="tag">{e.status}</span></p>
            </div>
            <form action={setStatus} className="flex gap-2">
              <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={e.id} />
              {e.status === "pendiente" && perm.canApprove && <button name="status" value="publicado" className="btn btn-sm">Aprobar y publicar</button>}
              {e.status === "borrador" && <button name="status" value={(e.price_cents > 0 || e.overnight) ? "pendiente" : "publicado"} className="btn btn-sm">{(e.price_cents > 0 || e.overnight) ? "Enviar a aprobación" : "Publicar"}</button>}
              {e.status !== "cancelado" && <button name="status" value="cancelado" className="btn-ghost btn-sm">Cancelar</button>}
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
