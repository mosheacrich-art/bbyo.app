"use client";
import { useActionState } from "react";
import { sendMagicLink } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(sendMagicLink, null);
  if (state && "sent" in state && state.sent)
    return (
      <div className="rounded-2xl bg-mist p-5 text-indigo">
        <p className="font-bold">Revisa tu correo</p>
        <p className="mt-1 text-sm">Te hemos enviado un enlace a {state.sent}. Ábrelo desde este dispositivo para entrar.</p>
      </div>
    );
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <label className="block text-sm font-semibold text-indigo" htmlFor="email">Correo electrónico</label>
      <input id="email" name="email" type="email" required autoComplete="email" placeholder="tu@correo.com"
        className="w-full rounded-full border-2 border-indigo/20 bg-white px-5 py-3 outline-none focus:border-indigo" />
      {state && "error" in state && state.error && <p className="text-sm font-semibold text-lox" role="alert">{state.error}</p>}
      <button disabled={pending} className="btn w-full">{pending ? "Enviando…" : "Entrar con enlace mágico"}</button>
      <p className="text-xs text-indigo/70">Sin contraseñas. Si es tu primera vez, se crea tu cuenta al entrar.</p>
    </form>
  );
}
