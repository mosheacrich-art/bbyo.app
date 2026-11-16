"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Nav({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto" aria-label="Principal">
      {items.map((i) => {
        const on = i.href === "/" ? path === "/" : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${on ? "bg-indigo text-white" : "text-indigo hover:bg-mist"}`}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
