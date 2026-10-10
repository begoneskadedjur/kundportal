-- Leads etapp 5 (2026-10-10): lead från engångsärende, bokat besök, Oneflow-automatik och notiser.
-- Sammanfattning: docs/leads/ETAPP-5.md. Inget raderas och inga DROP (create or replace).
--
-- 1. leads.booked_case_type/booked_case_id: ärendet som bokades från leaden (Boka besök).
-- 2. leads_before_write: spärren mot automatiska steg släpps när GUC begone.leads_automatik = on
--    (sätts bara inne i security definer-funktionerna nedan, transaktionslokalt).
-- 3. leads_after_write: loggar arende_kopplat även för det bokade ärendet.
-- 4. lead_far_se_arende, lead_arende_underlag, lead_fran_arende, lead_anteckning_fran_arende, lead_koppla_besok.
-- 5. contracts_lead_automatik: offert skickad, avböjd och signerad flyttar leaden.
-- 6. web_inquiry_skickad_offert: en offert från en lead (source_type 'lead') räknas som fristående.

-- ---------------------------------------------------------------------------
-- 1. Bokat besök
-- ---------------------------------------------------------------------------
alter table public.leads add column if not exists booked_case_type text;
alter table public.leads add column if not exists booked_case_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_booked_case_check') then
    alter table public.leads add constraint leads_booked_case_check check (
      (booked_case_type is null) = (booked_case_id is null)
      and (booked_case_type is null or booked_case_type in ('private_cases', 'business_cases', 'cases'))
    );
  end if;
end $$;

