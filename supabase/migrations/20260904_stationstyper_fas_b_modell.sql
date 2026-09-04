-- ═══════════════════════════════════════════════════════════════
-- Fas B: stationstypen får tjänst och produkter, kunden får läge
--
-- 1. station_types.annual_service_id: vilken tjänst kundpriset ligger på
--    (mekanisk fälla/betes/plåt/betong -> 144, ljusfälla -> 79).
-- 2. station_type_articles: produkterna teknikern får välja mellan.
-- 3. article_id på båda stationstabellerna: vad som faktiskt sattes ut.
-- 4. customers.addon_invoice_mode: faktureringsläget på kundnivå.
-- 5. addon_annual_price_for_type + addon_service_id_for_type: prisuppslag
--    per stationstyp, samma trappa som TS-sidan.
-- 6. Eget dubblettskydd för artikelrader (de faller utanför
--    cbi_addon_period_line_key eftersom billing_model = 'premium').
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1. Stationstypens tjänst
-- ─────────────────────────────────────────────────────────────
alter table public.station_types
  add column if not exists annual_service_id uuid references public.services(id) on delete set null;

comment on column public.station_types.annual_service_id is
  'Tjänsten som bär kundpriset per år för tilläggsstationer av denna typ. Null = använd tjänsten med used_for_addon_stations_annual.';

