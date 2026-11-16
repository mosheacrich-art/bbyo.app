-- BBYO España · datos iniciales (sin usuarios; los usuarios de demo se crean con scripts/seed-demo.ts)
set session_replication_role = replica;  -- no aplicar los triggers de aprobación al sembrar

insert into regions (id, slug, name) values
  ('00000000-0000-0000-0000-0000000000a1', 'espana', 'España')
on conflict do nothing;

insert into chapters (id, region_id, slug, name, city, accent, membership_fee_cents) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'bcn',     'Barcelona', 'Barcelona', '#1A03B5', 6000),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', 'madrid',  'Madrid',    'Madrid',    '#E42158', 6000),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000a1', 'malaga',  'Málaga',    'Málaga',    '#00B5C7', 5000),
  ('00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000000a1', 'marbella','Marbella',  'Marbella',  '#F8450A', 5000),
  ('00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-0000000000a1', 'melilla', 'Melilla',   'Melilla',   '#6BBD00', 4000)
on conflict do nothing;

insert into membership_plans (chapter_id, name, price_cents, period)
select id, 'Anual', membership_fee_cents, 'anual' from chapters;
insert into membership_plans (chapter_id, name, price_cents, period)
select id, 'Familiar', membership_fee_cents * 3 / 2, 'anual' from chapters;

insert into campaigns (chapter_id, title, goal_cents) values
  (null, 'Campaña de Jánuca solidaria', 300000),
  ('00000000-0000-0000-0000-0000000000b1', 'Fondo de becas de Barcelona', 150000);

insert into links (title, url, note, sort) values
  ('Sitio web de BBYO', 'https://bbyo.org/', 'bbyo.org', 1),
  ('BBYO en España', 'https://bbyo.org/bbyo-near-you/spain/', 'bbyo.org/bbyo-near-you/spain', 2),
  ('Portal para padres', null, 'Enlace por configurar', 3),
  ('Alumni Hub', null, 'Enlace por configurar', 4),
  ('Programas de verano', null, 'Enlace por configurar', 5),
  ('Convención Internacional', null, 'Enlace por configurar', 6),
  ('Donaciones', null, 'Enlace por configurar', 7);

insert into resources (category, title, boards_only, sort) values
  ('Programación', 'Plantilla de programa semanal', false, 1),
  ('Programación', 'Ideas de actividades por edad', false, 2),
  ('Programación', 'Guía para eventos abiertos a prospects', false, 3),
  ('Comunicación', 'Textos para invitar a prospects', false, 4),
  ('Gestión del board', 'Manual del board', true, 5),
  ('Gestión del board', 'Plantilla de acta de reunión', true, 6),
  ('Gestión del board', 'Plantilla de presupuesto de evento', true, 7),
  ('Seguridad', 'Protocolo de seguridad y salidas', true, 8),
  ('Seguridad', 'Checklist de pernocta', true, 9),
  ('Seguridad', 'Cómo reportar una incidencia', true, 10),
  ('Comunicación', 'Kit de marca y plantillas de redes', true, 11);

-- Eventos de ejemplo con fechas relativas a hoy
create temp table _ev (layer event_layer, ch text, title text, days int, hh int, loc text, price int, cap int,
  open boolean, alumni boolean, boards boolean, night boolean, st event_status, descr text);
insert into _ev values
 ('global',null,'Sesión informativa: programas de verano', 9,19,'Online',0,300,true,true,false,false,'publicado','Resumen de los programas de verano para teens, con preguntas y respuestas en directo.'),
 ('global',null,'Giving Tuesday: campaña de donaciones',16,9,'Online',0,null,true,true,false,false,'publicado','Campaña global para apoyar a los teens de BBYO.'),
 ('regional',null,'Convención regional España',26,10,'Madrid',9500,120,false,true,false,true,'publicado','Tres días con teens de todos los chapters: programa, shabat juntos y talleres de liderazgo. Incluye alojamiento y comidas.'),
 ('regional',null,'Encuentro de boards',14,19,'Online',0,40,false,false,true,false,'publicado','Reunión de coordinación entre los boards de los chapters.'),
 ('regional',null,'Shabatón regional',68,17,'Por definir',7000,80,false,false,false,true,'pendiente','Fin de semana de shabat para toda la región. Pendiente de aprobación.'),
 ('local','bcn','Noche de juegos',4,20,'Local del chapter',0,40,true,false,false,false,'publicado','Programa semanal. Trae a un amigo: los prospects entran gratis.'),
 ('local','bcn','Voluntariado: banco de alimentos',7,10,'Barcelona',0,25,true,false,false,false,'publicado','Mañana de voluntariado con el chapter.'),
 ('local','bcn','Cena de shabat',12,19,'Comunidad',1200,50,true,false,false,false,'publicado','Cena de shabat para el chapter y sus invitados.'),
 ('local','bcn','Fiesta de Jánuca',21,18,'Barcelona',800,60,true,true,false,false,'publicado','Fiesta de Jánuca abierta a miembros, prospects y alumni.'),
 ('local','bcn','Retiro de board',35,10,'Por definir',0,12,false,false,true,false,'borrador','Planificación del segundo trimestre.'),
 ('local','madrid','Torneo de fútbol sala',7,11,'Polideportivo',0,48,true,false,false,false,'publicado','Torneo por equipos del chapter de Madrid.'),
 ('local','madrid','Cena de shabat',12,20,'Comunidad',1500,70,true,false,false,false,'publicado','Cena de shabat del chapter de Madrid.'),
 ('local','madrid','Fiesta de Jánuca',23,18,'Madrid',1000,60,true,true,false,false,'publicado','Fiesta de Jánuca del chapter de Madrid.'),
 ('local','malaga','Pizza y debate',5,19,'Málaga',0,30,true,false,false,false,'publicado','Debate sobre liderazgo juvenil con pizza.'),
 ('local','malaga','Taller de liderazgo',20,17,'Málaga',0,30,false,false,false,false,'publicado','Taller para el board y los miembros.'),
 ('local','marbella','Tarde de playa y programa',6,16,'Marbella',0,25,true,false,false,false,'publicado','Tarde en la playa con programa del chapter.'),
 ('local','marbella','Cena de Jánuca',24,20,'Marbella',1200,40,true,false,false,false,'publicado','Cena de Jánuca del chapter de Marbella.'),
 ('local','melilla','Reunión de chapter',3,19,'Melilla',0,25,false,false,false,false,'publicado','Reunión mensual del chapter.'),
 ('local','melilla','Noche de cine',19,20,'Melilla',0,25,true,false,false,false,'publicado','Película y debate.');

insert into events (layer, region_id, chapter_id, title, description, starts_at, ends_at, location, price_cents, capacity, is_open, alumni_ok, boards_only, overnight, status)
select e.layer,
       case when e.layer = 'regional' then '00000000-0000-0000-0000-0000000000a1'::uuid end,
       case when e.layer = 'local' then (select id from chapters c where c.slug = e.ch) end,
       e.title, e.descr,
       date_trunc('day', now()) + make_interval(days => e.days, hours => e.hh),
       case when e.night then date_trunc('day', now()) + make_interval(days => e.days + 2, hours => 14)
            else date_trunc('day', now()) + make_interval(days => e.days, hours => e.hh + 2) end,
       e.loc, e.price, e.cap, e.open, e.alumni, e.boards, e.night, e.st
from _ev e;

set session_replication_role = origin;
