-- Frånvaro för flera tekniker som en händelse (3.108.0).
-- Varje tekniker har kvar sin egen rad i technician_absences; rader som hör
-- ihop (t.ex. teknikermöte) får samma group_id. title är rubriken på blocket.
-- Körd mot produktion 2026-10-29 som migrationen technician_absences_group_title.

alter table public.technician_absences add column if not exists group_id uuid, add column if not exists title text;
create index if not exists technician_absences_group_id_idx on public.technician_absences (group_id) where group_id is not null;
comment on column public.technician_absences.group_id is 'Samma värde på rader som skapades tillsammans för flera tekniker (t.ex. teknikermöte). Varje tekniker har kvar sin egen rad.';
comment on column public.technician_absences.title is 'Rubrik som visas på blocket i schemat. Tom = typen (reason) visas.';

-- Engångsdata 2026-10-29 (körd separat): teknikermötena 2026-10-06 (2 rader) och
-- 2026-11-02 (9 rader) fick varsitt group_id, reason 'Möte' och title 'Teknikermöte'.
-- Mötet 2026-11-02 08:00-09:00 flyttades samtidigt till 2026-11-03 08:00-09:00.