-- ─────────────────────────────────────────────────────────────
-- 2. Produkterna per stationstyp
-- ─────────────────────────────────────────────────────────────
create table if not exists public.station_type_articles (
  id uuid primary key default gen_random_uuid(),
  station_type_id uuid not null references public.station_types(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  is_default boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (station_type_id, article_id)
);

comment on table public.station_type_articles is
  'Produkter teknikern kan välja mellan för en stationstyp. Intern kostnad, visas aldrig för kund.';

create unique index if not exists station_type_articles_one_default
  on public.station_type_articles (station_type_id) where is_default;

create index if not exists station_type_articles_type_idx
  on public.station_type_articles (station_type_id, sort_order);

alter table public.station_type_articles enable row level security;

drop policy if exists "Personal kan läsa stationstypens artiklar" on public.station_type_articles;
create policy "Personal kan läsa stationstypens artiklar" on public.station_type_articles
  for select using (
    exists (select 1 from profiles where profiles.user_id = auth.uid()
            and profiles.role in ('admin', 'koordinator', 'technician'))
  );

drop policy if exists "Admin kan hantera stationstypens artiklar" on public.station_type_articles;
create policy "Admin kan hantera stationstypens artiklar" on public.station_type_articles
  for all using (
    exists (select 1 from profiles where profiles.user_id = auth.uid()
            and (profiles.role = 'admin' or profiles.is_admin = true))
  ) with check (
    exists (select 1 from profiles where profiles.user_id = auth.uid()
            and (profiles.role = 'admin' or profiles.is_admin = true))
  );

-- Atomärt byte av listan: PostgREST kör varje anrop i egen transaktion,
-- så delete + insert från klienten kan lämna typen tom vid avbrott.
create or replace function set_station_type_articles(
  p_station_type_id uuid,
  p_articles jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
  v_count int := 0;
  r record;
begin
  select exists (
    select 1 from profiles where profiles.user_id = auth.uid()
      and (profiles.role = 'admin' or profiles.is_admin = true)
  ) into v_is_admin;
  if not v_is_admin then
    raise exception 'Behörighet saknas';
  end if;

  delete from station_type_articles where station_type_id = p_station_type_id;

  for r in
    select (value ->> 'article_id')::uuid as article_id,
           coalesce((value ->> 'is_default')::boolean, false) as is_default,
           coalesce((value ->> 'sort_order')::int, ordinality::int) as sort_order
    from jsonb_array_elements(coalesce(p_articles, '[]'::jsonb)) with ordinality
  loop
    insert into station_type_articles (station_type_id, article_id, is_default, sort_order)
    values (p_station_type_id, r.article_id, r.is_default, r.sort_order)
    on conflict (station_type_id, article_id) do update
      set is_default = excluded.is_default, sort_order = excluded.sort_order;
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('ok', true, 'count', v_count);
end;
$$;

revoke all on function set_station_type_articles(uuid, jsonb) from public;
grant execute on function set_station_type_articles(uuid, jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. Produkten på stationen
-- ─────────────────────────────────────────────────────────────
alter table public.equipment_placements
  add column if not exists article_id uuid references public.articles(id) on delete set null;
alter table public.indoor_stations
  add column if not exists article_id uuid references public.articles(id) on delete set null;

comment on column public.equipment_placements.article_id is
  'Produkten som faktiskt placerades ut. Intern kostnad, aldrig synlig för kund.';
comment on column public.indoor_stations.article_id is
  'Produkten som faktiskt placerades ut. Intern kostnad, aldrig synlig för kund.';

-- ─────────────────────────────────────────────────────────────
-- 4. Faktureringsläget på kundnivå
-- ─────────────────────────────────────────────────────────────
alter table public.customers
  add column if not exists addon_invoice_mode text not null default 'with_contract';
alter table public.customers drop constraint if exists customers_addon_invoice_mode_check;
alter table public.customers add constraint customers_addon_invoice_mode_check
  check (addon_invoice_mode in ('with_contract', 'separate_per_contract'));

comment on column public.customers.addon_invoice_mode is
  'with_contract = tilläggen följer avtalens fakturering (samlad eller per avtal). separate_per_contract = egen tilläggsfaktura per avtal.';

-- Migrera befintligt läge från avtalen. Ett enda avtal har separate i dag.
update customers c
set addon_invoice_mode = case
  when exists (
    select 1 from contracts ct
    where ct.customer_id = c.id and ct.equipment_invoice_mode = 'separate'
  ) then 'separate_per_contract'
  else 'with_contract'
end
where c.addon_invoice_mode = 'with_contract';

comment on column public.contracts.equipment_invoice_mode is
  'DEPRECATED sedan 2026-09-04: läget bor på customers.addon_invoice_mode. Kolumnen läses inte längre och tas bort i nästa release.';

-- ─────────────────────────────────────────────────────────────
-- 5. Prisuppslag per stationstyp
--
-- Trappan är densamma som priceListService: avtalets prislista,
-- annars kundens, annars standardlistan, annars tjänstens base_price.
-- Enheter ärver moderbolagets lista när de saknar egen.
-- ─────────────────────────────────────────────────────────────

create or replace function addon_service_id_for_type(p_station_type_id uuid)
returns uuid
language sql
stable
as $$
  select coalesce(
    (select st.annual_service_id from station_types st where st.id = p_station_type_id),
    (select s.id from services s where s.used_for_addon_stations_annual = true and s.is_active = true limit 1)
  );
$$;

comment on function addon_service_id_for_type(uuid) is
  'Tjänsten som bär årspriset för en stationstyp: typens egen, annars den generella tilläggsstationstjänsten.';

create or replace function addon_annual_price_for_type(
  p_station_type_id uuid,
  p_customer_id uuid,
  p_contract_id uuid default null
) returns numeric
language plpgsql
stable
as $$
declare
  v_service_id uuid;
  v_list_id uuid;
  v_price numeric;
  v_parent uuid;
begin
  v_service_id := addon_service_id_for_type(p_station_type_id);
  if v_service_id is null then return null; end if;

  -- 1. Avtalets prislista
  if p_contract_id is not null then
    select price_list_id into v_list_id from contracts where id = p_contract_id;
    if v_list_id is not null then
      select custom_price into v_price from price_list_items
      where price_list_id = v_list_id and service_id = v_service_id limit 1;
      if v_price is not null and v_price > 0 then return v_price; end if;
    end if;
  end if;

  -- 2. Kundens egen lista, annars moderbolagets
  select price_list_id, parent_customer_id into v_list_id, v_parent
  from customers where id = p_customer_id;
  if v_list_id is null and v_parent is not null then
    select price_list_id into v_list_id from customers where id = v_parent;
  end if;
  if v_list_id is not null then
    select custom_price into v_price from price_list_items
    where price_list_id = v_list_id and service_id = v_service_id limit 1;
    if v_price is not null and v_price > 0 then return v_price; end if;
  end if;

  -- 3. Standardprislistan
  select custom_price into v_price from price_list_items pli
  join price_lists pl on pl.id = pli.price_list_id
  where pl.is_default = true and pl.is_active = true and pli.service_id = v_service_id
  limit 1;
  if v_price is not null and v_price > 0 then return v_price; end if;

  -- 4. Tjänstens grundpris
  select base_price into v_price from services where id = v_service_id;
  if v_price is not null and v_price > 0 then return v_price; end if;

  return null;
end;
$$;

comment on function addon_annual_price_for_type(uuid, uuid, uuid) is
  'Årspris per tilläggsstation av en viss typ. Trappa: avtalets prislista, kundens (eller moderbolagets), standardlistan, tjänstens base_price. Null = pris saknas, raden ska inte skapas.';

-- ─────────────────────────────────────────────────────────────
-- 6. Dubblettskydd för artikelrader
--
-- cbi_addon_period_line_key är partiellt på billing_model in
-- ('per_year','per_month'). Artikelraden har 'premium' och faller
-- utanför indexet helt, alltså utan skydd mot upprepade synkar.
-- Nyckeln tar med article_id: samma stationstyp kan ha olika produkt
-- ute och inne på samma enhet (Maserfrakt betesstation).
-- ─────────────────────────────────────────────────────────────
create unique index if not exists cbi_addon_article_line_key
  on public.case_billing_items (case_id, site_customer_id, station_type_id, article_id)
  where item_type = 'article'
    and billing_model = 'premium'
    and site_customer_id is not null
    and station_type_id is not null
    and status <> 'cancelled';
