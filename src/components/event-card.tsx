import Link from "next/link";
import { dayNum, dateShort, timeOf, eur } from "@/lib/format";
import { LAYER_LABEL, type EventRow } from "@/lib/data";

const LAYER_COLOR = { global: "bg-indigo text-white", regional: "bg-lox text-white", local: "bg-cyan text-indigo" } as const;

export function EventCard({ e, chapterName, badge }: { e: EventRow; chapterName?: string; badge?: string }) {
  return (
    <Link href={`/events/${e.id}`} className="card flex gap-4 transition hover:border-indigo/40">
      <div className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl ${LAYER_COLOR[e.layer]}`}>
        <span className="font-display text-3xl font-extrabold leading-none">{dayNum(e.starts_at)}</span>
        <span className="text-[10px] font-bold uppercase">{dateShort(e.starts_at).split(" ").slice(1).join(" ")}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="tag">{e.layer === "local" && chapterName ? chapterName : LAYER_LABEL[e.layer]}</span>
          {e.status !== "publicado" && <span className="tag bg-sunrise">{e.status}</span>}
          {e.boards_only && <span className="tag">Solo boards</span>}
          {e.overnight && <span className="tag">Con pernocta</span>}
          {badge && <span className="tag bg-pistachio/20">{badge}</span>}
        </div>
        <h3 className="mt-1 truncate text-lg font-extrabold text-indigo">{e.title}</h3>
        <p className="text-sm text-indigo/70">{timeOf(e.starts_at)} · {e.location || "Lugar por confirmar"} · {eur(e.price_cents)}</p>
      </div>
    </Link>
  );
}
