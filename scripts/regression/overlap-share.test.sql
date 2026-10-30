-- Steg 7 (supabase/migrations/20261030_avtalsar_overlap_share.sql): den gemensamma
-- överlappsandelen. Körs i SQL-editorn eller via execute_sql efter migrationen
-- (eller i samma transaktion som den, före commit). Allt sker i ett DO-block som
-- avslutas med raise exception, så ingenting sparas. Resultatet står i felmeddelandet.
--
-- G1: contract_period_overlap_share mot vaktens gamla uttryck (steg 3) för alla
--     överlappande par i ett rutnät: 0 skillnader väntas.
-- V1 till V5: vakten på riktigt, med gränsfallen kring hälften. Samma fall finns i
--     src/shared/contractInvoiceMatch.test.ts (periodOverlapShare), så TS och
--     databasen ger samma svar.
--   V1 kopia av Brynäs-utkastet: 23P01 (andel 1).
--   V2 låst faktura 2030-01-01 t.o.m. 2030-01-10 (tio dagar): OK.
--   V3 utkast 2030-01-06 t.o.m. 2030-01-20 (fem av tio dagar, andel 0,5): 23P01 "finns redan".
--   V4 utkast 2030-01-07 t.o.m. 2030-01-20 (fyra av tio, andel 0,4, mot låst): OK.
--   V5 utkast 2030-01-10 t.o.m. 2030-02-08 mot utkastet i V4 (andel 11/14 ≈ 0,79): 23P01.
-- Fakturanummer är prod-data 2026-10-30 (Brynäs INV-202610-0004, utkast).
do $do$
declare res text := E'\n'; d text := 'INV-202610-0004'; n int;
begin
execute $h$create function pg_temp.try_sql(p text) returns text language plpgsql as $f$ begin execute p; return 'OK'; exception when others then return 'ERR ' || sqlstate || ' ' || sqlerrm; end $f$$h$;
execute $h$create function pg_temp.cp(p_src text, p_patch jsonb) returns text language plpgsql as $f$ begin return pg_temp.try_sql(format('insert into invoices select (jsonb_populate_record(null::invoices, to_jsonb(i) || %L::jsonb)).* from invoices i where invoice_number = %L', p_patch, p_src)); end $f$$h$;

  with g as (
    select a_s::date as a_s, a_s::date + a_len - 1 as a_e, b_s::date as b_s, b_s::date + b_len - 1 as b_e
    from generate_series(date '2027-01-01', date '2027-03-31', interval '3 day') a_s0(a_s),
         unnest(array[1, 10, 28, 31, 90, 181, 365, 366, 730]) a_len,
         generate_series(date '2026-12-01', date '2027-06-30', interval '5 day') b_s0(b_s),
         unnest(array[1, 14, 30, 92, 183, 365]) b_len
  )
  select count(*) into n from g
  where least(a_e, b_e) >= greatest(a_s, b_s)
    and public.contract_period_overlap_share(a_s, a_e::date, b_s, b_e::date)
        <> (least(a_e, b_e) - greatest(a_s, b_s) + 1)::numeric
           / greatest(least(a_e - a_s + 1, b_e - b_s + 1), 1);
  res := res || 'G1 skillnader mot vaktens gamla uttryck: ' || n || E'\n';
  res := res || 'G2 utan överlapp ger 0: ' || public.contract_period_overlap_share('2027-01-01', '2027-01-31', '2027-02-01', '2027-02-28') || E'\n';

  res := res || 'V1 kopia av utkastet: ' || pg_temp.cp(d, jsonb_build_object('id', gen_random_uuid(), 'invoice_number', 'TEST-V1')) || E'\n';
  res := res || 'V2 låst 2030-01-01 t.o.m. 01-10: ' || pg_temp.cp(d, jsonb_build_object('id', gen_random_uuid(), 'invoice_number', 'TEST-V2', 'status', 'sent', 'billing_period_start', '2030-01-01', 'billing_period_end', '2030-01-10')) || E'\n';
  res := res || 'V3 andel 0,5 mot låst: ' || pg_temp.cp(d, jsonb_build_object('id', gen_random_uuid(), 'invoice_number', 'TEST-V3', 'billing_period_start', '2030-01-06', 'billing_period_end', '2030-01-20')) || E'\n';
  res := res || 'V4 andel 0,4 mot låst: ' || pg_temp.cp(d, jsonb_build_object('id', gen_random_uuid(), 'invoice_number', 'TEST-V4', 'billing_period_start', '2030-01-07', 'billing_period_end', '2030-01-20')) || E'\n';
  res := res || 'V5 andel 0,79 mot utkastet V4: ' || pg_temp.cp(d, jsonb_build_object('id', gen_random_uuid(), 'invoice_number', 'TEST-V5', 'billing_period_start', '2030-01-10', 'billing_period_end', '2030-02-08')) || E'\n';
  raise exception 'TESTRESULTAT (rullas tillbaka):%', res;
end $do$;
