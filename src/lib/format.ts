const TZ = "Europe/Madrid";
export const eur = (cents: number) =>
  cents === 0 ? "Gratis" : new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
export const dateLong = (iso: string) =>
  new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(new Date(iso));
export const dateShort = (iso: string) =>
  new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: TZ }).format(new Date(iso));
export const timeOf = (iso: string) =>
  new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(iso));
export const monthOf = (iso: string) =>
  new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: TZ }).format(new Date(iso));
export const dayNum = (iso: string) =>
  new Intl.DateTimeFormat("es-ES", { day: "2-digit", timeZone: TZ }).format(new Date(iso));
export const ageOn = (birth: string | null, on = new Date()) => {
  if (!birth) return null;
  const b = new Date(birth);
  let a = on.getFullYear() - b.getFullYear();
  const m = on.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && on.getDate() < b.getDate())) a--;
  return a;
};
