-- Fyra behörighetsluckor åtgärdas och 41 gamla avslut får avslutsdatum (3.89.1).
--
-- 1. case_comments: teknikern läste alla kommentarer. Nu läser teknikern kommentarer
--    på ärenden hen är delaktig i (tilldelad, besök, skapat avtalsärendet) och på
--    ärenden där hen är inblandad i kommunikationen (skrivit, nämnd som person,
--    rollen Tekniker eller Alla). Admin, koordinator och säljare som förut.
--    Läskvittona följer kommentaren.
-- 2. Bucketen comment-attachments blir privat. Appen hämtar signerade adresser
--    (useBilagaUrl); lagringspolicyn kräver redan intern användare.
-- 3. notifications: bara personal får skapa notiser till vem som helst. Kunder får
--    bara skriva till personal (buggrapporten). Avsändaren sätts alltid till den
--    inloggade, så att ingen kan skicka i någon annans namn.
-- 4. case_billing_items: cbi_internal_all gav tekniker och säljare alla rader.
--    Skriva: admin/koordinator alla, tekniker på ärenden hen är delaktig i, säljare
--    bara avtalsrader (avtalskartan). Läsa: dessutom tekniker för sina kunders
--    avtalsrader och säljare allt (säljaren ser alla ärenden).
-- 5. Bakåtfyllnad av completed_date för 41 avslutade ärenden utan datum: senaste
--    besöket, annars senaste ändringen.
--
-- Inga DROP: policyerna skrivs om med ALTER POLICY.

-- ─── Hjälpfunktioner ───

create or replace function public.my_comment_case_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select p.id as pid, p.technician_id as tid
      from public.profiles p
     where p.user_id = (select auth.uid())
       and p.role::text = 'technician'
       and p.technician_id is not null
     limit 1
  )
  select coalesce(array_agg(distinct x.id), array[]::uuid[]) from (
    select unnest(public.my_technician_case_ids(false)) from me
    union all
    select v.case_id from public.visits v, me
     where v.case_id is not null
       and (v.technician_id = me.tid
            or v.technicians @> jsonb_build_array(jsonb_build_object('id', me.tid::text)))
    union all
    select cc.case_id from public.case_comments cc, me
     where cc.author_id = (select auth.uid())
        or me.pid = any (cc.mentioned_user_ids)
        or cc.mentions_all
        or 'technician' = any (cc.mentioned_roles)
  ) x(id);
$$;

create or replace function public.my_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.profiles p where p.user_id = (select auth.uid()) limit 1;
$$;

create or replace function public.ar_intern_profil(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select p.role::text in ('admin', 'koordinator', 'technician', 'säljare')
      from public.profiles p where p.id = p_profile_id
  ), false);
$$;

