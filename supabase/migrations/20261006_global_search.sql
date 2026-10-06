-- Global söklåda (Ctrl+K) för admin, koordinator och tekniker.
--
-- public.global_search(p_query, p_portal, p_include_archived, p_limit) returnerar
-- ett jsonb-objekt med träffar per grupp. Funktionen är SECURITY DEFINER med egen
-- rollkontroll: RLS på invoices, cases m.fl. är för öppen (eller för olika mellan
-- tabellerna) för att räcka som säkerhetsgräns, och teknikerns begränsning till
-- egna ärenden och egna dokument finns inte i RLS. Rollen läses ur profiles för
-- auth.uid(); säljare, kunder och okända får ett tomt svar.
--
-- p_portal ('admin' | 'koordinator' | 'technician') smalnar av till portalens
-- omfång. Den kan bara minska behörigheten, aldrig öka den.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Hjälpfunktioner (immutable, så att de kan ingå i indexuttryck)
-- ---------------------------------------------------------------------------

create or replace function public.gs_hay(variadic p text[])
returns text
language sql
immutable
parallel safe
set search_path = public
as $$ select lower(array_to_string(p, ' ')) $$;

create or replace function public.gs_addr(p jsonb)
returns text
language plpgsql
immutable
parallel safe
set search_path = public
as $$
declare
  v text;
begin
  if p is null then
    return null;
  end if;
  if jsonb_typeof(p) = 'object' then
    return coalesce(p ->> 'formatted_address', p ->> 'address', p ->> 'street');
  end if;
  if jsonb_typeof(p) <> 'string' then
    return null;
  end if;
  v := p #>> '{}';
  -- ClickUp-arkivet har adressen som JSON-text i en jsonb-sträng
  if left(btrim(v), 1) = '{' then
    begin
      return coalesce((v::jsonb) ->> 'formatted_address', v);
    exception when others then
      return v;
    end;
  end if;
  return v;
end;
$$;

create or replace function public.gs_all_tokens(p_hay text, p_tokens text[])
returns boolean
language sql
immutable
parallel safe
set search_path = public
as $$
  select not exists (
    select 1 from unnest(p_tokens) t
    where p_hay is null or position(t in p_hay) = 0
  )
$$;

-- ---------------------------------------------------------------------------
-- Trigram-index på fritextfälten
-- ---------------------------------------------------------------------------

create index if not exists private_cases_gs_hay_trgm on public.private_cases using gin (
  public.gs_hay(case_number, title, kontaktperson, e_post_kontaktperson, telefon_kontaktperson,
    skadedjur, annat_skadedjur, public.gs_addr(adress), primary_assignee_name, secondary_assignee_name)
  extensions.gin_trgm_ops
);

create index if not exists business_cases_gs_hay_trgm on public.business_cases using gin (
  public.gs_hay(case_number, title, company_name, kontaktperson, bestallare, e_post_kontaktperson,
    telefon_kontaktperson, skadedjur, annat_skadedjur, public.gs_addr(adress), markning_faktura,
    primary_assignee_name, secondary_assignee_name)
  extensions.gin_trgm_ops
);

create index if not exists cases_gs_hay_trgm on public.cases using gin (
  public.gs_hay(case_number, title, contact_person, contact_email, contact_phone, pest_type,
    other_pest_type, public.gs_addr(address), work_order_number, primary_technician_name,
    secondary_technician_name)
  extensions.gin_trgm_ops
);

create index if not exists customers_gs_hay_trgm on public.customers using gin (
  public.gs_hay(company_name, site_name, site_code, contact_person, contact_email, contact_phone,
    contact_address, billing_reference, organization_number)
  extensions.gin_trgm_ops
);

create index if not exists contracts_gs_hay_trgm on public.contracts using gin (
  public.gs_hay(company_name, display_name, label, contact_person, contact_email, organization_number,
    contact_address, quote_reference_number, begone_employee_name)
  extensions.gin_trgm_ops
);

-- ---------------------------------------------------------------------------
-- Själva sökningen
-- ---------------------------------------------------------------------------

