-- Städning (3.132.16): två provisionsposter i pending_invoice låg kvar på ett
-- borttaget företagsärende utan faktura. Ny regel från 2026-11-23: borttaget
-- ärende har ingen väntande provision (se 20261123_stryk_vantande_provision_vid_borttagning.sql,
-- där posterna står i sin helhet så att de går att återskapa).
--
-- EJ KÖRD: apply_migration nekade raderingen 2026-11-23. Körs efter Christians ja.
-- Kontroll före körning: båda raderna ska fortfarande ha status pending_invoice
-- och ärendet dd1f1abd-45cf-420b-816c-1682bab67db4 status Borttaget.

delete from public.commission_posts
 where id in ('e37b7e21-1296-41e7-ad10-13c73b600feb', 'cc81fd2b-5a93-4040-95a7-d737296bdf17')
   and status = 'pending_invoice'
   and exists (select 1 from public.business_cases b
                where b.id = 'dd1f1abd-45cf-420b-816c-1682bab67db4' and b.status = 'Borttaget');
