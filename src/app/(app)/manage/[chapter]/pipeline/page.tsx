import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getManagedChapter } from "@/lib/manage";

const STAGES = [["contacto", "Contacto"], ["invitado", "Invitado"], ["asistio", "Asistió"], ["prospect", "Prospect"], ["miembro", "Miembro"]] as const;

async function move(form: FormData) {
  "use server";
  const slug = String(form.get("slug"));
  const { chapter } = await getManagedChapter(slug);
  const stage = String(form.get("stage"));
  if (!STAGES.some(([s]) => s === stage)) return;
  const supabase = await createClient();
  await supabase.from("prospect_pipeline").update({ stage, updated_at: new Date().toISOString() }).eq("person_id", String(form.get("person"))).eq("chapter_id", chapter.id);
  revalidatePath(`/manage/${slug}/pipeline`);
}

export default async function Pipeline({ params }: PageProps<"/manage/[chapter]/pipeline">) {
  const { chapter: slug } = await params;
  const { chapter } = await getManagedChapter(slug);
  const supabase = await createClient();
  const { data } = await supabase.from("prospect_pipeline").select("person_id, stage, notes, profiles!prospect_pipeline_person_id_fkey(full_name)").eq("chapter_id", chapter.id);
  const rows = (data ?? []) as unknown as { person_id: string; stage: string; notes: string; profiles: { full_name: string } }[];
  return (
    <div className="grid gap-3 lg:grid-cols-5">
      {STAGES.map(([key, label], i) => (
        <section key={key} className="rounded-2xl bg-mist/50 p-3">
          <h3 className="font-display text-xl font-extrabold uppercase text-indigo">{label} <span className="text-indigo/50">{rows.filter((r) => r.stage === key).length}</span></h3>
          <ul className="mt-2 space-y-2">
            {rows.filter((r) => r.stage === key).map((r) => (
              <li key={r.person_id} className="card p-3">
                <p className="font-bold text-indigo">{r.profiles?.full_name}</p>
                {r.notes && <p className="text-xs text-indigo/60">{r.notes}</p>}
                {i < STAGES.length - 1 && (
                  <form action={move} className="mt-2">
                    <input type="hidden" name="slug" value={slug} /><input type="hidden" name="person" value={r.person_id} />
                    <button name="stage" value={STAGES[i + 1][0]} className="text-xs font-bold text-indigo underline">Pasar a {STAGES[i + 1][1]} →</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
