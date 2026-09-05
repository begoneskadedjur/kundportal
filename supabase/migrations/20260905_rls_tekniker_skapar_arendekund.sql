-- Teknikerns avslut av privat- och företagsärenden skapar kundraden
-- (CaseCustomerService.getOrCreateCaseCustomer) innan fakturan byggs.
-- INSERT på customers var admin/koordinator/säljare: för en NY kund föll
-- avslutet med "new row violates row-level security policy", ingen faktura
-- skapades och ärendet syntes aldrig på /admin/fakturering.
-- Verifierat 2026-09-05 som teknikerroll.
drop policy if exists customers_technician_insert on public.customers;
create policy customers_technician_insert on public.customers
  for insert to authenticated
  with check (
    (select s.technician_id is not null from my_case_scope() s)
    -- Tekniker skapar bara engångskunder, aldrig multisite-enheter
    and parent_customer_id is null
  );
