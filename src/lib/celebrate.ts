/**
 * Confeti con los colores de BBYO + aviso breve. Se dibuja fuera de React para que
 * sobreviva al re-render (el formulario desaparece en cuanto la inscripción existe).
 */
const COLORS = ["#1a03b5", "#e42158", "#f8450a", "#00d7eb", "#f8f90a", "#6bbd00"];

export function celebrate(from: DOMRect | null, message: string) {
  if (typeof window === "undefined") return;
  toast(message);
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "60" });
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  const ox = from ? from.left + from.width / 2 : innerWidth / 2;
  const oy = from ? from.top + from.height / 2 : innerHeight * 0.6;
  const parts = Array.from({ length: 90 }, () => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6; // abanico hacia arriba
    const v = 7 + Math.random() * 8;
    return {
      x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      w: 6 + Math.random() * 6, h: 8 + Math.random() * 8, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      c: COLORS[(Math.random() * COLORS.length) | 0], round: Math.random() < 0.3,
    };
  });

  const start = performance.now();
  const DURATION = 1800;
  const frame = (t: number) => {
    const k = (t - start) / DURATION;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalAlpha = k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1;
    for (const p of parts) {
      p.vy += 0.35; p.vx *= 0.985; p.vy *= 0.985;
      p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
      if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 2);
      ctx.restore();
    }
    if (k < 1) requestAnimationFrame(frame); else canvas.remove();
  };
  requestAnimationFrame(frame);
}

function toast(message: string) {
  const el = document.createElement("div");
  el.setAttribute("role", "status");
  el.className = "celebrate-toast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => { el.classList.add("celebrate-toast-out"); setTimeout(() => el.remove(), 300); }, 2600);
}
