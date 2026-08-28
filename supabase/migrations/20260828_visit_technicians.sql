-- 20260828_visit_technicians.sql
-- Flera tekniker per besök.
--
-- EJ APPLICERAD. Granska och applicera manuellt.
--
-- Bakgrund: visits bär bara technician_id + technician_name (singular). Ett
-- ärende kan ha upp till tre tekniker (primary/secondary/tertiary på alla tre
-- ärendetabellerna) och provisionen fördelas redan mellan dem i
-- commission_posts. Besökssnapshotet tappade alla utom primärteknikern, så
-- fakturamodalens "Utfört arbete" och Ärendehistoriken visade en enda tekniker
-- på ett besök som två personer utfört (BE-0008612: fyra provisionsposter,
-- två tekniker, men "Mathias Carlsson" ensam i besöket).
--
-- Val av datamodell: jsonb-array på visits i stället för tabellen
-- visit_technicians.
--   * Listan är bunden till max tre poster och läses ALLTID tillsammans med
--     besöket — en join per besök hade bara kostat.
--   * Snapshotet ska frysa namnen som gällde vid besöket. En FK mot
--     technicians hade låtit ett namnbyte skriva om historiken.
--   * Ärendetabellerna lagrar redan teknikerna denormaliserat (id + name +
--     email i tre kolumnpar). jsonb är samma sanning, utan tre nya kolumnpar.
--   * commission_posts behåller sin radform — den behöver share_percentage
--     och utbetalningsstatus per tekniker, vilket ett snapshot inte har.
--
-- technician_id/technician_name lämnas orörda som primärtekniker: allt som
-- läser dem idag fortsätter fungera, och de är alltid element ett i arrayen.

-- =====================================================================
-- 1. Kolumnen
-- =====================================================================

alter table public.visits
  add column if not exists technicians jsonb not null default '[]'::jsonb;

comment on column public.visits.technicians is
  'Besökets tekniker i ordning [{id, name, role}], role = primary|secondary|tertiary. '
  'Element ett speglar technician_id/technician_name. Fryst snapshot — uppdateras '
  'aldrig av namnbyten i technicians-tabellen.';

-- Arrayform + kända roller. Tomt array tillåts (besök utan tilldelad tekniker).
alter table public.visits
  drop constraint if exists visits_technicians_is_array;

alter table public.visits
  add constraint visits_technicians_is_array
  check (jsonb_typeof(technicians) = 'array');

alter table public.visits
  drop constraint if exists visits_technicians_shape;

alter table public.visits
  add constraint visits_technicians_shape
  check (
    not exists (
      select 1
      from jsonb_array_elements(technicians) as t
      where jsonb_typeof(t) <> 'object'
         or coalesce(t->>'name', '') = ''
         or coalesce(t->>'role', 'primary') not in ('primary', 'secondary', 'tertiary')
    )
  );

-- Uppslag "vilka besök har tekniker X" utan att läsa hela tabellen.
create index if not exists idx_visits_technicians
  on public.visits using gin (technicians jsonb_path_ops);

-- =====================================================================
-- 2. Backfyllnad
--
-- Ärendets nuvarande tilldelning är den bästa tillgängliga uppskattningen av
-- vilka som var med på besöket. Den är inte perfekt (tilldelningen kan ha
-- ändrats efter besöket) men den är mer rätt än dagens ensamma primärtekniker.
--
-- Ordningen är medveten: bara besök där arrayen fortfarande är tom rörs, och
-- backfyllnaden kräver att ärendets primärtekniker är samma person som
-- besökets. Skiljer de sig har tilldelningen bytts efter besöket, och då är
-- ärendets lista fel sanning — sådana besök får bara sin egen primärtekniker.
-- =====================================================================

-- 2a. Avtalsärenden (cases: primary/secondary/tertiary_technician_*)
update public.visits v
set technicians = tech.list
from (
  select
    c.id as case_id,
    c.primary_technician_id as case_primary_id,
    (
      select coalesce(jsonb_agg(e.elem order by e.ord), '[]'::jsonb)
      from (
        values
          (1, c.primary_technician_id, c.primary_technician_name::text, 'primary'),
          (2, c.secondary_technician_id, c.secondary_technician_name::text, 'secondary'),
          (3, c.tertiary_technician_id, c.tertiary_technician_name::text, 'tertiary')
      ) as raw(ord, tech_id, tech_name, role)
      cross join lateral (
        select raw.ord as ord,
               jsonb_build_object('id', raw.tech_id, 'name', raw.tech_name, 'role', raw.role) as elem
      ) e
      where coalesce(raw.tech_name, '') <> ''
    ) as list
  from public.cases c
) tech
where v.case_id = tech.case_id
  and v.case_type = 'contract'
  and v.technicians = '[]'::jsonb
  and jsonb_array_length(tech.list) > 0
  and v.technician_id is not distinct from tech.case_primary_id;

