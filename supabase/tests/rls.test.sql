-- Pruebas de permisos (RLS y funciones). Se ejecutan sobre una base con migraciones + seed.
-- psql -f supabase/tests/00_auth_stub.sql (solo local) y luego este archivo.
create schema if not exists test;
grant usage on schema test to public;

create or replace function test.as_user(u uuid) returns void language plpgsql as $$
begin reset role; perform set_config('request.jwt.claim.sub', u::text, false); set role authenticated; end $$;
create or replace function test.as_anon() returns void language plpgsql as $$
begin reset role; perform set_config('request.jwt.claim.sub', '', false); set role anon; end $$;
create or replace function test.as_service() returns void language plpgsql as $$
begin reset role; set role service_role; end $$;
create or replace function test.as_admin() returns void language plpgsql as $$
begin reset role; perform set_config('request.jwt.claim.sub', '', false); end $$;
create or replace function test.eq(name text, got anyelement, want anyelement) returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAIL: %  (obtenido %, esperado %)', name, got, want; end if;
  raise notice 'ok   %', name;
end $$;
create or replace function test.raises(name text, q text, expect text default null) returns void language plpgsql as $$
declare ok boolean := false; msg text;
begin
  begin execute q; exception when others then ok := true; msg := sqlerrm; end;
  if not ok then raise exception 'FAIL: % (se esperaba un error)', name; end if;
  if expect is not null and position(expect in msg) = 0 then
    raise exception 'FAIL: % (error distinto: %)', name, msg; end if;
  raise notice 'ok   %', name;
end $$;

-- ───────── Datos de prueba ─────────
do $$
declare
  rg uuid := '00000000-0000-0000-0000-0000000000a1';
  bcn uuid := '00000000-0000-0000-0000-0000000000b1';
  mad uuid := '00000000-0000-0000-0000-0000000000b2';
begin
  perform test.as_admin();
  insert into auth.users (id, email, raw_user_meta_data) values
   ('10000000-0000-0000-0000-000000000001','staff@t.test','{"full_name":"Staff"}'),
   ('10000000-0000-0000-0000-000000000002','regional@t.test','{"full_name":"Regional"}'),
   ('10000000-0000-0000-0000-000000000003','boardbcn@t.test','{"full_name":"Board BCN"}'),
   ('10000000-0000-0000-0000-000000000004','boardmad@t.test','{"full_name":"Board MAD"}'),
   ('10000000-0000-0000-0000-000000000005','dani@t.test','{"full_name":"Dani"}'),
   ('10000000-0000-0000-0000-000000000006','sara@t.test','{"full_name":"Sara"}'),
   ('10000000-0000-0000-0000-000000000007','eli@t.test','{"full_name":"Eli"}'),
   ('10000000-0000-0000-0000-000000000008','raquel@t.test','{"full_name":"Raquel"}'),
   ('10000000-0000-0000-0000-000000000009','coord@t.test','{"full_name":"Coord BCN"}'),
   ('10000000-0000-0000-0000-00000000000a','memmad@t.test','{"full_name":"Miembro MAD"}'),
   ('10000000-0000-0000-0000-00000000000b','ana@t.test','{"full_name":"Ana"}'),
   ('10000000-0000-0000-0000-00000000000c','ben@t.test','{"full_name":"Ben"}');
  update profiles set birth_date = (current_date - interval '15 years')::date, home_chapter_id = bcn where id = '10000000-0000-0000-0000-000000000005';
  update profiles set birth_date = (current_date - interval '14 years 2 months')::date, home_chapter_id = bcn where id = '10000000-0000-0000-0000-000000000007';
  update profiles set birth_date = '1980-01-01', home_chapter_id = bcn where id in ('10000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000009');
  update profiles set birth_date = '1990-01-01', home_chapter_id = mad where id in ('10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-00000000000a');
  update profiles set birth_date = '2002-05-05' where id = '10000000-0000-0000-0000-000000000008';
  update profiles set birth_date = '2000-01-01', home_chapter_id = bcn where id in ('10000000-0000-0000-0000-00000000000b','10000000-0000-0000-0000-00000000000c');
  insert into role_assignments (user_id, role, scope_type, scope_id) values
   ('10000000-0000-0000-0000-000000000001','staff','global',null),
   ('10000000-0000-0000-0000-000000000002','regional_board','region',rg),
   ('10000000-0000-0000-0000-000000000003','chapter_board','chapter',bcn),
   ('10000000-0000-0000-0000-000000000004','chapter_board','chapter',mad),
   ('10000000-0000-0000-0000-000000000005','member','chapter',bcn),
   ('10000000-0000-0000-0000-000000000006','parent','chapter',bcn),
   ('10000000-0000-0000-0000-000000000007','prospect','chapter',bcn),
   ('10000000-0000-0000-0000-000000000008','alumni','region',rg),
   ('10000000-0000-0000-0000-000000000009','staff','chapter',bcn),
   ('10000000-0000-0000-0000-00000000000a','member','chapter',mad),
   ('10000000-0000-0000-0000-00000000000b','member','chapter',bcn),
   ('10000000-0000-0000-0000-00000000000c','member','chapter',bcn);
  insert into guardianships (guardian_id, child_id, verified)
  values ('10000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000005', true);
