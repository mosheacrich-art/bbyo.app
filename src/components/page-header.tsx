export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow: string; title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 lg:pr-14">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="h-display mt-2 text-5xl md:text-6xl">{title}</h1>
        {subtitle && <p className="mt-2 text-indigo/65">{subtitle}</p>}
      </div>
      {actions}
    </header>
  );
}