create index if not exists leads_booked_case_idx on public.leads (booked_case_type, booked_case_id) where booked_case_id is not null;
create index if not exists leads_offer_contract_idx on public.leads (offer_contract_id) where offer_contract_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Spärren släpps för automatiken
-- ---------------------------------------------------------------------------
create or replace function public.leads_before_write()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_me uuid := public.my_profile_id();
  v_admin boolean := public.is_lead_admin();
  v_inloggad boolean := auth.uid() is not null;
  v_automatik boolean := coalesce(current_setting('begone.leads_automatik', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, v_me);
    new.updated_by := coalesce(new.updated_by, new.created_by);
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status and new.stage is not distinct from old.stage then
    new.stage := public.lead_stage_fran_status(new.status::text);
    if new.stage = 'forlorad' and new.lost_reason is null then new.lost_reason := 'ovrigt'; end if;
  end if;

  if v_inloggad and not v_admin and not v_automatik then
    if new.stage in ('besok_bokat', 'offert_skickad', 'vunnen')
       and (tg_op = 'INSERT' or new.stage is distinct from old.stage) then
      raise exception 'Steget sätts automatiskt och kan inte väljas för hand' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' then
      if new.owner_profile_id is distinct from old.owner_profile_id and old.owner_profile_id is distinct from v_me then
        raise exception 'Bara ägaren eller admin/koordinator kan överlåta leaden' using errcode = '42501';
      end if;
      if new.tipped_by_profile_id is distinct from old.tipped_by_profile_id then
        raise exception 'Tipsaren kan bara ändras av admin/koordinator' using errcode = '42501';
      end if;
      if (new.booked_case_id is distinct from old.booked_case_id
          or new.offer_contract_id is distinct from old.offer_contract_id
          or new.agreement_contract_id is distinct from old.agreement_contract_id) then
        raise exception 'Kopplingen till ärende, offert och avtal sätts automatiskt' using errcode = '42501';
      end if;
    end if;
  end if;

  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    new.stage_changed_at := now();
    if new.stage = 'vunnen' then new.won_at := coalesce(new.won_at, now()); else new.won_at := null; end if;
    if new.stage = 'forlorad' then
      new.lost_at := coalesce(new.lost_at, now());
    else
      new.lost_at := null;
      new.lost_reason := null;
      new.lost_note := null;
    end if;
    if new.stage <> 'parkerad' then new.parked_until := null; end if;
  end if;

  new.status := case new.stage
    when 'ny' then 'blue_cold'
    when 'kontaktad' then 'yellow_warm'
    when 'besok_bokat' then 'orange_hot'
    when 'offert_skickad' then 'orange_hot'
    when 'vunnen' then 'green_deal'
    when 'forlorad' then 'red_lost'
    when 'parkerad' then 'blue_cold'
  end::public.lead_status;

  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Historiken: bokat ärende loggas som arende_kopplat
-- ---------------------------------------------------------------------------
create or replace function public.leads_after_write()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_profile uuid;
begin
  if coalesce(current_setting('begone.leads_migrering', true), '') = 'on' then
    return null;
  end if;
  v_profile := coalesce(public.my_profile_id(), new.updated_by);

  if tg_op = 'INSERT' then
    insert into public.lead_activities (lead_id, kind, till_varde, ref_table, ref_id, occurred_at, profile_id)
    values (new.id, 'skapad', new.source::text,
            coalesce(new.origin_case_type, case when new.web_inquiry_id is not null then 'web_inquiries' end),
            coalesce(new.origin_case_id, new.web_inquiry_id),
            new.created_at, coalesce(public.my_profile_id(), new.created_by));
    return null;
  end if;

  if new.stage is distinct from old.stage then
    if new.stage = 'forlorad' then
      insert into public.lead_activities (lead_id, kind, text, fran_varde, till_varde, profile_id)
      values (new.id, 'forlorad', new.lost_note, old.stage::text, new.lost_reason::text, v_profile);
    elsif new.stage = 'parkerad' then
      insert into public.lead_activities (lead_id, kind, fran_varde, till_varde, profile_id)
      values (new.id, 'parkerad', old.stage::text, new.parked_until::text, v_profile);
    else
      insert into public.lead_activities (lead_id, kind, fran_varde, till_varde, profile_id)
      values (new.id, 'stage', old.stage::text, new.stage::text, v_profile);
    end if;
  elsif new.stage = 'parkerad' and new.parked_until is distinct from old.parked_until then
    insert into public.lead_activities (lead_id, kind, fran_varde, till_varde, profile_id)
    values (new.id, 'parkerad', old.parked_until::text, new.parked_until::text, v_profile);
  end if;

  if new.owner_profile_id is distinct from old.owner_profile_id then
    insert into public.lead_activities (lead_id, kind, fran_varde, till_varde, profile_id)
    values (new.id, 'agare', old.owner_profile_id::text, new.owner_profile_id::text, v_profile);
  end if;

  if new.estimated_value is distinct from old.estimated_value then
    insert into public.lead_activities (lead_id, kind, fran_varde, till_varde, profile_id)
    values (new.id, 'varde', old.estimated_value::text, new.estimated_value::text, v_profile);
  end if;

  if new.next_action is distinct from old.next_action or new.next_action_at is distinct from old.next_action_at then
    insert into public.lead_activities (lead_id, kind, text, fran_varde, till_varde, profile_id)
    values (new.id, 'nasta_steg', new.next_action, old.next_action_at::text, new.next_action_at::text, v_profile);
  end if;

  if new.customer_id is distinct from old.customer_id and new.customer_id is not null then
    insert into public.lead_activities (lead_id, kind, till_varde, ref_table, ref_id, profile_id)
    values (new.id, 'kund_kopplad', new.customer_id::text, 'customers', new.customer_id, v_profile);
  end if;

  if new.origin_case_id is distinct from old.origin_case_id and new.origin_case_id is not null then
    insert into public.lead_activities (lead_id, kind, till_varde, ref_table, ref_id, profile_id)
    values (new.id, 'arende_kopplat', new.origin_case_id::text, new.origin_case_type, new.origin_case_id, v_profile);
  end if;

  if new.booked_case_id is distinct from old.booked_case_id and new.booked_case_id is not null then
    insert into public.lead_activities (lead_id, kind, text, till_varde, ref_table, ref_id, profile_id)
    values (new.id, 'arende_kopplat', 'Besök bokat', new.booked_case_id::text, new.booked_case_type, new.booked_case_id, v_profile);
  end if;

  if new.offer_contract_id is distinct from old.offer_contract_id and new.offer_contract_id is not null then
    insert into public.lead_activities (lead_id, kind, till_varde, ref_table, ref_id, profile_id)
    values (new.id, 'offert_skickad', new.offer_contract_id::text, 'contracts', new.offer_contract_id, v_profile);
  end if;

  if new.agreement_contract_id is distinct from old.agreement_contract_id and new.agreement_contract_id is not null then
    insert into public.lead_activities (lead_id, kind, till_varde, ref_table, ref_id, profile_id)
    values (new.id, 'avtal_signerat', new.agreement_contract_id::text, 'contracts', new.agreement_contract_id, v_profile);
  end if;

  return null;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Lead från engångsärende
-- ---------------------------------------------------------------------------

-- Samma regel som RLS-policyerna private_cases_unified_select/business_cases_unified_select:
-- admin, koordinator och säljare ser alla; tekniker ärenden där de är primär, sekundär eller
-- tertiär, eller nämnda i en kommentar. Kunder och okända: nej.
create or replace function public.lead_far_se_arende(p_case_type text, p_case_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_p public.profiles%rowtype;
  v_a uuid[];
  v_kort text;
begin
  if p_case_type not in ('private_cases', 'business_cases') or p_case_id is null then return false; end if;
  select * into v_p from public.profiles where user_id = auth.uid() and coalesce(is_active, true) limit 1;
  if not found then return false; end if;

  if p_case_type = 'private_cases' then
    select array[primary_assignee_id, secondary_assignee_id, tertiary_assignee_id] into v_a
      from public.private_cases where id = p_case_id and deleted_at is null;
    v_kort := 'private';
  else
    select array[primary_assignee_id, secondary_assignee_id, tertiary_assignee_id] into v_a
      from public.business_cases where id = p_case_id and deleted_at is null;
    v_kort := 'business';
  end if;
  if not found then return false; end if;

  if coalesce(v_p.is_admin, false) or coalesce(v_p.is_koordinator, false)
     or v_p.role::text in ('admin', 'koordinator', 'säljare') then
    return true;
  end if;
  if v_p.role::text = 'technician' then
    if v_p.technician_id is not null and v_p.technician_id = any (v_a) then return true; end if;
    return exists (select 1 from public.case_comments cc
                    where cc.case_id = p_case_id and cc.case_type = v_kort and v_p.id = any (cc.mentioned_user_ids));
  end if;
  return false;
end;
$function$;

-- Ärendets uppgifter i lead-form (internt, används av underlaget och skapandet).
create or replace function public.lead_arende_uppgifter(p_case_type text, p_case_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v jsonb;
begin
  if p_case_type = 'business_cases' then
    select jsonb_build_object(
      'case_number', c.case_number,
      'foretag', coalesce(nullif(btrim(c.company_name), ''), nullif(btrim(c.bestallare), ''), nullif(btrim(c.title), '')),
      'org_nr', nullif(btrim(c.org_nr), ''),
      'kontakt', nullif(btrim(c.kontaktperson), ''),
      'telefon', nullif(btrim(c.telefon_kontaktperson), ''),
      'epost', nullif(btrim(c.e_post_kontaktperson), ''),
      'adress', case when c.adress is null then null
                     when jsonb_typeof(c.adress) = 'string' then nullif(btrim(c.adress #>> '{}'), '')
                     else coalesce(c.adress ->> 'formatted_address', c.adress ->> 'address') end,
      'skadedjur', nullif(btrim(coalesce(nullif(c.skadedjur, ''), c.annat_skadedjur, '')), ''))
      into v from public.business_cases c where c.id = p_case_id;
  elsif p_case_type = 'private_cases' then
    select jsonb_build_object(
      'case_number', c.case_number,
      'foretag', null,
      'org_nr', null,
      'kontakt', coalesce(nullif(btrim(c.kontaktperson), ''), nullif(btrim(c.title), '')),
      'telefon', nullif(btrim(c.telefon_kontaktperson), ''),
      'epost', nullif(btrim(c.e_post_kontaktperson), ''),
      'adress', case when c.adress is null then null
                     when jsonb_typeof(c.adress) = 'string' then nullif(btrim(c.adress #>> '{}'), '')
                     else coalesce(c.adress ->> 'formatted_address', c.adress ->> 'address') end,
      'skadedjur', nullif(btrim(coalesce(nullif(c.skadedjur, ''), c.annat_skadedjur, '')), ''))
      into v from public.private_cases c where c.id = p_case_id;
  end if;
  return v;
end;
$function$;

-- Underlaget som modalen visar: ärendets kund, befintlig lead på ärendet och dubbletter.
-- Personnummer lämnar aldrig databasen härifrån.
create or replace function public.lead_arende_underlag(p_case_type text, p_case_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_u jsonb;
  v_bef jsonb;
  v_bef_id uuid;
  v_dubb jsonb;
begin
  if not public.lead_far_se_arende(p_case_type, p_case_id) then
    raise exception 'Du kan inte se ärendet' using errcode = '42501';
  end if;
  v_u := public.lead_arende_uppgifter(p_case_type, p_case_id);

  select l.id, jsonb_build_object('id', l.id, 'company_name', l.company_name, 'stage', l.stage,
                                  'kan_oppna', public.can_see_lead(l.id))
    into v_bef_id, v_bef
    from public.leads l
   where l.origin_case_type = p_case_type and l.origin_case_id = p_case_id
   limit 1;

  select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) into v_dubb
    from public.lead_dubbletter(v_u ->> 'org_nr', v_u ->> 'telefon', v_u ->> 'epost', v_bef_id) d
   where d.stage not in ('vunnen', 'forlorad');

  return v_u || jsonb_build_object('case_type', p_case_type, 'case_id', p_case_id,
                                   'befintlig', v_bef, 'dubbletter', v_dubb);
end;
$function$;

-- Skapar leaden. p_galler: företag lopande_avtal | fler_adresser | annan_tjanst,
-- privat hemmet | forening | foretag (de två sista kräver p_foretag).
-- Finns redan en lead på ärendet returneras den (skapad = false).
create or replace function public.lead_fran_arende(
  p_case_type text,
  p_case_id uuid,
  p_galler text,
  p_beskrivning text,
  p_foretag text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_me uuid := public.my_profile_id();
  v_tekniker boolean;
  v_u jsonb;
  v_id uuid;
  v_namn text;
  v_grupp public.lead_customer_group;
  v_typ public.lead_type;
  v_galler_text text;
  v_beskr text := nullif(btrim(coalesce(p_beskrivning, '')), '');
  v_foretag text := nullif(btrim(coalesce(p_foretag, '')), '');
  v_etikett text;
begin
  if not public.is_lead_staff() or v_me is null then
    raise exception 'Behörighet saknas' using errcode = '42501';
  end if;
  if not public.lead_far_se_arende(p_case_type, p_case_id) then
    raise exception 'Du kan inte se ärendet' using errcode = '42501';
  end if;
  if v_beskr is null then
    raise exception 'Skriv vad du såg' using errcode = '22023';
  end if;
  if char_length(v_beskr) > 2000 then
    raise exception 'Texten får vara högst 2000 tecken' using errcode = '22023';
  end if;

  select l.id, l.company_name into v_id, v_namn from public.leads l
   where l.origin_case_type = p_case_type and l.origin_case_id = p_case_id limit 1;
  if v_id is not null then
    return jsonb_build_object('lead_id', v_id, 'company_name', v_namn, 'skapad', false, 'kan_oppna', public.can_see_lead(v_id));
  end if;

  v_u := public.lead_arende_uppgifter(p_case_type, p_case_id);
  v_etikett := case p_case_type when 'business_cases' then 'företagsärende' else 'privat engångsärende' end;

  if p_case_type = 'business_cases' then
    if p_galler not in ('lopande_avtal', 'fler_adresser', 'annan_tjanst') then
      raise exception 'Okänt val' using errcode = '22023';
    end if;
    v_grupp := 'foretag';
    v_namn := coalesce(v_u ->> 'foretag', v_u ->> 'kontakt', 'Företag utan namn');
  else
    if p_galler not in ('hemmet', 'forening', 'foretag') then
      raise exception 'Okänt val' using errcode = '22023';
    end if;
    if p_galler = 'hemmet' then
      v_grupp := 'privat';
      v_namn := coalesce(v_u ->> 'kontakt', 'Privatperson');
    else
      if v_foretag is null then
        raise exception 'Fyll i företag eller förening' using errcode = '22023';
      end if;
      v_grupp := case p_galler when 'forening' then 'forening' else 'foretag' end;
      v_namn := v_foretag;
    end if;
  end if;

  v_typ := case when p_galler in ('fler_adresser', 'annan_tjanst') then 'utokning' else 'nytt_avtal' end;
  v_galler_text := case p_galler
    when 'lopande_avtal' then 'Löpande avtal'
    when 'fler_adresser' then 'Fler adresser'
    when 'annan_tjanst' then 'Annan tjänst'
    when 'hemmet' then 'Löpande avtal för hemmet'
    when 'forening' then 'Bostadsrättsföreningen'
    when 'foretag' then 'Kundens företag'
  end;

  select (p.role::text = 'technician') and not public.is_lead_admin()
    into v_tekniker from public.profiles p where p.id = v_me;

  begin
    insert into public.leads (
      company_name, organization_number, contact_person, phone_number, email, address, problem_type,
      notes, source, lead_type, customer_group, origin_case_type, origin_case_id,
      tipped_by_profile_id, owner_profile_id, stage, next_action, next_action_at, created_by, updated_by
    ) values (
      v_namn,
      case when p_case_type = 'business_cases' then v_u ->> 'org_nr' end,
      v_u ->> 'kontakt', v_u ->> 'telefon', v_u ->> 'epost', v_u ->> 'adress', v_u ->> 'skadedjur',
      concat_ws(E'\n\n',
        format('Från %s %s. Gäller: %s.', v_etikett, coalesce(v_u ->> 'case_number', ''), v_galler_text),
        case when v_u ->> 'skadedjur' is not null then 'Skadedjur i ärendet: ' || (v_u ->> 'skadedjur') end,
        v_beskr),
      case when coalesce(v_tekniker, false) then 'tekniker_tips' else 'engangsarende' end::public.lead_source,
      v_typ, v_grupp, p_case_type, p_case_id,
      v_me,
      case when coalesce(v_tekniker, false) then null else v_me end,
      'ny',
      'Kontakta kunden om tipset',
      now() + interval '2 days',
      v_me, v_me
    ) returning id into v_id;
  exception when unique_violation then
    select l.id, l.company_name into v_id, v_namn from public.leads l
     where l.origin_case_type = p_case_type and l.origin_case_id = p_case_id limit 1;
    return jsonb_build_object('lead_id', v_id, 'company_name', v_namn, 'skapad', false, 'kan_oppna', public.can_see_lead(v_id));
  end;

  return jsonb_build_object('lead_id', v_id, 'company_name', v_namn, 'skapad', true, 'kan_oppna', true);
end;
$function$;

-- Lägger tipset som anteckning på en befintlig lead (dubblett) i stället för att skapa en ny.
-- Teknikern behöver inte kunna se leaden; anteckningen hamnar i dess tidslinje med ärendet som referens.
create or replace function public.lead_anteckning_fran_arende(p_lead uuid, p_case_type text, p_case_id uuid, p_text text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_me uuid := public.my_profile_id();
  v_u jsonb;
  v_text text := nullif(btrim(coalesce(p_text, '')), '');
begin
  if not public.is_lead_staff() or v_me is null then
    raise exception 'Behörighet saknas' using errcode = '42501';
  end if;
  if not public.lead_far_se_arende(p_case_type, p_case_id) then
    raise exception 'Du kan inte se ärendet' using errcode = '42501';
  end if;
  if v_text is null then
    raise exception 'Skriv vad du såg' using errcode = '22023';
  end if;
  if not exists (select 1 from public.leads where id = p_lead) then
    raise exception 'Leaden finns inte' using errcode = 'P0002';
  end if;
  v_u := public.lead_arende_uppgifter(p_case_type, p_case_id);
  insert into public.lead_activities (lead_id, kind, text, ref_table, ref_id, occurred_at, profile_id)
  values (p_lead, 'anteckning',
          left(format('Tips från %s %s: %s',
                      case p_case_type when 'business_cases' then 'företagsärende' else 'privat engångsärende' end,
                      coalesce(v_u ->> 'case_number', ''), v_text), 4000),
          p_case_type, p_case_id, now(), v_me);
end;
$function$;

-- Kopplar ett ärende som bokats från leaden. Steget blir Besök bokat om leaden är Ny eller Kontaktad.
create or replace function public.lead_koppla_besok(p_lead uuid, p_case_type text, p_case_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_finns boolean;
begin
  if not public.can_edit_lead(p_lead) then
    raise exception 'Du kan inte ändra leaden' using errcode = '42501';
  end if;
  if p_case_type not in ('private_cases', 'business_cases', 'cases') then
    raise exception 'Okänd ärendetyp' using errcode = '22023';
  end if;
  v_finns := case p_case_type
    when 'private_cases' then exists (select 1 from public.private_cases where id = p_case_id)
    when 'business_cases' then exists (select 1 from public.business_cases where id = p_case_id)
    else exists (select 1 from public.cases where id = p_case_id)
  end;
  if not v_finns then
    raise exception 'Ärendet finns inte' using errcode = 'P0002';
  end if;

  perform set_config('begone.leads_automatik', 'on', true);
  update public.leads
     set booked_case_type = p_case_type,
         booked_case_id = p_case_id,
         stage = case when stage in ('ny', 'kontaktad') then 'besok_bokat'::public.lead_stage else stage end
   where id = p_lead;
  perform set_config('begone.leads_automatik', 'off', true);
end;
$function$;

-- ---------------------------------------------------------------------------
-- 5. Oneflow: offert eller avtal med source_type = 'lead'
-- ---------------------------------------------------------------------------

-- Notis till tipsaren (tekniker) när tipset blir offert och vunnet. Bara när tipsaren inte är ägaren
-- och profilens id är inloggningens id (notiser läses på auth.uid() = recipient_id).
create or replace function public.lead_notis_tipsare(p_lead uuid, p_titel text, p_text text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_l public.leads%rowtype;
begin
  select * into v_l from public.leads where id = p_lead;
  if not found or v_l.tipped_by_profile_id is null or v_l.tipped_by_profile_id is not distinct from v_l.owner_profile_id then
    return;
  end if;
  if not exists (select 1 from public.profiles p
                  where p.id = v_l.tipped_by_profile_id and p.user_id = p.id and coalesce(p.is_active, true)) then
    return;
  end if;
  insert into public.notifications (recipient_id, case_id, case_type, title, preview, case_title, sender_id, sender_name, is_read)
  values (v_l.tipped_by_profile_id, v_l.id, 'lead', p_titel || ' · ' || v_l.company_name, p_text, v_l.company_name,
          v_l.tipped_by_profile_id, 'Systemet', false);
end;
$function$;

create or replace function public.contracts_lead_automatik()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_l public.leads%rowtype;
  v_ar_avtal boolean;
  v_signerad boolean;
  v_var_signerad boolean;
begin
  if new.source_type is distinct from 'lead' or new.source_id is null then
    return null;
  end if;
  if tg_op = 'UPDATE'
     and new.status is not distinct from old.status
     and new.source_id is not distinct from old.source_id
     and new.source_type is not distinct from old.source_type then
    return null;
  end if;

  -- Contracts-flödet (webhook, utkast, publicering) får aldrig fallera på leaden
  begin
    select * into v_l from public.leads where id = new.source_id for update;
    if not found then return null; end if;

    v_ar_avtal := new.type = 'contract';
    v_signerad := new.status in ('signed', 'active');
    v_var_signerad := tg_op = 'UPDATE' and old.status in ('signed', 'active')
                      and old.source_id is not distinct from new.source_id;

    perform set_config('begone.leads_automatik', 'on', true);

    if new.status = 'pending' then
      update public.leads
         set offer_contract_id = new.id,
             stage = case when stage in ('ny', 'kontaktad', 'besok_bokat', 'parkerad') then 'offert_skickad'::public.lead_stage else stage end
       where id = v_l.id;
      if v_l.offer_contract_id is distinct from new.id then
        perform public.lead_notis_tipsare(v_l.id, 'Ditt tips har fått ' || case when v_ar_avtal then 'ett avtalsförslag' else 'en offert' end,
          'Säljaren har skickat ' || case when v_ar_avtal then 'ett avtal' else 'en offert' end || ' till kunden i Oneflow.');
      end if;

    elsif v_signerad and not v_var_signerad then
      update public.leads
         set agreement_contract_id = new.id,
             offer_contract_id = coalesce(offer_contract_id, new.id),
             customer_id = coalesce(customer_id, new.customer_id),
             stage = 'vunnen'
       where id = v_l.id;
      if v_l.stage is distinct from 'vunnen' then
        perform public.lead_notis_tipsare(v_l.id, 'Ditt tips är vunnet',
          case when v_ar_avtal then 'Kunden har signerat avtalet.' else 'Kunden har signerat offerten.' end);
      end if;

    elsif (new.status in ('declined', 'overdue') or (new.status = 'trashed' and tg_op = 'UPDATE' and old.status = 'pending'))
          and (v_l.offer_contract_id is null or v_l.offer_contract_id = new.id)
          and v_l.stage not in ('vunnen', 'forlorad') then
      insert into public.lead_activities (lead_id, kind, text, till_varde, ref_table, ref_id, profile_id)
      values (v_l.id, 'offert_avbojd',
              case new.status when 'declined' then 'Kunden avböjde' when 'overdue' then 'Signeringstiden gick ut' else 'Dokumentet makulerades' end,
              new.status, 'contracts', new.id, public.my_profile_id());
      update public.leads
         set stage = case when stage = 'offert_skickad' then 'kontaktad'::public.lead_stage else stage end,
             next_action = case new.status when 'declined' then 'Offerten avböjdes: ta ny kontakt'
                                           when 'overdue' then 'Offerten gick ut: ta ny kontakt'
                                           else 'Offerten makulerades: välj nästa steg' end,
             next_action_at = now()
       where id = v_l.id;
    end if;

    perform set_config('begone.leads_automatik', 'off', true);
  exception when others then
    perform set_config('begone.leads_automatik', 'off', true);
    raise warning 'contracts_lead_automatik: % (%)', sqlerrm, sqlstate;
  end;
  return null;
end;
$function$;

create or replace trigger contracts_lead_automatik
  after insert or update of status, source_type, source_id on public.contracts
  for each row execute function public.contracts_lead_automatik();

-- ---------------------------------------------------------------------------
-- 6. Leads (Webb): en offert från en lead räknas som fristående (inte ett ärendes offert)
-- ---------------------------------------------------------------------------
create or replace function public.web_inquiry_skickad_offert(p_oneflow_id text)
returns uuid
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select c.id
  from public.contracts c
  where c.oneflow_contract_id = p_oneflow_id
    and c.type = 'offer'
    and coalesce(c.status, 'draft') not in ('draft', 'trashed')
    and c.created_at >= now() - interval '1 day'
    and (c.source_id is null or c.source_type = 'lead')
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
$function$;

-- ---------------------------------------------------------------------------
-- Behörighet: RPC:er bara för inloggade, interna funktioner för ingen
-- ---------------------------------------------------------------------------
revoke execute on function public.lead_far_se_arende(text, uuid) from public, anon;
revoke execute on function public.lead_arende_underlag(text, uuid) from public, anon;
revoke execute on function public.lead_fran_arende(text, uuid, text, text, text) from public, anon;
revoke execute on function public.lead_anteckning_fran_arende(uuid, text, uuid, text) from public, anon;
revoke execute on function public.lead_koppla_besok(uuid, text, uuid) from public, anon;
grant execute on function public.lead_far_se_arende(text, uuid) to authenticated;
grant execute on function public.lead_arende_underlag(text, uuid) to authenticated;
grant execute on function public.lead_fran_arende(text, uuid, text, text, text) to authenticated;
grant execute on function public.lead_anteckning_fran_arende(uuid, text, uuid, text) to authenticated;
grant execute on function public.lead_koppla_besok(uuid, text, uuid) to authenticated;

revoke execute on function public.lead_arende_uppgifter(text, uuid) from public, anon, authenticated;
revoke execute on function public.lead_notis_tipsare(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.contracts_lead_automatik() from public, anon, authenticated;