end $$;

-- ───────── Visibilidad de eventos ─────────
do $$ declare n int; begin
  perform test.as_user('10000000-0000-0000-0000-000000000005'); select count(*) into n from events; perform test.eq('miembro (Dani) ve 7 eventos', n, 7);
  perform test.as_user('10000000-0000-0000-0000-000000000007'); select count(*) into n from events; perform test.eq('prospect ve solo abiertos: 6', n, 6);
  perform test.as_user('10000000-0000-0000-0000-000000000008'); select count(*) into n from events; perform test.eq('alumni ve 5 eventos', n, 5);
  perform test.as_user('10000000-0000-0000-0000-000000000003'); select count(*) into n from events; perform test.eq('board BCN ve 9 (incluye borrador y solo-boards)', n, 9);
  perform test.as_user('10000000-0000-0000-0000-000000000004'); select count(*) into n from events where layer='local' and chapter_id = '00000000-0000-0000-0000-0000000000b1'; perform test.eq('board MAD no ve eventos locales de BCN (solo abiertos/no)', n, 0);
  perform test.as_user('10000000-0000-0000-0000-000000000002'); select count(*) into n from events; perform test.eq('Regional ve 19', n, 19);
  perform test.as_user('10000000-0000-0000-0000-000000000001'); select count(*) into n from events; perform test.eq('staff global ve 19', n, 19);
  perform test.as_user('10000000-0000-0000-0000-000000000009'); select count(*) into n from events; perform test.eq('coordinador de BCN ve 8', n, 8);
  perform test.as_anon(); perform test.raises('anónimo no puede leer eventos', 'select * from events');
end $$;

-- ───────── Inscripciones y autorización parental ─────────
do $$
declare dani uuid := '10000000-0000-0000-0000-000000000005'; sara uuid := '10000000-0000-0000-0000-000000000006';
  eli uuid := '10000000-0000-0000-0000-000000000007';
  e_free uuid; e_paid uuid; e_mad uuid; e_boards uuid; e_conv uuid; r registrations; n int; st text;
