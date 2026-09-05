-- Teknikern arbetar i ärendemodalerna och avslutet fyller på kundgruppen på
-- en befintlig engångskund (getOrCreateCaseCustomer). UPDATE på customers
-- var admin/koordinator/säljare, så ändringen blev en tyst no-op.
-- Samma avgränsning som insert: aldrig multisite-enheter.
drop policy if exists customers_technician_update on public.customers;
create policy customers_technician_update on public.customers
  for update to authenticated
  using ((select s.technician_id is not null from my_case_scope() s) and parent_customer_id is null)
  with check ((select s.technician_id is not null from my_case_scope() s) and parent_customer_id is null);

-- case_preparations matchade profiles.id = auth.uid() i stället för
-- profiles.user_id. Alla tekniker har i dag id = user_id, men 7 av 26
-- profiler har inte det, så första teknikern med avvikande id skulle inte
-- kunna registrera preparat. Samma rättelse som gjordes för
-- equipment_placements och station_types.
drop policy if exists insert_staff on public.case_preparations;
create policy insert_staff on public.case_preparations
  for insert to authenticated
  with check (exists (select 1 from profiles where profiles.user_id = auth.uid()
                      and profiles.role in ('admin', 'koordinator', 'technician')));

drop policy if exists update_staff on public.case_preparations;
create policy update_staff on public.case_preparations
  for update to authenticated
  using (
    exists (select 1 from profiles where profiles.user_id = auth.uid() and profiles.role in ('admin', 'koordinator'))
    or applied_by_technician_id = (select profiles.technician_id from profiles where profiles.user_id = auth.uid())
  );

drop policy if exists delete_staff on public.case_preparations;
create policy delete_staff on public.case_preparations
  for delete to authenticated
  using (exists (select 1 from profiles where profiles.user_id = auth.uid()
                 and profiles.role in ('admin', 'koordinator', 'technician')));
