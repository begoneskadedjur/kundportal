-- 20261014_ordlista.sql
-- Ordlistan (3.52.0): ord som "Snygga till" i specialrapporterna aldrig rättar.
-- Fylls automatiskt med namnen på artiklar, tjänster, produkter, preparat och
-- stationstyper (triggers håller den i synk) och med ord som personalen lägger
-- till själv (source 'manuell').
--
-- Åtkomst:
--   läsa      admin, koordinator och tekniker
--   lägga in  samma roller, bara source 'manuell' och added_by = den inloggade
--   ändra     admin och koordinator (till exempel stänga av ett automatiskt ord)
--   ta bort   admin och koordinator, bara manuella ord (automatiska stängs av,
--             annars lägger synken tillbaka dem)
--
-- source_id är text eftersom products.id är text (övriga källor har uuid).
-- Idempotent och utan DROP: kan köras om.

create table if not exists public.text_glossary (
  id uuid primary key default gen_random_uuid(),
  term text not null,
  source text not null default 'manuell',
  source_id text null,
  active boolean not null default true,
  added_by uuid null default auth.uid(),
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'text_glossary_source_check'
      and conrelid = 'public.text_glossary'::regclass
  ) then
    alter table public.text_glossary
      add constraint text_glossary_source_check
      check (source in ('artikel', 'tjanst', 'produkt', 'preparat', 'stationstyp', 'manuell'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'text_glossary_term_check'
      and conrelid = 'public.text_glossary'::regclass
  ) then
    alter table public.text_glossary
      add constraint text_glossary_term_check
      check (length(btrim(term)) between 1 and 200);
  end if;
end;
$$;

create unique index if not exists text_glossary_term_lower_key on public.text_glossary (lower(term));
create index if not exists text_glossary_source_idx on public.text_glossary (source, source_id);

alter table public.text_glossary enable row level security;

-- ============================================================================
-- Rollkontroller (security definer, läser profiles utan att RLS rekurserar)
-- ============================================================================

-- Admin eller koordinator (samma regel som specialrapporterna)
create or replace function public.text_glossary_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select coalesce(p.is_admin, false)
      or coalesce(p.is_koordinator, false)
      or p.role::text in ('admin', 'koordinator')
      or coalesce(p.extra_roles, array[]::text[]) && array['admin', 'koordinator']::text[]
    from public.profiles p
    where p.user_id = auth.uid()
    limit 1
  ), false);
$$;

-- Admin, koordinator eller tekniker
create or replace function public.text_glossary_can_use()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select coalesce(p.is_admin, false)
      or coalesce(p.is_koordinator, false)
      or p.role::text in ('admin', 'koordinator', 'technician')
      or coalesce(p.extra_roles, array[]::text[]) && array['admin', 'koordinator', 'technician']::text[]
    from public.profiles p
    where p.user_id = auth.uid()
    limit 1
  ), false);
$$;

grant execute on function public.text_glossary_is_staff() to authenticated, service_role;
grant execute on function public.text_glossary_can_use() to authenticated, service_role;

-- ============================================================================
-- RLS
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'text_glossary' and policyname = 'text_glossary_select') then
    create policy text_glossary_select on public.text_glossary
      for select to authenticated
      using (public.text_glossary_can_use());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'text_glossary' and policyname = 'text_glossary_insert') then
    create policy text_glossary_insert on public.text_glossary
      for insert to authenticated
      with check (
        public.text_glossary_can_use()
        and source = 'manuell'
        and source_id is null
        and added_by = auth.uid()
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'text_glossary' and policyname = 'text_glossary_update') then
    create policy text_glossary_update on public.text_glossary
      for update to authenticated
      using (public.text_glossary_is_staff())
      with check (public.text_glossary_is_staff());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'text_glossary' and policyname = 'text_glossary_delete') then
    create policy text_glossary_delete on public.text_glossary
      for delete to authenticated
      using (public.text_glossary_is_staff() and source = 'manuell');
  end if;
