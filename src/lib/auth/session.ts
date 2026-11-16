import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "staff" | "regional_board" | "chapter_board" | "member" | "prospect" | "alumni" | "parent";
export type Scope = "global" | "region" | "chapter";
export type Assignment = { role: Role; scope_type: Scope; scope_id: string | null; board_position: string | null };

export type Session = {
  id: string;
  email: string | null;
  profile: { full_name: string; birth_date: string | null; home_chapter_id: string | null; locale: string };
  assignments: Assignment[];
};

export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const [{ data: profile }, { data: assignments }] = await Promise.all([
    supabase.from("profiles").select("full_name, birth_date, home_chapter_id, locale").eq("id", auth.user.id).single(),
    supabase
      .from("role_assignments")
      .select("role, scope_type, scope_id, board_position, starts_on, ends_on")
      .eq("user_id", auth.user.id),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const active = (assignments ?? []).filter(
    (a) => (!a.starts_on || a.starts_on <= today) && (!a.ends_on || a.ends_on >= today),
  );
  return {
    id: auth.user.id,
    email: auth.user.email ?? null,
    profile: profile ?? { full_name: auth.user.email ?? "", birth_date: null, home_chapter_id: null, locale: "es" },
    assignments: active as Assignment[],
  };
});

export async function requireSession() {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export type Chapter = { id: string; slug: string; name: string; city: string | null; accent: string | null; region_id: string };

/** Qué puede gestionar esta persona (la BD lo vuelve a comprobar con RLS; esto solo decide qué se muestra). */
export function permissions(s: Session, chapters: Chapter[]) {
  const a = s.assignments;
  const isStaff = a.some((x) => x.role === "staff" && x.scope_type === "global");
  const regions = new Set(a.filter((x) => ["staff", "regional_board"].includes(x.role) && x.scope_type === "region").map((x) => x.scope_id));
  const isRegional = a.some((x) => x.role === "regional_board");
  const managedChapters = chapters.filter(
    (c) =>
      isStaff ||
      regions.has(c.region_id) ||
      a.some((x) => x.scope_type === "chapter" && x.scope_id === c.id && ["staff", "chapter_board"].includes(x.role)),
  );
  return {
    isStaff,
    isRegional,
    canApprove: isStaff || isRegional || regions.size > 0,
    managedChapters,
    canManage: managedChapters.length > 0,
    isParent: a.some((x) => x.role === "parent"),
    isBoardish: a.some((x) => ["staff", "regional_board", "chapter_board"].includes(x.role)),
  };
}

export const ROLE_LABEL: Record<Role, string> = {
  staff: "Staff",
  regional_board: "Regional Board",
  chapter_board: "Chapter Board",
  member: "Miembro",
  prospect: "Prospect",
  alumni: "Alumni",
  parent: "Padre / madre",
};
