"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell, CalendarDays, Camera, ChevronRight, Heart, House, LayoutDashboard, Link2, LogOut, Menu, ShieldCheck,
  Ticket, User, Wrench, X, type LucideIcon,
} from "lucide-react";

export const ICONS = {
  home: House, calendar: CalendarDays, photos: Camera, toolbox: Wrench, links: Link2, donate: Heart,
  manage: LayoutDashboard, admin: ShieldCheck, profile: User, join: Ticket,
} satisfies Record<string, LucideIcon>;
export type IconName = keyof typeof ICONS;
export type NavItem = { href: string; label: string; icon: IconName; badge?: number };
export type NavGroup = { title?: string; items: NavItem[] };

const isOn = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="BBYO España, inicio">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white font-display text-xl font-extrabold text-indigo shadow-lg shadow-black/20">B</span>
      {!compact && (
        <span className="leading-none">
          <span className="block font-display text-2xl font-extrabold uppercase tracking-tight text-white">BBYO</span>
          <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-cyan">España</span>
        </span>
      )}
    </Link>
  );
}

function Avatar({ initials, className = "" }: { initials: string; className?: string }) {
  return <span className={`grid shrink-0 place-items-center rounded-full bg-lox font-bold text-white ${className}`}>{initials}</span>;
}

function NavList({ groups, path, onNavigate }: { groups: NavGroup[]; path: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Principal" className="space-y-5">
      {groups.map((g, i) => (
        <div key={i}>
          {g.title && <p className="mb-1.5 px-5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">{g.title}</p>}
          <ul>
            {g.items.map((it) => {
              const Icon = ICONS[it.icon];
              const on = isOn(path, it.href);
              return (
                <li key={it.href}>
                  <Link href={it.href} onClick={onNavigate} aria-current={on ? "page" : undefined}
                    className={`relative flex items-center gap-3 px-5 py-2.5 text-sm transition ${on ? "bg-white/10 font-bold text-white" : "text-white/75 hover:bg-white/5 hover:text-white"}`}>
                    {on && <span className="absolute inset-y-1 left-0 w-1 rounded-r bg-lox" />}
                    <Icon size={18} strokeWidth={1.75} aria-hidden />
                    <span className="flex-1">{it.label}</span>
                    {!!it.badge && <span className="rounded-full bg-lox px-1.5 text-[11px] font-bold text-white">{it.badge}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

type Props = {
  groups: NavGroup[]; tabs: NavItem[]; user: { name: string; role: string; initials: string };
  alerts: number; signOut: () => Promise<void>; demo: boolean; children: React.ReactNode;
};

export function AppShell({ groups, tabs, user, alerts, signOut, demo, children }: Props) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; }, [open]);

  const userCard = (
    <Link href="/me" onClick={() => setOpen(false)} className="flex items-center gap-3 border-y border-white/10 px-5 py-4 hover:bg-white/5">
      <Avatar initials={user.initials} className="h-9 w-9 text-sm" />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-bold text-white">{user.name}</span>
        <span className="block truncate text-xs text-white/55">{user.role} · <span className="text-cyan">Ver perfil</span></span>
      </span>
    </Link>
  );
  const footer = (
    <div className="mt-auto border-t border-white/10 p-4">
      <form action={signOut}>
        <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white">
          <LogOut size={18} strokeWidth={1.75} aria-hidden /> Salir
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Escritorio: barra lateral fija */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-night lg:flex">
        <div className="px-5 py-6"><Logo /></div>
        {userCard}
        <div className="flex-1 overflow-y-auto py-5"><NavList groups={groups} path={path} /></div>
        {footer}
      </aside>

      {/* Móvil: barra superior */}
      <header className="sticky top-0 z-20 flex items-center justify-between bg-night px-4 py-3 lg:hidden">
        <Logo />
        <div className="flex items-center gap-2">
          <Link href="/#atencion" className="relative grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white" aria-label={`Avisos: ${alerts}`}>
            <Bell size={18} aria-hidden />
            {alerts > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-lox px-1 text-[11px] font-bold">{alerts}</span>}
          </Link>
          <Link href="/me" aria-label="Mi perfil"><Avatar initials={user.initials} className="h-10 w-10 text-sm" /></Link>
        </div>
      </header>

      {/* Escritorio: campana arriba a la derecha */}
      <Link href="/#atencion" aria-label={`Avisos: ${alerts}`}
        className="fixed right-6 top-5 z-20 hidden h-11 w-11 place-items-center rounded-xl bg-night text-white shadow-lg lg:grid">
        <Bell size={19} aria-hidden />
        {alerts > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-lox px-1 text-[11px] font-bold">{alerts}</span>}
      </Link>

      <main className="mx-auto max-w-6xl px-4 pb-32 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">{children}</main>
      <footer className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 pb-28 text-xs text-indigo/50 sm:px-6 lg:px-10 lg:pb-8 lg:pr-64">
        <span>© {new Date().getFullYear()} BBYO España · propuesta no oficial</span>
        <span>Marca y logotipo pendientes de autorización de BBYO</span>
      </footer>

      {demo && (
        <Link href="/login" className="fixed bottom-20 right-3 z-30 flex items-center gap-1.5 rounded-full bg-sunrise py-1.5 pl-2 pr-3 text-xs font-bold text-indigo shadow-xl ring-1 ring-indigo/10 lg:bottom-5 lg:right-6">
          <span className="rounded-full bg-indigo px-2 py-0.5 text-[10px] uppercase tracking-wide text-white">Demo</span>
          <span className="hidden sm:inline">{user.name.split(" ")[0]} · </span>Cambiar<span className="hidden sm:inline"> persona</span> <ChevronRight size={14} aria-hidden />
        </Link>
      )}

      {/* Móvil: pestañas inferiores */}
      <nav aria-label="Accesos" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-indigo/10 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {tabs.map((t) => {
          const Icon = ICONS[t.icon];
          const on = isOn(path, t.href);
          return (
            <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${on ? "text-indigo" : "text-indigo/50"}`}>
              <Icon size={21} strokeWidth={on ? 2.25 : 1.75} aria-hidden />{t.label}
            </Link>
          );
        })}
        <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold text-indigo/50">
          <Menu size={21} strokeWidth={1.75} aria-hidden />Más
        </button>
      </nav>

      {/* Móvil: menú completo */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <button className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-label="Cerrar menú" />
          <div className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col bg-night">
            <div className="flex items-center justify-between px-5 py-5">
              <Logo />
              <button onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg text-white/80 hover:bg-white/10" aria-label="Cerrar"><X size={20} /></button>
            </div>
            {userCard}
            <div className="flex-1 overflow-y-auto py-5"><NavList groups={groups} path={path} onNavigate={() => setOpen(false)} /></div>
            {footer}
          </div>
        </div>
      )}
    </div>
  );
}
