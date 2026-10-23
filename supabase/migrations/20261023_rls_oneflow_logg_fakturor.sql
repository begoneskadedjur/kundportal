-- 2026-10-23: två RLS-luckor åtgärdade utan att personalens flöden tappar något.
--
-- Körd mot databasen i fyra steg (rls_oneflow_logg_fakturor,
-- invoices_assign_free_number_fix_lpad, invoices_assign_free_number_count_series,
-- rls_fakturor_tekniker_mangdbaserad). Filen visar slutläget och är
-- idempotent bortsett från CREATE POLICY.
--
-- 1. oneflow_sync_log: alla inloggade (även kunder) läste hela loggen med
--    payload, och vem som helst (även anon) kunde skriva i den. Enda läsaren i
--    klienten är admin-sidan /admin/avtalsdiagnostik (useOneflowWebhook). Enda
--    skrivaren är api/oneflow/webhook.ts med service role. min_kundresa läser
--    via SECURITY DEFINER och påverkas inte.
--    Nu: SELECT bara för admin/koordinator (my_case_scope().is_staff, räknar
--    is_admin, is_koordinator och extra_roles). INSERT bara service_role.
--
-- 2. invoices: inv_internal_all gav ALLA tekniker ALL på alla fakturor.
--    invoice_items: "Allow all for authenticated users" gav ALLA inloggade,
--    även kunder, säljare och multisite-användare, ALL på alla fakturarader.
--    Nu: admin/koordinator (inkl. tekniker med is_admin/extra_roles) oförändrat.
--    Kunder läser sina fakturor som förut och nu bara raderna på dem.
--    Tekniker (profiles.role = technician):
--      läsa   fakturor på ärenden där de är tekniker 1-3 (avtalsärende även
--             skapare, privat/företag även omnämnd i kommentar), samt
--             ärendelösa fakturor (avtal, månadsbatch) hos kunder där de har
--             ett avtalsärende, inkl. enhetens huvudkontor
--      skapa  på eget ärende (tekniker 1-3) eller månadsbatch (adhoc) hos egen kund
--      ändra  samma urval, bara status draft/pending_approval/ready
--      radera bara eget ärendes oskickade faktura utan Fortnox-nummer
--             (upsertInvoiceFromCase ersätter utkastet)
--
-- Inga borttagningar: befintliga policyer snävas med ALTER POLICY, nya läggs till.

-- ─── Hjälpfunktioner (mängdbaserade, en gång per fråga) ───────────────────
-- Radvisa funktionsanrop i policyn gav ~0,8 s för count(*) på invoices även
-- för admin (alla permissiva policyer utvärderas). Policyerna jämför därför
-- mot arrayer: (select f())::uuid[] blir en initplan.

create or replace function public.my_technician_case_ids(p_for_write boolean)
returns uuid[]
language sql
stable
security definer
set search_path to ''
as $fn$
  with t as (select s.technician_id as tid from public.my_case_scope() s),
       me as (select p.id from public.profiles p where p.user_id = (select auth.uid()))
  select coalesce(array_agg(distinct x.id), array[]::uuid[]) from (
    select c.id from public.cases c, t
     where t.tid in (c.primary_technician_id, c.secondary_technician_id, c.tertiary_technician_id)
    union all
    select c.id from public.private_cases c, t
     where t.tid in (c.primary_assignee_id, c.secondary_assignee_id, c.tertiary_assignee_id)
    union all
    select c.id from public.business_cases c, t
     where t.tid in (c.primary_assignee_id, c.secondary_assignee_id, c.tertiary_assignee_id)
    union all
    -- bara läsning: skapare av avtalsärende, omnämnd i ärendekommentar
    select c.id from public.cases c, t
     where not p_for_write and c.created_by_technician_id = t.tid
    union all
    select cc.case_id from public.case_comments cc, me, t
     where not p_for_write and t.tid is not null and me.id = any (cc.mentioned_user_ids)
  ) x(id);
$fn$;

-- Kunder där teknikern har ett avtalsärende, plus huvudkontoret för enheter
create or replace function public.my_technician_customer_ids()
returns uuid[]
language sql
stable
security definer
set search_path to ''
as $fn$
  with t as (select s.technician_id as tid from public.my_case_scope() s)
  select coalesce(array_agg(distinct x.id), array[]::uuid[]) from (
    select c.customer_id from public.cases c, t
     where t.tid in (c.primary_technician_id, c.secondary_technician_id, c.tertiary_technician_id)
       and c.customer_id is not null
    union all
    select cu.parent_customer_id from public.cases c
      join public.customers cu on cu.id = c.customer_id, t
     where t.tid in (c.primary_technician_id, c.secondary_technician_id, c.tertiary_technician_id)
       and cu.parent_customer_id is not null
  ) x(id);