create or replace function public.global_search(
  p_query text,
  p_portal text default null,
  p_include_archived boolean default false,
  p_limit integer default 5
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_prof        record;
  v_is_admin    boolean;
  v_is_koord    boolean;
  v_is_tech     boolean;
  v_scope       text;
  v_tech_id     uuid;
  v_emails      text[];
  v_q           text;
  v_digits      text;
  v_kind        text;
  v_num         bigint;
  v_phone       text;
  v_tokens      text[];
  v_first       text;
  v_limit       integer := least(greatest(coalesce(p_limit, 5), 1), 20);
  v_empty       jsonb := jsonb_build_object('scope', null, 'kind', null, 'cases', '[]'::jsonb,
                    'customers', '[]'::jsonb, 'documents', '[]'::jsonb, 'leads', '[]'::jsonb,
                    'technicians', '[]'::jsonb, 'invoices', '[]'::jsonb);
  r_cases       jsonb := '[]';
  r_customers   jsonb := '[]';
  r_documents   jsonb := '[]';
  r_leads       jsonb := '[]';
  r_techs       jsonb := '[]';
  r_invoices    jsonb := '[]';
begin
  if auth.uid() is null then
    return v_empty;
  end if;

  select p.role, p.is_admin, p.is_koordinator, p.technician_id, p.email, p.extra_roles, p.is_active
    into v_prof
    from public.profiles p
   where p.user_id = auth.uid()
   limit 1;

  if not found or coalesce(v_prof.is_active, true) = false then
    return v_empty;
  end if;

  v_is_admin := v_prof.role = 'admin' or coalesce(v_prof.is_admin, false)
                or 'admin' = any(coalesce(v_prof.extra_roles, '{}'));
  v_is_koord := v_is_admin or v_prof.role = 'koordinator' or coalesce(v_prof.is_koordinator, false)
                or 'koordinator' = any(coalesce(v_prof.extra_roles, '{}'));
  v_is_tech  := v_is_koord or v_prof.role = 'technician'
                or 'technician' = any(coalesce(v_prof.extra_roles, '{}'));

  v_scope := case
    when p_portal = 'admin'       and v_is_admin then 'admin'
    when p_portal = 'koordinator' and v_is_koord then 'koordinator'
    when p_portal = 'technician'  and v_is_tech  then 'technician'
    when p_portal is null and v_is_admin then 'admin'
    when p_portal is null and v_is_koord then 'koordinator'
    when p_portal is null and v_is_tech  then 'technician'
    else null
  end;

  if v_scope is null then
    return v_empty;
  end if;

  v_tech_id := v_prof.technician_id;
  select array_remove(array[lower(v_prof.email), lower(t.email)], null)
    into v_emails
    from (select 1) one
    left join public.technicians t on t.id = v_tech_id;
  v_emails := coalesce(v_emails, array_remove(array[lower(v_prof.email)], null));

  -- Tolka frågan ---------------------------------------------------------------
  v_q := lower(btrim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g')));
  if length(v_q) < 2 then
    return v_empty || jsonb_build_object('scope', v_scope);
  end if;
  v_digits := regexp_replace(v_q, '\D', '', 'g');

  v_kind := case
    when v_q ~ '^be-?\s?\d{1,8}$' then 'case'
    when position('@' in v_q) > 0 then 'email'
    -- 10 siffror som börjar på 0 är ett telefonnummer, inte ett org.nr
    when v_q ~ '^\d{6}-\d{4}$' or v_q ~ '^[1-9]\d{9}$' or v_q ~ '^(19|20)\d{6}-?\d{4}$' then 'orgnr'
    when v_q ~ '^\d{3} \d{2}$' then 'postal'
    when v_q ~ '^(\+46|0)[\d\s-]{6,}$' and length(v_digits) between 8 and 13 then 'phone'
    when v_q ~ '^\d{1,8}$' then 'number'
    else 'text'
  end;

  if v_kind in ('case', 'number') then
    v_num := v_digits::bigint;
  end if;
  if v_kind = 'phone' then
    v_phone := regexp_replace(v_digits, '^46', '0');
  end if;

  -- Orden i längdordning; det längsta används som like-villkor (kan ta trigramindexet),
  -- alla ord måste sedan finnas någonstans i texten (gs_all_tokens, utan jokertecken).
  select coalesce(array_agg(t order by length(t) desc), '{}')
    into v_tokens
    from unnest(string_to_array(v_q, ' ')) t
   where t <> '';
  v_first := '%' || replace(replace(replace(coalesce(v_tokens[1], v_q), '\', '\\'), '%', '\%'), '_', '\_') || '%';

  -- Ärenden ----------------------------------------------------------------------
  -- Äldre rader saknar case_number men har ärendenumret som titel (BE-0008900).
  with hits as (
    select 'private'::text as case_type, pc.id,
           coalesce(pc.case_number, substring(pc.title from '^[Bb][Ee]-\d+$')) as number,
           coalesce(nullif(pc.title, ''), pc.kontaktperson, 'Ärende') as title,
           pc.status, coalesce(pc.start_date, pc.created_at) as at,
           pc.skadedjur as pest, public.gs_addr(pc.adress) as address,
           concat_ws(' och ', pc.primary_assignee_name, pc.secondary_assignee_name, pc.tertiary_assignee_name) as techs,
           pc.kontaktperson as customer_name, null::uuid as customer_id,
           pc.start_date is not null as scheduled,
           pc.legacy_archived_at is not null as archived,
           public.gs_hay(pc.case_number, pc.title, pc.kontaktperson, pc.e_post_kontaktperson, pc.telefon_kontaktperson,
             pc.skadedjur, pc.annat_skadedjur, public.gs_addr(pc.adress), pc.primary_assignee_name, pc.secondary_assignee_name) as hay,
           pc.e_post_kontaktperson as email, pc.telefon_kontaktperson as phone, pc.personnummer as idnr
      from public.private_cases pc
     where pc.deleted_at is null
       and (p_include_archived or pc.legacy_archived_at is null)
       and (v_scope <> 'technician' or (v_tech_id is not null and v_tech_id in
            (pc.primary_assignee_id, pc.secondary_assignee_id, pc.tertiary_assignee_id)))
    union all
    select 'business', bc.id,
           coalesce(bc.case_number, substring(bc.title from '^[Bb][Ee]-\d+$')),
           coalesce(nullif(bc.title, ''), bc.company_name, 'Ärende'),
           bc.status, coalesce(bc.start_date, bc.created_at),
           bc.skadedjur, public.gs_addr(bc.adress),
           concat_ws(' och ', bc.primary_assignee_name, bc.secondary_assignee_name, bc.tertiary_assignee_name),
           coalesce(bc.company_name, bc.kontaktperson), null::uuid,
           bc.start_date is not null,
           bc.legacy_archived_at is not null,
           public.gs_hay(bc.case_number, bc.title, bc.company_name, bc.kontaktperson, bc.bestallare, bc.e_post_kontaktperson,
             bc.telefon_kontaktperson, bc.skadedjur, bc.annat_skadedjur, public.gs_addr(bc.adress), bc.markning_faktura,
             bc.primary_assignee_name, bc.secondary_assignee_name),
           bc.e_post_kontaktperson, bc.telefon_kontaktperson, bc.org_nr
      from public.business_cases bc
     where bc.deleted_at is null
       and (p_include_archived or bc.legacy_archived_at is null)
       and (v_scope <> 'technician' or (v_tech_id is not null and v_tech_id in
            (bc.primary_assignee_id, bc.secondary_assignee_id, bc.tertiary_assignee_id)))
    union all
    select 'contract', c.id,
           coalesce(c.case_number::text, substring(c.title from '^[Bb][Ee]-\d+$')),
           coalesce(nullif(c.title, ''), cu.company_name, 'Avtalsärende'),
           c.status, coalesce(c.scheduled_start, c.created_at),
           c.pest_type, public.gs_addr(c.address),
           concat_ws(' och ', c.primary_technician_name, c.secondary_technician_name, c.tertiary_technician_name),
           coalesce(cu.company_name, c.contact_person), c.customer_id,
           c.scheduled_start is not null,
           false,
           public.gs_hay(c.case_number, c.title, c.contact_person, c.contact_email, c.contact_phone, c.pest_type,
             c.other_pest_type, public.gs_addr(c.address), c.work_order_number, c.primary_technician_name,
             c.secondary_technician_name) || ' ' || coalesce(lower(cu.company_name), '') || ' ' || coalesce(lower(cu.site_name), ''),
           c.contact_email, c.contact_phone, cu.organization_number
      from public.cases c
      left join public.customers cu on cu.id = c.customer_id
     where c.deleted_at is null
       and (v_scope <> 'technician' or (v_tech_id is not null and v_tech_id in
            (c.primary_technician_id, c.secondary_technician_id, c.tertiary_technician_id)))
  ), numbered as (
    select h.*,
           ltrim(regexp_replace(coalesce(h.number, ''), '\D', '', 'g'), '0') as num_digits
      from hits h
  ), matched as (
    select n.*,
           (v_kind in ('case', 'number') and n.num_digits <> '' and n.num_digits = ltrim(v_digits, '0')) as exact,
           case when v_kind = 'text' then extensions.word_similarity(v_q, n.hay) else 0 end as rank
      from numbered n
     where case v_kind
       when 'case' then n.num_digits <> '' and n.num_digits like ltrim(v_digits, '0') || '%'
       when 'number' then n.num_digits <> '' and (n.num_digits = ltrim(v_digits, '0')
                          or (length(v_digits) >= 3 and n.num_digits like ltrim(v_digits, '0') || '%'))
       when 'email' then lower(coalesce(n.email, '')) like '%' || v_q || '%'
       when 'phone' then regexp_replace(regexp_replace(coalesce(n.phone, ''), '\D', '', 'g'), '^46', '0') like '%' || v_phone || '%'
       when 'orgnr' then right(regexp_replace(coalesce(n.idnr, ''), '\D', '', 'g'), 10) = right(v_digits, 10)
       when 'postal' then replace(coalesce(n.address, ''), ' ', '') like '%' || v_digits || '%'
       else n.hay like v_first and public.gs_all_tokens(n.hay, v_tokens)
     end
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'kind', 'case', 'id', m.id, 'case_type', m.case_type, 'number', m.number, 'title', m.title,
           'status', m.status, 'date', m.at, 'pest', m.pest, 'address', m.address, 'technicians', nullif(m.techs, ''),
           'customer_name', m.customer_name, 'customer_id', m.customer_id, 'scheduled', m.scheduled,
           'archived', m.archived, 'exact', m.exact)
         order by m.exact desc, m.archived asc, m.rank desc, m.at desc nulls last), '[]'::jsonb)
    into r_cases
    from (select * from matched order by exact desc, archived asc, rank desc, at desc nulls last limit v_limit * 2) m;

  -- Kunder -----------------------------------------------------------------------
  select coalesce(jsonb_agg(x.j order by x.exact desc, x.active desc, x.rank desc, x.name), '[]'::jsonb)
    into r_customers
    from (
      select jsonb_build_object(
               'kind', 'customer', 'id', cu.id,
               'title', coalesce(nullif(cu.company_name, ''), cu.contact_person, 'Kund'),
               'site_name', cu.site_name, 'organization_number', cu.organization_number,
               'customer_number', cu.customer_number, 'contract_type', cu.contract_type,
               'is_active', cu.is_active, 'is_multisite', cu.is_multisite, 'site_type', cu.site_type,
               'contact_person', cu.contact_person, 'contact_email', cu.contact_email,
               'contact_phone', cu.contact_phone, 'contact_address', cu.contact_address,
               'price_list_id', cu.price_list_id, 'customer_group_id', cu.customer_group_id,
               'exact', m.exact) as j,
             m.exact, coalesce(cu.is_active, true) as active, m.rank, cu.company_name as name
        from public.customers cu
        cross join lateral (
          select
            public.gs_hay(cu.company_name, cu.site_name, cu.site_code, cu.contact_person, cu.contact_email, cu.contact_phone,
              cu.contact_address, cu.billing_reference, cu.organization_number) as hay
        ) h
        cross join lateral (
          select
            (v_kind = 'number' and (cu.customer_number = v_num
               or exists (select 1 from public.fortnox_customer_numbers f
                           where f.numeric_value = v_num and f.org_digits is not null and length(f.org_digits) >= 10
                             and f.org_digits = right(regexp_replace(coalesce(cu.organization_number, ''), '\D', '', 'g'), 10))))
            or (v_kind = 'orgnr' and right(regexp_replace(coalesce(cu.organization_number, ''), '\D', '', 'g'), 10) = right(v_digits, 10))
            as exact,
            case when v_kind = 'text' then extensions.word_similarity(v_q, h.hay) else 0 end as rank
        ) m
       where case v_kind
         when 'number' then m.exact or lower(coalesce(cu.billing_reference, '')) = v_q
         when 'case' then false
         when 'orgnr' then m.exact
         when 'email' then lower(coalesce(cu.contact_email, '') || ' ' || coalesce(cu.billing_email, '')) like '%' || v_q || '%'
         when 'phone' then regexp_replace(regexp_replace(coalesce(cu.contact_phone, ''), '\D', '', 'g'), '^46', '0') like '%' || v_phone || '%'
         when 'postal' then replace(coalesce(cu.contact_address, ''), ' ', '') like '%' || v_digits || '%'
         else h.hay like v_first and public.gs_all_tokens(h.hay, v_tokens)
       end
       order by m.exact desc, coalesce(cu.is_active, true) desc, m.rank desc, cu.company_name
       limit v_limit
    ) x;

  -- Dokument (offerter och avtal) ----------------------------------------------
  select coalesce(jsonb_agg(x.j order by x.archived, x.rank desc, x.at desc), '[]'::jsonb)
    into r_documents
    from (
      select jsonb_build_object(
               'kind', 'document', 'id', co.id, 'doc_type', co.type,
               'title', coalesce(nullif(co.display_name, ''), nullif(co.label, ''), co.company_name, co.contact_person, 'Dokument'),
               'company_name', co.company_name, 'number', co.quote_reference_number,
               'status', co.status, 'contract_type', co.contract_type,
               'total_value', co.total_value, 'annual_value', co.annual_value,
               'end_date', coalesce(co.effective_end_date, co.contract_end_date),
               'date', co.created_at, 'customer_id', co.customer_id,
               'archived', co.legacy_archived_at is not null) as j,
             co.legacy_archived_at is not null as archived, m.rank, co.created_at as at
        from public.contracts co
        cross join lateral (
          select public.gs_hay(co.company_name, co.display_name, co.label, co.contact_person, co.contact_email,
                   co.organization_number, co.contact_address, co.quote_reference_number, co.begone_employee_name) as hay
        ) h
        cross join lateral (select case when v_kind = 'text' then extensions.word_similarity(v_q, h.hay) else 0 end as rank) m
       where co.status not in ('trashed', 'draft')
         and (p_include_archived or co.legacy_archived_at is null)
         and (v_scope <> 'technician'
              or lower(coalesce(co.begone_employee_email, '')) = any(v_emails)
              or lower(coalesce(co.created_by_email, '')) = any(v_emails))
         and case v_kind
           when 'case' then false
           when 'number' then lower(coalesce(co.quote_reference_number, '')) like '%' || v_q || '%'
           when 'orgnr' then right(regexp_replace(coalesce(co.organization_number, ''), '\D', '', 'g'), 10) = right(v_digits, 10)
           when 'email' then lower(coalesce(co.contact_email, '')) like '%' || v_q || '%'
           when 'phone' then regexp_replace(regexp_replace(coalesce(co.contact_phone, ''), '\D', '', 'g'), '^46', '0') like '%' || v_phone || '%'
           when 'postal' then replace(coalesce(co.contact_address, ''), ' ', '') like '%' || v_digits || '%'
           else h.hay like v_first and public.gs_all_tokens(h.hay, v_tokens)
         end
       order by co.legacy_archived_at is not null, m.rank desc, co.created_at desc
       limit v_limit
    ) x;

  if v_scope in ('admin', 'koordinator') then
    -- Webbleads ------------------------------------------------------------------
    select coalesce(jsonb_agg(x.j order by x.at desc), '[]'::jsonb)
      into r_leads
      from (
        select jsonb_build_object(
                 'kind', 'lead', 'id', wi.id,
                 'title', coalesce(nullif(wi.company_name, ''), nullif(wi.name, ''), 'Förfrågan'),
                 'name', wi.name, 'company_name', wi.company_name, 'number', wi.referens,
                 'status', wi.status, 'pest', wi.pest_type, 'city', coalesce(wi.rattad_ort, wi.city),
                 'date', coalesce(wi.submitted_at, wi.created_at)) as j,
               coalesce(wi.submitted_at, wi.created_at) as at
          from public.web_inquiries wi
          cross join lateral (
            select public.gs_hay(wi.name, wi.company_name, wi.email, wi.phone, wi.address, wi.rattad_adress,
                     wi.postal_code, wi.city, wi.pest_type, wi.referens, wi.organization_number, wi.arende_nummer) as hay
          ) h
         where case v_kind
           when 'case' then coalesce(wi.arende_nummer, '') <> ''
                            and ltrim(regexp_replace(wi.arende_nummer, '\D', '', 'g'), '0') = ltrim(v_digits, '0')
           when 'number' then lower(coalesce(wi.referens, '')) like '%' || v_q || '%'
           when 'orgnr' then right(regexp_replace(coalesce(wi.organization_number, wi.id_nummer, ''), '\D', '', 'g'), 10) = right(v_digits, 10)
           when 'email' then lower(coalesce(wi.email, '')) like '%' || v_q || '%'
           when 'phone' then regexp_replace(regexp_replace(coalesce(wi.phone, ''), '\D', '', 'g'), '^46', '0') like '%' || v_phone || '%'
           when 'postal' then replace(coalesce(wi.rattad_postnummer, wi.postal_code, ''), ' ', '') = v_digits
           else h.hay like v_first and public.gs_all_tokens(h.hay, v_tokens)
         end
         order by coalesce(wi.submitted_at, wi.created_at) desc
         limit v_limit
      ) x;

    -- Tekniker -------------------------------------------------------------------
    select coalesce(jsonb_agg(x.j order by x.active desc, x.name), '[]'::jsonb)
      into r_techs
      from (
        select jsonb_build_object(
                 'kind', 'technician', 'id', t.id, 'title', t.name, 'role', t.role,
                 'email', t.email, 'phone', t.direct_phone, 'is_active', t.is_active) as j,
               coalesce(t.is_active, true) as active, t.name
          from public.technicians t
         where case v_kind
           when 'email' then lower(coalesce(t.email, '')) like '%' || v_q || '%'
           when 'phone' then regexp_replace(regexp_replace(coalesce(t.direct_phone, '') || ' ' || coalesce(t.office_phone, ''), '\D', '', 'g'), '^46', '0') like '%' || v_phone || '%'
           when 'text' then public.gs_all_tokens(public.gs_hay(t.name, t.email, t.role), v_tokens)
           else false
         end
         order by coalesce(t.is_active, true) desc, t.name
         limit v_limit
      ) x;

    -- Fakturor -------------------------------------------------------------------
    select coalesce(jsonb_agg(x.j order by x.exact desc, x.at desc), '[]'::jsonb)
      into r_invoices
      from (
        select jsonb_build_object(
                 'kind', 'invoice', 'id', i.id, 'number', i.invoice_number,
                 'fortnox_number', i.fortnox_document_number,
                 'title', coalesce(i.customer_name, 'Faktura'), 'status', i.status,
                 'total_amount', i.total_amount, 'date', i.created_at, 'paid_at', i.paid_at,
                 'due_date', i.due_date, 'exact', m.exact) as j,
               m.exact, i.created_at as at
          from public.invoices i
          cross join lateral (
            select (v_kind = 'number' and (i.fortnox_document_number = v_digits
                     or regexp_replace(coalesce(i.invoice_number, ''), '\D', '', 'g') = v_digits))
                   or (v_kind = 'text' and lower(coalesce(i.invoice_number, '')) = v_q) as exact
          ) m
         where case v_kind
           when 'number' then m.exact or (length(v_digits) >= 3 and lower(coalesce(i.invoice_number, '')) like '%' || v_q)
           when 'orgnr' then right(regexp_replace(coalesce(i.organization_number, ''), '\D', '', 'g'), 10) = right(v_digits, 10)
           when 'email' then lower(coalesce(i.customer_email, '')) like '%' || v_q || '%'
           when 'text' then public.gs_all_tokens(public.gs_hay(i.invoice_number, i.fortnox_document_number, i.customer_name,
                              i.organization_number, i.invoice_marking), v_tokens)
           else false
         end
         order by m.exact desc, i.created_at desc
         limit v_limit
      ) x;
  end if;

  return jsonb_build_object(
    'scope', v_scope,
    'kind', v_kind,
    'cases', r_cases,
    'customers', r_customers,
    'documents', r_documents,
    'leads', r_leads,
    'technicians', r_techs,
    'invoices', r_invoices
  );
end;
$$;

revoke all on function public.global_search(text, text, boolean, integer) from public, anon;
grant execute on function public.global_search(text, text, boolean, integer) to authenticated;

comment on function public.global_search(text, text, boolean, integer) is
  'Global söklåda (Ctrl+K). Security definer med egen rollkontroll ur profiles: tekniker ser bara egna/delade ärenden och egna dokument, säljare och kunder får tomt svar.';
