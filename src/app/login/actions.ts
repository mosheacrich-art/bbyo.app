"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { DEMO, DEMO_COOKIE } from "@/lib/demo/mode";
import { demoStore } from "@/lib/demo/store";

const schema = z.object({ email: z.email(), next: z.string().optional() });
const safeNext = (n: string | undefined) => (n?.startsWith("/") && !n.startsWith("//") ? n : "/");

export async function sendMagicLink(_: unknown, form: FormData) {
  const parsed = schema.safeParse({ email: String(form.get("email") ?? "").trim(), next: String(form.get("next") ?? "/") });
  if (!parsed.success) return { error: "Escribe un correo válido." };
  const next = safeNext(parsed.data.next);
  const supabase = await createClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${site}/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: true },
  });
  if (error) return { error: "No hemos podido enviar el enlace. Inténtalo de nuevo en un minuto." };
  return { sent: parsed.data.email };
}

/** Modo demo: entra como una de las personas de ejemplo, sin correo. */
export async function demoSignIn(form: FormData) {
  if (!DEMO) redirect("/login");
  const id = String(form.get("user") ?? "");
  if (!demoStore().personas.some((p) => p.id === id)) redirect("/login");
  (await cookies()).set(DEMO_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect(safeNext(String(form.get("next") ?? "/")));
}

export async function signOut() {
  if (DEMO) {
    (await cookies()).delete(DEMO_COOKIE);
    redirect("/login");
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
