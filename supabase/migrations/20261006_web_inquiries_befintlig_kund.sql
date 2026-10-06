-- 20261006_web_inquiries_befintlig_kund.sql
-- Leads (Webb): förfrågningar från befintliga avtalskunder och koppling till befintliga ärenden.
--
--  1. Ny status 'befintlig_kund'. Sätts automatiskt när förfrågan kopplas till ett ärende i
--     tabellen cases (avtalsärende, stationskontroll eller etablering för en avtalskund), skapat
--     från förfrågan eller kopplat i efterhand. Ingår inte i vunnen och förlorad: dygnsjobbet
--     räknar bara förfrågningar med status Bokad och ärenden i private_cases och business_cases.
--  2. arende_tabell får även vara 'cases'. Rondering och egenkontroll kan inte kopplas.
--  3. Kolumnen arende_kopplat: sant när koordinatorn kopplat ett befintligt ärende i stället för
--     att skapa ett. Historiken skriver då "Ärende kopplat" i stället för "Ärende skapat".
--  4. Spärren för vilka ärenden som får kopplas: tidigare bara ärenden skapade det senaste dygnet,
--     nu ärenden skapade samma dag som förfrågan kom in (svensk tid) eller senare och som inte
--     redan är kopplade till en annan förfrågan.
--  5. bokad_at sätts till när ärendet skapades (aldrig senare än nu), så att ett ärende som
--     kopplas i efterhand får sin frist från bokningen och fakturor efter den räknas.
--  6. customer_id sätts till ärendets kund för ärenden i cases.
--
-- Inga DROP utom drop constraint if exists plus add constraint för tabellens egna villkor.
-- Funktioner med create or replace.

alter table public.web_inquiries add column if not exists arende_kopplat boolean not null default false;

alter table public.web_inquiries drop constraint if exists web_inquiries_status_check;
alter table public.web_inquiries add constraint web_inquiries_status_check
  check (status in ('ny', 'kontaktad', 'offert', 'bokad', 'befintlig_kund', 'vunnen', 'forlorad', 'skrap'));

alter table public.web_inquiries drop constraint if exists web_inquiries_arende_tabell_check;
alter table public.web_inquiries add constraint web_inquiries_arende_tabell_check
  check (arende_tabell is null or arende_tabell in ('private_cases', 'business_cases', 'cases'));

-- Ett ärende kan bara höra till en förfrågan
create unique index if not exists web_inquiries_arende_unik
  on public.web_inquiries (arende_tabell, arende_id)
  where arende_id is not null;

-- ---------------------------------------------------------------------------
-- Före uppdatering

create or replace function public.web_inquiries_before_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_personal boolean := auth.uid() is not null;
  v_skapad timestamptz;
  v_nummer text;
  v_tjanst text;
  v_typ text;
  v_kund uuid;
  v_offert uuid;
  v_ny_offert boolean := new.offert_oneflow_id is not null
                         and new.offert_oneflow_id is distinct from old.offert_oneflow_id;
  v_ny_koppling boolean := old.arende_id is null and new.arende_id is not null;
