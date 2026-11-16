"use client";
import { useActionState } from "react";

type Result = { error?: string; ok?: boolean } | null;

export function ActionForm({
  action, children, submit, className = "", hidden = {},
}: {
  action: (prev: Result, form: FormData) => Promise<Result>;
  children?: React.ReactNode; submit: string; className?: string; hidden?: Record<string, string>;
}) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form action={run} className={className}>
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {children}
      {state?.error && <p role="alert" className="mt-2 text-sm font-semibold text-lox">{state.error}</p>}
      {state?.ok && <p className="mt-2 text-sm font-semibold text-pistachio">Hecho.</p>}
      <button disabled={pending} className="btn btn-sm mt-3">{pending ? "Un momento…" : submit}</button>
    </form>
  );
}