-- 2b. Privatärenden (private_cases: primary/secondary/tertiary_assignee_*)
update public.visits v
set technicians = tech.list
from (
  select
    c.id as case_id,
    c.primary_assignee_id as case_primary_id,
    (
      select coalesce(jsonb_agg(e.elem order by e.ord), '[]'::jsonb)
      from (
        values
          (1, c.primary_assignee_id, c.primary_assignee_name, 'primary'),
          (2, c.secondary_assignee_id, c.secondary_assignee_name, 'secondary'),
          (3, c.tertiary_assignee_id, c.tertiary_assignee_name, 'tertiary')
      ) as raw(ord, tech_id, tech_name, role)
      cross join lateral (
        select raw.ord as ord,
               jsonb_build_object('id', raw.tech_id, 'name', raw.tech_name, 'role', raw.role) as elem
      ) e
      where coalesce(raw.tech_name, '') <> ''
    ) as list
  from public.private_cases c
) tech
where v.case_id = tech.case_id
  and v.case_type = 'private'
  and v.technicians = '[]'::jsonb
  and jsonb_array_length(tech.list) > 0
  and v.technician_id is not distinct from tech.case_primary_id;

-- 2c. Företagsärenden (business_cases: primary/secondary/tertiary_assignee_*)
update public.visits v
set technicians = tech.list
from (
  select
    c.id as case_id,
    c.primary_assignee_id as case_primary_id,
    (
      select coalesce(jsonb_agg(e.elem order by e.ord), '[]'::jsonb)
      from (
        values
          (1, c.primary_assignee_id, c.primary_assignee_name, 'primary'),
          (2, c.secondary_assignee_id, c.secondary_assignee_name, 'secondary'),
          (3, c.tertiary_assignee_id, c.tertiary_assignee_name, 'tertiary')
      ) as raw(ord, tech_id, tech_name, role)
      cross join lateral (
        select raw.ord as ord,
               jsonb_build_object('id', raw.tech_id, 'name', raw.tech_name, 'role', raw.role) as elem
      ) e
      where coalesce(raw.tech_name, '') <> ''
    ) as list
  from public.business_cases c
) tech
where v.case_id = tech.case_id
  and v.case_type = 'business'
  and v.technicians = '[]'::jsonb
  and jsonb_array_length(tech.list) > 0
  and v.technician_id is not distinct from tech.case_primary_id;

-- 2d. Resten: besök vars ärende inte kunde matchas (ärendet borta, tilldelningen
--     ändrad) får åtminstone sin egen primärtekniker i arrayen, så att
--     visningskoden kan lita på technicians och aldrig behöver falla tillbaka.
update public.visits v
set technicians = jsonb_build_array(
  jsonb_build_object('id', v.technician_id, 'name', v.technician_name, 'role', 'primary')
)
where v.technicians = '[]'::jsonb
  and coalesce(v.technician_name, '') <> '';

-- =====================================================================
-- 3. create_visit_snapshot: ta emot och lagra hela teknikerlistan
--
-- Ny parameter p_technicians jsonb, sist i signaturen med DEFAULT så att
-- befintliga anrop utan parametern fortsätter fungera (PostgREST matchar på
-- namn — den gamla anropsformen träffar samma funktion).
--
-- Funktionen normaliserar själv: saknas p_technicians byggs listan från
-- p_technician_id/p_technician_name, så ingen anropsväg kan skapa ett besök
-- med tom teknikerlista när en primärtekniker är känd. Primärteknikerns
-- kolumner härleds ur listans första element när de inte skickats med.
--
-- Övrig logik (advisory lock, idempotens, stämpling av case_billing_items)
-- är oförändrad från 20260828_visits_entity.sql.
--
-- OBS: en ny parameter ger en NY signatur, så CREATE OR REPLACE skapar en
-- överlagring i stället för att ersätta. Två överlagringar där alla nya
-- parametrar har DEFAULT gör varje anrop tvetydigt ("function is not unique").
-- Den gamla 15-parametersvarianten måste därför droppas först.
-- =====================================================================

