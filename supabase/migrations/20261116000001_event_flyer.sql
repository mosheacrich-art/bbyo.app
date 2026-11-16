-- Cartel del evento subido por el board (URL pública o ruta de Storage).
alter table public.events add column if not exists flyer_url text;
