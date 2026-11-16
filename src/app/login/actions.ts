"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ email: z.email(), next: z.string().optional() });

export async function sendMagicLink(_: unknown, form: FormData) {
  const parsed = schema.safeParse({ email: String(form.get("email") ?? "").trim(), next: String(form.get("next") ?? "/") });
  if (!parsed.success) return { error: "Escribe un correo válido." };
  const next = parsed.data.next?.startsWith("/") && !parsed.data.next.startsWith("//") ? parsed.data.next : "/";
  const supabase = await createClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${site}/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: true },
  });
  if (error) return { error: "No hemos podido enviar el enlace. Inténtalo de nuevo en un minuto." };
  return { sent: parsed.data.email };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
