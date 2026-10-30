-- Överlappsvakten (steg 3, supabase/migrations/20261030_invoice_period_overlap_guard.sql).
-- Körs i SQL-editorn eller via execute_sql. Allt sker i ett DO-block som avslutas med
-- raise exception, så ingenting sparas. Resultatet står i felmeddelandet.
-- Förväntat (2026-10-30): T1, T3, T5b, T10, T15b, T18b, T20, T21b ger 23P01;
-- T12 och T14b ger 23505 från de unika indexen (som före vakten); övriga OK.
-- Fakturanummer och id:n är prod-data 2026-10-30 (Brynäs INV-202607-0036/INV-202610-0004,
-- utkasten i regressionsdumpens update-rader); byt om de ändrats.
do $do$
declare res text := E'\n'; b text := 'INV-202607-0036'; d text := 'INV-202610-0004'; c text;
begin
execute $h$create function pg_temp.try_sql(p text) returns text language plpgsql as $f$ begin execute p; return 'OK'; exception when others then return 'ERR ' || sqlstate || ' ' || sqlerrm; end $f$$h$;
execute $h$create function pg_temp.cp(p_src text, p_patch jsonb) returns text language plpgsql as $f$ begin return pg_temp.try_sql(format('insert into invoices select (jsonb_populate_record(null::invoices, to_jsonb(i) || %L::jsonb)).* from invoices i where invoice_number = %L', p_patch, p_src)); end $f$$h$;
  res := res || 'T1 kopia av utkastet: ' || pg_temp.cp(d, jsonb_build_object('id', gen_random_uuid(), 'invoice_number', 'TEST-1')) || E'\n';
  res := res || 'T2 låst 2030-07-01: ' || pg_temp.cp(b, jsonb_build_object('id', gen_random_uuid(), 'invoice_number', 'TEST-L', 'status','sent','is_historical',false,'billing_period_start','2030-07-01','billing_period_end','2031-06-30')) || E'\n';
  res := res || 'T3 2030-06-30 mot låst (0,997): ' || pg_temp.cp(d, jsonb_build_object('id', gen_random_uuid(), 'invoice_number', 'TEST-3','billing_period_start','2030-06-30','billing_period_end','2031-06-29')) || E'\n';
  res := res || 'T4 2031-06-30 en dag mot låst: ' || pg_temp.cp(d, jsonb_build_object('id', gen_random_uuid(), 'invoice_number', 'TEST-4','billing_period_start','2031-06-30','billing_period_end','2032-06-29')) || E'\n';
  res := res || 'T5a utkast 2034-07-01: ' || pg_temp.cp(d, jsonb_build_object('id', gen_random_uuid(), 'invoice_number', 'TEST-D','billing_period_start','2034-07-01','billing_period_end','2035-06-30')) || E'\n';
  res := res || 'T5b en dag mot utkast: ' || pg_temp.cp(d, jsonb_build_object('id', gen_random_uuid(), 'invoice_number', 'TEST-5','billing_period_start','2035-06-30','billing_period_end','2036-06-29')) || E'\n';
  res := res || 'T6 Brynäs utkast till ready: ' || pg_temp.try_sql(format('update invoices set status = %L where invoice_number = %L', 'ready', d)) || E'\n';
  res := res || 'T7 synk sent->paid när utkast överlappar en dag: ' || pg_temp.try_sql($s$update invoices set status = 'paid', paid_at = now() where invoice_number = 'TEST-L'$s$) || E'\n';
  res := res || 'T8 status=status på alla avtalsfakturor: ' || pg_temp.try_sql($s$update invoices set status = status where invoice_type = 'contract'$s$) || E'\n';
  res := res || 'T8b perioder=perioder på alla avtalsfakturor: ' || pg_temp.try_sql($s$update invoices set billing_period_start = billing_period_start, billing_period_end = billing_period_end, contract_id = contract_id, is_consolidated = is_consolidated, contract_invoice_kind = contract_invoice_kind where invoice_type = 'contract'$s$) || E'\n';
  res := res || 'T9 generatorns uppdateringar 03bee4df stigande: ' || pg_temp.try_sql($s$
    update invoices set billing_period_start='2027-02-01', billing_period_end='2028-01-31' where id='d7654fec-e1c1-4f02-8ac5-592257329e04';
    update invoices set billing_period_start='2028-02-01', billing_period_end='2029-01-31' where id='ea3d1560-37fa-480e-ad63-9bc0dc4b487f';
    update invoices set billing_period_start='2029-02-01', billing_period_end='2030-01-31' where id='248d2716-f4d7-4d8f-bb61-b68f6d24b4de';
    update invoices set billing_period_start='2030-02-01', billing_period_end='2031-01-31' where id='ab76c4f1-1720-4b83-8b5b-45615ecc9ff5';$s$) || E'\n';
  res := res || 'T9b samma, fallande: ' || pg_temp.try_sql($s$
    update invoices set billing_period_start='2030-02-01', billing_period_end='2031-01-31' where id='ab76c4f1-1720-4b83-8b5b-45615ecc9ff5';
    update invoices set billing_period_start='2029-02-01', billing_period_end='2030-01-31' where id='248d2716-f4d7-4d8f-bb61-b68f6d24b4de';
    update invoices set billing_period_start='2028-02-01', billing_period_end='2029-01-31' where id='ea3d1560-37fa-480e-ad63-9bc0dc4b487f';
    update invoices set billing_period_start='2027-02-01', billing_period_end='2028-01-31' where id='d7654fec-e1c1-4f02-8ac5-592257329e04';$s$) || E'\n';
  res := res || 'T9c övriga uppdateringar i regressionsdumpen: ' || pg_temp.try_sql($s$
    update invoices set billing_period_start='2027-03-01', billing_period_end='2028-02-29' where id='135e7247-7af4-4a2b-bbc8-e7dc5264ad84';
    update invoices set billing_period_start='2028-03-01', billing_period_end='2029-02-28' where id='f30c5dcb-929a-4585-baab-e3e61264ad6a';
    update invoices set billing_period_start='2029-03-01', billing_period_end='2030-02-28' where id='0fde9a45-e7ff-4702-a9a5-899052b32736';
    update invoices set billing_period_start='2030-03-01', billing_period_end='2031-02-28' where id='8858d1f2-0cac-4ca7-83be-cf764d4a87a3';
    update invoices set billing_period_start='2027-03-01', billing_period_end='2028-02-29' where id='1c500100-046f-44b2-a2e5-9b21eb81cd7f';
    update invoices set billing_period_start='2028-03-01', billing_period_end='2029-02-28' where id='8ffdc53a-17e5-4b3b-a3cf-4260e977d0c1';
    update invoices set billing_period_start='2027-06-01', billing_period_end='2028-05-31' where id='7cf37edf-3fee-48a5-b17d-cdb0599b9319';
    update invoices set billing_period_start='2028-06-01', billing_period_end='2029-05-31' where id='9e054616-873d-471f-a633-e80f6f83e52e';
    update invoices set billing_period_start='2026-10-01', billing_period_end='2027-09-30' where id='208725d2-b48f-49ac-bc50-8a361b05c011';$s$) || E'\n';
  res := res || 'T10 utkast flyttas ovanpå betald: ' || pg_temp.try_sql(format($s$update invoices set billing_period_start='2025-11-25', billing_period_end='2026-11-24' where invoice_number=%L$s$, d)) || E'\n';
  res := res || 'T11 F-import samma period som betald: ' || pg_temp.cp(b, jsonb_build_object('id', gen_random_uuid(), 'invoice_number', 'F-99999','is_historical',true,'fortnox_document_number','99999')) || E'\n';
  res := res || 'T12 HIST samma period: ' || pg_temp.cp(b, jsonb_build_object('id', gen_random_uuid(), 'invoice_number', 'HIST-TEST','is_historical',true)) || E'\n';
  res := res || 'T13 adhoc samma period: ' || pg_temp.cp(d, jsonb_build_object('id', gen_random_uuid(), 'invoice_number', 'TEST-13','invoice_type','adhoc')) || E'\n';
  res := res || 'T14a makulerad med Fortnox-nr: ' || pg_temp.cp(b, jsonb_build_object('id', gen_random_uuid(), 'invoice_number', 'TEST-C','status','cancelled','is_historical',false,'fortnox_document_number','99998')) || E'\n';
  res := res || 'T14b återställ den (sent): ' || pg_temp.try_sql($s$update invoices set status='sent' where invoice_number='TEST-C'$s$) || E'\n';
  res := res || 'T15a makulerad utan Fortnox-nr: ' || pg_temp.cp(b, jsonb_build_object('id', gen_random_uuid(), 'invoice_number', 'TEST-C2','status','cancelled','is_historical',false,'fortnox_document_number',null)) || E'\n';
  res := res || 'T15b återställ den (ready): ' || pg_temp.try_sql($s$update invoices set status='ready' where invoice_number='TEST-C2'$s$) || E'\n';
  res := res || 'T16 makulera INV-202610-0002: ' || pg_temp.try_sql($s$update invoices set status='cancelled' where invoice_number='INV-202610-0002'$s$) || E'\n';
  res := res || 'T16b återställ INV-202610-0002 (ready): ' || pg_temp.try_sql($s$update invoices set status='ready' where invoice_number='INV-202610-0002'$s$) || E'\n';
  res := res || 'T17 cronens skapande 1f88b97e 2027-02-01: ' || pg_temp.cp('F-51', jsonb_build_object('id', gen_random_uuid(), 'invoice_number', 'TEST-17','status','pending_approval','is_historical',false,'fortnox_document_number',null,'billing_period_start','2027-02-01','billing_period_end','2028-01-31')) || E'\n';
  res := res || 'T18 samlingsfaktura 67ffdb9f 2027-07-01: ' || pg_temp.cp(d, jsonb_build_object('id', gen_random_uuid(), 'invoice_number', 'TEST-18','contract_id',null,'is_consolidated',true,'customer_id','67ffdb9f-ff14-450e-94ee-cf5095906d80','billing_period_start','2027-07-01','billing_period_end','2028-06-30')) || E'\n';
  res := res || 'T18b samling dubblett: ' || pg_temp.cp(d, jsonb_build_object('id', gen_random_uuid(), 'invoice_number', 'TEST-18b','contract_id',null,'is_consolidated',true,'customer_id','67ffdb9f-ff14-450e-94ee-cf5095906d80','billing_period_start','2027-07-15','billing_period_end','2028-07-14')) || E'\n';
  res := res || 'T19 import gör om utkastet till F-: ' || pg_temp.try_sql(format($s$update invoices set invoice_number='F-88888', is_historical=true, status='paid', billing_period_start='2025-11-25', billing_period_end='2026-11-24' where invoice_number=%L$s$, d)) || E'\n';
  select invoice_number into c from invoices where invoice_type='contract' and contract_invoice_kind='equipment' and status='pending_approval' order by invoice_number limit 1;
  res := res || 'T20 tilläggsfaktura kopia (' || c || '): ' || pg_temp.cp(c, jsonb_build_object('id', gen_random_uuid(), 'invoice_number', 'TEST-20')) || E'\n';
  perform set_config('app.allow_period_overlap','on',true);
  res := res || 'T21 nödventil, dubblett: ' || pg_temp.cp('INV-202609-0355', jsonb_build_object('id', gen_random_uuid(), 'invoice_number', 'TEST-21', 'billing_period_start','2026-11-02')) || E'\n';
  perform set_config('app.allow_period_overlap','',true);
  res := res || 'T21b utan nödventil: ' || pg_temp.cp('INV-202609-0355', jsonb_build_object('id', gen_random_uuid(), 'invoice_number', 'TEST-21b', 'billing_period_start','2026-11-03')) || E'\n';
  res := res || 'T22 vyn, par utan F-: ' || (select count(*) from contract_invoice_overlaps where number_a not like 'F-%' and number_b not like 'F-%')::text || E' (påverkas av testerna ovan; kör select separat, väntat 8)\n';
  raise exception 'TESTRESULTAT (rullas tillbaka):%', res;
end $do$;
