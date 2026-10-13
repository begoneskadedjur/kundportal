-- commission_settings: bara admin får skriva (2026-10-13)
--
-- Tidigare kunde alla inloggade (även kunder) läsa och uppdatera
-- provisionsinställningarna, inklusive tipsbonusen (tipsbonus_*), via API:t.
--
-- Nu:
--   SELECT  intern personal (intranet_is_internal(): admin, koordinator,
--           tekniker, säljare med aktivt konto). Kunder läser inte längre.
--   UPDATE  bara admin (is_current_user_admin(): profiles.user_id = auth.uid()
--           och is_admin = true).
--   INSERT/DELETE  bara admin (fanns ingen policy tidigare, alltså nekat för
--           alla; nu uttryckligen admin).
--
-- Funktionerna som läser tabellen i databasen (tipsbonus_installning,
-- compute_payout_month) är SECURITY DEFINER och påverkas inte.
-- Inga DROP-satser: befintliga policies ändras med ALTER POLICY.

alter policy "Authenticated users can update commission_settings"
  on public.commission_settings
  to authenticated
  using ((select public.is_current_user_admin()))
  with check ((select public.is_current_user_admin()));

alter policy "Authenticated users can update commission_settings"
  on public.commission_settings
  rename to commission_settings_admin_update;

alter policy "Authenticated users can read commission_settings"
  on public.commission_settings
  to authenticated
  using ((select public.intranet_is_internal()));

alter policy "Authenticated users can read commission_settings"
  on public.commission_settings
  rename to commission_settings_personal_select;

create policy commission_settings_admin_insert
  on public.commission_settings
  for insert
  to authenticated
  with check ((select public.is_current_user_admin()));

create policy commission_settings_admin_delete
  on public.commission_settings
  for delete
  to authenticated
  using ((select public.is_current_user_admin()));
