-- 20261001_teknikernamn_inte_epost_data.sql
--
-- Teknikerns e-postadress hade skrivits som namn när etableringen och
-- stationsutsättningen skickade profilens "full_name || email" (full_name
-- finns inte på profilen, så det blev alltid e-posten). Koden hämtar nu
-- namnet ur technicians-tabellen. Här rättas raderna som redan skrivits:
-- namnet slås upp via teknikerns id. Rader utan id rörs inte.

update public.case_billing_items k
set added_by_technician_name = t.name
from public.technicians t
where t.id = k.added_by_technician_id
  and k.added_by_technician_name like '%@%'
  and coalesce(trim(t.name), '') <> '';

update public.case_preparations p
set applied_by_technician_name = t.name
from public.technicians t
where t.id = p.applied_by_technician_id
  and p.applied_by_technician_name like '%@%'
  and coalesce(trim(t.name), '') <> '';
