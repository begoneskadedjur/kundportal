-- ROT och RUT hela vägen från offert till Fortnox (3.127.0)
-- Bara additiva ändringar: nya kolumner, en ny tjänst och backfill av
-- befintliga ROT/RUT-arbetsrader (labor_for_item_id) med timmarna.

-- Timmar till Skatteverket (visas aldrig för kunden) + bostadsrätt
alter table public.case_billing_items
  add column if not exists house_work_hours numeric,
  add column if not exists brf_org_number text,
  add column if not exists apartment_number text;

comment on column public.case_billing_items.house_work_hours is
  'ROT/RUT: timmar som rapporteras till Skatteverket via Fortnox (HouseWorkHoursToReport). Visas aldrig för kunden.';
comment on column public.case_billing_items.brf_org_number is
  'ROT/RUT i bostadsrätt: föreningens org.nr (i stället för fastighetsbeteckning).';
comment on column public.case_billing_items.apartment_number is
  'ROT/RUT i bostadsrätt: lägenhetsnummer.';

alter table public.invoice_items
  add column if not exists house_work_hours numeric;

comment on column public.invoice_items.house_work_hours is
  'ROT/RUT: timmar till Fortnox (HouseWorkHoursToReport). Saknas: radens antal (äldre rader).';

alter table public.invoices
  add column if not exists brf_org_number text,
  add column if not exists apartment_number text,
  add column if not exists rot_rut_asked_amount numeric,
  add column if not exists rot_rut_fortnox_amount numeric,
  add column if not exists rot_rut_error text,
  add column if not exists rot_rut_claim_status text,
  add column if not exists rot_rut_claim_date date;

alter table public.invoices add constraint invoices_rot_rut_claim_status_check
  check (rot_rut_claim_status is null or rot_rut_claim_status in ('requested', 'paid_out', 'rejected'));

comment on column public.invoices.rot_rut_asked_amount is 'ROT/RUT: begärt avdrag i hela kronor (portalens uträkning).';
comment on column public.invoices.rot_rut_fortnox_amount is 'ROT/RUT: avdraget Fortnox räknade fram när fakturan skapades.';
comment on column public.invoices.rot_rut_error is 'ROT/RUT: fel när avdraget skulle registreras i Fortnox (null = inget fel).';
comment on column public.invoices.rot_rut_claim_status is 'ROT/RUT-begäran hos Skatteverket, manuell markering: requested, paid_out, rejected.';
comment on column public.invoices.rot_rut_claim_date is 'Datum för senaste markeringen av begäran.';

-- Offertens rader vid skapandet, och avvikelse mot Oneflow (webhooken)
alter table public.contracts
  add column if not exists rot_rut_expected jsonb,
  add column if not exists rot_rut_mismatch text;

comment on column public.contracts.rot_rut_expected is 'ROT/RUT-offert: raderna och beloppen portalen skickade till Oneflow.';
comment on column public.contracts.rot_rut_mismatch is 'ROT/RUT-offert: text när Oneflows produkter inte stämmer med portalens rader (null = stämmer).';

-- Ny tjänst: Övriga kostnader. Inaktiv, så den syns inte i tjänstelistor;
-- ROT/RUT-offerten hämtar den med koden.
insert into public.services (code, name, description, group_id, unit, sort_order, is_active, show_in_booking, base_price, rot_eligible, rut_eligible)
select '145', 'Övriga kostnader', 'Rad i ROT/RUT-offert för underentreprenörer och övrigt. Inget avdrag.',
       (select id from public.service_groups where name = 'Övrigt' limit 1),
       'st', 999, false, false, null, false, false
where not exists (select 1 from public.services where code = '145');

-- Befintliga ROT/RUT-arbetsrader: timmarna = antal
update public.case_billing_items
set house_work_hours = quantity
where labor_for_item_id is not null
  and rot_rut_type is not null
  and house_work_hours is null;
