import { requireSession, permissions, ROLE_LABEL } from "@/lib/auth/session";
import { getChapters } from "@/lib/data";
import { getAlerts } from "@/lib/alerts";
import { signOut } from "@/app/login/actions";
import { AppShell, type NavGroup, type NavItem } from "@/components/shell";
import { DEMO } from "@/lib/demo/mode";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();
  const chapters = await getChapters();
  const perm = permissions(session, chapters);
  const alerts = await getAlerts(session.id);
  const noRole = session.assignments.length === 0;

  const groups: NavGroup[] = [
    { items: [{ href: "/", label: "Inicio", icon: "home", badge: alerts.length }] },
    {
      title: "Principal",
      items: [
        { href: "/calendar", label: "Calendario", icon: "calendar" },
        { href: "/photos", label: "Fotos", icon: "photos" },
        { href: "/toolbox", label: "Toolbox", icon: "toolbox" },
        { href: "/links", label: "Enlaces", icon: "links" },
        { href: "/donate", label: "Donar", icon: "donate" },
      ],
    },
    ...(perm.canManage || perm.isStaff
      ? [{
          title: "Gestión",
          items: [
            ...(perm.canManage ? [{ href: "/manage", label: perm.managedChapters.length === 1 ? `Chapter ${perm.managedChapters[0].name}` : "Chapters", icon: "manage" } as NavItem] : []),
            ...(perm.isStaff ? [{ href: "/admin", label: "Administración", icon: "admin" } as NavItem] : []),
          ],
        }]
      : []),
    {
      title: "Mi cuenta",
      items: [
        { href: "/me", label: "Mi perfil", icon: "profile" },
        ...(noRole ? [{ href: "/unirse", label: "Tengo un código", icon: "join" } as NavItem] : []),
      ],
    },
  ];
  const tabs: NavItem[] = [
    { href: "/", label: "Inicio", icon: "home" },
    { href: "/calendar", label: "Eventos", icon: "calendar" },
    { href: "/photos", label: "Fotos", icon: "photos" },
    perm.canManage ? { href: "/manage", label: "Gestión", icon: "manage" } : { href: "/donate", label: "Donar", icon: "donate" },
  ];

  const a = session.assignments[0];
  const scope = a?.scope_type === "chapter" ? chapters.find((c) => c.id === a.scope_id)?.name : a?.scope_type === "region" ? "España" : null;
  const name = session.profile.full_name || session.email || "";
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

  return (
    <AppShell
      groups={groups} tabs={tabs} alerts={alerts.length} signOut={signOut} demo={DEMO}
      user={{ name, initials, role: a ? `${a.board_position ?? ROLE_LABEL[a.role]}${scope ? ` · ${scope}` : ""}` : "Sin chapter" }}
    >
      {children}
    </AppShell>
  );
}
