import "server-only";
import { createClient } from "@supabase/supabase-js";
import { DEMO } from "@/lib/demo/mode";
import { createDemoClient } from "@/lib/demo/client";

const real = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

/** Solo servidor. Salta RLS: usar únicamente en webhooks, cron y seed. */
export function createAdminClient(): ReturnType<typeof real> {
  if (DEMO) return createDemoClient(null, true) as unknown as ReturnType<typeof real>;
  return real();
}
