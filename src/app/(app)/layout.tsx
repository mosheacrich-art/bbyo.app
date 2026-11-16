import Link from "next/link";
import { requireSession, permissions, ROLE_LABEL } from "@/lib/auth/session";
import { getChapters } from "@/lib/data";
import { signOut } from "@/app/login/actions";
import { Nav } from "@/components/nav";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();
  const chapters = await getChapters();
  const perm = permissions(session, chapters);
  const items = [
    { href: "/", label: "Inicio" },
    { href: "/calendar", label: "Calendario" },
    { href: "/photos", label: "Fotos" },
    { href: "/toolbox", label: "Toolbox" },
    { href: "/links", label: "Enlaces" },
    { href: "/donate", label: "Donar" },
    ...(perm.canManage ? [{ href: "/manage", label: "Gestión" }] : []),
    ...(perm.isStaff ? [{ href: "/admin", label: "Admin" }] : []),
  ];
  const mainRole = session.assignments[0]?.role;
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-indigo/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="font-display text-2xl font-extrabold uppercase tracking-tight text-indigo">
            BBYO <span className="text-lox">España</span>
          </Link>
          <Nav items={items} />
          <div className="ml-auto flex items-center gap-3">
            <Link href="/me" className="text-right text-sm leading-tight">
              <span className="block font-bold text-indigo">{session.profile.full_name || session.email}</span>
              <span className="block text-xs text-indigo/60">{mainRole ? ROLE_LABEL[mainRole] : "Sin rol aún"}</span>
            </Link>
            <form action={signOut}><button className="btn-ghost btn-sm">Salir</button></form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-indigo/50">
        Propuesta no oficial para BBYO España. Marca y logotipo pendientes de autorización de BBYO.
      </footer>
    </div>
  );
}
