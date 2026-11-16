-- BBYO España · permisos
-- Todas las reglas de acceso viven aquí, en la base de datos (RLS), no en el frontend.

-- ───────────────────────── Perfil automático al crear usuario ─────────────────────────
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ───────────────────────── Funciones de ámbito ─────────────────────────
create function roles_of(uid uuid) returns table (role app_role, scope_type scope_type, scope_id uuid)
language sql stable security definer set search_path = public as $$
  select ra.role, ra.scope_type, ra.scope_id
  from role_assignments ra
  where ra.user_id = uid
    and ra.starts_on <= current_date
    and (ra.ends_on is null or ra.ends_on >= current_date)
$$;

create function chapter_region(c uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select region_id from chapters where id = c
$$;

-- ¿Tiene uid el rol r con ámbito que cubra el chapter c o la región rg?
-- Global cubre todo; región cubre sus chapters; chapter cubre solo ese chapter.
create function has_scope_u(uid uuid, r app_role, c uuid default null, rg uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from roles_of(uid) a
    where a.role = r and (
      a.scope_type = 'global'
      or (a.scope_type = 'region' and a.scope_id = coalesce(rg, chapter_region(c)))
      or (a.scope_type = 'chapter' and c is not null and a.scope_id = c)
    )
  )
$$;

create function has_scope(r app_role, c uuid default null, rg uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select has_scope_u(auth.uid(), r, c, rg)
$$;

create function has_role_in_region(uid uuid, r app_role, rg uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from roles_of(uid) a
    where a.role = r and (
      a.scope_type = 'global'
      or (a.scope_type = 'region' and a.scope_id = rg)
      or (a.scope_type = 'chapter' and chapter_region(a.scope_id) = rg)
    )
  )
$$;

create function manages_chapter_u(uid uuid, c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select has_scope_u(uid, 'staff', c) or has_scope_u(uid, 'regional_board', c) or has_scope_u(uid, 'chapter_board', c)
$$;

create function manages_region_u(uid uuid, rg uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select has_scope_u(uid, 'staff', null, rg) or has_scope_u(uid, 'regional_board', null, rg)
$$;

create function manages_chapter(c uuid) returns boolean
language sql stable security definer set search_path = public as $$ select manages_chapter_u(auth.uid(), c) $$;

create function manages_region(rg uuid) returns boolean
language sql stable security definer set search_path = public as $$ select manages_region_u(auth.uid(), rg) $$;

-- Aprobar eventos: staff o Regional Board del ámbito (el Chapter Board no)
create function approves_for(c uuid, rg uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select has_scope('staff', c, rg) or has_scope('regional_board', c, rg)
$$;

create function is_staff_any() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from roles_of(auth.uid()) where role = 'staff')
$$;

create function is_guardian_of(child uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from guardianships g
                 where g.guardian_id = auth.uid() and g.child_id = child and g.verified)
$$;

create function age_on(b date, d date default current_date) returns integer
language sql immutable as $$ select extract(year from age(d, b))::int $$;

-- ───────────────────────── Visibilidad de eventos ─────────────────────────
create function event_visible_to(e events, uid uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if uid is null then return false; end if;

  if e.layer = 'global' then
    if has_scope_u(uid, 'staff') then return true; end if;
    return e.status = 'publicado' and exists (select 1 from roles_of(uid));

  elsif e.layer = 'regional' then
    if manages_region_u(uid, e.region_id) then return true; end if;
    if e.status <> 'publicado' then return false; end if;
    if e.boards_only then
      return exists (select 1 from chapters c
                     where c.region_id = e.region_id and has_scope_u(uid, 'chapter_board', c.id));
    end if;
    return (e.is_open and exists (select 1 from roles_of(uid)))
        or has_role_in_region(uid, 'member', e.region_id)
        or has_role_in_region(uid, 'chapter_board', e.region_id)
        or has_role_in_region(uid, 'parent', e.region_id)
        or has_role_in_region(uid, 'staff', e.region_id)
        or (e.alumni_ok and has_role_in_region(uid, 'alumni', e.region_id));

  else
    if manages_chapter_u(uid, e.chapter_id) then return true; end if;
    if e.status <> 'publicado' or e.boards_only then return false; end if;
    return has_scope_u(uid, 'member', e.chapter_id)
        or has_scope_u(uid, 'parent', e.chapter_id)
        or (e.is_open   and has_scope_u(uid, 'prospect', e.chapter_id))
        or (e.alumni_ok and has_scope_u(uid, 'alumni',   e.chapter_id));
  end if;
end $$;

create function event_visible(e events) returns boolean
language sql stable security definer set search_path = public as $$ select event_visible_to(e, auth.uid()) $$;

create function event_manages(e events) returns boolean
language sql stable security definer set search_path = public as $$
  select case e.layer
    when 'global'   then has_scope('staff')
    when 'regional' then manages_region(e.region_id)
    else manages_chapter(e.chapter_id)
  end
$$;

create function event_manages_id(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select event_manages(e) from events e where e.id = eid), false)
$$;

-- ───────────────────────── Visibilidad de personas ─────────────────────────
create function can_manage_person(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select manages_chapter(pr.home_chapter_id) from profiles pr where pr.id = p), false)
      or exists (select 1 from role_assignments ra
                 where ra.user_id = p and ra.scope_type = 'chapter' and manages_chapter(ra.scope_id))
$$;

create function can_see_profile(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p = auth.uid()
      or is_guardian_of(p)
      or can_manage_person(p)
      or exists (select 1 from registrations r where r.person_id = p and event_manages_id(r.event_id))
$$;

-- Qué roles puede conceder el usuario actual y dónde
create function role_grantable(r app_role, st scope_type, sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when st = 'global' then has_scope('staff')
    when st = 'region' then has_scope('staff', null, sid)
                            or (has_scope('regional_board', null, sid) and r in ('alumni','parent'))
    when st = 'chapter' then
         (has_scope('staff', sid) and (r <> 'staff' or has_scope('staff', null, chapter_region(sid))))
      or (has_scope('regional_board', sid) and r in ('chapter_board','member','prospect','alumni','parent'))
      or (has_scope('chapter_board', sid) and r in ('member','prospect','parent'))
    else false
  end
$$;

-- Datos de salud: el participante, su tutor y el equipo solo durante el evento
create function health_visible(reg uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from registrations r join events e on e.id = r.event_id
    where r.id = reg and (
      r.person_id = auth.uid()
      or is_guardian_of(r.person_id)
      or (event_manages(e)
          and now() between e.starts_at - interval '12 hours'
                        and coalesce(e.ends_at, e.starts_at + interval '3 days') + interval '12 hours')
    )
  )
$$;

-- ───────────────────────── Triggers ─────────────────────────
-- Reglas de eventos: los eventos con coste o pernocta solo los publica quien aprueba
create function events_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare needs_approval boolean; can_approve boolean;
begin
  needs_approval := new.price_cents > 0 or new.overnight;
  can_approve := approves_for(new.chapter_id, new.region_id);
  if new.layer = 'global' then can_approve := has_scope('staff'); end if;

  if tg_op = 'INSERT' then new.created_by := coalesce(new.created_by, auth.uid()); end if;

  -- Cambiar precio o pernocta de un evento ya publicado obliga a volver a aprobarlo
  if tg_op = 'UPDATE' and old.status = 'publicado' and new.status = 'publicado' and needs_approval
     and not can_approve and (new.price_cents <> old.price_cents or new.overnight <> old.overnight) then
    new.status := 'pendiente'; new.approved_by := null; new.approved_at := null;
  end if;

  -- Publicar un evento con coste o pernocta solo lo puede hacer quien aprueba
  if new.status = 'publicado' and needs_approval then
    if not can_approve and not (tg_op = 'UPDATE' and old.status = 'publicado') then
      raise exception 'approval_required: los eventos con coste o pernocta los aprueba staff o Regional Board'
        using errcode = '42501';
    end if;
    if tg_op = 'INSERT' or old.status is distinct from 'publicado' then
      new.approved_by := auth.uid(); new.approved_at := now();
    end if;
  end if;
  return new;
end $$;

create trigger events_guard_trg before insert or update on events
  for each row execute function events_guard();

create function audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), tg_op, tg_table_name, coalesce(new.id, old.id)::text,
          jsonb_build_object('old', case when tg_op <> 'INSERT' then to_jsonb(old) end,
                             'new', case when tg_op <> 'DELETE' then to_jsonb(new) end));
  return coalesce(new, old);
end $$;

create trigger audit_roles after insert or update or delete on role_assignments
  for each row execute function audit_row();
create trigger audit_events after insert or update or delete on events
  for each row execute function audit_row();
create trigger audit_registrations after update or delete on registrations
  for each row execute function audit_row();

-- ───────────────────────── RLS ─────────────────────────
alter table regions             enable row level security;
alter table chapters            enable row level security;
alter table profiles            enable row level security;
alter table role_assignments    enable row level security;
alter table guardianships       enable row level security;
alter table events              enable row level security;
alter table registrations       enable row level security;
alter table registration_health enable row level security;
alter table payments            enable row level security;
alter table membership_plans    enable row level security;
alter table memberships         enable row level security;
alter table prospect_pipeline   enable row level security;
alter table campaigns           enable row level security;
alter table donations           enable row level security;
alter table albums              enable row level security;
alter table photos              enable row level security;
alter table photo_consents      enable row level security;
alter table resources           enable row level security;
alter table links               enable row level security;
alter table tasks               enable row level security;
alter table invites             enable row level security;
alter table audit_log           enable row level security;

-- Catálogo: lo ve cualquier usuario con sesión; lo edita staff global
create policy regions_read  on regions  for select to authenticated using (true);
create policy chapters_read on chapters for select to authenticated using (true);
create policy links_read    on links    for select to authenticated using (true);
create policy plans_read    on membership_plans for select to authenticated using (true);
create policy campaigns_read on campaigns for select to authenticated using (true);
create policy regions_write  on regions  for all to authenticated using (has_scope('staff')) with check (has_scope('staff'));
create policy chapters_write on chapters for all to authenticated using (has_scope('staff')) with check (has_scope('staff'));
create policy links_write    on links    for all to authenticated using (has_scope('staff')) with check (has_scope('staff'));
create policy plans_write    on membership_plans for all to authenticated using (has_scope('staff')) with check (has_scope('staff'));
create policy campaigns_write on campaigns for all to authenticated using (has_scope('staff')) with check (has_scope('staff'));

create policy resources_read on resources for select to authenticated
  using (not boards_only or exists (select 1 from roles_of(auth.uid()) where role in ('staff','regional_board','chapter_board')));
create policy resources_write on resources for all to authenticated using (has_scope('staff')) with check (has_scope('staff'));

-- Perfiles
create policy profiles_read on profiles for select to authenticated using (can_see_profile(id));
create policy profiles_update_own on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_managed on profiles for update to authenticated
  using (can_manage_person(id)) with check (can_manage_person(id));

-- Roles
create policy roles_read on role_assignments for select to authenticated
  using (user_id = auth.uid() or can_manage_person(user_id) or is_guardian_of(user_id));
create policy roles_insert on role_assignments for insert to authenticated
  with check (role_grantable(role, scope_type, scope_id));
create policy roles_update on role_assignments for update to authenticated
  using (role_grantable(role, scope_type, scope_id)) with check (role_grantable(role, scope_type, scope_id));
create policy roles_delete on role_assignments for delete to authenticated
  using (role_grantable(role, scope_type, scope_id));

-- Tutores
create policy guard_read on guardianships for select to authenticated
  using (guardian_id = auth.uid() or child_id = auth.uid() or can_manage_person(child_id));
create policy guard_request on guardianships for insert to authenticated
  with check ((guardian_id = auth.uid() and not verified) or (can_manage_person(child_id) and verified));
create policy guard_verify on guardianships for update to authenticated
  using (can_manage_person(child_id)) with check (can_manage_person(child_id));
create policy guard_delete on guardianships for delete to authenticated
  using (can_manage_person(child_id) or guardian_id = auth.uid());

-- Eventos
create function event_writable(e events) returns boolean
language sql stable security definer set search_path = public as $$ select event_manages(e) $$;
create policy events_read   on events for select to authenticated using (event_visible(events));
create policy events_insert on events for insert to authenticated with check (event_writable(events));
create policy events_update on events for update to authenticated
  using (event_writable(events)) with check (event_writable(events));
create policy events_delete on events for delete to authenticated
  using (event_writable(events) and status in ('borrador','cancelado'));

-- Inscripciones: solo lectura directa; se escribe con las funciones de más abajo
create policy regs_read on registrations for select to authenticated
  using (person_id = auth.uid() or registered_by = auth.uid() or is_guardian_of(person_id) or event_manages_id(event_id));

create policy health_read on registration_health for select to authenticated
  using (health_visible(registration_id));

-- Pagos y donaciones: se crean desde el servidor; el usuario solo lee lo suyo
create policy payments_read on payments for select to authenticated
  using (payer_id = auth.uid() or (chapter_id is not null and manages_chapter(chapter_id)) or has_scope('staff'));
create policy donations_read on donations for select to authenticated
  using (donor_id = auth.uid() or (chapter_id is not null and manages_chapter(chapter_id)) or has_scope('staff'));
create policy donations_insert on donations for insert to authenticated
  with check (donor_id = auth.uid() and status = 'pendiente');

-- Membresías y prospects
create policy memberships_read on memberships for select to authenticated
  using (person_id = auth.uid() or is_guardian_of(person_id) or manages_chapter(chapter_id));
create policy memberships_write on memberships for all to authenticated
  using (manages_chapter(chapter_id)) with check (manages_chapter(chapter_id));
create policy pipeline_all on prospect_pipeline for all to authenticated
  using (manages_chapter(chapter_id)) with check (manages_chapter(chapter_id));

-- Fotos
create policy albums_read on albums for select to authenticated
  using (manages_chapter(chapter_id) or has_scope('member', chapter_id) or has_scope('parent', chapter_id));
create policy albums_write on albums for all to authenticated
  using (manages_chapter(chapter_id)) with check (manages_chapter(chapter_id));
create policy photos_read on photos for select to authenticated
  using (exists (select 1 from albums a where a.id = album_id and (
          manages_chapter(a.chapter_id)
          or (photos.status = 'publicada' and (has_scope('member', a.chapter_id) or has_scope('parent', a.chapter_id))))));
create policy photos_insert on photos for insert to authenticated
  with check (uploaded_by = auth.uid() and exists (select 1 from albums a where a.id = album_id and (
          (manages_chapter(a.chapter_id)) or (status = 'pendiente' and has_scope('member', a.chapter_id)))));
create policy photos_moderate on photos for update to authenticated
  using (exists (select 1 from albums a where a.id = album_id and manages_chapter(a.chapter_id)))
  with check (exists (select 1 from albums a where a.id = album_id and manages_chapter(a.chapter_id)));
create policy consents_read on photo_consents for select to authenticated
  using (person_id = auth.uid() or is_guardian_of(person_id) or can_manage_person(person_id));
create policy consents_write on photo_consents for all to authenticated
  using (person_id = auth.uid() or is_guardian_of(person_id))
  with check (person_id = auth.uid() or is_guardian_of(person_id));

-- Gestión interna
create policy tasks_all on tasks for all to authenticated
  using (manages_chapter(chapter_id)) with check (manages_chapter(chapter_id));
create policy invites_all on invites for all to authenticated
  using (manages_chapter(chapter_id)) with check (manages_chapter(chapter_id) and role in ('member','prospect','parent','alumni'));
create policy audit_read on audit_log for select to authenticated using (is_staff_any());

-- ───────────────────────── Funciones de negocio ─────────────────────────
create function occupied_seats(eid uuid) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from registrations where event_id = eid and status in ('confirmada','pendiente_pago')
$$;

create function register_for_event(p_event uuid, p_person uuid, p_health text default null)
returns registrations language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid(); e events; reg registrations; birth date; yrs int;
  needs_guardian boolean; st reg_status;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into e from events where id = p_event;
  if not found or not event_visible_to(e, me) then raise exception 'event_not_found' using errcode = 'P0002'; end if;
  if e.status <> 'publicado' then raise exception 'event_not_open' using errcode = '42501'; end if;
  if e.starts_at < now() then raise exception 'event_past' using errcode = '22023'; end if;
  if p_person <> me and not is_guardian_of(p_person) then
    raise exception 'not_allowed: solo puedes inscribirte tú o a tu hijo/a verificado/a' using errcode = '42501';
  end if;
  if not event_visible_to(e, p_person) then
    raise exception 'not_eligible: el participante no tiene acceso a este evento' using errcode = '42501';
  end if;

  select birth_date into birth from profiles where id = p_person;
  if birth is null then raise exception 'birth_date_required' using errcode = '22023'; end if;
  yrs := age_on(birth);

  -- Un menor que se apunta solo necesita autorización si es menor de 14, o hay coste o pernocta
  needs_guardian := yrs < 18 and me = p_person and (yrs < 14 or e.price_cents > 0 or e.overnight);
  if needs_guardian and not exists (select 1 from guardianships where child_id = p_person and verified) then
    raise exception 'guardian_required: falta un padre o tutor verificado' using errcode = '42501';
  end if;

  if exists (select 1 from registrations where event_id = p_event and person_id = p_person and status <> 'cancelada') then
    raise exception 'already_registered' using errcode = '23505';
  end if;

  if needs_guardian then st := 'pendiente_padres';
  elsif occupied_seats(p_event) >= coalesce(e.capacity, 2147483647) then st := 'lista_espera';
  elsif e.price_cents > 0 then st := 'pendiente_pago';
  else st := 'confirmada';
  end if;

  insert into registrations (event_id, person_id, registered_by, status, authorized_by, authorized_at)
  values (p_event, p_person, me, st,
          case when me <> p_person then me end, case when me <> p_person then now() end)
  on conflict (event_id, person_id) do update
    set status = excluded.status, registered_by = excluded.registered_by,
        authorized_by = excluded.authorized_by, authorized_at = excluded.authorized_at,
        checked_in_at = null
  returning * into reg;

  if p_health is not null and length(trim(p_health)) > 0 then
    insert into registration_health (registration_id, notes) values (reg.id, trim(p_health))
    on conflict (registration_id) do update set notes = excluded.notes, updated_at = now();
  end if;
  return reg;
end $$;

create function authorize_registration(p_reg uuid, p_health text default null)
returns registrations language plpgsql security definer set search_path = public as $$
declare r registrations; e events; st reg_status;
begin
  select * into r from registrations where id = p_reg for update;
  if not found then raise exception 'registration_not_found' using errcode = 'P0002'; end if;
  if r.status <> 'pendiente_padres' then raise exception 'not_pending_authorization' using errcode = '22023'; end if;
  if not is_guardian_of(r.person_id) then raise exception 'not_guardian' using errcode = '42501'; end if;
  select * into e from events where id = r.event_id;
  if e.status <> 'publicado' then raise exception 'event_not_open' using errcode = '42501'; end if;

  if occupied_seats(e.id) >= coalesce(e.capacity, 2147483647) then st := 'lista_espera';
  elsif e.price_cents > 0 then st := 'pendiente_pago';
  else st := 'confirmada';
  end if;

  update registrations set status = st, authorized_by = auth.uid(), authorized_at = now()
  where id = p_reg returning * into r;

  if p_health is not null and length(trim(p_health)) > 0 then
    insert into registration_health (registration_id, notes) values (r.id, trim(p_health))
    on conflict (registration_id) do update set notes = excluded.notes, updated_at = now();
  end if;
  return r;
end $$;

create function cancel_registration(p_reg uuid) returns registrations
language plpgsql security definer set search_path = public as $$
declare r registrations; e events; nxt registrations; freed boolean;
begin
  select * into r from registrations where id = p_reg for update;
  if not found then raise exception 'registration_not_found' using errcode = 'P0002'; end if;
  if not (r.person_id = auth.uid() or is_guardian_of(r.person_id) or event_manages_id(r.event_id)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  freed := r.status in ('confirmada','pendiente_pago');
  update registrations set status = 'cancelada' where id = p_reg returning * into r;
  delete from registration_health where registration_id = p_reg;

  -- Si se libera una plaza, entra el primero de la lista de espera
  if freed then
    select * into e from events where id = r.event_id;
    select * into nxt from registrations where event_id = r.event_id and status = 'lista_espera'
      order by created_at limit 1 for update skip locked;
    if found then
      update registrations set status = case when e.price_cents > 0 then 'pendiente_pago'::reg_status else 'confirmada'::reg_status end
      where id = nxt.id;
    end if;
  end if;
  return r;
end $$;

create function check_in(p_reg uuid) returns registrations
language plpgsql security definer set search_path = public as $$
declare r registrations;
begin
  select * into r from registrations where id = p_reg for update;
  if not found then raise exception 'registration_not_found' using errcode = 'P0002'; end if;
  if not event_manages_id(r.event_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if r.status <> 'confirmada' then raise exception 'not_confirmed' using errcode = '22023'; end if;
  update registrations set checked_in_at = coalesce(checked_in_at, now()) where id = p_reg returning * into r;
  return r;
end $$;

create function redeem_invite(p_code text) returns role_assignments
language plpgsql security definer set search_path = public as $$
declare i invites; ra role_assignments;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into i from invites where code = p_code for update;
  if not found or i.uses_left <= 0 or (i.expires_at is not null and i.expires_at < now()) then
    raise exception 'invite_invalid' using errcode = '22023';
  end if;
  insert into role_assignments (user_id, role, scope_type, scope_id, created_by)
  values (auth.uid(), i.role, 'chapter', i.chapter_id, i.created_by) returning * into ra;
  update profiles set home_chapter_id = coalesce(home_chapter_id, i.chapter_id) where id = auth.uid();
  update invites set uses_left = uses_left - 1 where code = p_code;
  return ra;
end $$;

-- Solo el servidor (webhook de pagos): confirma el pago y la inscripción
create function confirm_payment(p_payment uuid, p_ref text) returns void
language plpgsql security definer set search_path = public as $$
declare p payments;
begin
  update payments set status = 'pagado', provider_ref = coalesce(p_ref, provider_ref)
  where id = p_payment and status = 'pendiente' returning * into p;
  if not found then return; end if;
  if p.registration_id is not null then
    update registrations set status = 'confirmada' where id = p.registration_id and status = 'pendiente_pago';
  end if;
  if p.donation_id is not null then
    update donations set status = 'pagado' where id = p.donation_id;
  end if;
end $$;

-- Borra los datos de salud 7 días después de cada evento (programar con pg_cron)
create function purge_health() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from registration_health h using registrations r, events e
  where h.registration_id = r.id and e.id = r.event_id
    and coalesce(e.ends_at, e.starts_at) < now() - interval '7 days';
  get diagnostics n = row_count;
  return n;
end $$;

-- ───────────────────────── Permisos de ejecución ─────────────────────────
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function
  register_for_event(uuid, uuid, text), authorize_registration(uuid, text), cancel_registration(uuid),
  check_in(uuid), redeem_invite(text), occupied_seats(uuid)
  to authenticated;
-- Las funciones de ámbito las usan las políticas RLS al evaluarse como "authenticated"
grant execute on function
  roles_of(uuid), chapter_region(uuid), has_scope_u(uuid, app_role, uuid, uuid), has_scope(app_role, uuid, uuid),
  has_role_in_region(uuid, app_role, uuid), manages_chapter_u(uuid, uuid), manages_region_u(uuid, uuid),
  manages_chapter(uuid), manages_region(uuid), approves_for(uuid, uuid), is_staff_any(), is_guardian_of(uuid),
  age_on(date, date), event_visible_to(events, uuid), event_visible(events), event_manages(events),
  event_manages_id(uuid), event_writable(events), can_manage_person(uuid), can_see_profile(uuid),
  role_grantable(app_role, scope_type, uuid), health_visible(uuid)
  to authenticated;
grant execute on function confirm_payment(uuid, text), purge_health() to service_role;

revoke all on all tables in schema public from anon;
