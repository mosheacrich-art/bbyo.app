import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Borra datos de salud 7 días después de cada evento. Programar a diario con Authorization: Bearer $CRON_SECRET. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await createAdminClient().rpc("purge_health");
  if (error) return NextResponse.json({ error: "failed" }, { status: 500 });
  return NextResponse.json({ purged: data });
}
