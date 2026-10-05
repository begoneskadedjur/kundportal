-- 20261005_web_inquiries_offert_bokad_tjanst.sql
-- Leads (Webb): skapa offert från förfrågan, bokad tjänst och ärendenummer.
--
-- 1. Offert från förfrågan. Knappen Skapa offert öppnar Oneflow-guiden förifylld. När offerten
--    faktiskt skickats till kunden (contracts-raden har type offer och är publicerad, alltså inte
--    draft) kopplar guiden den till förfrågan via offert_oneflow_id. Triggern kontrollerar att
--    offerten finns och är nyskickad, sätter status Offert, haft_offert (90 dagars frist),
--    offert_contract_id och offert_skickad_at, och historiken får raden "Offert skickad" med
--    Oneflow-id:t. Status Offert kan inte längre sättas för hand.
-- 2. Bokad tjänst och ärendenummer. När ärendet kopplas till förfrågan läser triggern ärendets
--    skadedjur (tjänsten koordinatorn valde) och case_number (numret kunden får) och sparar dem på
--    förfrågan. Kundens eget val i pest_type står kvar. Förfrågans referens (artanalysens eller
--    formulärets nummer) kopplas aldrig till ärendenumret.
--
-- Inga DROP-satser.

alter table public.web_inquiries
  add column if not exists offert_oneflow_id text check (offert_oneflow_id is null or char_length(offert_oneflow_id) <= 40),
  add column if not exists offert_contract_id uuid,
  add column if not exists offert_skickad_at timestamptz,
  add column if not exists bokad_tjanst text check (bokad_tjanst is null or char_length(bokad_tjanst) <= 200),
  add column if not exists arende_nummer text check (arende_nummer is null or char_length(arende_nummer) <= 40);

comment on column public.web_inquiries.offert_oneflow_id is 'Oneflow-id för den senast skickade offerten från förfrågan. Sätts av guiden när offerten skickats.';
comment on column public.web_inquiries.offert_contract_id is 'contracts.id för offerten (sätts av triggern).';
comment on column public.web_inquiries.offert_skickad_at is 'När offerten kopplades till förfrågan, dvs. skickades (sätts av triggern).';
comment on column public.web_inquiries.bokad_tjanst is 'Tjänsten (skadedjur) som koordinatorn valde när ärendet skapades. Kundens val står kvar i pest_type.';
comment on column public.web_inquiries.arende_nummer is 'Ärendenumret (case_number) som kunden fick. Kopplas aldrig till förfrågans referens.';

-- ---------------------------------------------------------------------------
-- Offerten som ska kopplas: en skickad offert i contracts, skapad det senaste dygnet.
-- Security definer så att säljare och koordinator kan kontrolleras oavsett RLS på contracts.

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
    and (auth.uid() is null or public.is_web_inquiry_staff())
  order by c.created_at desc
  limit 1;
$$;

-- Triggern körs som den inloggade (security invoker) och behöver kunna anropa kontrollen
revoke execute on function public.web_inquiry_skickad_offert(text) from public, anon;
grant execute on function public.web_inquiry_skickad_offert(text) to authenticated;

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

    -- Offerten: bara en skickad, nyskapad offert, och inte på en bokad förfrågan
    if old.offert_oneflow_id is not null and new.offert_oneflow_id is null then
      raise exception 'Kopplingen till offerten kan inte tas bort';
    end if;
    if v_ny_offert then
      if old.arende_id is not null then
        raise exception 'En bokad förfrågan kan inte få en offert kopplad';
      end if;
      v_offert := public.web_inquiry_skickad_offert(new.offert_oneflow_id);
      if v_offert is null then
        raise exception 'Offerten finns inte eller har inte skickats';
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

-- ---------------------------------------------------------------------------
-- Efter uppdatering: historik, nu också "Offert skickad"

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
            'Ärende skapat' || coalesce(' ' || new.arende_nummer, ''),
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

revoke execute on function public.web_inquiries_after_update() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Redan bokade förfrågningar: ärendenummer och bokad tjänst från ärendet

update public.web_inquiries w
set arende_nummer = coalesce(w.arende_nummer, nullif(btrim(pc.case_number), '')),
    bokad_tjanst = coalesce(w.bokad_tjanst, nullif(btrim(pc.skadedjur), ''))
from public.private_cases pc
where w.arende_tabell = 'private_cases' and w.arende_id = pc.id
  and (w.arende_nummer is null or w.bokad_tjanst is null);

update public.web_inquiries w
set arende_nummer = coalesce(w.arende_nummer, nullif(btrim(bc.case_number), '')),
    bokad_tjanst = coalesce(w.bokad_tjanst, nullif(btrim(bc.skadedjur), ''))
from public.business_cases bc
where w.arende_tabell = 'business_cases' and w.arende_id = bc.id
  and (w.arende_nummer is null or w.bokad_tjanst is null);
