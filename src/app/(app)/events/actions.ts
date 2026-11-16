"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import { friendly } from "@/lib/errors";
import { startPayment } from "@/lib/payments";

const uuid = z.uuid();

export async function registerAction(_: unknown, form: FormData) {
  await requireSession();
  const p = z.object({ event: uuid, person: uuid, health: z.string().max(1000).optional() })
    .safeParse({ event: form.get("event"), person: form.get("person"), health: String(form.get("health") ?? "").trim() || undefined });
  if (!p.success) return { error: "Datos no válidos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("register_for_event", { p_event: p.data.event, p_person: p.data.person, p_health: p.data.health ?? null });
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/events/${p.data.event}`);
  revalidatePath("/");
  return { ok: true };
}

export async function authorizeAction(_: unknown, form: FormData) {
  await requireSession();
  const p = z.object({ reg: uuid, event: uuid, health: z.string().max(1000).optional() })
    .safeParse({ reg: form.get("reg"), event: form.get("event"), health: String(form.get("health") ?? "").trim() || undefined });
  if (!p.success) return { error: "Datos no válidos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("authorize_registration", { p_reg: p.data.reg, p_health: p.data.health ?? null });
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/events/${p.data.event}`);
  revalidatePath("/");
  return { ok: true };
}

export async function cancelAction(form: FormData) {
  await requireSession();
  const p = z.object({ reg: uuid, event: uuid }).safeParse({ reg: form.get("reg"), event: form.get("event") });
  if (!p.success) return;
  const supabase = await createClient();
  await supabase.rpc("cancel_registration", { p_reg: p.data.reg });
  revalidatePath(`/events/${p.data.event}`);
  revalidatePath("/");
}

export async function payAction(form: FormData) {
  const session = await requireSession();
  const p = z.object({ reg: uuid, event: uuid }).safeParse({ reg: form.get("reg"), event: form.get("event") });
  if (!p.success) return;
  const supabase = await createClient();
  // RLS: solo vemos la inscripción si somos la persona, su tutor o gestores
  const { data: reg } = await supabase.from("registrations").select("id, status, events(title, price_cents, chapter_id)").eq("id", p.data.reg).single();
  const ev = reg?.events as unknown as { title: string; price_cents: number; chapter_id: string | null } | null;
  if (!reg || reg.status !== "pendiente_pago" || !ev || ev.price_cents <= 0) return;
  const { url } = await startPayment({
    payerId: session.id, chapterId: ev.chapter_id, amountCents: ev.price_cents, title: ev.title,
    registrationId: reg.id, returnPath: `/events/${p.data.event}`,
  });
  redirect(url);
}
