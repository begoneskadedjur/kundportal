-- Godkännanden för rabattansvariga i alla roller (2026-10-26).
-- Sidan Godkännanden finns nu i admin-, koordinator- och säljarportalen och visas
-- för den som har profiles.can_approve_discounts. Säljaren når inte fakturor via
-- de vanliga policyerna (my_case_scope.is_staff), så rabattansvariga får läsa och
-- godkänna fakturor som väntar på godkännande, deras rader och underlaget som
-- sidan visar (rabattrader, avtalstillägg, kunden). Inget annat öppnas.

create policy "Rabattansvariga läser väntande fakturor" on public.invoices
  for select to authenticated
  using (public.can_approve_discounts() and status = 'pending_approval');

create policy "Rabattansvariga godkänner väntande fakturor" on public.invoices
  for update to authenticated
  using (public.can_approve_discounts() and status = 'pending_approval')
  with check (public.can_approve_discounts() and status in ('pending_approval', 'ready'));

create policy "Rabattansvariga läser rader i väntande fakturor" on public.invoice_items
  for select to authenticated
  using (public.can_approve_discounts() and invoice_id in (
    select i.id from public.invoices i where i.status = 'pending_approval'));

create policy "Rabattansvariga läser rabattrader och avtalstillägg" on public.case_billing_items
  for select to authenticated
  using (public.can_approve_discounts()
         and (coalesce(discount_percent, 0) > 0 or contract_addition_annual is not null));

create policy "Rabattansvariga läser avtalstillägg" on public.contract_additions
  for select to authenticated
  using (public.can_approve_discounts());

create policy "Rabattansvariga läser kunder med väntande fakturor" on public.customers
  for select to authenticated
  using (public.can_approve_discounts() and id in (
    select i.customer_id from public.invoices i where i.status = 'pending_approval'));