end;
$$;

grant select, insert, update, delete on public.text_glossary to authenticated;
grant all on public.text_glossary to service_role;

-- ============================================================================
-- Synk från källtabellerna
-- ============================================================================

-- Lägger till eller byter namn på källans term. TG_ARGV[0] = source.
-- Rör aldrig en rad som admin har stängt av (active = false).
create or replace function public.text_glossary_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text := tg_argv[0];
  v_id text := new.id::text;
  v_term text := btrim(coalesce(new.name::text, ''));
  v_rad public.text_glossary%rowtype;
begin
  if v_term = '' or length(v_term) > 200 then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.name is not distinct from new.name then
    return new;
  end if;

  select * into v_rad
  from public.text_glossary
  where source = v_source and source_id = v_id
  limit 1;

  if found then
    if not v_rad.active or v_rad.term = v_term then
      return new;
    end if;
    begin
      update public.text_glossary set term = v_term where id = v_rad.id;
    exception when unique_violation then
      -- Det nya namnet finns redan i ordlistan (från en annan källa eller manuellt)
      null;
    end;
  else
    insert into public.text_glossary (term, source, source_id, added_by)
    values (v_term, v_source, v_id, null)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

do $$
declare
  k record;
begin
  for k in
    select * from (values
      ('articles', 'artikel'),
      ('services', 'tjanst'),
      ('products', 'produkt'),
      ('preparations', 'preparat'),
      ('station_types', 'stationstyp')
    ) as t(tabell, kalla)
  loop
    if not exists (
      select 1 from pg_trigger
      where tgname = 'text_glossary_sync_trg'
        and tgrelid = format('public.%I', k.tabell)::regclass
    ) then
      execute format(
        'create trigger text_glossary_sync_trg after insert or update of name on public.%I '
        'for each row execute function public.text_glossary_sync(%L)',
        k.tabell, k.kalla
      );
    end if;
  end loop;
end;
$$;

-- ============================================================================
-- Första fyllningen. Preparat och stationstyper först, så att de vinner när
-- samma namn finns i flera källor.
-- ============================================================================

insert into public.text_glossary (term, source, source_id, added_by)
select distinct on (lower(btrim(name))) btrim(name), 'preparat', id::text, null::uuid
from public.preparations
where btrim(coalesce(name, '')) <> '' and length(btrim(name)) <= 200
order by lower(btrim(name)), id
on conflict do nothing;

insert into public.text_glossary (term, source, source_id, added_by)
select distinct on (lower(btrim(name))) btrim(name), 'stationstyp', id::text, null::uuid
from public.station_types
where btrim(coalesce(name, '')) <> '' and length(btrim(name)) <= 200
order by lower(btrim(name)), id
on conflict do nothing;

insert into public.text_glossary (term, source, source_id, added_by)
select distinct on (lower(btrim(name))) btrim(name), 'artikel', id::text, null::uuid
from public.articles
where btrim(coalesce(name, '')) <> '' and length(btrim(name)) <= 200
order by lower(btrim(name)), id
on conflict do nothing;

insert into public.text_glossary (term, source, source_id, added_by)
select distinct on (lower(btrim(name))) btrim(name), 'tjanst', id::text, null::uuid
from public.services
where btrim(coalesce(name, '')) <> '' and length(btrim(name)) <= 200
order by lower(btrim(name)), id
on conflict do nothing;

insert into public.text_glossary (term, source, source_id, added_by)
select distinct on (lower(btrim(name))) btrim(name), 'produkt', id::text, null::uuid
from public.products
where btrim(coalesce(name, '')) <> '' and length(btrim(name)) <= 200
order by lower(btrim(name)), id
on conflict do nothing;

comment on table public.text_glossary is
  'Ordlistan för Snygga till (3.52.0): termer som AI-genomläsningen aldrig ändrar. Automatiska rader synkas från articles, services, products, preparations och station_types; manuella läggs till av personalen.';
