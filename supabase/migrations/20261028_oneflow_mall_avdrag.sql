-- Mallen bestämmer ROT/RUT-avdraget i Skapa avtal eller offert (3.106.0).
-- Oneflow-mallarna har hårdkodad text om avdraget: ROT-mallen söker 30 % och
-- RUT-mallen 50 % av arbetskostnaden. Kolumnen säger vilket avdrag mallen bär,
-- null = mallen har inget avdrag. Bara tillägg, inga DROP eller DELETE.
-- Körd 2026-10-28 via apply_migration (oneflow_templates_deduction_type).
alter table public.oneflow_templates
  add column if not exists deduction_type text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'oneflow_templates_deduction_type_check'
  ) then
    alter table public.oneflow_templates
      add constraint oneflow_templates_deduction_type_check
      check (deduction_type is null or deduction_type in ('ROT', 'RUT'));
  end if;
end $$;

comment on column public.oneflow_templates.deduction_type is
  'ROT eller RUT om mallens text söker det avdraget, null = inget avdrag. Styr vilket avdrag som kan väljas i Skapa avtal eller offert.';

update public.oneflow_templates set deduction_type = 'ROT'
 where oneflow_template_id = '8919012' and deduction_type is null;
update public.oneflow_templates set deduction_type = 'RUT'
 where oneflow_template_id = '8919059' and deduction_type is null;
