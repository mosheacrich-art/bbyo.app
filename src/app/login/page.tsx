import { LoginForm } from "./form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next = "/", error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <p className="font-display text-sm font-bold uppercase tracking-widest text-indigo/70">BBYO España · propuesta no oficial</p>
      <h1 className="font-display mt-2 text-6xl font-extrabold uppercase leading-[0.9] text-indigo">Entra a tu chapter</h1>
      <p className="mt-4 text-indigo/80">Calendario, inscripciones, fotos y todo lo de tu chapter en un sitio.</p>
      {error && <p className="mt-4 rounded-xl bg-lox/10 p-3 text-sm font-semibold text-lox">El enlace ha caducado o ya se usó. Pide uno nuevo.</p>}
      <div className="mt-8"><LoginForm next={next} /></div>
    </main>
  );
}
