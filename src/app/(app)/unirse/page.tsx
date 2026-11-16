import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { ActionForm } from "@/components/forms";
import { createClient } from "@/lib/supabase/server";
import { friendly } from "@/lib/errors";
import { PageHeader } from "@/components/page-header";

async function redeem(_: unknown, form: FormData) {
  "use server";
  await requireSession();
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  if (!code) return { error: "Escribe el código." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("redeem_invite", { p_code: code });
  if (error) return { error: friendly(error.message) };
  redirect("/");
}

export default async function Join({ searchParams }: { searchParams: Promise<{ codigo?: string }> }) {
  const { codigo = "" } = await searchParams;
  await requireSession();
  return (
    <div className="mx-auto max-w-md space-y-4">
      <PageHeader eyebrow="Invitación" title="Únete a tu chapter" subtitle="Tu chapter board te habrá dado un código de invitación." />
      <ActionForm action={redeem} submit="Unirme">
        <label className="label" htmlFor="code">Código</label>
        <input id="code" name="code" defaultValue={codigo} className="input uppercase" autoComplete="off" />
      </ActionForm>
    </div>
  );
}
