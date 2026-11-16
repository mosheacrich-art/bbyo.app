"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Coins, LayoutDashboard, Ticket, UserPlus, Users } from "lucide-react";

const TABS = [
  ["", "Resumen", LayoutDashboard], ["/people", "Personas", Users], ["/events", "Eventos", CalendarDays],
  ["/pipeline", "Prospects", UserPlus], ["/money", "Dinero", Coins], ["/invites", "Invitaciones", Ticket],
] as const;

export function ManageTabs({ slug, badges = {} }: { slug: string; badges?: Record<string, number> }) {
  const path = usePathname();
  const base = `/manage/${slug}`;
  return (
    <nav className="no-scrollbar flex gap-2 overflow-x-auto pb-1" aria-label="Gestión del chapter">
      {TABS.map(([p, label, Icon]) => {
        const href = base + p;
        const on = p === "" ? path === base : path.startsWith(href);
        return (
          <Link key={label} href={href} aria-current={on ? "page" : undefined} className={`chip ${on ? "chip-on" : ""}`}>
            <Icon size={15} aria-hidden />{label}
            {!!badges[p] && <span className={`rounded-full px-1.5 text-[11px] font-bold ${on ? "bg-white text-indigo" : "bg-lox text-white"}`}>{badges[p]}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
