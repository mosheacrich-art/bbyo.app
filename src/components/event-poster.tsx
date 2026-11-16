import Link from "next/link";
import { CalendarDays, Clock, MapPin, Users } from "lucide-react";
import { dateLong, dateShort, dayNum, timeOf, eur } from "@/lib/format";
import { LAYER_LABEL, type EventRow } from "@/lib/data";

const LAYER_BG = { global: "#1a03b5", regional: "#e42158" } as const;
const PALETTE = ["#1a03b5", "#e42158", "#f8450a", "#10066e", "#0b8a9a", "#5a2bd6"];

function hash(s: string) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }

/** Cartel generado del evento (sustituye a la imagen hasta que los boards suban sus propios carteles). */
export function Poster({ e, accent, chapterName, badge, className = "" }: { e: EventRow; accent?: string | null; chapterName?: string; badge?: string; className?: string }) {
  if (e.flyer_url) {
    return (
      <div className={`relative aspect-[3/4] overflow-hidden rounded-2xl bg-mist ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={e.flyer_url} alt={`Cartel: ${e.title}`} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        {badge && <span className="absolute right-3 top-3 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-indigo shadow">{badge}</span>}
      </div>
    );
  }
  const h = hash(e.id);
  const bg = PALETTE[h % PALETTE.length];
  const v = h % 3;
  return (
    <div className={`relative aspect-[3/4] overflow-hidden rounded-2xl text-white ${className}`} style={{ background: bg }}>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" aria-hidden>
        {v === 0 && <><circle cx="360" cy="70" r="150" fill="#fff" opacity=".12" /><circle cx="40" cy="470" r="110" fill="#000" opacity=".12" /></>}
        {v === 1 && <><rect x="200" y="-40" width="260" height="260" rx="60" transform="rotate(20 330 90)" fill="#fff" opacity=".12" /><circle cx="70" cy="430" r="90" fill="#f8f90a" opacity=".22" /></>}
        {v === 2 && <><path d="M0 330 Q200 250 400 340 L400 500 L0 500Z" fill="#000" opacity=".14" /><circle cx="330" cy="110" r="70" fill="#00d7eb" opacity=".3" /></>}
      </svg>
      <div className="relative flex h-full flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <span className="font-display text-lg font-extrabold uppercase leading-none tracking-tight">BBYO
            <span className="mt-1 flex items-center gap-1 text-[9px] font-bold tracking-[0.25em] opacity-90">
              <span className="h-2 w-2 rounded-full ring-1 ring-white/70" style={{ background: e.layer === "local" ? accent ?? "#fff" : LAYER_BG[e.layer] }} />
              {e.layer === "local" ? chapterName : LAYER_LABEL[e.layer]}
            </span>
          </span>
          {badge && <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-indigo shadow">{badge}</span>}
        </div>
        <h3 className="mt-auto font-display text-[2.1rem] font-extrabold uppercase leading-[0.88] tracking-tight [text-wrap:balance]">{e.title}</h3>
        <div className="mt-4 space-y-1.5 text-xs font-semibold">
          <p className="flex items-center gap-1.5 first-letter:uppercase"><CalendarDays size={14} aria-hidden />{dateLong(e.starts_at)}</p>
          <p className="flex items-center gap-1.5"><MapPin size={14} aria-hidden />{e.location || "Por confirmar"}</p>
        </div>
        <span className="mt-4 inline-flex w-fit items-center rounded-full bg-white px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-indigo">
          {e.price_cents ? `Inscríbete · ${eur(e.price_cents)}` : "Inscríbete gratis"}
        </span>
      </div>
    </div>
  );
}

/** Tarjeta pequeña para la fila horizontal de la home. */
export function EventPosterLink(props: { e: EventRow; accent?: string | null; chapterName?: string; badge?: string }) {
  return (
    <Link href={`/events/${props.e.id}`} className="group block w-60 shrink-0 snap-start sm:w-64">
      <Poster {...props} className="shadow-sm transition group-hover:-translate-y-1 group-hover:shadow-xl" />
      <p className="mt-2.5 truncate font-bold text-indigo">{props.e.title}</p>
      <p className="text-sm text-indigo/60">{dateShort(props.e.starts_at)} · {timeOf(props.e.starts_at)}</p>
    </Link>
  );
}

/** Tarjeta grande de la lista de eventos: cartel + ficha. */
export function EventListCard({ e, accent, chapterName, badge, seats }: { e: EventRow; accent?: string | null; chapterName?: string; badge?: string; seats?: number }) {
  const bar = e.layer === "local" ? accent ?? "#1a03b5" : LAYER_BG[e.layer];
  return (
    <Link href={`/events/${e.id}`} className="group flex flex-col overflow-hidden rounded-2xl border border-indigo/10 bg-white shadow-sm transition hover:shadow-lg" style={{ borderLeft: `4px solid ${bar}` }}>
      <Poster e={e} accent={accent} chapterName={chapterName} badge={badge} className="rounded-none" />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-paper text-center leading-none">
            <span className="font-display text-2xl font-extrabold text-indigo">{dayNum(e.starts_at)}</span>
            <span className="-mt-2 text-[10px] font-bold uppercase text-indigo/60">{dateShort(e.starts_at).split(" ").slice(1).join(" ").replace(".", "")}</span>
          </div>
          <div className="flex flex-wrap justify-end gap-1">
            <span className="tag">{e.layer === "local" ? chapterName : LAYER_LABEL[e.layer]}</span>
            {e.overnight && <span className="tag">Con pernocta</span>}
            {e.boards_only && <span className="tag">Solo boards</span>}
            {e.status !== "publicado" && <span className="tag bg-sunrise">{e.status}</span>}
          </div>
        </div>
        <h3 className="mt-3 text-lg font-extrabold text-indigo">{e.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-indigo/70">{e.description}</p>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-indigo/60">
          <span className="flex items-center gap-1"><Clock size={13} aria-hidden />{timeOf(e.starts_at)}</span>
          <span className="flex items-center gap-1"><MapPin size={13} aria-hidden />{e.location || "Por confirmar"}</span>
          {e.capacity && <span className="flex items-center gap-1"><Users size={13} aria-hidden />{seats ?? 0}/{e.capacity}</span>}
        </div>
        <div className="mt-auto flex items-center justify-between pt-5">
          <span className="font-bold text-indigo">{eur(e.price_cents)}</span>
          <span className="btn btn-sm">{badge ? "Ver inscripción" : "Inscribirme"}</span>
        </div>
      </div>
    </Link>
  );
}
