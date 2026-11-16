import { LoginForm } from "./form";
import { DEMO } from "@/lib/demo/mode";
import { demoStore } from "@/lib/demo/store";
import { demoSignIn } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next = "/", error } = await searchParams;
  return (
    <main className={`mx-auto flex min-h-dvh flex-col justify-center px-6 py-12 ${DEMO ? "max-w-3xl" : "max-w-md"}`}>
      <p className="font-display text-sm font-bold uppercase tracking-widest text-indigo/70">BBYO España · propuesta no oficial</p>
      <h1 className="font-display mt-2 text-6xl font-extrabold uppercase leading-[0.9] text-indigo">Entra a tu chapter</h1>
      <p className="mt-4 text-indigo/80">Calendario, inscripciones, fotos y todo lo de tu chapter en un sitio.</p>
      {error && <p className="mt-4 rounded-xl bg-lox/10 p-3 text-sm font-semibold text-lox">El enlace ha caducado o ya se usó. Pide uno nuevo.</p>}
      {DEMO ? (
        <section className="mt-8">
          <p className="mb-3 rounded-xl bg-sunrise/60 px-4 py-2 text-sm font-semibold text-indigo">
            Demo: elige con quién entrar. Cada persona ve la app según su rol. Los cambios duran hasta reiniciar el servidor.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {demoStore().personas.map((p) => (
              <form key={p.id} action={demoSignIn}>
                <input type="hidden" name="user" value={p.id} />
                <input type="hidden" name="next" value={next} />
                <button className="card h-full w-full text-left transition hover:border-indigo/50 hover:bg-mist/30">
                  <span className="block text-xs font-bold uppercase tracking-wide text-lox">{p.label}</span>
                  <span className="mt-1 block text-lg font-extrabold text-indigo">{p.name}</span>
                  <span className="mt-1 block text-sm text-indigo/70">{p.hint}</span>
                </button>
              </form>
            ))}
          </div>
        </section>
      ) : (
        <div className="mt-8"><LoginForm next={next} /></div>
      )}
    </main>
  );
}
