"use client";
import { useActionState, useRef } from "react";
import { celebrate as burst } from "@/lib/celebrate";

type Result = { error?: string; ok?: boolean } | null;

export function ActionForm({
  action, children, submit, className = "", hidden = {}, celebrate,
}: {
  action: (prev: Result, form: FormData) => Promise<Result>;
  children?: React.ReactNode; submit: string; className?: string; hidden?: Record<string, string>;
  /** Si se indica, al terminar bien lanza confeti y muestra este mensaje. */
  celebrate?: string;
}) {
  const btn = useRef<HTMLButtonElement>(null);
  const [state, run, pending] = useActionState(async (prev: Result, form: FormData) => {
    const rect = btn.current?.getBoundingClientRect() ?? null;
    const res = await action(prev, form);
    if (res?.ok && celebrate) burst(rect, celebrate);
    return res;
  }, null);
  return (
    <form action={run} className={className}>
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {children}
      {state?.error && <p role="alert" className="mt-2 text-sm font-semibold text-lox">{state.error}</p>}
      {state?.ok && !celebrate && <p className="mt-2 text-sm font-semibold text-pistachio">Hecho.</p>}
      <button ref={btn} disabled={pending} className="btn btn-sm mt-3">{pending ? "Un momento…" : submit}</button>
    </form>
  );
}
