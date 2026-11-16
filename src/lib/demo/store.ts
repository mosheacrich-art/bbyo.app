import "server-only";

/**
 * Base de datos en memoria para el modo demo. Replica supabase/seed.sql + scripts/seed-demo.ts
 * y añade inscripciones, pagos, fotos, etc. para que todas las pantallas tengan contenido.
 * Vive mientras corre el servidor; al reiniciarlo vuelve al estado inicial.
 */
export type Row = Record<string, unknown>;
export type DB = Record<string, Row[]>;

export type Persona = { id: string; email: string; name: string; label: string; hint: string };

// UUID deterministas (válidos v4) para que la sesión demo sobreviva a reinicios del servidor.
const uid = (n: number) => `d0000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
let seq = 0;
const next = () => uid(++seq);

const dayAt = (days: number, hours: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  d.setHours(Math.floor(hours), Math.round((hours % 1) * 60));
  return d.toISOString();
};
const dateOnly = (yearsAgo: number, extraMonths = 0) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - yearsAgo);
  d.setMonth(d.getMonth() - extraMonths);
  return d.toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);

function build(): { db: DB; personas: Persona[] } {
  seq = 0;
  const region = { id: next(), slug: "espana", name: "España", created_at: dayAt(-200, 9) };
  const ch = (slug: string, name: string, accent: string, fee: number) => ({
    id: next(), region_id: region.id, slug, name, city: name, accent, membership_fee_cents: fee, created_at: dayAt(-200, 9),
  });
  const chapters = [
    ch("bcn", "Barcelona", "#1A03B5", 6000),
    ch("madrid", "Madrid", "#E42158", 6000),
    ch("malaga", "Málaga", "#00B5C7", 5000),
    ch("marbella", "Marbella", "#F8450A", 5000),
    ch("melilla", "Melilla", "#6BBD00", 4000),
  ];
  const cid = (slug: string) => chapters.find((c) => c.slug === slug)!.id;

  const membership_plans = chapters.flatMap((c) => [
    { id: next(), chapter_id: c.id, name: "Anual", price_cents: c.membership_fee_cents, period: "anual" },
    { id: next(), chapter_id: c.id, name: "Familiar", price_cents: (c.membership_fee_cents * 3) / 2, period: "anual" },
  ]);

  const campaigns = [
    { id: next(), chapter_id: null, title: "Campaña de Jánuca solidaria", goal_cents: 300000, active: true },
    { id: next(), chapter_id: cid("bcn"), title: "Fondo de becas de Barcelona", goal_cents: 150000, active: true },
  ];

  const links = [
    ["Sitio web de BBYO", "https://bbyo.org/", "bbyo.org"],
    ["BBYO en España", "https://bbyo.org/bbyo-near-you/spain/", "bbyo.org/bbyo-near-you/spain"],
    ["Portal para padres", null, "Enlace por configurar"],
    ["Alumni Hub", null, "Enlace por configurar"],
    ["Programas de verano", null, "Enlace por configurar"],
    ["Convención Internacional", null, "Enlace por configurar"],
    ["Donaciones", null, "Enlace por configurar"],
  ].map(([title, url, note], i) => ({ id: next(), title, url, note, sort: i + 1 }));

  const resources = ([
    ["Programación", "Plantilla de programa semanal", false],
    ["Programación", "Ideas de actividades por edad", false],
    ["Programación", "Guía para eventos abiertos a prospects", false],
    ["Comunicación", "Textos para invitar a prospects", false],
    ["Gestión del board", "Manual del board", true],
    ["Gestión del board", "Plantilla de acta de reunión", true],
    ["Gestión del board", "Plantilla de presupuesto de evento", true],
    ["Seguridad", "Protocolo de seguridad y salidas", true],
    ["Seguridad", "Checklist de pernocta", true],
    ["Seguridad", "Cómo reportar una incidencia", true],
    ["Comunicación", "Kit de marca y plantillas de redes", true],
  ] as const).map(([category, title, boards_only], i) => ({ id: next(), category, title, url: null, boards_only, sort: i + 1 }));

  type Ev = [layer: string, ch: string | null, title: string, days: number, hh: number, loc: string, price: number, cap: number | null,
    open: boolean, alumni: boolean, boards: boolean, night: boolean, st: string, descr: string];
  // Flyers reales de los chapters (las fechas de los flyers no coinciden con las de la demo)
  const FLYERS: Record<string, string> = {
    "Chapter meeting": "bcn-chapter-meeting", "Castanyada: cocinamos panellets": "bcn-castanyada", "Only Members": "bcn-only-members",
    "Kickoff: Laser Tag": "bcn-kickoff", "Paint and relax: girls afternoon": "melilla-paint-and-relax", "Fiesta Ibicenca": "melilla-fiesta-ibicenca",
    "J-Serve: cuidamos el planeta": "melilla-j-serve", "Casino Night": "melilla-casino-night",
  };
  const evs: Ev[] = [
    ["global", null, "Sesión informativa: programas de verano", 9, 19, "Online", 0, 300, true, true, false, false, "publicado", "Resumen de los programas de verano para teens, con preguntas y respuestas en directo."],
    ["global", null, "Giving Tuesday: campaña de donaciones", 16, 9, "Online", 0, null, true, true, false, false, "publicado", "Campaña global para apoyar a los teens de BBYO."],
    ["regional", null, "Convención regional España", 26, 10, "Madrid", 9500, 120, false, true, false, true, "publicado", "Tres días con teens de todos los chapters: programa, shabat juntos y talleres de liderazgo. Incluye alojamiento y comidas."],
    ["regional", null, "Encuentro de boards", 14, 19, "Online", 0, 40, false, false, true, false, "publicado", "Reunión de coordinación entre los boards de los chapters."],
    ["regional", null, "Shabatón regional", 68, 17, "Por definir", 7000, 80, false, false, false, true, "pendiente", "Fin de semana de shabat para toda la región. Pendiente de aprobación."],
    ["local", "bcn", "Chapter meeting", 4, 16.5, "Colegio Hatikva", 0, 40, true, false, false, false, "publicado", "¡Estáis todos invitados! Reunión del chapter para conocer al board y lo que viene este año. Trae a un amigo: los prospects entran gratis."],
    ["local", "bcn", "Castanyada: cocinamos panellets", 9, 11, "Sant Cugat", 0, 35, true, false, false, false, "publicado", "Cocinamos juntos panellets y castañas. ¡Nos vemos para cocinar, compartir y disfrutar! El horario exacto y el lugar se envían en el grupo de WhatsApp."],
    ["local", "bcn", "Only Members", 15, 18.5, "Barcelona (ubicación por privado)", 0, 30, false, false, false, false, "publicado", "Evento solo para miembros. ¡Prepárate para el frío! Es obligatorio venir con calcetines, pantalón largo y guantes. Plazas limitadas."],
    ["local", "bcn", "Voluntariado: banco de alimentos", 7, 10, "Barcelona", 0, 25, true, false, false, false, "publicado", "Mañana de voluntariado con el chapter."],
    ["local", "bcn", "Cena de shabat", 12, 19, "Comunidad", 1200, 50, true, false, false, false, "publicado", "Cena de shabat para el chapter y sus invitados."],
    ["local", "bcn", "Fiesta de Jánuca", 21, 18, "Barcelona", 800, 60, true, true, false, false, "publicado", "Fiesta de Jánuca abierta a miembros, prospects y alumni."],
    ["local", "bcn", "Retiro de board", 35, 10, "Por definir", 0, 12, false, false, true, false, "borrador", "Planificación del segundo trimestre."],
    ["local", "bcn", "Kickoff: Laser Tag", -24, 16.5, "Sant Cugat (transporte necesario)", 1000, 40, true, false, false, false, "publicado", "Arrancamos el año con una partida de laser tag. Plazas limitadas."],
    ["local", "madrid", "Torneo de fútbol sala", 7, 11, "Polideportivo", 0, 48, true, false, false, false, "publicado", "Torneo por equipos del chapter de Madrid."],
    ["local", "madrid", "Cena de shabat", 12, 20, "Comunidad", 1500, 70, true, false, false, false, "publicado", "Cena de shabat del chapter de Madrid."],
    ["local", "madrid", "Fiesta de Jánuca", 23, 18, "Madrid", 1000, 60, true, true, false, false, "publicado", "Fiesta de Jánuca del chapter de Madrid."],
    ["local", "malaga", "Pizza y debate", 5, 19, "Málaga", 0, 30, true, false, false, false, "publicado", "Debate sobre liderazgo juvenil con pizza."],
    ["local", "malaga", "Taller de liderazgo", 20, 17, "Málaga", 0, 30, false, false, false, false, "publicado", "Taller para el board y los miembros."],
    ["local", "marbella", "Tarde de playa y programa", 6, 16, "Marbella", 0, 25, true, false, false, false, "publicado", "Tarde en la playa con programa del chapter."],
    ["local", "marbella", "Cena de Jánuca", 24, 20, "Marbella", 1200, 40, true, false, false, false, "publicado", "Cena de Jánuca del chapter de Marbella."],
    ["local", "melilla", "Paint and relax: girls afternoon", 5, 18, "Melilla", 0, 20, true, false, false, false, "publicado", "Tarde de B'nai B'rith Girls: pintaremos, decoraremos, charlaremos y aprenderemos todas juntas. Let's have a great time!"],
    ["local", "melilla", "Fiesta Ibicenca", 10, 22, "Melilla", 1000, 60, true, true, false, false, "publicado", "Fiesta ibicenca del chapter. Ven de blanco."],
    ["local", "melilla", "J-Serve: cuidamos el planeta", 13, 17, "Melilla", 0, 30, true, false, false, false, "publicado", "Jornada de voluntariado medioambiental: recogida y reciclaje. Cuidamos el planeta juntos."],
    ["local", "melilla", "Casino Night", 19, 21, "Melilla", 500, 50, true, false, false, false, "publicado", "Póker, blackjack, ruleta y premios. Fichas de juego, sin dinero real."],
  ];
  const events = evs.map(([layer, chs, title, days, hh, location, price_cents, capacity, is_open, alumni_ok, boards_only, overnight, status, description]) => ({
    id: next(), layer, region_id: layer === "regional" ? region.id : null, chapter_id: layer === "local" ? cid(chs!) : null,
    title, description, starts_at: dayAt(days, hh), ends_at: overnight ? dayAt(days + 2, 14) : dayAt(days, hh + 2),
    location, price_cents, capacity, is_open, alumni_ok, boards_only, overnight, status,
    created_by: null, approved_by: null, approved_at: null, created_at: dayAt(Math.min(days, 0) - 10, 12),
    flyer_url: FLYERS[title] ? `/demo/flyers/${FLYERS[title]}.jpg` : null,
  }));
  const ev = (chapter: string | null, title: string) =>
    events.find((e) => e.title === title && (chapter ? e.chapter_id === cid(chapter) : e.chapter_id === null))!.id;

  // ── Personas ──
  type P = { key: string; email: string; name: string; birth: string; chapter?: string; label?: string; hint?: string;
    roles: { role: string; scope_type: string; scope?: string; pos?: string }[] };
  const people: P[] = [
    { key: "staff", email: "staff@demo.bbyo.test", name: "Noa Staff", birth: "1988-03-02", label: "Staff", hint: "Ve y gestiona todo. Concede roles en Admin.", roles: [{ role: "staff", scope_type: "global" }] },
    { key: "regional", email: "regional@demo.bbyo.test", name: "Ari Regional", birth: "2005-06-11", label: "Regional Board", hint: "Gestiona todos los chapters de España y aprueba eventos.", roles: [{ role: "regional_board", scope_type: "region" }] },
    { key: "board", email: "board@demo.bbyo.test", name: "Lia Board BCN", birth: "2007-01-20", chapter: "bcn", label: "Chapter Board · Barcelona", hint: "CRM del chapter: personas, eventos, check-in, dinero.", roles: [{ role: "chapter_board", scope_type: "chapter", scope: "bcn", pos: "Presidenta" }] },
    { key: "dani", email: "dani@demo.bbyo.test", name: "Dani L.", birth: dateOnly(15), chapter: "bcn", label: "Miembro (15 años)", hint: "Se apunta a eventos; los de pago o con pernocta los autoriza su madre.", roles: [{ role: "member", scope_type: "chapter", scope: "bcn" }] },
    { key: "sara", email: "sara@demo.bbyo.test", name: "Sara L.", birth: "1980-09-09", chapter: "bcn", label: "Madre de Dani", hint: "Autoriza y paga las inscripciones de su hijo.", roles: [{ role: "parent", scope_type: "chapter", scope: "bcn" }] },
    { key: "eli", email: "eli@demo.bbyo.test", name: "Eli R.", birth: dateOnly(14, 3), chapter: "bcn", label: "Prospect", hint: "Solo ve los eventos abiertos a prospects.", roles: [{ role: "prospect", scope_type: "chapter", scope: "bcn" }] },
    { key: "raquel", email: "raquel@demo.bbyo.test", name: "Raquel M.", birth: "2002-05-05", label: "Alumni", hint: "Ve los eventos abiertos a alumni.", roles: [{ role: "alumni", scope_type: "region" }] },
    { key: "tomas", email: "tomas@demo.bbyo.test", name: "Tomás N.", birth: dateOnly(16), label: "Recién llegado", hint: "Sin chapter todavía: prueba el código de invitación BCN-2026.", roles: [] },
    // Resto del chapter (no son personas de login, dan vida al CRM)
    { key: "maya", email: "maya@demo.bbyo.test", name: "Maya S.", birth: dateOnly(16, 5), chapter: "bcn", roles: [{ role: "member", scope_type: "chapter", scope: "bcn" }] },
    { key: "jonas", email: "jonas@demo.bbyo.test", name: "Jonás B.", birth: dateOnly(17, 2), chapter: "bcn", roles: [{ role: "chapter_board", scope_type: "chapter", scope: "bcn", pos: "Tesorero" }] },
    { key: "tali", email: "tali@demo.bbyo.test", name: "Tali K.", birth: dateOnly(14, 8), chapter: "bcn", roles: [{ role: "member", scope_type: "chapter", scope: "bcn" }] },
    { key: "adam", email: "adam@demo.bbyo.test", name: "Adam F.", birth: dateOnly(15, 1), chapter: "bcn", roles: [{ role: "member", scope_type: "chapter", scope: "bcn" }] },
    { key: "nina", email: "nina@demo.bbyo.test", name: "Nina P.", birth: dateOnly(13, 10), chapter: "bcn", roles: [{ role: "prospect", scope_type: "chapter", scope: "bcn" }] },
    { key: "gabi", email: "gabi@demo.bbyo.test", name: "Gabi T.", birth: dateOnly(14, 1), chapter: "bcn", roles: [{ role: "prospect", scope_type: "chapter", scope: "bcn" }] },
    { key: "leo", email: "leo@demo.bbyo.test", name: "Leo G.", birth: dateOnly(16, 4), chapter: "madrid", roles: [{ role: "member", scope_type: "chapter", scope: "madrid" }] },
    { key: "rut", email: "rut@demo.bbyo.test", name: "Rut A.", birth: dateOnly(17, 6), chapter: "madrid", roles: [{ role: "chapter_board", scope_type: "chapter", scope: "madrid", pos: "Presidenta" }] },
  ];
  const ids: Record<string, string> = {};
  const users: Row[] = [];
  const profiles: Row[] = [];
  const role_assignments: Row[] = [];
  for (const p of people) {
    const id = next();
    ids[p.key] = id;
    users.push({ id, email: p.email });
    profiles.push({ id, full_name: p.name, birth_date: p.birth, locale: "es", home_chapter_id: p.chapter ? cid(p.chapter) : null, created_at: dayAt(-120, 10) });
    for (const r of p.roles)
      role_assignments.push({
        id: next(), user_id: id, role: r.role, scope_type: r.scope_type,
        scope_id: r.scope_type === "region" ? region.id : r.scope_type === "chapter" ? cid(r.scope!) : null,
        board_position: r.pos ?? null, starts_on: dateOnly(1), ends_on: null, created_by: null,
      });
  }
  const personas: Persona[] = people.filter((p) => p.label).map((p) => ({ id: ids[p.key], email: p.email, name: p.name, label: p.label!, hint: p.hint! }));

  const guardianships = [{ id: next(), guardian_id: ids.sara, child_id: ids.dani, verified: true, verified_by: ids.board, created_at: dayAt(-90, 10) }];

  const prospect_pipeline = [
    { person_id: ids.eli, chapter_id: cid("bcn"), stage: "invitado", owner_id: ids.board, notes: "Vino a la noche de juegos", updated_at: dayAt(-5, 12) },
    { person_id: ids.nina, chapter_id: cid("bcn"), stage: "contacto", owner_id: ids.board, notes: "Amiga de Tali", updated_at: dayAt(-3, 12) },
    { person_id: ids.gabi, chapter_id: cid("bcn"), stage: "asistio", owner_id: ids.jonas, notes: "Repite el jueves", updated_at: dayAt(-8, 12) },
  ];

  const memberships = [
    ["dani", true], ["maya", true], ["jonas", true], ["tali", false], ["adam", false], ["board", true],
  ].map(([k, paid]) => ({
    id: next(), person_id: ids[k as string], chapter_id: cid("bcn"), plan_id: membership_plans[0].id,
    paid, valid_until: paid ? `${new Date().getFullYear()}-12-31` : null, created_at: dayAt(-60, 10),
  }));

  // Inscripciones
  const reg = (event_id: string, person: string, status: string, by = person, checked = false) => ({
    id: next(), event_id, person_id: ids[person], registered_by: ids[by], status,
    authorized_by: null, authorized_at: null, checked_in_at: checked ? dayAt(-24, 20) : null, created_at: dayAt(-6, 18),
  });
  const registrations = [
    reg(ev("bcn", "Chapter meeting"), "dani", "confirmada"),
    reg(ev("bcn", "Chapter meeting"), "maya", "confirmada"),
    reg(ev("bcn", "Chapter meeting"), "tali", "confirmada"),
    reg(ev("bcn", "Chapter meeting"), "eli", "confirmada"),
    reg(ev("bcn", "Chapter meeting"), "board", "confirmada"),
    reg(ev(null, "Convención regional España"), "dani", "pendiente_padres"),
    reg(ev(null, "Convención regional España"), "jonas", "confirmada"),
    reg(ev("bcn", "Cena de shabat"), "dani", "pendiente_pago", "sara"),
    reg(ev("bcn", "Cena de shabat"), "maya", "confirmada"),
    reg(ev("bcn", "Cena de shabat"), "adam", "confirmada"),
    reg(ev("bcn", "Voluntariado: banco de alimentos"), "jonas", "confirmada"),
    reg(ev("bcn", "Kickoff: Laser Tag"), "dani", "confirmada", "dani", true),
    reg(ev("bcn", "Kickoff: Laser Tag"), "maya", "confirmada", "maya", true),
    reg(ev("bcn", "Kickoff: Laser Tag"), "gabi", "confirmada", "gabi", true),
    reg(ev("madrid", "Torneo de fútbol sala"), "leo", "confirmada"),
  ];
  const regId = (person: string, title: string) => registrations.find((r) => r.person_id === ids[person] && events.find((e) => e.id === r.event_id)!.title === title)!.id;
  const registration_health = [
    { registration_id: regId("maya", "Chapter meeting"), notes: "Alergia a los frutos secos", updated_at: dayAt(-6, 18) },
    { registration_id: regId("maya", "Cena de shabat"), notes: "Alergia a los frutos secos", updated_at: dayAt(-6, 18) },
  ];

  const donations = [
    { id: next(), campaign_id: campaigns[0].id, chapter_id: null, donor_id: ids.sara, amount_cents: 5000, recurring: false, status: "pagado", created_at: dayAt(-12, 11) },
    { id: next(), campaign_id: campaigns[0].id, chapter_id: null, donor_id: ids.raquel, amount_cents: 2500, recurring: false, status: "pagado", created_at: dayAt(-9, 11) },
    { id: next(), campaign_id: campaigns[0].id, chapter_id: null, donor_id: ids.staff, amount_cents: 120000, recurring: false, status: "pagado", created_at: dayAt(-30, 11) },
    { id: next(), campaign_id: campaigns[1].id, chapter_id: cid("bcn"), donor_id: ids.sara, amount_cents: 10000, recurring: false, status: "pagado", created_at: dayAt(-20, 11) },
    { id: next(), campaign_id: campaigns[1].id, chapter_id: cid("bcn"), donor_id: ids.raquel, amount_cents: 30000, recurring: false, status: "pagado", created_at: dayAt(-15, 11) },
  ];
  const pay = (payer: string, amount_cents: number, opts: { reg?: string; don?: string; days: number }) => ({
    id: next(), chapter_id: cid("bcn"), payer_id: ids[payer], registration_id: opts.reg ?? null, donation_id: opts.don ?? null,
    amount_cents, currency: "eur", status: "pagado", provider: "simulado", provider_ref: "simulado", created_at: dayAt(-opts.days, 13),
  });
  const payments = [
    pay("sara", 1200, { reg: regId("maya", "Cena de shabat"), days: 4 }),
    pay("adam", 1200, { reg: regId("adam", "Cena de shabat"), days: 3 }),
    pay("sara", 10000, { don: donations[3].id, days: 20 }),
    pay("raquel", 30000, { don: donations[4].id, days: 15 }),
  ];

  const albums = [
    { id: next(), chapter_id: cid("bcn"), event_id: ev("bcn", "Kickoff: Laser Tag"), title: "Kickoff: Laser Tag", created_at: dayAt(-23, 12) },
    { id: next(), chapter_id: cid("bcn"), event_id: null, title: "Kick-off del curso", created_at: dayAt(-60, 12) },
    { id: next(), chapter_id: cid("madrid"), event_id: null, title: "Shabat en Madrid", created_at: dayAt(-30, 12) },
  ];
  const photos = [
    ...[1, 2, 3, 4].map((n) => ({ id: next(), album_id: albums[0].id, storage_path: `${n}.svg`, status: "publicada", uploaded_by: ids.board, created_at: dayAt(-23, 12) })),
    { id: next(), album_id: albums[0].id, storage_path: "5.svg", status: "pendiente", uploaded_by: ids.dani, created_at: dayAt(-22, 12) },
    ...[5, 6, 2].map((n) => ({ id: next(), album_id: albums[1].id, storage_path: `${n}.svg`, status: "publicada", uploaded_by: ids.board, created_at: dayAt(-60, 12) })),
    ...[3, 6].map((n) => ({ id: next(), album_id: albums[2].id, storage_path: `${n}.svg`, status: "publicada", uploaded_by: ids.rut, created_at: dayAt(-30, 12) })),
  ];
  const photo_consents = ["dani", "maya", "tali", "board"].map((k) => ({ person_id: ids[k], allowed: true, updated_by: ids[k], updated_at: dayAt(-50, 10) }));

  const invites = [
    { code: "BCN-2026", chapter_id: cid("bcn"), role: "member", uses_left: 20, expires_at: dayAt(30, 23), created_by: ids.board },
    { code: "BCN-PROSPECT", chapter_id: cid("bcn"), role: "prospect", uses_left: 10, expires_at: dayAt(14, 23), created_by: ids.board },
    { code: "MAD-2026", chapter_id: cid("madrid"), role: "member", uses_left: 15, expires_at: dayAt(30, 23), created_by: ids.rut },
  ];

  const audit_log = [
    ["role_assignments", "insert", "staff", 40], ["events", "update", "regional", 10], ["events", "insert", "board", 8],
    ["guardianships", "update", "board", 7], ["registrations", "update", "sara", 4], ["invites", "insert", "board", 2],
  ].map(([entity, action, actor, days], i) => ({ id: i + 1, at: dayAt(-(days as number), 12), actor_id: ids[actor as string], action, entity, entity_id: null, meta: {} }));

  const db: DB = {
    users, regions: [region], chapters, profiles, role_assignments, guardianships, events, registrations, registration_health,
    payments, membership_plans, memberships, prospect_pipeline, campaigns, donations, albums, photos, photo_consents,
    resources, links, tasks: [], invites, audit_log,
  };
  return { db, personas };
}

const g = globalThis as unknown as { __bbyoDemo?: { db: DB; personas: Persona[] } };
export function demoStore() {
  if (!g.__bbyoDemo) g.__bbyoDemo = build();
  return g.__bbyoDemo;
}
export { today };
