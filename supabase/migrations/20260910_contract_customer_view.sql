-- Kundens vy av avtalet
--
-- Kundportalen och "Visa som kund" i avtalskartan läser samma projektion.
-- Funktionen returnerar BARA det kunden får se: omfattning, prislista,
-- uppföljning, premie och fakturering, referenser, löptid. Aldrig kostnader,
-- marginal, inköp eller interna noteringar. Läckagerisken hanteras här, på
-- ett ställe, inte i varje vy.

create or replace function public.contract_customer_access(p_contract_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.intranet_is_internal()
    or exists (
      select 1
      from public.contracts c
      join public.profiles pr on pr.user_id = auth.uid() and pr.is_active
      where c.id = p_contract_id
        and (
          pr.customer_id = c.customer_id
          or pr.customer_id in (select cs.customer_id from public.contract_sites cs where cs.contract_id = c.id)
          or pr.customer_id in (select cu.id from public.customers cu where cu.parent_customer_id = c.customer_id)
          or c.customer_id = any (public.my_multisite_customer_ids())
          or exists (select 1 from public.contract_sites cs where cs.contract_id = c.id and cs.customer_id = any (public.my_multisite_customer_ids()))
        )
    )
$$;

create or replace function public.contract_customer_view(p_contract_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c public.contracts;
  v_scope jsonb;
  v_prices jsonb;
  v_followup jsonb;
  v_refs jsonb;
  v_premium numeric;
  v_next_invoice date;
  v_owner text;
  v_year_start date;
begin
  if not public.contract_customer_access(p_contract_id) then
    raise exception 'Behörighet saknas';
  end if;
  select * into c from public.contracts where id = p_contract_id;
  if not found then return null; end if;

  select coalesce(cu.site_name, cu.company_name) into v_owner from public.customers cu where cu.id = c.customer_id;
  v_premium := public.contract_annual_value_in_force(p_contract_id);

  -- Avtalsårets start: senaste årsdagen av avtalsstarten
  v_year_start := coalesce(c.contract_start_date, c.start_date, date_trunc('year', current_date)::date);
  while v_year_start + interval '1 year' <= current_date loop
    v_year_start := (v_year_start + interval '1 year')::date;
  end loop;

  -- § 1 Omfattning
  select coalesce(jsonb_agg(jsonb_build_object(
      'unit_id', cu.id,
      'name', coalesce(cu.site_name, cu.company_name),
      'address', cu.contact_address,
      'active_from', cs.active_from,
      'reference', cu.billing_reference
    ) order by cs.active_from, coalesce(cu.site_name, cu.company_name)), '[]'::jsonb)
    into v_scope
  from public.contract_sites cs
  join public.customers cu on cu.id = cs.customer_id
  where cs.contract_id = p_contract_id and (cs.active_to is null or cs.active_to >= current_date);

  -- § 2 Fasta priser för avrop (kundpris, aldrig inköp)
  select coalesce(jsonb_agg(jsonb_build_object('name', s.name, 'code', s.code, 'price', pli.price, 'unit', s.unit) order by s.name), '[]'::jsonb)
    into v_prices
  from public.price_list_items pli
  join public.services s on s.id = pli.service_id
  where pli.price_list_id = c.price_list_id and pli.service_id is not null and pli.price is not null;

  -- § 3 Uppföljning per enhet: rytm, gjorda i avtalsåret, nästa besök
  select coalesce(jsonb_agg(jsonb_build_object(
      'unit_id', u.unit_id,
      'name', u.name,
      'service_mode', coalesce(u.service_mode, 'inspection'),
      'frequency', coalesce(u.visit_frequency, c.visit_frequency),
      'visits_per_year', coalesce(u.visits_per_year, c.visits_per_year),
      'done_this_year', (select count(*) from public.station_inspection_sessions s where s.customer_id = u.unit_id and s.completed_at is not null and s.completed_at::date >= v_year_start and (s.contract_id = p_contract_id or s.contract_id is null)),
      'next_visit_at', (select min(s.scheduled_at) from public.station_inspection_sessions s where s.customer_id = u.unit_id and s.completed_at is null and s.scheduled_at >= now() and (s.contract_id = p_contract_id or s.contract_id is null))
    ) order by u.name), '[]'::jsonb)
    into v_followup
  from (
    select cs.customer_id as unit_id, coalesce(cu.site_name, cu.company_name) as name, cs.service_mode, cs.visit_frequency, cs.visits_per_year
    from public.contract_sites cs join public.customers cu on cu.id = cs.customer_id
    where cs.contract_id = p_contract_id and (cs.active_to is null or cs.active_to >= current_date)
    union
    select c.customer_id, v_owner, null, null, null
    where not c.covers_all_sites and not exists (select 1 from public.contract_sites cs where cs.contract_id = p_contract_id)
  ) u;

  -- Nästa premiefaktura: nästa ankarmånad
  if c.billing_anchor_month is not null then
    v_next_invoice := make_date(extract(year from current_date)::int, c.billing_anchor_month, 1);
    if v_next_invoice <= current_date then v_next_invoice := (v_next_invoice + interval '1 year')::date; end if;
  end if;

  return jsonb_build_object(
    'id', c.id,
    'name', coalesce(c.display_name, c.label, c.contract_type, 'Avtal'),
    'contract_type', c.contract_type,
    'owner', v_owner,
    'status', case when c.terminated_at is not null then 'uppsagt' when c.status in ('signed', 'active') then 'aktivt' else c.status end,
    'signed_at', c.signed_at,
    'start_date', coalesce(c.contract_start_date, c.start_date),
    'end_date', c.contract_end_date,
    'notice_period_months', c.notice_period_months,
    'renewal_mode', c.renewal_mode,
    'option_until', c.option_until,
    'diary_number', c.diary_number,
    'invoice_reference', c.invoice_reference,
    'price_list', (select name from public.price_lists where id = c.price_list_id),
    'covers_all_sites', c.covers_all_sites,
    'scope', v_scope,
    'prices', v_prices,
    'followup', v_followup,
    'contract_year_start', v_year_start,
    'premium', jsonb_build_object(
      'annual_value', v_premium,
      'billing_frequency', c.billing_frequency,
      'billing_anchor_month', c.billing_anchor_month,
      'next_invoice', v_next_invoice
    ),
    'agreement_text', c.agreement_text,
    'account_manager', c.account_manager_name
  );
end;
$$;

-- Portalen: alla avtal inloggad kund får se
create or replace function public.my_contract_views()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(public.contract_customer_view(c.id) order by c.display_order, c.created_at), '[]'::jsonb)
  from public.contracts c
  where c.status in ('signed', 'active')
    and coalesce(c.template_id, '') <> 'imported'
    and public.contract_customer_access(c.id)
    and not public.intranet_is_internal();
$$;

grant execute on function public.contract_customer_access(uuid) to authenticated;
grant execute on function public.contract_customer_view(uuid) to authenticated;
grant execute on function public.my_contract_views() to authenticated;

-- Portalen vid impersonering: personal ser kundens avtal via p_customer_id
drop function if exists public.my_contract_views();
create or replace function public.my_contract_views(p_customer_id uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.contract_customer_view(c.id) order by c.display_order, c.created_at), '[]'::jsonb)
  from public.contracts c
  where c.status in ('signed', 'active') and coalesce(c.template_id, '') <> 'imported'
    and case
      when public.intranet_is_internal() then p_customer_id is not null and (
        c.customer_id = p_customer_id
        or exists (select 1 from public.contract_sites cs where cs.contract_id = c.id and cs.customer_id = p_customer_id and (cs.active_to is null or cs.active_to >= current_date))
        or exists (select 1 from public.customers cu where cu.id = p_customer_id and cu.parent_customer_id = c.customer_id))
      else public.contract_customer_access(c.id)
    end;
$$;
grant execute on function public.my_contract_views(uuid) to authenticated;