create or replace function public.tekniker_far_skriva_fakturarad(p_case_id uuid, p_case_type text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.tekniker_delaktig_i_arende(p_case_id, p_case_type)
      or (p_case_type = 'contract' and exists (
            select 1 from public.cases c, public.my_case_scope() s
             where c.id = p_case_id
               and s.technician_id is not null
               and c.created_by_technician_id = s.technician_id));
$$;

grant execute on function public.my_comment_case_ids() to authenticated;
grant execute on function public.my_profile_id() to authenticated;
grant execute on function public.ar_intern_profil(uuid) to authenticated;
grant execute on function public.tekniker_far_skriva_fakturarad(uuid, text) to authenticated;
revoke execute on function public.my_comment_case_ids() from anon;
revoke execute on function public.my_profile_id() from anon;
revoke execute on function public.ar_intern_profil(uuid) from anon;
revoke execute on function public.tekniker_far_skriva_fakturarad(uuid, text) from anon;

-- ─── 1. Kommentarer och läskvitton ───

alter policy "Users can view all comments" on public.case_comments
  using (
    (select public.is_internal_user())
    and (
      (select s.is_staff or s.is_sales from public.my_case_scope() s)
      or case_id in (select unnest(public.my_comment_case_ids()))
      -- Raden själv: gäller även en ny tråd som returneras i samma insert
      or author_id = (select auth.uid())
      or (select public.my_profile_id()) = any (mentioned_user_ids)
      or mentions_all
      or 'technician' = any (mentioned_roles)
    )
  );

alter policy "Alla kan se läsbekräftelser" on public.comment_read_receipts
  using (
    (select public.is_internal_user())
    and exists (select 1 from public.case_comments c where c.id = comment_read_receipts.comment_id)
  );

-- ─── 2. Bilagor ───

update storage.buckets set public = false where id = 'comment-attachments';

-- ─── 3. Notiser ───

create or replace function public.notis_satt_avsandare()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Bara direkta anrop från appen (därför inte security definer: current_user är
  -- då den inloggades roll). Systemfunktioner och service role sätter avsändaren själva.
  -- Det rättar också notiser som i dag fälls av not null/främmande nyckel
  -- (rabattsvar utan avsändare, rabattbegäran med tekniker-id, kunder vars
  -- profil-id skiljer sig från inloggnings-id).
  if current_user = 'authenticated' and (select auth.uid()) is not null then
    new.sender_id := public.my_profile_id();
  end if;
  return new;
end;
$$;

create trigger a_notis_satt_avsandare
  before insert on public.notifications
  for each row execute function public.notis_satt_avsandare();

alter policy "Users can create notifications" on public.notifications
  with check (
    (select public.is_internal_user())
    or public.ar_intern_profil(recipient_id)
  );

-- ─── 4. Faktureringsrader ───

-- Skrivregeln (ALL gäller både läsa och skriva)
alter policy cbi_internal_all on public.case_billing_items
  using (
    (select s.is_staff from public.my_case_scope() s)
    or ((select s.is_sales from public.my_case_scope() s)
        and case_type = 'contract'
        and exists (select 1 from public.contracts k where k.id = case_billing_items.case_id))
    or ((select s.technician_id from public.my_case_scope() s) is not null
        and public.tekniker_far_skriva_fakturarad(case_id, case_type))
  )
  with check (
    (select s.is_staff from public.my_case_scope() s)
    or ((select s.is_sales from public.my_case_scope() s)
        and case_type = 'contract'
        and exists (select 1 from public.contracts k where k.id = case_billing_items.case_id))
    or ((select s.technician_id from public.my_case_scope() s) is not null
        and public.tekniker_far_skriva_fakturarad(case_id, case_type))
  );

-- Läsregeln utöver skrivregeln
create policy cbi_internal_read on public.case_billing_items
  for select to authenticated
  using (
    (select s.is_sales from public.my_case_scope() s)
    or ((select s.technician_id from public.my_case_scope() s) is not null
        and (case_id in (select unnest(public.my_technician_case_ids(false)))
             or customer_id in (select unnest(public.my_technician_customer_ids()))
             or site_customer_id in (select unnest(public.my_technician_customer_ids()))))
  );

-- ─── 5. Avslutsdatum för gamla avslut ───

with senaste_besok as (
  select v.case_id, v.case_type, max(coalesce(v.completed_date, v.visit_date)) as datum
    from public.visits v
   group by v.case_id, v.case_type
)
update public.private_cases pc
   set completed_date = coalesce(sb.datum, pc.updated_at)
  from (select id from public.private_cases where status = 'Avslutat' and completed_date is null) m
  left join senaste_besok sb on sb.case_id = m.id and sb.case_type = 'private'
 where pc.id = m.id;

with senaste_besok as (
  select v.case_id, v.case_type, max(coalesce(v.completed_date, v.visit_date)) as datum
    from public.visits v
   group by v.case_id, v.case_type
)
update public.business_cases bc
   set completed_date = coalesce(sb.datum, bc.updated_at)
  from (select id from public.business_cases where status = 'Avslutat' and completed_date is null) m
  left join senaste_besok sb on sb.case_id = m.id and sb.case_type = 'business'
 where bc.id = m.id;

-- cases har inga besök bland de sju; updated_at sparas före triggern skriver om den
update public.cases c
   set completed_date = c.updated_at
 where c.status = 'Avslutat' and c.completed_date is null;
