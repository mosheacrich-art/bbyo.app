import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Alert = { id: string; kind: "autorizar" | "pagar"; eventId: string; eventTitle: string; personName: string; isMe: boolean };

/** Lo que espera una acción de esta persona: autorizar a un hijo/a o pagar una inscripción. */
export const getAlerts = cache(async (uid: string): Promise<Alert[]> => {
  const supabase = await createClient();
  const [{ data: regs }, { data: kids }] = await Promise.all([
    supabase.from("registrations").select("id, event_id, person_id, status, events(title)").in("status", ["pendiente_padres", "pendiente_pago"]),
    supabase.from("guardianships").select("child_id, profiles!guardianships_child_id_fkey(full_name)").eq("guardian_id", uid).eq("verified", true),
  ]);
  const names = new Map((kids ?? []).map((k) => [k.child_id as string, (k.profiles as unknown as { full_name: string } | null)?.full_name ?? "Tu hijo/a"]));
  return (regs ?? [])
    .filter((r) => r.person_id === uid || names.has(r.person_id))
    .filter((r) => r.status === "pendiente_pago" || r.person_id !== uid)
    .map((r) => ({
      id: r.id, kind: r.status === "pendiente_padres" ? "autorizar" : "pagar", eventId: r.event_id,
      eventTitle: (r.events as unknown as { title: string } | null)?.title ?? "Evento",
      personName: r.person_id === uid ? "Tú" : names.get(r.person_id)!, isMe: r.person_id === uid,
    }));
});
