-- 20261016_fonster_mot_basavtal.sql
-- Upphandlingsportalen 3.66.0: bearbetningsfönstret (18 till 12 månader före
-- slut) räknas mot basavtalets slut, inte mot sista möjliga slut med
-- förlängningsoptioner (beslut 2026-10-16). Bara uppdatering av beräknade
-- fält, inget tas bort.
--
--   1. window_start och window_end räknas om mot coalesce(base_end_date,
--      calc_end_date), samma regel som contractWorkWindow i
--      src/shared/procurementRules.ts.
--   2. Avtal som efter ändringen redan är i eller förbi fönstret märks som
--      notifierade (samma mekanism som 20261016_avtalsklocka_optioner_kontakter_egna_poster.sql),
--      så att nästa körning av procurement-deadlines inte skickar en hög notiser.

update public.procurement_awards
set window_start = (coalesce(base_end_date, calc_end_date) - interval '18 months')::date,
    window_end = (coalesce(base_end_date, calc_end_date) - interval '12 months')::date
where window_start is distinct from (coalesce(base_end_date, calc_end_date) - interval '18 months')::date
   or window_end is distinct from (coalesce(base_end_date, calc_end_date) - interval '12 months')::date;

update public.procurement_awards
set window_notified_at = now()
where window_notified_at is null
  and coalesce(corrected_end_date, base_end_date, calc_end_date) is not null
  and (coalesce(corrected_end_date, base_end_date, calc_end_date) - interval '18 months')::date <= (now() at time zone 'Europe/Stockholm')::date;
