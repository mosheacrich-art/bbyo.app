import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession, permissions } from "@/lib/auth/session";
import { getChapters } from "@/lib/data";
import { PageHeader } from "@/components/page-header";

export default async function Manage() {
  const s = await requireSession();
  const perm = permissions(s, await getChapters());
  if (perm.managedChapters.length === 0) redirect("/");
  if (perm.managedChapters.length === 1) redirect(`/manage/${perm.managedChapters[0].slug}`);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Gestión" title="Tus chapters" subtitle="Elige el chapter que quieres gestionar." />
      <div className="grid gap-3 md:grid-cols-3">
        {perm.managedChapters.map((c) => (
          <Link key={c.id} href={`/manage/${c.slug}`} className="card transition hover:border-indigo/40">
            <p className="h-display text-4xl">{c.name}</p><p className="text-sm text-indigo/60">{c.city}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
