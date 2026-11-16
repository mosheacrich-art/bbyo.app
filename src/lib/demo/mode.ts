/** Modo demo: sin Supabase configurado (o con DEMO_MODE=1) la app usa una base de datos en memoria. */
export const DEMO = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.DEMO_MODE === "1";
export const DEMO_COOKIE = "bbyo_demo_user";