$fn$;

revoke all on function public.my_technician_case_ids(boolean) from public, anon;
revoke all on function public.my_technician_customer_ids() from public, anon;
grant execute on function public.my_technician_case_ids(boolean) to authenticated, service_role;
grant execute on function public.my_technician_customer_ids() to authenticated, service_role;

-- Radvis variant av samma regel (för kontroller i SQL), används inte i policyerna
create or replace function public.technician_invoice_access(
  p_case_id uuid, p_customer_id uuid, p_invoice_type text, p_for_write boolean
) returns boolean
language sql
stable
security definer
set search_path to ''
as $fn$
  select case
    when p_case_id is not null then p_case_id = any (public.my_technician_case_ids(p_for_write))
    when p_customer_id is null then false
    when p_for_write and coalesce(p_invoice_type, '') <> 'adhoc' then false
    else p_customer_id = any (public.my_technician_customer_ids())
  end;
$fn$;

revoke all on function public.technician_invoice_access(uuid, uuid, text, boolean) from public, anon;
grant execute on function public.technician_invoice_access(uuid, uuid, text, boolean) to authenticated, service_role;

-- ─── 1. oneflow_sync_log ───────────────────────────────────────────────────

alter policy "Users can view webhook logs" on public.oneflow_sync_log
  to authenticated
  using ((select s.is_staff from public.my_case_scope() s));

alter policy "Service role can insert webhook logs" on public.oneflow_sync_log
  to service_role
  with check (true);

-- ─── 2a. invoices ──────────────────────────────────────────────────────────

-- Personal: oförändrat ALL (tekniker borttagna ur villkoret)
alter policy inv_internal_all on public.invoices
  using ((select s.is_staff from public.my_case_scope() s))
  with check ((select s.is_staff from public.my_case_scope() s));

-- Läsare: CaseHistoryPanel, VisitHistoryPanel, TechnicianCases,
-- TechnicianCustomerJourney, upsertInvoiceFromCase-uppslaget,
-- generateAdhocInvoiceForCase (månadsbatch), ContractAdditionService (låsta perioder)
create policy inv_technician_select on public.invoices
  for select to authenticated
  using ((case_id is not null and case_id = any ((select public.my_technician_case_ids(false))::uuid[]))
      or (case_id is null and customer_id = any ((select public.my_technician_customer_ids())::uuid[])));

-- createInvoiceFromCase, per_case-merförsäljning, månadsbatch
create policy inv_technician_insert on public.invoices
  for insert to authenticated
  with check ((case_id is not null and case_id = any ((select public.my_technician_case_ids(true))::uuid[]))
      or (case_id is null and invoice_type = 'adhoc' and customer_id = any ((select public.my_technician_customer_ids())::uuid[])));

-- recalculateInvoiceTotals på månadsbatchen
create policy inv_technician_update on public.invoices
  for update to authenticated
  using (status in ('draft', 'pending_approval', 'ready')
         and ((case_id is not null and case_id = any ((select public.my_technician_case_ids(true))::uuid[]))
           or (case_id is null and invoice_type = 'adhoc' and customer_id = any ((select public.my_technician_customer_ids())::uuid[]))))
  with check (status in ('draft', 'pending_approval', 'ready')
         and ((case_id is not null and case_id = any ((select public.my_technician_case_ids(true))::uuid[]))
           or (case_id is null and invoice_type = 'adhoc' and customer_id = any ((select public.my_technician_customer_ids())::uuid[]))));

-- upsertInvoiceFromCase raderar eget ärendes oskickade utkast
create policy inv_technician_delete on public.invoices
  for delete to authenticated
  using (case_id is not null
         and case_id = any ((select public.my_technician_case_ids(true))::uuid[])
         and status in ('draft', 'pending_approval', 'ready')
         and fortnox_document_number is null);

-- ─── 2b. invoice_items ─────────────────────────────────────────────────────

alter policy "Allow all for authenticated users" on public.invoice_items
  using ((select s.is_staff from public.my_case_scope() s))
  with check ((select s.is_staff from public.my_case_scope() s));
alter policy "Allow all for authenticated users" on public.invoice_items
  rename to ii_internal_all;

-- Kund/multisite: raderna på de fakturor de redan får läsa (inv_customer_read)
create policy ii_customer_read on public.invoice_items
  for select to authenticated
  using (invoice_id in (select i.id from public.invoices i
                         where i.customer_id = any ((select public.my_scope_customer_ids())::uuid[])));

