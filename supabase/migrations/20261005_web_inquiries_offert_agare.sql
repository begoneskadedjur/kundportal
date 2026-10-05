-- 20261005_web_inquiries_offert_agare.sql
-- Leads (Webb): granskningens rättning av offertkopplingen.
--
-- Tidigare kunde vilken skickad offert som helst från det senaste dygnet kopplas till en förfrågan,
-- även en offert som en kollega skapat, en offert som skapats från ett ärende eller en offert som
-- redan var kopplad till en annan förfrågan. Nu gäller:
--   1. Offerten ska vara skapad av den inloggade (contracts.created_by_email = inloggningens e-post).
--      Guiden skickar alltid den inloggades e-post som avsändare, så en offert från guiden går igenom.
--   2. Offerten får inte höra till ett ärende (source_id ska vara tomt), som offerter från guiden.
--   3. En offert kan bara höra till en förfrågan, även efter att förfrågan fått en ny offert
--      (historiken räknas). Triggern ger ett läsbart fel och ett unikt index är spärren även vid
--      samtidiga anrop.
--
-- Inga DROP-satser.

create or replace function public.web_inquiry_skickad_offert(p_oneflow_id text)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id
  from public.contracts c
  where c.oneflow_contract_id = p_oneflow_id
    and c.type = 'offer'
    and coalesce(c.status, 'draft') not in ('draft', 'trashed')
    and c.created_at >= now() - interval '1 day'
    and c.source_id is null
    and (
      auth.uid() is null
      or (
        public.is_web_inquiry_staff()
        and lower(btrim(coalesce(c.created_by_email, ''))) = lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
        and coalesce(auth.jwt() ->> 'email', '') <> ''
      )
    )
  order by c.created_at desc
  limit 1;
$$;

revoke execute on function public.web_inquiry_skickad_offert(text) from public, anon;
grant execute on function public.web_inquiry_skickad_offert(text) to authenticated;

-- Kopplad till en annan förfrågan, nu eller tidigare? Security definer så att kontrollen ser alla förfrågningar.
create or replace function public.web_inquiry_offert_kopplad_annan(p_inquiry uuid, p_oneflow_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.web_inquiries w
    where w.offert_oneflow_id = p_oneflow_id and w.id <> p_inquiry
  ) or exists (
    -- Även en offert som tidigare varit kopplad till en annan förfrågan och sedan ersatts
    select 1 from public.web_inquiry_events e
    where e.typ = 'konvertering' and e.till_varde = 'offert:' || p_oneflow_id and e.inquiry_id <> p_inquiry
  );
$$;

revoke execute on function public.web_inquiry_offert_kopplad_annan(uuid, text) from public, anon;
grant execute on function public.web_inquiry_offert_kopplad_annan(uuid, text) to authenticated;

create unique index if not exists web_inquiries_offert_oneflow_id_unik
  on public.web_inquiries (offert_oneflow_id)
  where offert_oneflow_id is not null;

-- Före uppdatering: samma som 20261005_web_inquiries_offert_bokad_tjanst.sql plus kontrollen att
-- offerten inte redan är kopplad till en annan förfrågan.

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
  v_offert uuid;
  v_ny_offert boolean := new.offert_oneflow_id is not null
                         and new.offert_oneflow_id is distinct from old.offert_oneflow_id;
begin
  new.updated_at := now();

  -- Ärendet som kopplas: finns det, när skapades det, numret och tjänsten
  if old.arende_id is null and new.arende_id is not null then
    if new.arende_tabell = 'private_cases' then
      select pc.created_at, pc.case_number, pc.skadedjur into v_skapad, v_nummer, v_tjanst
      from public.private_cases pc where pc.id = new.arende_id;
    else
      select bc.created_at, bc.case_number, bc.skadedjur into v_skapad, v_nummer, v_tjanst
      from public.business_cases bc where bc.id = new.arende_id;
    end if;
  end if;

  if v_ny_offert and public.web_inquiry_offert_kopplad_annan(new.id, new.offert_oneflow_id) then
    raise exception 'Offerten är redan kopplad till en annan förfrågan';
  end if;

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
      if v_skapad is null then
        raise exception 'Ärendet finns inte';
      end if;
      if v_skapad < now() - interval '1 day' then
        raise exception 'Bara ett nyskapat ärende kan kopplas till förfrågan';
      end if;
    end if;

    -- Offerten: bara en skickad, nyskapad offert som den inloggade skapat, och inte på en bokad förfrågan
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

    -- Systemets fält
    new.bokad_at := old.bokad_at;
    new.fakturerad_at := old.fakturerad_at;
    new.haft_offert := old.haft_offert;
    new.offert_contract_id := old.offert_contract_id;
    new.offert_skickad_at := old.offert_skickad_at;
    new.bokad_tjanst := old.bokad_tjanst;
    new.arende_nummer := old.arende_nummer;

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
      if new.status = 'offert' and not v_ny_offert then
        raise exception 'Offert sätts när en offert skickas från förfrågan';
      end if;
    end if;
  elsif v_ny_offert then
    v_offert := coalesce(new.offert_contract_id, public.web_inquiry_skickad_offert(new.offert_oneflow_id));
  end if;

  -- Offert skickad: status Offert, 90 dagars frist och tidpunkten
  if v_ny_offert then
    new.offert_contract_id := v_offert;
    new.offert_skickad_at := now();
    if new.arende_id is null then
      new.status := 'offert';
    end if;
    new.haft_offert := true;
  end if;

  -- Ärende skapat: status Bokad, tidpunkten, ärendenumret och den bokade tjänsten
  if old.arende_id is null and new.arende_id is not null then
    new.status := 'bokad';
    new.bokad_at := coalesce(new.bokad_at, now());
    new.arende_nummer := coalesce(nullif(btrim(v_nummer), ''), new.arende_nummer);
    new.bokad_tjanst := coalesce(nullif(btrim(v_tjanst), ''), new.bokad_tjanst);
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