begin
  perform test.as_admin();
  select id into e_free from events where title='Noche de juegos' and chapter_id='00000000-0000-0000-0000-0000000000b1';
  select id into e_paid from events where title='Cena de shabat' and chapter_id='00000000-0000-0000-0000-0000000000b1';
  select id into e_mad  from events where title='Torneo de fútbol sala';
  select id into e_boards from events where title='Encuentro de boards';
  select id into e_conv from events where title='Convención regional España';

  perform test.as_user(dani);
  select (register_for_event(e_free, dani, 'Alergia a los frutos secos')).status into st; perform test.eq('Dani se apunta a evento gratis: confirmada', st, 'confirmada');
  select (register_for_event(e_paid, dani)).status into st; perform test.eq('Dani (15) a evento de pago: pendiente_padres', st, 'pendiente_padres');
  perform test.raises('Dani no puede apuntarse dos veces', format('select register_for_event(%L,%L)', e_free, dani), 'already_registered');
  perform test.raises('Dani no ve eventos de otro chapter', format('select register_for_event(%L,%L)', e_mad, dani), 'event_not_found');
  perform test.raises('Dani no puede apuntarse a eventos solo-boards', format('select register_for_event(%L,%L)', e_boards, dani));
  perform test.raises('Dani no puede apuntar a otra persona', format('select register_for_event(%L,%L)', e_free, eli), 'not_allowed');

  perform test.as_user(eli);
  select (register_for_event(e_free, eli)).status into st; perform test.eq('Prospect (14) se apunta a evento abierto gratis', st, 'confirmada');
  perform test.raises('Prospect no accede a evento no abierto', format('select register_for_event(%L,%L)', e_conv, eli));

  perform test.as_user(sara);
  select id into r.id from registrations where person_id = dani and event_id = e_paid;
  select count(*) into n from registrations; perform test.eq('Sara (madre) ve las inscripciones de Dani', n, 2);
  select (authorize_registration(r.id, 'Sin alergias')).status into st; perform test.eq('Sara autoriza: pendiente_pago', st, 'pendiente_pago');
  perform test.raises('Sara no puede confirmar pagos', format('select confirm_payment(%L,%L)', gen_random_uuid(), 'x'));

  perform test.as_service();
  insert into payments (chapter_id, payer_id, registration_id, amount_cents) values ('00000000-0000-0000-0000-0000000000b1', sara, r.id, 1200) returning id into r.id;
  perform confirm_payment(r.id, 'pi_test');
  perform test.as_admin();
  select status::text into st from registrations where person_id = dani and event_id = e_paid; perform test.eq('el pago confirma la inscripción', st, 'confirmada');

  -- privacidad entre chapters
  perform test.as_user('10000000-0000-0000-0000-00000000000a'); select count(*) into n from registrations; perform test.eq('otro miembro no ve inscripciones ajenas', n, 0);
  perform test.as_user('10000000-0000-0000-0000-000000000004'); select count(*) into n from registrations; perform test.eq('board MAD no ve inscripciones de BCN', n, 0);
  perform test.as_user('10000000-0000-0000-0000-000000000003'); select count(*) into n from registrations; perform test.eq('board BCN ve las 3 inscripciones de su chapter', n, 3);

  -- check-in
  select id into r.id from registrations where person_id = dani and event_id = e_free;
  perform test.as_user('10000000-0000-0000-0000-000000000004'); perform test.raises('board MAD no puede hacer check-in en BCN', format('select check_in(%L)', r.id), 'not_allowed');
  perform test.as_user(dani); perform test.raises('Dani no puede hacer check-in', format('select check_in(%L)', r.id), 'not_allowed');
  perform test.as_user('10000000-0000-0000-0000-000000000003');
  select (check_in(r.id)).checked_in_at is not null into st; perform test.eq('board BCN hace check-in', st, 'true');
  perform test.as_user(dani); update registrations set status='confirmada' where id = r.id; get diagnostics n = row_count; perform test.eq('nadie actualiza registrations directamente (0 filas)', n, 0);
  perform test.raises('nadie inserta registrations directamente', format('insert into registrations(event_id,person_id,registered_by,status) values (%L,%L,%L,''confirmada'')', e_free, dani, dani));
end $$;

-- ───────── Datos de salud solo durante el evento ─────────
do $$ declare n int; dani uuid := '10000000-0000-0000-0000-000000000005'; e uuid; begin
  perform test.as_admin();
  select id into e from events where title='Noche de juegos' and chapter_id='00000000-0000-0000-0000-0000000000b1';
  perform test.as_user(dani); select count(*) into n from registration_health; perform test.eq('Dani ve sus 2 datos de salud', n, 2);
  perform test.as_user('10000000-0000-0000-0000-000000000006'); select count(*) into n from registration_health; perform test.eq('su madre ve los datos de salud', n, 2);
  perform test.as_user('10000000-0000-0000-0000-000000000003'); select count(*) into n from registration_health; perform test.eq('board no ve salud fuera de la ventana del evento', n, 0);
  perform test.as_admin(); update events set starts_at = now() + interval '1 hour', ends_at = now() + interval '3 hours' where id = e;
  perform test.as_user('10000000-0000-0000-0000-000000000003'); select count(*) into n from registration_health; perform test.eq('board ve salud durante el evento', n, 1);
  perform test.as_user('10000000-0000-0000-0000-000000000004'); select count(*) into n from registration_health; perform test.eq('board de otro chapter nunca ve salud', n, 0);
  perform test.as_user('10000000-0000-0000-0000-000000000001'); select count(*) into n from registration_health; perform test.eq('staff global ve salud durante el evento', n, 1);
  perform test.as_admin(); update events set starts_at = now() - interval '30 days', ends_at = now() - interval '29 days' where id = e;
  perform test.eq('purge_health borra salud 7+ días tras el evento', purge_health(), 1);
