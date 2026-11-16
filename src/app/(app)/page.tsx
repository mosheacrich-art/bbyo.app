import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CalendarDays, Camera, ChevronRight, CreditCard, Heart, LayoutDashboard, MapPin, ShieldCheck, Sparkles, Ticket, Wrench } from "lucide-react";
import { requireSession, permissions } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getChapters, STATUS_LABEL, LAYER_LABEL, type EventRow, type RegRow } from "@/lib/data";
import { getAlerts } from "@/lib/alerts";
import { EventPosterLink } from "@/components/event-poster";
import { dateLong, dateShort, timeOf, eur } from "@/lib/format";

const hebrewDate = (d: Date) => {
  const s = new Intl.DateTimeFormat("es-ES-u-ca-hebrew", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" }).format(d).replace(/\s*AM$/, "");
  return s.replace(/ de ([a-z])/, (_, c: string) => ` de ${c.toUpperCase()}`);
};
const fullDate = (d: Date) => new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" }).format(d);

export default async function Home() {
  const session = await requireSession();
  const supabase = await createClient();
  const chapters = await getChapters();
  const perm = permissions(session, chapters);
  const byId = new Map(chapters.map((c) => [c.id, c]));
  const now = new Date();
  const nowIso = now.toISOString();

  const myChapterId = session.profile.home_chapter_id ?? session.assignments.find((a) => a.scope_type === "chapter")?.scope_id ?? null;
  const myChapter = myChapterId ? byId.get(myChapterId) : undefined;

  const [{ data: events }, { data: regs }, { data: albums }, alerts, { count: members }, { data: board }] = await Promise.all([
    supabase.from("events").select("*").eq("status", "publicado").gte("starts_at", nowIso).order("starts_at").limit(12),
    supabase.from("registrations").select("id, event_id, person_id, registered_by, status, checked_in_at, events(title, starts_at)").neq("status", "cancelada").order("created_at", { ascending: false }),
    supabase.from("albums").select("id, title, chapter_id, created_at, photos(id, storage_path, status)").order("created_at", { ascending: false }),
    getAlerts(session.id),
    myChapterId ? supabase.from("profiles").select("id", { count: "exact", head: true }).eq("home_chapter_id", myChapterId) : Promise.resolve({ count: null }),
    myChapterId ? supabase.from("role_assignments").select("board_position, profiles!role_assignments_user_id_fkey(full_name)").eq("scope_id", myChapterId).eq("role", "chapter_board") : Promise.resolve({ data: [] }),
  ]);
  const upcoming = (events ?? []) as EventRow[];
  const myRegs = (regs ?? []) as unknown as (RegRow & { events: { title: string; starts_at: string } })[];
  const registered = new Set(myRegs.filter((r) => r.person_id === session.id).map((r) => r.event_id));
  const mine = myRegs.filter((r) => r.person_id === session.id && r.events.starts_at >= nowIso).slice(0, 4);
  const nextLocal = upcoming.find((e) => e.chapter_id === myChapterId);
  const featured = upcoming.find((e) => e.layer !== "local" && (e.overnight || e.price_cents > 0)) ?? upcoming.find((e) => e.layer !== "local");
  const daysTo = featured ? Math.ceil((new Date(featured.starts_at).getTime() - now.getTime()) / 86_400_000) : 0;

  // Fotos publicadas para el carrusel
  const admin = createAdminClient();
  const shots = (albums ?? []).flatMap((a) =>
    (a.photos as { id: string; storage_path: string; status: string }[]).filter((p) => p.status === "publicada").map((p) => ({ ...p, album: a.title as string, chapter: byId.get(a.chapter_id)?.name })),
  ).slice(0, 8);
  const { data: signed } = shots.length ? await admin.storage.from("photos").createSignedUrls(shots.map((s) => s.storage_path), 3600) : { data: [] };
  const photos = shots.map((s, i) => ({ ...s, url: signed?.[i]?.signedUrl })).filter((p) => p.url);

  const first = session.profile.full_name.split(" ")[0] || "bienvenido/a";
  const tiles = [
    { href: "/calendar", label: "Calendario", icon: CalendarDays },
    { href: "/photos", label: "Fotos", icon: Camera },
    { href: "/toolbox", label: "Toolbox", icon: Wrench },
    perm.canManage ? { href: "/manage", label: "Gestión", icon: LayoutDashboard } : { href: "/donate", label: "Donar", icon: Heart },
  ];
  const noRole = session.assignments.length === 0;

  return (
    <div className="space-y-10">
      {/* Saludo + tarjeta del chapter */}
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:items-start lg:pr-14">
        <div>
          <p className="font-bold text-lox" lang="he" dir="rtl" style={{ textAlign: "left" }}>שָׁלוֹם</p>
          <h1 className="h-display mt-1 text-5xl md:text-6xl">Shalom,<br />{first}!</h1>
          <p className="mt-3 text-sm text-indigo/60"><span className="inline-block first-letter:uppercase">{fullDate(now)}</span> · {hebrewDate(now)}</p>
        </div>
        <div>
          <p className="mb-2 text-sm font-bold text-indigo">{myChapter ? `Tu chapter: ${myChapter.name}` : "BBYO España"}</p>
          <div className="card grid gap-4 sm:grid-cols-3" style={myChapter?.accent ? { borderTop: `4px solid ${myChapter.accent}` } : undefined}>
            {myChapter ? (
              <>
                <div>
                  <p className="text-xs font-semibold text-indigo/55">Próximo programa</p>
                  {nextLocal ? (
                    <Link href={`/events/${nextLocal.id}`} className="mt-0.5 block font-bold text-indigo hover:underline">{nextLocal.title}<span className="block text-sm font-semibold text-lox first-letter:uppercase">{dateShort(nextLocal.starts_at)} · {timeOf(nextLocal.starts_at)}</span></Link>
                  ) : <p className="mt-0.5 text-indigo/60">Nada programado aún</p>}
                </div>
                <div>
                  <p className="text-xs font-semibold text-indigo/55">Board</p>
                  <ul className="mt-0.5 space-y-0.5 text-sm">
                    {((board ?? []) as unknown as { board_position: string | null; profiles: { full_name: string } | null }[]).slice(0, 3).map((b, i) => (
                      <li key={i}><b className="text-indigo">{b.profiles?.full_name}</b> <span className="text-indigo/55">{b.board_position}</span></li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-indigo/55">Miembros</p>
                  <p className="font-display text-4xl font-extrabold text-indigo">{members ?? 0}</p>
                </div>
              </>
            ) : (
              <>
                <div><p className="text-xs font-semibold text-indigo/55">Chapters</p><p className="font-display text-4xl font-extrabold text-indigo">{chapters.length}</p></div>
                <div><p className="text-xs font-semibold text-indigo/55">Próximos eventos</p><p className="font-display text-4xl font-extrabold text-indigo">{upcoming.length}</p></div>
                <div><p className="text-xs font-semibold text-indigo/55">Ciudades</p><p className="text-sm font-semibold text-indigo">{chapters.map((c) => c.name).join(" · ")}</p></div>
              </>
            )}
          </div>
        </div>
      </section>

      {noRole && (
        <section className="card flex flex-wrap items-center justify-between gap-4 border-2 border-indigo bg-mist">
          <div>
            <h2 className="text-xl font-extrabold text-indigo">Todavía no estás en ningún chapter</h2>
            <p className="mt-1 text-indigo/80">Pide un código de invitación a tu chapter board y úsalo aquí.</p>
          </div>
          <Link href="/unirse" className="btn"><Ticket size={16} className="mr-2" aria-hidden />Tengo un código</Link>
        </section>
      )}

      {alerts.length > 0 && (
        <section id="atencion" className="scroll-mt-24 space-y-3">
          <h2 className="section-title"><Sparkles size={18} className="text-lox" aria-hidden />Necesita tu atención</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {alerts.map((a) => (
              <Link key={a.id} href={`/events/${a.eventId}`}
                className={`card flex items-center gap-4 transition hover:shadow-md ${a.kind === "autorizar" ? "border-lox/30 bg-lox/5" : "border-jaffa/30 bg-jaffa/5"}`}>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white ${a.kind === "autorizar" ? "bg-lox" : "bg-jaffa"}`}>
                  {a.kind === "autorizar" ? <ShieldCheck size={18} aria-hidden /> : <CreditCard size={18} aria-hidden />}
                </span>
                <span className="min-w-0 flex-1 text-sm">
                  {a.kind === "autorizar" ? <><b>{a.personName}</b> quiere ir a <b>{a.eventTitle}</b></> : <>Pago pendiente: <b>{a.eventTitle}</b>{!a.isMe && <> ({a.personName})</>}</>}
                </span>
                <span className="btn btn-sm">{a.kind === "autorizar" ? "Autorizar" : "Pagar"}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Accesos rápidos */}
      <section>
        <h2 className="section-title mb-3"><span className="grid grid-cols-2 gap-0.5" aria-hidden>{[0, 1, 2, 3].map((i) => <span key={i} className="h-1.5 w-1.5 rounded-sm bg-lox" />)}</span>Accesos rápidos</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {tiles.map((t) => (
            <Link key={t.href} href={t.href} className="card flex flex-col items-center gap-2 py-6 text-sm font-semibold text-indigo transition hover:-translate-y-0.5 hover:shadow-md">
              <t.icon size={22} strokeWidth={1.6} className="text-indigo" aria-hidden />{t.label}
            </Link>
          ))}
        </div>
      </section>

      {/* Carrusel de fotos */}
      {photos.length > 0 && (
        <section aria-label="Momentos del chapter" className="relative overflow-hidden rounded-2xl bg-night">
          <div className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto">
            {photos.map((p) => (
              <Link key={p.id} href="/photos" className="relative aspect-[4/3] w-[85%] shrink-0 snap-start sm:w-1/2 lg:w-1/3">
                <Image src={p.url!} alt={`Foto de ${p.album}`} fill unoptimized className="object-cover" />
              </Link>
            ))}
          </div>
          <p className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-5 pb-4 pt-12 font-semibold italic text-white">
            Momentos inolvidables{myChapter ? ` de BBYO ${myChapter.name}` : " de BBYO España"}
          </p>
        </section>
      )}

      {/* Próximos eventos */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="section-title"><CalendarDays size={18} className="text-lox" aria-hidden />Próximos eventos</h2>
          <Link href="/calendar" className="flex items-center gap-1 text-sm font-bold text-indigo hover:underline">Ver todos <ArrowRight size={15} aria-hidden /></Link>
        </div>
        {upcoming.length ? (
          <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
            {upcoming.slice(0, 8).map((e) => (
              <EventPosterLink key={e.id} e={e} accent={e.chapter_id ? byId.get(e.chapter_id)?.accent : null}
                chapterName={e.chapter_id ? byId.get(e.chapter_id)?.name : undefined} badge={registered.has(e.id) ? "Inscrito" : undefined} />
            ))}
          </div>
        ) : <p className="text-indigo/60">No hay eventos próximos.</p>}
      </section>

      {/* Evento destacado */}
      {featured && (
        <section>
          <h2 className="section-title mb-3"><Sparkles size={18} className="text-lox" aria-hidden />Gran evento</h2>
          <Link href={`/events/${featured.id}`} className="relative block overflow-hidden rounded-2xl bg-night p-6 text-white shadow-lg transition hover:shadow-xl sm:p-8">
            <span aria-hidden className="pointer-events-none absolute -bottom-8 right-4 select-none font-display text-[9rem] font-extrabold uppercase leading-none text-white/5 sm:text-[12rem]">BBYO</span>
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-cyan">{LAYER_LABEL[featured.layer]}{featured.overnight ? " · con pernocta" : ""}</p>
                <h3 className="mt-1 font-display text-4xl font-extrabold uppercase leading-[0.9] sm:text-5xl">{featured.title}</h3>
              </div>
              <span className="flex items-center gap-1 text-sm text-white/70">Ver evento <ChevronRight size={15} aria-hidden /></span>
            </div>
            <div className="relative mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
              <div><p className="text-xs text-white/55">Faltan</p><p className="font-display text-4xl font-extrabold text-sunrise">{daysTo} días</p></div>
              <div><p className="text-xs text-white/55">Fecha</p><p className="font-bold first-letter:uppercase">{dateLong(featured.starts_at)}</p><p className="text-xs text-white/55">{timeOf(featured.starts_at)}</p></div>
              <div><p className="flex items-center gap-1 text-xs text-white/55"><MapPin size={12} aria-hidden />Lugar</p><p className="font-bold">{featured.location}</p></div>
              <div><p className="text-xs text-white/55">Precio</p><p className="font-bold">{eur(featured.price_cents)}</p></div>
            </div>
          </Link>
        </section>
      )}

      {mine.length > 0 && (
        <section>
          <h2 className="section-title mb-3"><Ticket size={18} className="text-lox" aria-hidden />Mis inscripciones</h2>
          <ul className="divide-y divide-indigo/10 overflow-hidden rounded-2xl border border-indigo/10 bg-white">
            {mine.map((r) => (
              <li key={r.id}>
                <Link href={`/events/${r.event_id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-mist/30">
                  <span className="min-w-0"><b className="text-indigo">{r.events.title}</b><span className="block text-sm text-indigo/60 first-letter:uppercase">{dateLong(r.events.starts_at)}</span></span>
                  <span className="tag shrink-0">{STATUS_LABEL[r.status]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
