import "server-only";
import { demoStore, today, type DB, type Row } from "./store";

/**
 * Cliente falso con la misma forma que supabase-js para las consultas que usa la app.
 * Reproduce las reglas de visibilidad más importantes (RLS) y las funciones SQL (rpc).
 */
type Err = { message: string; code?: string };
type Result = { data: unknown; error: Err | null; count?: number | null };
type Ctx = { uid: string | null; admin: boolean };

const PK: Record<string, string[]> = {
  prospect_pipeline: ["person_id"], photo_consents: ["person_id"], registration_health: ["registration_id"], invites: ["code"],
};
const DEFAULTS: Record<string, () => Row> = {
  events: () => ({ description: "", location: "", price_cents: 0, capacity: null, is_open: false, alumni_ok: false, boards_only: false, overnight: false, status: "borrador", region_id: null, chapter_id: null, created_by: null, approved_by: null, approved_at: null }),
  registrations: () => ({ authorized_by: null, authorized_at: null, checked_in_at: null }),
  payments: () => ({ currency: "eur", status: "pendiente", provider: "stripe", provider_ref: null, registration_id: null, donation_id: null }),
  donations: () => ({ recurring: false, status: "pendiente", campaign_id: null, chapter_id: null }),
  role_assignments: () => ({ starts_on: today(), ends_on: null, board_position: null, created_by: null }),
  invites: () => ({ uses_left: 1, expires_at: null }),
  memberships: () => ({ paid: false, valid_until: null, plan_id: null }),
  prospect_pipeline: () => ({ stage: "contacto", notes: "", owner_id: null }),
};
const NO_ID = new Set(["prospect_pipeline", "photo_consents", "registration_health", "invites", "audit_log"]);
const err = (message: string, code?: string): Result => ({ data: null, error: { message, code } });

// ───────────── Permisos (port de supabase/migrations/*_security.sql) ─────────────
function rolesOf(db: DB, uid: string | null) {
  if (!uid) return [];
  const t = today();
  return db.role_assignments.filter((a) => a.user_id === uid && (a.starts_on as string) <= t && (!a.ends_on || (a.ends_on as string) >= t));
}
const regionOf = (db: DB, c: unknown) => db.chapters.find((x) => x.id === c)?.region_id;
function hasScope(db: DB, uid: string | null, role: string, c: unknown = null, rg: unknown = null) {
  return rolesOf(db, uid).some((a) => a.role === role && (
    a.scope_type === "global" ||
    (a.scope_type === "region" && a.scope_id === (rg ?? regionOf(db, c))) ||
    (a.scope_type === "chapter" && c != null && a.scope_id === c)));
}
function hasRoleInRegion(db: DB, uid: string | null, role: string, rg: unknown) {
  return rolesOf(db, uid).some((a) => a.role === role && (
    a.scope_type === "global" || (a.scope_type === "region" && a.scope_id === rg) || (a.scope_type === "chapter" && regionOf(db, a.scope_id) === rg)));
}
const managesChapter = (db: DB, uid: string | null, c: unknown) =>
  hasScope(db, uid, "staff", c) || hasScope(db, uid, "regional_board", c) || hasScope(db, uid, "chapter_board", c);
const managesRegion = (db: DB, uid: string | null, rg: unknown) => hasScope(db, uid, "staff", null, rg) || hasScope(db, uid, "regional_board", null, rg);
const isGuardian = (db: DB, uid: string | null, child: unknown) => db.guardianships.some((g) => g.guardian_id === uid && g.child_id === child && g.verified);
function eventManages(db: DB, uid: string | null, e: Row | undefined) {
  if (!e) return false;
  if (e.layer === "global") return hasScope(db, uid, "staff");
  if (e.layer === "regional") return managesRegion(db, uid, e.region_id);
  return managesChapter(db, uid, e.chapter_id);
}
function eventVisible(db: DB, uid: string | null, e: Row) {
  if (!uid) return false;
  const roles = rolesOf(db, uid);
  if (e.layer === "global") return hasScope(db, uid, "staff") || (e.status === "publicado" && roles.length > 0);
  if (e.layer === "regional") {
    if (managesRegion(db, uid, e.region_id)) return true;
    if (e.status !== "publicado") return false;
    if (e.boards_only) return db.chapters.some((c) => c.region_id === e.region_id && hasScope(db, uid, "chapter_board", c.id));
    return (!!e.is_open && roles.length > 0) || ["member", "chapter_board", "parent", "staff"].some((r) => hasRoleInRegion(db, uid, r, e.region_id))
      || (!!e.alumni_ok && hasRoleInRegion(db, uid, "alumni", e.region_id));
  }
  if (managesChapter(db, uid, e.chapter_id)) return true;
  if (e.status !== "publicado" || e.boards_only) return false;
  return hasScope(db, uid, "member", e.chapter_id) || hasScope(db, uid, "parent", e.chapter_id)
    || (!!e.is_open && hasScope(db, uid, "prospect", e.chapter_id)) || (!!e.alumni_ok && hasScope(db, uid, "alumni", e.chapter_id));
}
const eventById = (db: DB, id: unknown) => db.events.find((e) => e.id === id);

