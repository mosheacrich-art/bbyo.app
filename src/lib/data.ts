import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Chapter } from "@/lib/auth/session";

export type EventRow = {
  id: string; layer: "global" | "regional" | "local"; region_id: string | null; chapter_id: string | null;
  title: string; description: string; starts_at: string; ends_at: string | null; location: string;
  price_cents: number; capacity: number | null; is_open: boolean; alumni_ok: boolean; boards_only: boolean;
  overnight: boolean; status: "borrador" | "pendiente" | "publicado" | "cancelado";
};
export type RegStatus = "pendiente_padres" | "pendiente_pago" | "confirmada" | "lista_espera" | "cancelada";
export type RegRow = { id: string; event_id: string; person_id: string; registered_by: string; status: RegStatus; checked_in_at: string | null };

export const getChapters = cache(async (): Promise<Chapter[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("chapters").select("id, slug, name, city, accent, region_id").order("name");
  return (data ?? []) as Chapter[];
});

export const STATUS_LABEL: Record<RegStatus, string> = {
  pendiente_padres: "Esperando a tus padres",
  pendiente_pago: "Pendiente de pago",
  confirmada: "Confirmada",
  lista_espera: "Lista de espera",
  cancelada: "Cancelada",
};
export const LAYER_LABEL = { global: "Global", regional: "España", local: "Chapter" } as const;
