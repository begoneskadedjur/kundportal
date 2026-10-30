-- scripts/regression/sql-dump.sql
-- Regressionsskript, steg 1 i docs/planer/avtalsar-exakt-arsdag-teknik.md.
-- Ren SELECT. Körs i SQL-editorn, via MCP execute_sql eller via
-- scripts/regression/sql-dump.mts (som anropar samma funktioner via PostgREST).
--
-- För alla levande avtal (type = 'contract', status signed/active) och sju
-- fasta datum:
--   contract_next_period_start(id, d)       STABLE SECURITY DEFINER, läser bara contracts
--   contract_next_unplanned_period(id, d)   STABLE, läser contracts, invoices, invoice_items
--   next_invoice_replik                      se nedan
--
-- contract_customer_view(id)->>'next_invoice' anropas INTE: funktionen börjar
-- med contract_customer_access(id), som kräver auth-kontext
-- (intranet_is_internal() eller en inloggad kundprofil) och kastar
-- 'Behörighet saknas' för service role och SQL-editorn. Den läser dessutom
-- current_date och tar inget datum. I stället räknas fältet här med exakt
-- samma uttryck som funktionen (kontrollerat med pg_get_functiondef
-- 2026-10-30), med current_date utbytt mot d:
--   if c.billing_anchor_month is not null then
--     v_next_invoice := make_date(extract(year from current_date)::int, c.billing_anchor_month, 1);
--     if v_next_invoice <= current_date then v_next_invoice := (v_next_invoice + interval '1 year')::date; end if;
--   end if;
-- (fältet ligger i jsonb under 'premium', alltså ->'premium'->>'next_invoice'.)
--
-- Ingen funktion här skriver.

with live as (
  select id, billing_anchor_month
  from public.contracts
  where type = 'contract' and status in ('signed', 'active')
),
dates(d) as (
  values (date '2026-10-30'), (date '2026-12-31'), (date '2027-01-01'), (date '2027-02-28'),
         (date '2027-06-30'), (date '2027-07-01'), (date '2028-02-29')
)
select
  l.id as contract_id,
  dates.d as day,
  public.contract_next_period_start(l.id, dates.d) as next_period_start,
  public.contract_next_unplanned_period(l.id, dates.d) as next_unplanned_period,
  case
    when l.billing_anchor_month is null then null
    when make_date(extract(year from dates.d)::int, l.billing_anchor_month, 1) <= dates.d
      then (make_date(extract(year from dates.d)::int, l.billing_anchor_month, 1) + interval '1 year')::date
    else make_date(extract(year from dates.d)::int, l.billing_anchor_month, 1)
  end as next_invoice_replik
from live l
cross join dates
order by l.id, dates.d;

-- Kontrollsumma (samma som sql-dump.mts skriver i meta.md5): kör frågan ovan
-- som delfråga q och sedan
--   select count(*), md5(string_agg(contract_id || '|' || day || '|' || coalesce(next_period_start::text, '')
--     || '|' || coalesce(next_unplanned_period::text, '') || '|' || coalesce(next_invoice_replik::text, ''),
--     E'\n' order by contract_id, day)) from q;
