-- 20261005_web_inquiries_bokad_utfall.sql
-- Leads (Webb): skapa ärende från förfrågan, status Bokad och automatiskt utfall.
--
-- 1. Ny status 'bokad'. Sätts av triggern när förfrågan kopplas till ett ärende
--    (arende_tabell + arende_id), samtidigt som bokad_at stämplas.
-- 2. haft_offert: sant när förfrågan någon gång haft status Offert. Ger 90 dagars frist i
--    stället för 30.
-- 3. Vunnen sätts bara av systemet (dygnsjobbet api/cron/web-inquiries-utfall.ts som kör
--    web_inquiries_berakna_utfall() med service role). Personal kan inte sätta Vunnen, inte ändra
--    status på en bokad förfrågan och inte ändra kopplingen till ärendet.
-- 4. Fakturerad = fakturan för ärendet (invoices, status booked, sent, paid eller overdue) eller
--    ärendets gamla billing_status sent eller paid. Förlorad när fristen gått utan faktura, också
--    när ärendet inte ska faktureras.
--
-- Den enda DROP-satsen är bytet av CHECK-villkoret för status (godkänt för just detta).

alter table public.web_inquiries
  add column if not exists arende_tabell text check (arende_tabell is null or arende_tabell in ('private_cases', 'business_cases')),
  add column if not exists arende_id uuid,
  add column if not exists bokad_at timestamptz,
  add column if not exists haft_offert boolean not null default false,
  add column if not exists fakturerad_at timestamptz;

comment on column public.web_inquiries.arende_tabell is 'Tabellen för ärendet som skapades från förfrågan: private_cases eller business_cases.';
comment on column public.web_inquiries.arende_id is 'Ärendet som skapades från förfrågan. Sätts en gång och kan inte ändras av personal.';
comment on column public.web_inquiries.bokad_at is 'När ärendet skapades från förfrågan. Fristen för Vunnen räknas härifrån.';
comment on column public.web_inquiries.haft_offert is 'Sant om förfrågan någon gång haft status Offert: 90 dagars frist i stället för 30.';
comment on column public.web_inquiries.fakturerad_at is 'När det kopplade ärendet fakturerades första gången (sätts av dygnsjobbet).';

create unique index if not exists web_inquiries_arende_key on public.web_inquiries (arende_tabell, arende_id) where arende_id is not null;
create index if not exists web_inquiries_bokad_idx on public.web_inquiries (status) where status = 'bokad';

alter table public.web_inquiries drop constraint if exists web_inquiries_status_check;
alter table public.web_inquiries add constraint web_inquiries_status_check
  check (status in ('ny', 'kontaktad', 'offert', 'bokad', 'vunnen', 'forlorad', 'skrap'));

-- Förfrågningar som redan haft status Offert
update public.web_inquiries w set haft_offert = true
where not w.haft_offert
  and (w.status = 'offert'
       or exists (select 1 from public.web_inquiry_events e
                  where e.inquiry_id = w.id and e.typ = 'status' and e.till_varde = 'offert'));

-- ---------------------------------------------------------------------------
-- Före uppdatering: tidsstämplar, spärrar och Bokad

create or replace function public.web_inquiries_before_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_personal boolean := auth.uid() is not null;
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

-- ---------------------------------------------------------------------------
-- Efter uppdatering: historik, nu också "Ärende skapat"

create or replace function public.web_inquiries_after_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile uuid;
begin
  select p.id into v_profile from public.profiles p where p.user_id = auth.uid() limit 1;
  if new.arende_id is distinct from old.arende_id and new.arende_id is not null then
    insert into public.web_inquiry_events (inquiry_id, typ, text, till_varde, profile_id)
    values (new.id, 'konvertering', 'Ärende skapat', new.arende_tabell || ':' || new.arende_id::text, v_profile);
  end if;
  if new.status is distinct from old.status then
    insert into public.web_inquiry_events (inquiry_id, typ, fran_varde, till_varde, profile_id)
    values (new.id, 'status', old.status, new.status, v_profile);
  end if;
  if new.tilldelad_till is distinct from old.tilldelad_till then
    insert into public.web_inquiry_events (inquiry_id, typ, fran_varde, till_varde, profile_id)
    values (new.id, 'tilldelning', old.tilldelad_till::text, new.tilldelad_till::text, v_profile);
  end if;
  if new.lead_id is distinct from old.lead_id and new.lead_id is not null then
    insert into public.web_inquiry_events (inquiry_id, typ, text, till_varde, profile_id)
    values (new.id, 'konvertering', 'B2B-lead skapad', new.lead_id::text, v_profile);
  end if;
  return null;
end;
$$;

revoke execute on function public.web_inquiries_after_update() from public, anon, authenticated;
revoke execute on function public.web_inquiries_before_update() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Dygnsjobbet: Vunnen eller Förlorad för bokade förfrågningar

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

    -- Fakturan i portalen
    select min(coalesce(i.sent_at, i.booked_at, i.paid_at, i.created_at)) into v_fakt
    from public.invoices i
    where i.case_id = r.arende_id
      and i.case_type = case r.arende_tabell when 'private_cases' then 'private' else 'business' end
      and i.status in ('booked', 'sent', 'paid', 'overdue');

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
