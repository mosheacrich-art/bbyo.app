import { NextResponse } from "next/server";
import { stripe } from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const s = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s || !secret) return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "no_signature" }, { status: 400 });
  let event;
  try {
    event = s.webhooks.constructEvent(body, sig, secret);
  } catch {
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const paymentId = session.metadata?.payment_id;
    if (paymentId && session.payment_status === "paid") {
      await createAdminClient().rpc("confirm_payment", { p_payment: paymentId, p_ref: session.id });
    }
  }
  return NextResponse.json({ received: true });
}