function visible(db: DB, ctx: Ctx, table: string, r: Row): boolean {
  if (ctx.admin) return true;
  const u = ctx.uid;
  switch (table) {
    case "events": return eventVisible(db, u, r);
    case "registrations": return r.person_id === u || r.registered_by === u || isGuardian(db, u, r.person_id) || eventManages(db, u, eventById(db, r.event_id));
    case "registration_health": {
      const reg = db.registrations.find((x) => x.id === r.registration_id);
      return !!reg && eventManages(db, u, eventById(db, reg.event_id));
    }
    case "resources": return !r.boards_only || rolesOf(db, u).some((a) => ["staff", "regional_board", "chapter_board"].includes(a.role as string));
    case "albums": return managesChapter(db, u, r.chapter_id) || hasScope(db, u, "member", r.chapter_id) || hasScope(db, u, "parent", r.chapter_id);
    case "photos": {
      const a = db.albums.find((x) => x.id === r.album_id);
      return !!a && (managesChapter(db, u, a.chapter_id) || (r.status === "publicada" && (hasScope(db, u, "member", a.chapter_id) || hasScope(db, u, "parent", a.chapter_id))));
    }
    default: return true;
  }
}

// ───────────── Query builder ─────────────
type Filter = { col: string; op: string; val: unknown };
type Embed = { key: string; table: string; hint: string | null; inner: boolean; cols: Parsed };
type Parsed = { all: boolean; fields: string[]; embeds: Embed[] };

function splitTop(s: string) {
  const out: string[] = []; let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
function parse(sel: string): Parsed {
  const p: Parsed = { all: false, fields: [], embeds: [] };
  for (const part of splitTop(sel)) {
    const m = part.match(/^([a-z_]+)(?:!([a-z_]+))?\((.*)\)$/);
    if (m) {
      const hint = m[2] ?? null;
      p.embeds.push({ key: m[1], table: m[1], hint: hint === "inner" ? null : hint, inner: hint === "inner", cols: parse(m[3]) });
    } else if (part === "*") p.all = true;
    else p.fields.push(part);
  }
  return p;
}
const singular = (t: string) => (t.endsWith("ies") ? t.slice(0, -3) + "y" : t.replace(/s$/, ""));

function cmp(a: unknown, b: unknown) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return (a as number) < (b as number) ? -1 : (a as number) > (b as number) ? 1 : 0;
}
function test(v: unknown, op: string, val: unknown) {
  switch (op) {
    case "eq": return v === val;
    case "neq": return v !== val && v != null;
    case "gt": return v != null && (v as number) > (val as number);
    case "gte": return v != null && (v as number) >= (val as number);
    case "lt": return v != null && (v as number) < (val as number);
    case "lte": return v != null && (v as number) <= (val as number);
    case "in": return (val as unknown[]).includes(v);
    case "is": return v === val;
    default: return true;
  }
}

class Query implements PromiseLike<Result> {
  private op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private sel = "*";
  private returning = false;
  private countMode = false;
  private head = false;
  private filters: Filter[] = [];
  private orders: { col: string; asc: boolean; nullsFirst?: boolean }[] = [];
  private lim: number | null = null;
  private one: "single" | "maybe" | null = null;
  private payload: Row | Row[] | null = null;
  private conflict: string[] | null = null;

  constructor(private db: DB, private ctx: Ctx, private table: string) {}