end $$;

-- ───────── Aforo y lista de espera ─────────
do $$ declare a uuid := '10000000-0000-0000-0000-00000000000b'; b uuid := '10000000-0000-0000-0000-00000000000c'; e uuid; ra registrations; st text; begin
  perform test.as_user('10000000-0000-0000-0000-000000000003');
  insert into events (layer, chapter_id, title, starts_at, capacity, status, price_cents)
    values ('local','00000000-0000-0000-0000-0000000000b1','Aforo 1', now() + interval '5 days', 1, 'publicado', 0) returning id into e;
  perform test.as_user(a); select (register_for_event(e, a)).status into st; perform test.eq('primero entra', st, 'confirmada');
  perform test.as_user(b); select (register_for_event(e, b)).status into st; perform test.eq('segundo a lista de espera', st, 'lista_espera');
  perform test.as_user(a); select id into ra.id from registrations where event_id = e and person_id = a; perform cancel_registration(ra.id);
  perform test.as_admin(); select status::text into st from registrations where event_id = e and person_id = b; perform test.eq('al cancelar entra el de la lista de espera', st, 'confirmada');
end $$;

-- ───────── Aprobación de eventos ─────────
do $$ declare e uuid; st text; bcn uuid := '00000000-0000-0000-0000-0000000000b1'; begin
  perform test.as_user('10000000-0000-0000-0000-000000000003');
  perform test.raises('board no publica eventos con coste', format('insert into events (layer,chapter_id,title,starts_at,price_cents,status) values (''local'',%L,''Pago'',now()+interval ''9 days'',500,''publicado'')', bcn), 'approval_required');
  perform test.raises('board no publica eventos con pernocta', format('insert into events (layer,chapter_id,title,starts_at,overnight,status) values (''local'',%L,''Noche'',now()+interval ''9 days'',true,''publicado'')', bcn), 'approval_required');
  insert into events (layer,chapter_id,title,starts_at,price_cents,status) values ('local',bcn,'Pago',now()+interval '9 days',500,'pendiente') returning id into e;
  perform test.eq('board crea evento con coste como pendiente', (select status::text from events where id=e), 'pendiente');
  perform test.raises('board no puede auto-aprobar', format('update events set status=''publicado'' where id=%L', e), 'approval_required');
  perform test.as_user('10000000-0000-0000-0000-000000000004');
  perform test.raises('board MAD no puede crear eventos de BCN', format('insert into events (layer,chapter_id,title,starts_at,status) values (''local'',%L,''X'',now()+interval ''9 days'',''borrador'')', bcn));
  perform test.as_user('10000000-0000-0000-0000-000000000002');
  update events set status='publicado' where id=e;
  perform test.eq('Regional aprueba y queda registrado', (select approved_by is not null from events where id=e), true);
  perform test.as_user('10000000-0000-0000-0000-000000000003');
  update events set price_cents = 900 where id=e;
  perform test.eq('cambiar el precio vuelve a pedir aprobación', (select status::text from events where id=e), 'pendiente');
  perform test.raises('board no crea eventos regionales', 'insert into events (layer,region_id,title,starts_at,status) values (''regional'',''00000000-0000-0000-0000-0000000000a1'',''R'',now()+interval ''9 days'',''borrador'')');
  perform test.raises('board no crea eventos globales', 'insert into events (layer,title,starts_at,status) values (''global'',''G'',now()+interval ''9 days'',''borrador'')');
  perform test.as_user('10000000-0000-0000-0000-000000000001');
  insert into events (layer,title,starts_at,status) values ('global','G',now()+interval '9 days','publicado');
  perform test.eq('staff crea evento global', (select count(*)::int from events where title='G'), 1);
end $$;

