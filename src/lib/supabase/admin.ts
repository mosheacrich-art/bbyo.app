import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Solo servidor. Salta RLS: usar únicamente en webhooks, cron y seed. */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
