-- Totales de campañas visibles para cualquier persona autenticada (sin exponer quién donó)
create function campaign_totals() returns table (campaign_id uuid, total_cents bigint)
language sql stable security definer set search_path = public as $$
  select campaign_id, coalesce(sum(amount_cents), 0)::bigint from donations
  where status = 'pagado' and campaign_id is not null group by campaign_id
$$;
revoke all on function campaign_totals() from public, anon, authenticated;
grant execute on function campaign_totals() to authenticated;

-- La fecha de nacimiento decide si hace falta autorización parental: una vez fijada,
-- la persona no puede cambiarla sola (la corrige quien gestiona su chapter o staff).
create function profiles_guard() returns trigger language plpgsql as $$
begin
  if old.birth_date is not null and new.birth_date is distinct from old.birth_date
     and auth.uid() = old.id and not can_manage_person(old.id) then
    raise exception 'birth_date_locked: pide a tu board que corrija la fecha de nacimiento' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_guard_trg before update on profiles for each row execute function profiles_guard();