begin
  new.updated_at := now();

  if v_ny_koppling then
    if new.arende_tabell = 'private_cases' then
      select pc.created_at, pc.case_number, pc.skadedjur into v_skapad, v_nummer, v_tjanst
      from public.private_cases pc where pc.id = new.arende_id;
    elsif new.arende_tabell = 'business_cases' then
      select bc.created_at, bc.case_number, bc.skadedjur into v_skapad, v_nummer, v_tjanst
      from public.business_cases bc where bc.id = new.arende_id;
    elsif new.arende_tabell = 'cases' then
      select c.created_at, c.case_number, c.service_type, c.customer_id,
             case c.service_type
               when 'inspection' then 'Stationskontroll'
               when 'establishment' then 'Etablering'
               else coalesce(nullif(btrim(c.pest_type), ''), 'Avtalsärende')
             end
        into v_skapad, v_nummer, v_typ, v_kund, v_tjanst
      from public.cases c where c.id = new.arende_id;
    end if;
  end if;

  if v_ny_offert and public.web_inquiry_offert_kopplad_annan(new.id, new.offert_oneflow_id) then
    raise exception 'Offerten är redan kopplad till en annan förfrågan';
  end if;

  if v_personal then
    if old.arende_id is not null
       and (new.arende_id is distinct from old.arende_id or new.arende_tabell is distinct from old.arende_tabell) then
      raise exception 'Kopplingen till ärendet kan inte ändras';
    end if;
    if (new.arende_id is null) <> (new.arende_tabell is null) then
      raise exception 'Ärendets tabell och id måste anges tillsammans';
    end if;
    if v_ny_koppling then
      if v_skapad is null then
        raise exception 'Ärendet finns inte';
      end if;
      if v_skapad < (date_trunc('day', old.created_at at time zone 'Europe/Stockholm') at time zone 'Europe/Stockholm') then
        raise exception 'Bara ett ärende som skapats samma dag som förfrågan kom in eller senare kan kopplas';
      end if;
      if v_typ in ('rondering_trafikkontoret', 'egenkontroll_trafikkontoret') then
        raise exception 'Rondering och egenkontroll kan inte kopplas till en förfrågan';
      end if;
      if exists (
        select 1 from public.web_inquiries w
        where w.arende_id = new.arende_id and w.arende_tabell = new.arende_tabell and w.id <> new.id
      ) then
        raise exception 'Ärendet är redan kopplat till en annan förfrågan';
      end if;
    end if;

    if old.offert_oneflow_id is not null and new.offert_oneflow_id is null then
      raise exception 'Kopplingen till offerten kan inte tas bort';
    end if;
    if v_ny_offert then
      if old.arende_id is not null then
        raise exception 'En bokad förfrågan kan inte få en offert kopplad';
      end if;
      v_offert := public.web_inquiry_skickad_offert(new.offert_oneflow_id);
      if v_offert is null then
        raise exception 'Offerten finns inte, har inte skickats eller är inte skapad av dig';
      end if;
    end if;

    new.bokad_at := old.bokad_at;
    new.fakturerad_at := old.fakturerad_at;
    new.haft_offert := old.haft_offert;
    new.offert_contract_id := old.offert_contract_id;
    new.offert_skickad_at := old.offert_skickad_at;
    new.bokad_tjanst := old.bokad_tjanst;
    new.arende_nummer := old.arende_nummer;
    if not v_ny_koppling then
      new.arende_kopplat := old.arende_kopplat;
    end if;

    if new.status is distinct from old.status then
      if new.status = 'vunnen' then
        raise exception 'Vunnen sätts automatiskt när ärendet fakturerats';
      end if;
      if new.status = 'befintlig_kund' and not v_ny_koppling then
        raise exception 'Befintlig kund sätts när ett avtalsärende kopplas till förfrågan';
      end if;
      if old.arende_id is not null then
        raise exception 'En bokad förfrågan får sitt utfall automatiskt';
      end if;
      if new.status = 'bokad' and new.arende_id is null then
        raise exception 'Bokad sätts när ett ärende skapas från förfrågan';
      end if;
      if new.status = 'offert' and not v_ny_offert then
        raise exception 'Offert sätts när en offert skickas från förfrågan';
      end if;
    end if;
  elsif v_ny_offert then
    v_offert := coalesce(new.offert_contract_id, public.web_inquiry_skickad_offert(new.offert_oneflow_id));
  end if;

  if v_ny_offert then
    new.offert_contract_id := v_offert;
    new.offert_skickad_at := now();
    if new.arende_id is null then
      new.status := 'offert';
    end if;
    new.haft_offert := true;
  end if;

  if v_ny_koppling then
    new.status := case when new.arende_tabell = 'cases' then 'befintlig_kund' else 'bokad' end;
    new.bokad_at := coalesce(new.bokad_at, least(now(), coalesce(v_skapad, now())));
    new.arende_nummer := coalesce(nullif(btrim(v_nummer), ''), new.arende_nummer);
    new.bokad_tjanst := coalesce(nullif(btrim(v_tjanst), ''), new.bokad_tjanst);
    if new.arende_tabell = 'cases' and v_kund is not null then
      new.customer_id := v_kund;
    end if;
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
-- Efter uppdatering: historiken skiljer på skapat och kopplat ärende

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
  if new.offert_oneflow_id is distinct from old.offert_oneflow_id and new.offert_oneflow_id is not null then
    insert into public.web_inquiry_events (inquiry_id, typ, text, till_varde, profile_id)
    values (new.id, 'konvertering', 'Offert skickad', 'offert:' || new.offert_oneflow_id, v_profile);
  end if;
  if new.arende_id is distinct from old.arende_id and new.arende_id is not null then
    insert into public.web_inquiry_events (inquiry_id, typ, text, till_varde, profile_id)
    values (new.id, 'konvertering',
            case when new.arende_kopplat then 'Ärende kopplat' else 'Ärende skapat' end
              || coalesce(' ' || new.arende_nummer, ''),
            new.arende_tabell || ':' || new.arende_id::text, v_profile);
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

-- ---------------------------------------------------------------------------
-- Dygnsjobbet: bara nyförsäljning (status Bokad, ärenden i private_cases och business_cases).
-- Befintliga kunder får aldrig vunnen eller förlorad.

create or replace function public.web_inquiries_berakna_utfall()
returns table(vunna integer, forlorade integer, kvar integer)
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
      and w.arende_tabell in ('private_cases', 'business_cases')
    for update
  loop
    v_frist := r.bokad_at + case when r.haft_offert then interval '90 days' else interval '30 days' end;

    select min(coalesce(i.sent_at, i.booked_at, i.paid_at, i.created_at)) into v_fakt
    from public.invoices i
    where i.case_id = r.arende_id
      and i.case_type = case r.arende_tabell when 'private_cases' then 'private' else 'business' end
      and i.status in ('booked', 'sent', 'paid', 'overdue')
      and coalesce(i.sent_at, i.booked_at, i.paid_at, i.created_at) >= r.bokad_at - interval '1 day';

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

revoke execute on function public.web_inquiries_after_update() from public, anon, authenticated;
revoke execute on function public.web_inquiries_before_update() from public, anon, authenticated;
revoke execute on function public.web_inquiries_berakna_utfall() from public, anon, authenticated;
grant execute on function public.web_inquiries_berakna_utfall() to service_role;
