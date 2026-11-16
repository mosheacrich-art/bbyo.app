import "server-only";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const stripe = () => (process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null);
export const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Crea el cobro. Con Stripe devuelve la URL de Checkout; sin clave (desarrollo) confirma el pago
 * al instante marcándolo como "simulado" para poder probar el flujo completo.
 */
export async function startPayment(opts: {
  payerId: string; chapterId: string | null; amountCents: number; title: string;
  registrationId?: string; donationId?: string; returnPath: string;
}): Promise<{ url: string }> {
  const admin = createAdminClient();
  const { data: pay, error } = await admin.from("payments").insert({
    chapter_id: opts.chapterId, payer_id: opts.payerId, registration_id: opts.registrationId ?? null,
    donation_id: opts.donationId ?? null, amount_cents: opts.amountCents,
    provider: stripe() ? "stripe" : "simulado",
  }).select("id").single();
  if (error || !pay) throw new Error("payment_create_failed");

  const s = stripe();
  if (!s) {
    await admin.rpc("confirm_payment", { p_payment: pay.id, p_ref: "simulado" });
    return { url: `${opts.returnPath}${opts.returnPath.includes("?") ? "&" : "?"}pago=ok` };
  }
  const session = await s.checkout.sessions.create({
    mode: "payment",
    line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: opts.amountCents, product_data: { name: opts.title } } }],
    metadata: { payment_id: pay.id },
    success_url: `${site()}${opts.returnPath}${opts.returnPath.includes("?") ? "&" : "?"}pago=ok`,
    cancel_url: `${site()}${opts.returnPath}${opts.returnPath.includes("?") ? "&" : "?"}pago=cancelado`,
  });
  await admin.from("payments").update({ provider_ref: session.id }).eq("id", pay.id);
  return { url: session.url! };
}
