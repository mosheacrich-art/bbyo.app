-- BBYO España · esquema base
-- Estructura: región → chapters. Las personas tienen roles con ámbito (global, región o chapter).

create type app_role     as enum ('staff','regional_board','chapter_board','member','prospect','alumni','parent');
create type scope_type   as enum ('global','region','chapter');
create type event_layer  as enum ('global','regional','local');
create type event_status as enum ('borrador','pendiente','publicado','cancelado');
create type reg_status   as enum ('pendiente_padres','pendiente_pago','confirmada','lista_espera','cancelada');
create type pay_status   as enum ('pendiente','pagado','fallido','reembolsado');
create type photo_status as enum ('pendiente','publicada','rechazada');

create table regions (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  created_at timestamptz not null default now()
);

create table chapters (
  id                   uuid primary key default gen_random_uuid(),
  region_id            uuid not null references regions(id),
  slug                 text not null unique,
  name                 text not null,
  city                 text,
  accent               text not null default '#1A03B5',
  membership_fee_cents integer not null default 0 check (membership_fee_cents >= 0),
  created_at           timestamptz not null default now()
);

create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  full_name       text not null default '',
  birth_date      date,
  locale          text not null default 'es' check (locale in ('es','en','ca')),
  home_chapter_id uuid references chapters(id),
  created_at      timestamptz not null default now()
);

create table role_assignments (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles(id) on delete cascade,
  role           app_role not null,
  scope_type     scope_type not null,
  scope_id       uuid,
  board_position text,
  starts_on      date not null default current_date,
  ends_on        date,
  created_by     uuid references profiles(id),
  constraint scope_matches check (
    (scope_type = 'global' and scope_id is null) or (scope_type <> 'global' and scope_id is not null)),
  constraint dates_ok check (ends_on is null or ends_on >= starts_on)
);
create index role_assignments_user_idx on role_assignments(user_id);

create table guardianships (
  id          uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references profiles(id) on delete cascade,
  child_id    uuid not null references profiles(id) on delete cascade,
  verified    boolean not null default false,
  verified_by uuid references profiles(id),
  created_at  timestamptz not null default now(),
  unique (guardian_id, child_id),
  check (guardian_id <> child_id)
);

create table events (
  id             uuid primary key default gen_random_uuid(),
  layer          event_layer not null,
  region_id      uuid references regions(id),
  chapter_id     uuid references chapters(id),
  title          text not null,
  description    text not null default '',
  starts_at      timestamptz not null,
  ends_at        timestamptz,
  location       text not null default '',
  price_cents    integer not null default 0 check (price_cents >= 0),
  capacity       integer check (capacity is null or capacity > 0),
  is_open        boolean not null default false,   -- abierto a prospects
  alumni_ok      boolean not null default false,
  boards_only    boolean not null default false,
  overnight      boolean not null default false,
  status         event_status not null default 'borrador',
  created_by     uuid references profiles(id),
  approved_by    uuid references profiles(id),
  approved_at    timestamptz,
  created_at     timestamptz not null default now(),
  constraint layer_scope check (
    (layer = 'global'   and region_id is null and chapter_id is null) or
    (layer = 'regional' and region_id is not null and chapter_id is null) or
    (layer = 'local'    and chapter_id is not null and region_id is null))
);
create index events_starts_idx on events(starts_at);

create table registrations (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references events(id) on delete cascade,
  person_id     uuid not null references profiles(id) on delete cascade,
  registered_by uuid not null references profiles(id),
  status        reg_status not null,
  authorized_by uuid references profiles(id),
  authorized_at timestamptz,
  checked_in_at timestamptz,
  created_at    timestamptz not null default now(),
  unique (event_id, person_id)
);
create index registrations_event_idx on registrations(event_id);

-- Datos de salud: tabla aparte con acceso restringido a la ventana del evento
create table registration_health (
  registration_id uuid primary key references registrations(id) on delete cascade,
  notes           text not null,
  updated_at      timestamptz not null default now()
);