drop function if exists public.create_visit_snapshot(
  uuid, text, text, boolean, uuid, text, timestamptz, text, text, text, text,
  integer, integer, integer, uuid
);

create or replace function public.create_visit_snapshot(
  p_case_id uuid,
  p_case_type text,
  p_source text,
  p_is_final boolean,
  p_technician_id uuid default null::uuid,
  p_technician_name text default null::text,
  p_visit_date timestamp with time zone default now(),
  p_work_performed text default null::text,
  p_findings text default null::text,
  p_recommendations text default null::text,
  p_materials_used text default null::text,
  p_time_spent_minutes integer default null::integer,
  p_pest_level integer default null::integer,
  p_problem_rating integer default null::integer,
  p_customer_id uuid default null::uuid,
  p_technicians jsonb default null::jsonb
)
returns visits
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v visits;
  v_next integer;
  v_techs jsonb;
  v_primary_id uuid;
  v_primary_name text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_case_id::text, 0));

  if p_is_final then
    select * into v from visits where case_id = p_case_id and is_final;
    if found then return v; end if;
  else
    select * into v from visits
    where case_id = p_case_id
      and date_trunc('day', visit_date) = date_trunc('day', p_visit_date)
      and source = p_source;
    if found then return v; end if;
  end if;

  -- Normalisera teknikerlistan: behall bara objekt med namn, satt role om den
  -- saknas (forsta = primary, ovriga = secondary).
  if p_technicians is null or jsonb_typeof(p_technicians) <> 'array' then
    v_techs := '[]'::jsonb;
  else
    select coalesce(jsonb_agg(
             jsonb_build_object(
               'id', t.elem->>'id',
               'name', trim(t.elem->>'name'),
               'role', coalesce(
                 nullif(t.elem->>'role', ''),
                 case when t.ord = 1 then 'primary' else 'secondary' end
               )
             )
             order by t.ord
           ), '[]'::jsonb)
    into v_techs
    from jsonb_array_elements(p_technicians) with ordinality as t(elem, ord)
    where jsonb_typeof(t.elem) = 'object'
      and coalesce(trim(t.elem->>'name'), '') <> '';
  end if;

  -- Ingen lista skickad men en primartekniker ar kand: bygg listan ur den.
  if jsonb_array_length(v_techs) = 0 and coalesce(trim(p_technician_name), '') <> '' then
    v_techs := jsonb_build_array(
      jsonb_build_object('id', p_technician_id, 'name', trim(p_technician_name), 'role', 'primary')
    );
  end if;

  -- Primarteknikerns kolumner: uttryckligt varde vinner, annars listans forsta.
  v_primary_id := coalesce(p_technician_id, (v_techs->0->>'id')::uuid);
  v_primary_name := coalesce(nullif(trim(p_technician_name), ''), v_techs->0->>'name');

  select coalesce(max(visit_number), 0) + 1 into v_next
  from visits where case_id = p_case_id;

  insert into visits (
    case_id, case_type, source, is_final, visit_number,
    technician_id, technician_name, technicians, visit_date, completed_date,
    work_performed, findings, recommendations, materials_used,
    time_spent_minutes, pest_level, problem_rating, customer_id, status
  ) values (
    p_case_id, p_case_type, p_source, p_is_final, v_next,
    v_primary_id, v_primary_name, v_techs, p_visit_date,
    case when p_is_final then now() else p_visit_date end,
    p_work_performed, p_findings, p_recommendations, p_materials_used,
    p_time_spent_minutes, p_pest_level, p_problem_rating, p_customer_id,
    'completed'
  ) returning * into v;

  -- Stampla arendets ostamplade rader. case_type-filtret hindrar korsstampling
  -- mellan arendetabeller; avtalsprislistrader (case_id -> contracts) traffas
  -- aldrig eftersom deras case_id inte ar arendets.
  update case_billing_items cbi
  set visit_id = v.id, visit_number = v_next, updated_at = now()
  where cbi.case_id = p_case_id
    and cbi.case_type = p_case_type
    and cbi.visit_id is null;

  return v;
end $function$;