create policy ii_technician_select on public.invoice_items
  for select to authenticated
  using (invoice_id in (select i.id from public.invoices i
                         where (i.case_id is not null and i.case_id = any ((select public.my_technician_case_ids(false))::uuid[]))
                            or (i.case_id is null and i.customer_id = any ((select public.my_technician_customer_ids())::uuid[]))));

-- Rader läggs bara på oskickade fakturor (createInvoiceFromCase, addItemsToAdhocInvoice)
create policy ii_technician_insert on public.invoice_items
  for insert to authenticated
  with check (invoice_id in (select i.id from public.invoices i
                              where i.status in ('draft', 'pending_approval', 'ready')
                                and ((i.case_id is not null and i.case_id = any ((select public.my_technician_case_ids(true))::uuid[]))
                                  or (i.case_id is null and i.invoice_type = 'adhoc' and i.customer_id = any ((select public.my_technician_customer_ids())::uuid[])))));

-- Uppdatering: oskickad faktura, eller frikoppling från ärenderaden
-- (CaseBillingService.removeCaseArticle sätter case_billing_item_id = null
-- även på låsta fakturor, annars stoppar FK:n raderingen av ärenderaden)
create policy ii_technician_update on public.invoice_items
  for update to authenticated
  using (invoice_id in (select i.id from public.invoices i
                         where (i.case_id is not null and i.case_id = any ((select public.my_technician_case_ids(true))::uuid[]))
                            or (i.case_id is null and i.invoice_type = 'adhoc' and i.customer_id = any ((select public.my_technician_customer_ids())::uuid[]))))
  with check (invoice_id in (select i.id from public.invoices i
                              where ((i.case_id is not null and i.case_id = any ((select public.my_technician_case_ids(true))::uuid[]))
                                  or (i.case_id is null and i.invoice_type = 'adhoc' and i.customer_id = any ((select public.my_technician_customer_ids())::uuid[])))
                                and (i.status in ('draft', 'pending_approval', 'ready')
                                     or invoice_items.case_billing_item_id is null)));
-- Ingen DELETE-policy för tekniker: raderna försvinner via ON DELETE CASCADE
-- när upsertInvoiceFromCase raderar utkastet.

-- ─── 2c. Fakturanummer ─────────────────────────────────────────────────────
-- Klienten räknar fram nästa INV-ÅÅÅÅMM-nnnn ur det den ser: InvoiceService
-- count(serien)+1 med kontroll och reservnummer ur Date.now() (6 siffror),
-- ContractInvoiceGenerator max+1. En tekniker ser nu bara sina fakturor och
-- skulle få ett upptaget nummer eller reservnumret. Krockar numret, eller är
-- det ett reservnummer, sätter triggern samma nummer som personalen hade fått
-- (count(serien)+1) och annars nästa lediga efter högsta löpnumret. Lediga
-- nummer lämnas orörda. Gäller alla roller; för personal ersätter det bara ett
-- unique-fel eller ett reservnummer.

create or replace function public.invoices_assign_free_number()
returns trigger
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_prefix text;
  v_next text;
begin
  if new.invoice_number ~ '^INV-[0-9]{6}-[0-9]+$'
     and (new.invoice_number ~ '^INV-[0-9]{6}-[0-9]{6,}$'
          or exists (select 1 from public.invoices i where i.invoice_number = new.invoice_number)) then
    v_prefix := substring(new.invoice_number from '^(INV-[0-9]{6})-');
    perform pg_advisory_xact_lock(hashtext('invoice_number:' || v_prefix));
    select (count(*) + 1)::text into v_next
      from public.invoices i where i.invoice_number like v_prefix || '-%';
    -- lpad kortar strängar längre än längden, därav greatest
    v_next := v_prefix || '-' || lpad(v_next, greatest(4, length(v_next)), '0');
    if exists (select 1 from public.invoices i where i.invoice_number = v_next) then
      -- Löpnummer med 1-5 siffror (oktober 2026 är redan femsiffrigt);
      -- reservnummer (6+ siffror) räknas inte in
      select (coalesce(max(substring(i.invoice_number from '-([0-9]{1,5})$')::int), 0) + 1)::text
        into v_next
        from public.invoices i
       where i.invoice_number ~ ('^' || v_prefix || '-[0-9]{1,5}$');
      v_next := v_prefix || '-' || lpad(v_next, greatest(4, length(v_next)), '0');
    end if;
    new.invoice_number := v_next;
  end if;
  return new;
end;
$fn$;

create or replace trigger trg_invoices_assign_free_number
  before insert on public.invoices
  for each row execute function public.invoices_assign_free_number();