-- ───────── Roles, tutores y personas ─────────
do $$ declare n int; bcn uuid := '00000000-0000-0000-0000-0000000000b1'; mad uuid := '00000000-0000-0000-0000-0000000000b2'; begin
  perform test.as_user('10000000-0000-0000-0000-000000000003');
  insert into role_assignments (user_id, role, scope_type, scope_id) values ('10000000-0000-0000-0000-00000000000b','prospect','chapter',bcn) ;
  perform test.raises('board no da el rol chapter_board', format('insert into role_assignments (user_id,role,scope_type,scope_id) values (%L,''chapter_board'',''chapter'',%L)', '10000000-0000-0000-0000-00000000000b', bcn));
  perform test.raises('board no da roles en otro chapter', format('insert into role_assignments (user_id,role,scope_type,scope_id) values (%L,''member'',''chapter'',%L)', '10000000-0000-0000-0000-00000000000b', mad));
  perform test.raises('nadie se hace staff a sí mismo', format('insert into role_assignments (user_id,role,scope_type) values (%L,''staff'',''global'')', '10000000-0000-0000-0000-000000000003'));
  perform test.as_user('10000000-0000-0000-0000-000000000009');
  perform test.raises('coordinador de chapter no crea staff', format('insert into role_assignments (user_id,role,scope_type,scope_id) values (%L,''staff'',''chapter'',%L)', '10000000-0000-0000-0000-00000000000b', bcn));
  perform test.as_user('10000000-0000-0000-0000-000000000001');
  insert into role_assignments (user_id,role,scope_type) values ('10000000-0000-0000-0000-00000000000c','staff','global');
  perform test.eq('staff global concede staff', (select count(*)::int from role_assignments where user_id='10000000-0000-0000-0000-00000000000c' and role='staff'), 1);
  delete from role_assignments where user_id='10000000-0000-0000-0000-00000000000c' and role='staff';

  perform test.as_user('10000000-0000-0000-0000-000000000005'); select count(*) into n from profiles; perform test.eq('Dani solo ve su perfil', n, 1);
  perform test.as_user('10000000-0000-0000-0000-000000000006'); select count(*) into n from profiles; perform test.eq('Sara ve su perfil y el de su hijo', n, 2);
  perform test.as_user('10000000-0000-0000-0000-000000000004'); select count(*) into n from profiles where home_chapter_id = bcn; perform test.eq('board MAD no ve personas de BCN', n, 0);
  perform test.as_user('10000000-0000-0000-0000-000000000003'); select count(*) into n from profiles where home_chapter_id = bcn; perform test.eq('board BCN ve a las personas de BCN', n, 7);
  perform test.as_user('10000000-0000-0000-0000-000000000006');
  perform test.raises('un padre no se verifica a sí mismo', format('insert into guardianships (guardian_id,child_id,verified) values (%L,%L,true)', '10000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000007'));
  perform test.as_user('10000000-0000-0000-0000-000000000005');
  perform test.eq('miembro ve 0 filas de audit_log', (select count(*)::int from audit_log), 0);
  perform test.as_user('10000000-0000-0000-0000-000000000001'); perform test.eq('staff lee el audit_log', (select count(*) > 0 from audit_log), true);
end $$;

-- ───────── Invitaciones ─────────
do $$ declare ra role_assignments; bcn uuid := '00000000-0000-0000-0000-0000000000b1'; begin
  perform test.as_user('10000000-0000-0000-0000-000000000003');
  insert into invites (code, chapter_id, role, uses_left, created_by) values ('BCN-2026', bcn, 'member', 1, '10000000-0000-0000-0000-000000000003');
  perform test.as_user('10000000-0000-0000-0000-00000000000a');
  perform test.eq('canjear invitación da rol de miembro en BCN', (redeem_invite('BCN-2026')).role::text, 'member');
  perform test.raises('la invitación solo vale una vez', 'select redeem_invite(''BCN-2026'')', 'invite_invalid');
end $$;
do $$ declare n int; begin
  perform test.as_user('10000000-0000-0000-0000-000000000005');
  perform test.raises('un menor no cambia su fecha de nacimiento', 'update profiles set birth_date = ''1990-01-01'' where id = ''10000000-0000-0000-0000-000000000005''', 'birth_date_locked');
  perform test.as_user('10000000-0000-0000-0000-000000000003');
  update profiles set birth_date = '2011-01-01' where id = '10000000-0000-0000-0000-000000000005'; get diagnostics n = row_count;
  perform test.eq('el board de su chapter sí puede corregirla', n, 1);
  perform test.as_user('10000000-0000-0000-0000-000000000005');
  perform test.eq('campaign_totals responde', (select count(*) from campaign_totals()) >= 0, true);
end $$;
select 'TODAS LAS PRUEBAS DE PERMISOS PASAN' as resultado;
