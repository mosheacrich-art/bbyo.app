import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { ActionForm } from "@/components/forms";
import { createClient } from "@/lib/supabase/server";
import { friendly } from "@/lib/errors";

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
      <h1 className="h-display text-6xl">Únete a tu chapter</h1>
      <p className="text-indigo/70">Tu chapter board te habrá dado un código de invitación.</p>
      <ActionForm action={redeem} submit="Unirme">
        <label className="label" htmlFor="code">Código</label>
        <input id="code" name="code" defaultValue={codigo} className="input uppercase" autoComplete="off" />
      </ActionForm>
    </div>
  );
}