  select(cols = "*", opts?: { count?: string; head?: boolean }) {
    if (this.op === "select") { this.sel = cols; this.countMode = !!opts?.count; this.head = !!opts?.head; }
    else { this.returning = true; this.sel = cols; }
    return this;
  }
  insert(v: Row | Row[]) { this.op = "insert"; this.payload = v; return this; }
  update(v: Row) { this.op = "update"; this.payload = v; return this; }
  upsert(v: Row | Row[], opts?: { onConflict?: string }) { this.op = "upsert"; this.payload = v; this.conflict = opts?.onConflict?.split(",").map((s) => s.trim()) ?? null; return this; }
  delete() { this.op = "delete"; return this; }
  private f(op: string, col: string, val: unknown) { this.filters.push({ col, op, val }); return this; }
  eq(c: string, v: unknown) { return this.f("eq", c, v); }
  neq(c: string, v: unknown) { return this.f("neq", c, v); }
  gt(c: string, v: unknown) { return this.f("gt", c, v); }
  gte(c: string, v: unknown) { return this.f("gte", c, v); }
  lt(c: string, v: unknown) { return this.f("lt", c, v); }
  lte(c: string, v: unknown) { return this.f("lte", c, v); }
  in(c: string, v: unknown[]) { return this.f("in", c, v); }
  is(c: string, v: unknown) { return this.f("is", c, v); }
  order(col: string, o?: { ascending?: boolean; nullsFirst?: boolean }) { this.orders.push({ col, asc: o?.ascending ?? true, nullsFirst: o?.nullsFirst }); return this; }
  limit(n: number) { this.lim = n; return this; }
  single() { this.one = "single"; return this; }
  maybeSingle() { this.one = "maybe"; return this; }

  then<A = Result, B = never>(ok?: ((r: Result) => A | PromiseLike<A>) | null, ko?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve().then(() => this.run()).then(ok, ko);
  }

  private rows() { return (this.db[this.table] ??= []); }
  private matches(r: Row) { return this.filters.filter((f) => !f.col.includes(".")).every((f) => test(r[f.col], f.op, f.val)); }

  private project(table: string, r: Row, p: Parsed): Row | null {
    const out: Row = {};
    if (p.all) Object.assign(out, r);
    for (const f of p.fields) out[f] = r[f];
    for (const e of p.embeds) {
      const fk = e.hint ? e.hint.replace(new RegExp(`^${table}_`), "").replace(/_fkey$/, "") : `${singular(e.table)}_id`;
      const target = (this.db[e.table] ?? []).filter((t) => visible(this.db, this.ctx, e.table, t));
      let val: Row | Row[] | null;
      if (fk in r) {
        const t = target.find((x) => x.id === r[fk]);
        val = t ? this.project(e.table, t, e.cols) : null;
      } else {
        const back = `${singular(table)}_id`;
        val = target.filter((x) => x[back] === r.id).map((x) => this.project(e.table, x, e.cols)!);
      }
      const dotted = this.filters.filter((f) => f.col.startsWith(e.key + "."));
      if (dotted.length && val && !Array.isArray(val) && !dotted.every((f) => test((val as Row)[f.col.split(".")[1]], f.op, f.val))) val = null;
      if (e.inner && (val == null || (Array.isArray(val) && val.length === 0))) return null;
      out[e.key] = val;
    }
    return out;
  }

  private shape(found: Row[]): Result {
    const p = parse(this.sel);
    let data = found.map((r) => this.project(this.table, r, p)).filter((x): x is Row => x !== null);
    const count = data.length;
    if (this.lim != null) data = data.slice(0, this.lim);
    if (this.one) {
      if (data.length === 1) return { data: data[0], error: null, count };
      if (data.length === 0 && this.one === "maybe") return { data: null, error: null, count };
      return err(data.length ? "multiple_rows" : "row_not_found", "PGRST116");
    }
    if (this.head) return { data: null, error: null, count };
    return { data, error: null, count: this.countMode ? count : null };
  }

  private withDefaults(v: Row): Row {
    const row: Row = { ...(DEFAULTS[this.table]?.() ?? {}), ...v };
    if (!NO_ID.has(this.table) && !row.id) row.id = crypto.randomUUID();
    if (this.table === "audit_log") row.id = this.rows().length + 1;
    if (!("created_at" in row) && !NO_ID.has(this.table)) row.created_at = new Date().toISOString();
    return row;
  }

