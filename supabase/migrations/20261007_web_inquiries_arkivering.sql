-- 20261007_web_inquiries_arkivering.sql
-- Leads (Webb): arkivering av förfrågningar (skräp och avslutade) så att de inte syns i Inkorg och Alla.
-- archived_at/archived_by sätts av triggern (tidpunkten och vem), klienten skickar bara "arkivera" eller
-- "återställ". Samma RLS som statusbyte (web_inquiries_update_staff). Arkivering och återställning
-- loggas i historiken som händelsetypen 'arkivering'. Arkiverade räknas inte i Inkorgens räknare.

alter table public.web_inquiries add column if not exists archived_at timestamptz;
alter table public.web_inquiries add column if not exists archived_by uuid references public.profiles(id) on delete set null;

create index if not exists web_inquiries_archived_idx on public.web_inquiries (archived_at) where archived_at is not null;

-- Ny händelsetyp i historiken
alter table public.web_inquiry_events drop constraint if exists web_inquiry_events_typ_check;
alter table public.web_inquiry_events add constraint web_inquiry_events_typ_check
  check (typ in ('anteckning', 'status', 'tilldelning', 'konvertering', 'bilder', 'arkivering'));

-- ---------------------------------------------------------------------------
-- Före uppdatering: som tidigare, plus arkiveringens tidpunkt och användare

create or replace function public.web_inquiries_before_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
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

  -- Arkivering: tidpunkten och användaren sätts här, aldrig av klienten
  if (new.archived_at is null) <> (old.archived_at is null) then
    if new.archived_at is null then
      new.archived_by := null;
    else
      new.archived_at := now();
      select p.id into new.archived_by from public.profiles p where p.user_id = auth.uid() limit 1;
    end if;
  else
    new.archived_at := old.archived_at;
    new.archived_by := old.archived_by;
  end if;
  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Efter uppdatering: historik, plus arkivering och återställning

create or replace function public.web_inquiries_after_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
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
  if (new.archived_at is null) <> (old.archived_at is null) then
    insert into public.web_inquiry_events (inquiry_id, typ, text, till_varde, profile_id)
    values (new.id, 'arkivering',
            case when new.archived_at is null then 'Återställd från arkivet' else 'Arkiverad' end,
            case when new.archived_at is null then 'aterstalld' else 'arkiverad' end,
            v_profile);
  end if;
  return null;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Inkorgens räknare: arkiverade räknas inte

create or replace function public.web_inquiries_new_count()
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select case when public.is_web_inquiry_staff()
    then (select count(*)::int from public.web_inquiries where status = 'ny' and archived_at is null)
    else 0 end;
$function$;
