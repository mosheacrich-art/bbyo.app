import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { DEMO, DEMO_COOKIE } from "@/lib/demo/mode";
import { createDemoClient } from "@/lib/demo/client";

async function createRealClient() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll(list) {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // Server Component: el proxy ya refresca la sesión.
          }
        },
      },
    },
  );
}

export async function createClient(): ReturnType<typeof createRealClient> {
  if (DEMO) {
    const store = await cookies();
    return createDemoClient(store.get(DEMO_COOKIE)?.value ?? null) as unknown as Awaited<ReturnType<typeof createRealClient>>;
  }
  return createRealClient();
}