create table payments (
  id              uuid primary key default gen_random_uuid(),
  chapter_id      uuid references chapters(id),
  payer_id        uuid not null references profiles(id),
  registration_id uuid references registrations(id) on delete set null,
  donation_id     uuid,
  amount_cents    integer not null check (amount_cents > 0),
  currency        text not null default 'eur',
  status          pay_status not null default 'pendiente',
  provider        text not null default 'stripe',
  provider_ref    text,
  created_at      timestamptz not null default now()
);

create table membership_plans (
  id          uuid primary key default gen_random_uuid(),
  chapter_id  uuid references chapters(id),
  name        text not null,
  price_cents integer not null check (price_cents >= 0),
  period      text not null default 'anual'
);

create table memberships (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references profiles(id) on delete cascade,
  chapter_id  uuid not null references chapters(id),
  plan_id     uuid references membership_plans(id),
  paid        boolean not null default false,
  valid_until date,
  created_at  timestamptz not null default now(),
  unique (person_id, chapter_id)
);

create table prospect_pipeline (
  person_id  uuid primary key references profiles(id) on delete cascade,
  chapter_id uuid not null references chapters(id),
  stage      text not null default 'contacto'
             check (stage in ('contacto','invitado','asistio','prospect','miembro')),
  owner_id   uuid references profiles(id),
  notes      text not null default '',
  updated_at timestamptz not null default now()
);

create table campaigns (
  id         uuid primary key default gen_random_uuid(),
  chapter_id uuid references chapters(id),
  title      text not null,
  goal_cents integer not null check (goal_cents > 0),
  active     boolean not null default true
);

create table donations (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid references campaigns(id),
  chapter_id   uuid references chapters(id),
  donor_id     uuid not null references profiles(id),
  amount_cents integer not null check (amount_cents > 0),
  recurring    boolean not null default false,
  status       pay_status not null default 'pendiente',
  created_at   timestamptz not null default now()
);
alter table payments add constraint payments_donation_fk foreign key (donation_id) references donations(id) on delete set null;

create table albums (
  id         uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references chapters(id),
  event_id   uuid references events(id) on delete set null,
  title      text not null,
  created_at timestamptz not null default now()
);

create table photos (
  id           uuid primary key default gen_random_uuid(),
  album_id     uuid not null references albums(id) on delete cascade,
  storage_path text not null,
  status       photo_status not null default 'pendiente',
  uploaded_by  uuid references profiles(id),
  created_at   timestamptz not null default now()
);

create table photo_consents (
  person_id  uuid primary key references profiles(id) on delete cascade,
  allowed    boolean not null default false,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

create table resources (
  id         uuid primary key default gen_random_uuid(),
  category   text not null,
  title      text not null,
  url        text,
  boards_only boolean not null default false,
  sort       integer not null default 0
);

create table links (
  id    uuid primary key default gen_random_uuid(),
  title text not null,
  url   text,
  note  text not null default '',
  sort  integer not null default 0
);

create table tasks (
  id          uuid primary key default gen_random_uuid(),
  chapter_id  uuid not null references chapters(id),
  title       text not null,
  assignee_id uuid references profiles(id),
  status      text not null default 'pendiente' check (status in ('pendiente','en_curso','hecha')),
  due_on      date,
  created_at  timestamptz not null default now()
);

create table invites (
  code       text primary key,
  chapter_id uuid not null references chapters(id),
  role       app_role not null check (role in ('member','prospect','parent','alumni')),
  uses_left  integer not null default 1 check (uses_left >= 0),
  expires_at timestamptz,
  created_by uuid references profiles(id)
);

create table audit_log (
  id        bigint generated always as identity primary key,
  at        timestamptz not null default now(),
  actor_id  uuid,
  action    text not null,
  entity    text not null,
  entity_id text,
  meta      jsonb not null default '{}'::jsonb
);
