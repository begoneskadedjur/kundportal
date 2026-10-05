-- 20261005_web_inquiries_bokad_granskning.sql
-- Granskningens rättning av Leads (Webb), status Bokad.
--
-- Personal kunde koppla förfrågan till vilket ärende som helst via API:t, även ett gammalt ärende
-- som redan fakturerats. Dygnsjobbet hade då gett Vunnen direkt, alltså Vunnen för hand.
-- Nu måste ärendet finnas i angiven tabell och vara skapat det senaste dygnet, dvs. ärendet som
-- skapades från förfrågan i ärendemodalen. Dygnsjobbet räknar dessutom bara fakturor från
-- bokningsdygnet och framåt.

create or replace function public.web_inquiries_before_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_personal boolean := auth.uid() is not null;
  v_skapad timestamptz;
begin
  new.updated_at := now();

  if v_personal then
    -- Kopplingen till ärendet sätts en gång
    if old.arende_id is not null
       and (new.arende_id is distinct from old.arende_id or new.arende_tabell is distinct from old.arende_tabell) then
      raise exception 'Kopplingen till ärendet kan inte ändras';
    end if;
    if (new.arende_id is null) <> (new.arende_tabell is null) then
      raise exception 'Ärendets tabell och id måste anges tillsammans';
    end if;
    -- Ny koppling: ärendet ska finnas och vara nyskapat från förfrågan
    if old.arende_id is null and new.arende_id is not null then
      if new.arende_tabell = 'private_cases' then
        select pc.created_at into v_skapad from public.private_cases pc where pc.id = new.arende_id;
      else
        select bc.created_at into v_skapad from public.business_cases bc where bc.id = new.arende_id;
      end if;
      if v_skapad is null then
        raise exception 'Ärendet finns inte';
      end if;
      if v_skapad < now() - interval '1 day' then
        raise exception 'Bara ett nyskapat ärende kan kopplas till förfrågan';
      end if;
    end if;
    -- Systemets fält
    new.bokad_at := old.bokad_at;
    new.fakturerad_at := old.fakturerad_at;
    new.haft_offert := old.haft_offert;

    if new.status is distinct from old.status then
      if new.status = 'vunnen' then
        raise exception 'Vunnen sätts automatiskt när ärendet fakturerats';
      end if;
      if old.arende_id is not null then
        raise exception 'En bokad förfrågan får sitt utfall automatiskt';
      end if;
      if new.status = 'bokad' and new.arende_id is null then
        raise exception 'Bokad sätts när ett ärende skapas från förfrågan';
      end if;
    end if;
  end if;

  -- Ärende skapat: status Bokad och tidpunkten
  if old.arende_id is null and new.arende_id is not null then
    new.status := 'bokad';
    new.bokad_at := coalesce(new.bokad_at, now());
  end if;

  if new.status = 'offert' then
    new.haft_offert := true;
  end if;

  if new.status is distinct from old.status then
    new.status_andrad_at := now();
    if old.status = 'ny' and new.forsta_kontakt_at is null then
      new.forsta_kontakt_at := now();
    end if;
  end if;
  if new.tilldelad_till is distinct from old.tilldelad_till then
    new.tilldelad_at := case when new.tilldelad_till is null then null else now() end;
  end if;
  return new;
end;
$$;

revoke execute on function public.web_inquiries_before_update() from public, anon, authenticated;

create or replace function public.web_inquiries_berakna_utfall()
returns table (vunna integer, forlorade integer, kvar integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  v_frist timestamptz;
  v_fakt timestamptz;
  v_vunna integer := 0;
  v_forlorade integer := 0;
  v_kvar integer := 0;
begin
  for r in
    select w.id, w.arende_tabell, w.arende_id, w.bokad_at, w.haft_offert
    from public.web_inquiries w
    where w.status = 'bokad' and w.arende_id is not null and w.bokad_at is not null
    for update
  loop
    v_frist := r.bokad_at + case when r.haft_offert then interval '90 days' else interval '30 days' end;

    -- Fakturan i portalen, från bokningsdygnet och framåt
    select min(coalesce(i.sent_at, i.booked_at, i.paid_at, i.created_at)) into v_fakt
    from public.invoices i
    where i.case_id = r.arende_id
      and i.case_type = case r.arende_tabell when 'private_cases' then 'private' else 'business' end
      and i.status in ('booked', 'sent', 'paid', 'overdue')
      and coalesce(i.sent_at, i.booked_at, i.paid_at, i.created_at) >= r.bokad_at - interval '1 day';

    -- Ärendets gamla fakturastatus (billing_updated_at sparas i UTC utan zon)
    if v_fakt is null then
      if r.arende_tabell = 'private_cases' then
        select coalesce(pc.billing_updated_at at time zone 'UTC', now()) into v_fakt
        from public.private_cases pc
        where pc.id = r.arende_id and pc.billing_status in ('sent', 'paid');
      else
        select coalesce(bc.billing_updated_at at time zone 'UTC', now()) into v_fakt
        from public.business_cases bc
        where bc.id = r.arende_id and bc.billing_status in ('sent', 'paid');
      end if;
    end if;

    if v_fakt is not null and v_fakt <= v_frist then
      update public.web_inquiries set status = 'vunnen', fakturerad_at = v_fakt where id = r.id;
      v_vunna := v_vunna + 1;
    elsif now() > v_frist then
      update public.web_inquiries set status = 'forlorad', fakturerad_at = v_fakt where id = r.id;
      v_forlorade := v_forlorade + 1;
    else
      v_kvar := v_kvar + 1;
    end if;
  end loop;

  return query select v_vunna, v_forlorade, v_kvar;
end;
$$;

revoke execute on function public.web_inquiries_berakna_utfall() from public, anon, authenticated;
grant execute on function public.web_inquiries_berakna_utfall() to service_role;
