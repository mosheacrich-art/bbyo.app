"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import { startPayment } from "@/lib/payments";

export async function donateAction(_: unknown, form: FormData) {
  const session = await requireSession();
  const p = z.object({ campaign: z.uuid(), euros: z.coerce.number().min(1).max(10000) })
    .safeParse({ campaign: form.get("campaign"), euros: form.get("euros") });
  if (!p.success) return { error: "Indica un importe entre 1 € y 10.000 €." };
  const supabase = await createClient();
  const { data: camp } = await supabase.from("campaigns").select("id, title, chapter_id, active").eq("id", p.data.campaign).single();
  if (!camp?.active) return { error: "Esta campaña ya no está activa." };
  const cents = Math.round(p.data.euros * 100);
  const { data: don, error } = await supabase.from("donations")
    .insert({ campaign_id: camp.id, chapter_id: camp.chapter_id, donor_id: session.id, amount_cents: cents }).select("id").single();
  if (error || !don) return { error: "No hemos podido registrar la donación." };
  const { url } = await startPayment({
    payerId: session.id, chapterId: camp.chapter_id, amountCents: cents, title: `Donación: ${camp.title}`,
    donationId: don.id, returnPath: "/donate",
  });
  redirect(url);
}
