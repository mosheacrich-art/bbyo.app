# BBYO España — app (propuesta no oficial)

Next.js 16 (App Router) + Supabase (Postgres, Auth, RLS, Storage) + Stripe.
Marca BBYO usada solo como propuesta; pendiente de autorización de BBYO.

## Qué hay
- **Roles** con ámbito (global / regional / chapter): Staff, Regional Board, Chapter Board, Miembro, Prospect, Alumni, Padres.
- **Calendario** en 3 capas (global, España, chapter) con filtros; detalle de evento e inscripción.
- **Autorización parental**: un menor necesita tutor verificado si tiene <14 años, el evento es de pago o hay pernocta. Datos de salud en tabla aparte, visibles solo en la ventana del evento y borrados a los 7 días.
- **Pagos y donaciones** (Stripe Checkout + webhook; sin clave Stripe se confirman en modo simulado).
- **Fotos** (álbumes por chapter, moderación, consentimiento), **Toolbox**, **Enlaces**.
- **CRM `/manage/[chapter]`**: resumen, personas y cuotas, eventos (crear/aprobar/publicar), asistentes + check-in, pipeline de prospects, dinero, invitaciones.
- **`/admin`** (Staff): conceder roles y registro de cambios.
- Toda la seguridad está en la base de datos (RLS + funciones SQL); la UI solo decide qué mostrar.

## Puesta en marcha
1. Crea un proyecto en Supabase y copia `.env.example` a `.env.local` con sus claves.
2. Aplica las migraciones y el seed (Supabase CLI):
   ```
   supabase link --project-ref <ref>
   supabase db push
   psql "$DATABASE_URL" -f supabase/seed.sql   # datos de ejemplo: región, 5 chapters, 19 eventos
   ```
3. Auth → URL Configuration: añade `http://localhost:3000/auth/callback` (y la URL de producción).
4. Usuarios de demo: `npx tsx --env-file=.env.local scripts/seed-demo.ts` (también crea el bucket `photos`).
5. `npm run dev`.
6. Programa a diario `GET /api/cron/purge` con `Authorization: Bearer $CRON_SECRET` (borrado de datos de salud).
7. Stripe: webhook a `/api/stripe/webhook` con el evento `checkout.session.completed`.

## Pruebas
`PGHOST=/tmp PGPORT=54329 PGUSER=postgres ./scripts/test-db.sh` — aplica migraciones + seed en un Postgres local y ejecuta 51 pruebas de permisos (visibilidad, autorización parental, aprobación de eventos, salud, roles, invitaciones).
`npm run lint && npx tsc --noEmit && npm run build`.

## Pendiente (decisiones de BBYO)
Autorización de marca · entidad legal responsable de datos y pagos (certificados Ley 49/2002, modelo 182) · AZA/BBG separados o mezclados · coordinadores por chapter · textos legales (privacidad, consentimiento de menores).
## Siguiente iteración
Subida de fotos por boards, importación de miembros, emails transaccionales, i18n (es/en/ca), PWA.
