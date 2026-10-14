-- 20261014_specialrapporter_avvikelse.sql
-- Specialrapporter 3.54.0: ny händelsetyp "avvikelse". Regeln byts mot en som
-- tillåter allt den gamla gjorde plus avvikelse, så ingen befintlig rad påverkas.

alter table public.special_report_events drop constraint if exists special_report_events_type_check;
alter table public.special_report_events add constraint special_report_events_type_check
  check (type in ('inspektion', 'besok', 'betning', 'atgard', 'underlev', 'notering', 'avvikelse'));
