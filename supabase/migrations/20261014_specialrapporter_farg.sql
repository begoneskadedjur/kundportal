-- 20261014_specialrapporter_farg.sql
-- Specialrapporter 3.51.0: varje del (sektion) har en egen färg som syns på
-- kartan, i redigeraren och i PDF:en. Befintliga delar får färger i tur och
-- ordning efter sin position i rapporten.

alter table public.special_report_sections
  add column if not exists color text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'special_report_sections_color_check'
      and conrelid = 'public.special_report_sections'::regclass
  ) then
    alter table public.special_report_sections
      add constraint special_report_sections_color_check
      check (color is null or color ~ '^#[0-9a-fA-F]{6}$');
  end if;
end;
$$;

-- Palett: grön, blå, orange, rosa, lila, cyan, röd, gul
update public.special_report_sections s
set color = (array['#20c58f', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444', '#eab308'])[
  ((x.rn - 1) % 8) + 1
]
from (
  select id, row_number() over (partition by report_id order by position, created_at) as rn
  from public.special_report_sections
) x
where x.id = s.id and s.color is null;