  private run(): Result {
    const rows = this.rows();
    if (this.op === "select") {
      let found = rows.filter((r) => visible(this.db, this.ctx, this.table, r) && this.matches(r));
      if (this.orders.length) {
        found = [...found].sort((a, b) => {
          for (const o of this.orders) {
            const va = a[o.col], vb = b[o.col];
            if (o.nullsFirst && (va == null) !== (vb == null)) return va == null ? -1 : 1;
            const c = cmp(va, vb);
            if (c) return o.asc ? c : -c;
          }
          return 0;
        });
      }
      return this.shape(found);
    }
    const list = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
    let touched: Row[] = [];
    if (this.op === "insert") {
      touched = list.map((v) => this.withDefaults(v));
      rows.push(...touched);
    } else if (this.op === "upsert") {
      const keys = this.conflict ?? PK[this.table] ?? ["id"];
      for (const v of list) {
        const hit = rows.find((r) => keys.every((k) => r[k] === v[k]));
        if (hit) { Object.assign(hit, v); touched.push(hit); } else { const n = this.withDefaults(v); rows.push(n); touched.push(n); }
      }
    } else if (this.op === "update") {
      touched = rows.filter((r) => this.matches(r));
      touched.forEach((r) => Object.assign(r, this.payload));
    } else {
      touched = rows.filter((r) => this.matches(r));
      this.db[this.table] = rows.filter((r) => !touched.includes(r));
    }
    if (!this.returning) return { data: null, error: null };
    return this.shape(touched);
  }
}

// ───────────── Funciones SQL (rpc) ─────────────
const occupied = (db: DB, eid: unknown) => db.registrations.filter((r) => r.event_id === eid && ["confirmada", "pendiente_pago"].includes(r.status as string)).length;
const ageOf = (birth: string) => {
  const b = new Date(birth), n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
};
function saveHealth(db: DB, reg: unknown, notes: unknown) {
  const t = typeof notes === "string" ? notes.trim() : "";
  if (!t) return;
  const hit = db.registration_health.find((h) => h.registration_id === reg);
  if (hit) Object.assign(hit, { notes: t, updated_at: new Date().toISOString() });
  else db.registration_health.push({ registration_id: reg, notes: t, updated_at: new Date().toISOString() });
}

