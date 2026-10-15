-- 20261015_arbetsrad_rot_rut_koppling.sql
-- Arbetsrad för ROT/RUT kopplad till sin tjänsterad.
--
-- Privatärenden: ROT/RUT-avdrag får bara ligga på arbetstidstjänsten (135).
-- När en paketprisad tjänst delas upp blir arbetsdelen en egen rad med
-- tjänst 135 som pekar på tjänsteraden via labor_for_item_id. UI:t visar
-- tjänsten med totalpriset (tjänsterad + arbetsrad) och arbetsandelen
-- inskjuten under. Fakturan lägger arbetsraden direkt efter tjänsteraden.
--
-- Raderas tjänsteraden försvinner arbetsraden med den (on delete cascade).
--
-- RLS: policyn cbi_internal_all (for all, staff/säljare/tekniker) täcker
-- alla kolumner, så insert/update av kolumnen kräver ingen policyändring.
--
-- Idempotent: inga DROP.

alter table public.case_billing_items
  add column if not exists labor_for_item_id uuid
    references public.case_billing_items(id) on delete cascade;

create index if not exists idx_case_billing_items_labor_for_item_id
  on public.case_billing_items (labor_for_item_id)
  where labor_for_item_id is not null;

comment on column public.case_billing_items.labor_for_item_id is
  'Arbetsrad för ROT/RUT som hör till tjänsteraden: id på tjänsteraden vars arbetskostnad raden bär. Null = vanlig rad.';
