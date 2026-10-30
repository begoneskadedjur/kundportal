-- Backning för 20261030_arbetslista_avtalskartan.sql (steg 10).
-- Dagens definition av addon_pending_refresh_notifications och dagens två
-- triggrar på stationstabellerna, ordagrant ur pg_get_functiondef och
-- pg_get_triggerdef 2026-10-30 före migrationen. Kör hela filen i SQL-editorn.
-- De nya funktionerna (contract_work_items, contract_work_items_internal,
-- addon_station_set_case, addon_coverage_conflict_resolve,
-- work_items_notify_*) kan stå kvar oanvända. De nya triggrarna tas bort av
-- Christian i SQL-editorn om de ska bort:
--   drop trigger trg_work_items_coverage on public.addon_station_coverage;
--   drop trigger trg_work_items_conflicts on public.addon_coverage_conflicts;
--   drop trigger trg_work_items_contract_anchor on public.contracts;

CREATE OR REPLACE FUNCTION public.addon_pending_refresh_notifications(p_root_customer_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  s record;
  p record;
  v_title text;
  v_preview text;
begin
  select * into s from public.addon_pending_summary() where root_customer_id = p_root_customer_id;

  if s.root_customer_id is null then
    update public.notifications
      set is_read = true, read_at = coalesce(read_at, now())
    where case_type = 'customer' and case_id = p_root_customer_id and not is_read
      and title like 'Tillägg att besluta%';
    return;
  end if;

  v_title := 'Tillägg att besluta · ' || s.company_name;
  v_preview := s.stations || ' tilläggsstation' || case when s.stations = 1 then '' else 'er' end
    || ' på ' || s.contracts || ' avtal väntar på beslut om fakturering, '
    || replace(to_char(round(s.annual_kr), 'FM999G999G999'), ',', ' ') || ' kr/år.';

  for p in select id from public.profiles where can_approve_invoices and is_active loop
    update public.notifications
      set title = v_title, preview = v_preview, created_at = now()
    where recipient_id = p.id and case_type = 'customer' and case_id = p_root_customer_id and not is_read
      and title like 'Tillägg att besluta%';
    if not found then
      insert into public.notifications (recipient_id, case_id, case_type, title, preview, case_title, sender_id, sender_name, is_read)
      values (p.id, p_root_customer_id, 'customer', v_title, v_preview, s.company_name, p.id, 'Systemet', false);
    end if;
  end loop;
end;
$function$;

CREATE OR REPLACE TRIGGER trg_equipment_placements_addon_pending AFTER INSERT OR UPDATE OF is_addon, addon_contract_id, status ON public.equipment_placements FOR EACH ROW EXECUTE FUNCTION addon_pending_notify();
CREATE OR REPLACE TRIGGER trg_indoor_stations_addon_pending AFTER INSERT OR UPDATE OF is_addon, addon_contract_id, status ON public.indoor_stations FOR EACH ROW EXECUTE FUNCTION addon_pending_notify();