function rpc(db: DB, ctx: Ctx, fn: string, a: Record<string, unknown> = {}): Result {
  const me = ctx.uid;
  const now = new Date().toISOString();
  switch (fn) {
    case "occupied_seats": return { data: occupied(db, a.eid), error: null };
    case "campaign_totals": {
      const m = new Map<unknown, number>();
      db.donations.filter((d) => d.status === "pagado" && d.campaign_id).forEach((d) => m.set(d.campaign_id, (m.get(d.campaign_id) ?? 0) + (d.amount_cents as number)));
      return { data: [...m].map(([campaign_id, total_cents]) => ({ campaign_id, total_cents })), error: null };
    }
    case "register_for_event": {
      if (!me) return err("not_authenticated");
      const e = eventById(db, a.p_event);
      if (!e || !eventVisible(db, me, e)) return err("event_not_found");
      if (e.status !== "publicado") return err("event_not_open");
      if ((e.starts_at as string) < now) return err("event_past");
      if (a.p_person !== me && !isGuardian(db, me, a.p_person)) return err("not_allowed");
      if (!eventVisible(db, a.p_person as string, e)) return err("not_eligible");
      const birth = db.profiles.find((p) => p.id === a.p_person)?.birth_date as string | null;
      if (!birth) return err("birth_date_required");
      const yrs = ageOf(birth);
      const needsGuardian = yrs < 18 && me === a.p_person && (yrs < 14 || (e.price_cents as number) > 0 || !!e.overnight);
      if (needsGuardian && !db.guardianships.some((g) => g.child_id === a.p_person && g.verified)) return err("guardian_required");
      const existing = db.registrations.find((r) => r.event_id === e.id && r.person_id === a.p_person);
      if (existing && existing.status !== "cancelada") return err("already_registered");
      const st = needsGuardian ? "pendiente_padres"
        : occupied(db, e.id) >= ((e.capacity as number | null) ?? Infinity) ? "lista_espera"
        : (e.price_cents as number) > 0 ? "pendiente_pago" : "confirmada";
      const fields = { status: st, registered_by: me, authorized_by: me !== a.p_person ? me : null, authorized_at: me !== a.p_person ? now : null, checked_in_at: null };
      let reg: Row;
      if (existing) { Object.assign(existing, fields); reg = existing; }
      else { reg = { id: crypto.randomUUID(), event_id: e.id, person_id: a.p_person, created_at: now, ...fields }; db.registrations.push(reg); }
      saveHealth(db, reg.id, a.p_health);
      return { data: reg, error: null };
    }
    case "authorize_registration": {
      const r = db.registrations.find((x) => x.id === a.p_reg);
      if (!r) return err("registration_not_found");
      if (r.status !== "pendiente_padres") return err("not_pending_authorization");
      if (!isGuardian(db, me, r.person_id)) return err("not_guardian");
      const e = eventById(db, r.event_id)!;
      if (e.status !== "publicado") return err("event_not_open");
      r.status = occupied(db, e.id) >= ((e.capacity as number | null) ?? Infinity) ? "lista_espera" : (e.price_cents as number) > 0 ? "pendiente_pago" : "confirmada";
      Object.assign(r, { authorized_by: me, authorized_at: now });
      saveHealth(db, r.id, a.p_health);
      return { data: r, error: null };
    }
    case "cancel_registration": {
      const r = db.registrations.find((x) => x.id === a.p_reg);
      if (!r) return err("registration_not_found");
      const e = eventById(db, r.event_id)!;
      if (!(r.person_id === me || isGuardian(db, me, r.person_id) || eventManages(db, me, e))) return err("not_allowed");
      const freed = ["confirmada", "pendiente_pago"].includes(r.status as string);
      r.status = "cancelada";
      db.registration_health = db.registration_health.filter((h) => h.registration_id !== r.id);
      if (freed) {
        const nxt = db.registrations.filter((x) => x.event_id === e.id && x.status === "lista_espera").sort((x, y) => cmp(x.created_at, y.created_at))[0];
        if (nxt) nxt.status = (e.price_cents as number) > 0 ? "pendiente_pago" : "confirmada";
      }
      return { data: r, error: null };
    }
    case "check_in": {
      const r = db.registrations.find((x) => x.id === a.p_reg);
      if (!r) return err("registration_not_found");
      if (!eventManages(db, me, eventById(db, r.event_id))) return err("not_allowed");
      if (r.status !== "confirmada") return err("not_confirmed");
      r.checked_in_at ??= now;
      return { data: r, error: null };
    }
    case "redeem_invite": {
      if (!me) return err("not_authenticated");
      const i = db.invites.find((x) => x.code === a.p_code);
      if (!i || (i.uses_left as number) <= 0 || (i.expires_at && (i.expires_at as string) < now)) return err("invite_invalid");
      const ra = { id: crypto.randomUUID(), user_id: me, role: i.role, scope_type: "chapter", scope_id: i.chapter_id, board_position: null, starts_on: today(), ends_on: null, created_by: i.created_by };
      db.role_assignments.push(ra);
      const p = db.profiles.find((x) => x.id === me);
      if (p) p.home_chapter_id ??= i.chapter_id;
      i.uses_left = (i.uses_left as number) - 1;
      db.audit_log.push({ id: db.audit_log.length + 1, at: now, actor_id: me, action: "insert", entity: "role_assignments", entity_id: ra.id, meta: {} });
      return { data: ra, error: null };
    }
    case "confirm_payment": {
      const p = db.payments.find((x) => x.id === a.p_payment && x.status === "pendiente");
      if (!p) return { data: null, error: null };
      Object.assign(p, { status: "pagado", provider_ref: a.p_ref ?? p.provider_ref });
      const r = db.registrations.find((x) => x.id === p.registration_id && x.status === "pendiente_pago");
      if (r) r.status = "confirmada";
      const d = db.donations.find((x) => x.id === p.donation_id);
      if (d) d.status = "pagado";
      return { data: null, error: null };
    }
    case "purge_health": return { data: 0, error: null };
    default: return err(`unknown_function ${fn}`);
  }
}

// ───────────── Cliente ─────────────
export function createDemoClient(uid: string | null, admin = false) {
  const { db } = demoStore();
  const ctx: Ctx = { uid, admin };
  const user = () => {
    const u = db.users.find((x) => x.id === uid);
    return u ? { id: u.id as string, email: u.email as string } : null;
  };
  return {
    from: (table: string) => new Query(db, ctx, table),
    rpc: async (fn: string, args?: Record<string, unknown>) => rpc(db, ctx, fn, args),
    auth: {
      getUser: async () => ({ data: { user: user() }, error: null }),
      getClaims: async () => ({ data: user() ? { claims: { sub: uid } } : null, error: null }),
      signOut: async () => ({ error: null }),
      signInWithOtp: async () => ({ error: { message: "demo" } }),
      exchangeCodeForSession: async () => ({ error: { message: "demo" } }),
      admin: { listUsers: async () => ({ data: { users: db.users.map((u) => ({ id: u.id, email: u.email })) }, error: null }) },
    },
    storage: {
      from: () => ({
        createSignedUrls: async (paths: string[]) => ({ data: paths.map((p) => ({ path: p, signedUrl: `/demo/photos/${p}` })), error: null }),
      }),
    },
  };
}
