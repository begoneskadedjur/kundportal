-- Upphandlingsportalen, etapp 3 och 4 plus datakvalitet (docs/upphandlingsportal-plan.md)
--
-- Additivt. Inga drop av tabeller eller kolumner. Enda ändrade villkoret är
-- procurement_awards.calc_end_source som breddas med två nya källor.
--
--   1. Avtalsklockan: felträffsflagga, startbas, beräkningsgrund och
--      uppföljning (ny annons, ny tilldelning, slut passerat).
--   2. Leverantörsalias för orgnr-varianter (Nomor 5565293976 -> 5565263976).
--   3. Hash per PDF på signalkällorna.
--   4. procurement_municipalities: SCB:s 290 kommuner med län (NUTS3),
--      och en funktion som sätter län på köpare.
--   5. Anbudsbibliotek (procurement_answers) och utkast per krav.
--   6. Utfall vunnet/förlorat sätter upphandlingens status.
--   7. RPC:er: marknadsdatan i ett anrop och uppföljningen av avtalsklockan.
--   8. Mercells länkformat verifierat: https://app.mercell.com/tender/{id}.

-- ---------------------------------------------------------------------------
-- 1. Avtalsklockan

alter table public.procurement_awards
  add column if not exists excluded_reason text,
  add column if not exists excluded_at timestamptz,
  add column if not exists start_basis_date date,
  add column if not exists duration_months numeric,
  add column if not exists calc_basis text,
  add column if not exists followup_status text,
  add column if not exists followup_notice_id uuid references public.procurement_notices(id) on delete set null,
  add column if not exists followup_award_id uuid references public.procurement_awards(id) on delete set null,
  add column if not exists followup_url text,
  add column if not exists followup_title text,
  add column if not exists followup_date date,
  add column if not exists followup_checked_at timestamptz;

comment on column public.procurement_awards.excluded_reason is
  'Felträff: tilldelningen gäller inte skadedjur (t.ex. vassklippning, lokalvård). Rådata behålls, raden räknas inte i marknad eller avtalsklocka.';
comment on column public.procurement_awards.start_basis_date is
  'Avtalsstart som slutdatumet räknas från: avtalsstart, tecknat avtal, tilldelning plus en månad, tilldelningsannonsen eller annonsen plus sex månader.';
comment on column public.procurement_awards.followup_status is
  'new_notice = köparen har annonserat igen, new_award = köparen har tilldelat en senare upphandling, passed_no_notice = slut passerat utan känd ny annons (senaste två åren), stale = slut passerat för över två år sedan.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'procurement_awards_followup_status_check') then
    alter table public.procurement_awards
      add constraint procurement_awards_followup_status_check
      check (followup_status is null or followup_status in ('new_notice', 'new_award', 'passed_no_notice', 'stale'));
  end if;
end $$;

-- Breddat villkor: avtalsstart plus avtalstid ur TED eller ur annonstexten
alter table public.procurement_awards drop constraint if exists procurement_awards_calc_end_source_check;
alter table public.procurement_awards add constraint procurement_awards_calc_end_source_check
  check (calc_end_source is null or calc_end_source in (
    'ted_end_plus_renewals', 'ted_end', 'mercell_expiry', 'contract_duration', 'text_duration', 'assumption_2_2', 'manual'
  ));

create index if not exists procurement_awards_excluded_idx on public.procurement_awards (excluded_reason) where excluded_reason is not null;
create index if not exists procurement_awards_followup_idx on public.procurement_awards (followup_status);

-- Användare får markera och avmarkera felträffar
grant update (excluded_reason, excluded_at) on public.procurement_awards to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Leverantörsalias

alter table public.procurement_suppliers
  add column if not exists org_aliases text[] not null default '{}',
  add column if not exists merged_into uuid references public.procurement_suppliers(id) on delete set null;

create index if not exists procurement_suppliers_org_aliases_idx on public.procurement_suppliers using gin (org_aliases);

comment on column public.procurement_suppliers.org_aliases is
  'Felskrivna eller äldre orgnr som ska räknas som den här leverantören (t.ex. 5565293976 för Nomor 5565263976).';

-- Nomor: TED-XML 2019 har orgnr 5565293976, rätt är 5565263976
do $$
declare
  v_canon uuid;
  v_dup uuid;
  r record;
begin
  select id into v_canon from public.procurement_suppliers where org_number = '5565263976';
  select id into v_dup from public.procurement_suppliers where org_number = '5565293976';
  if v_canon is null then return; end if;

  update public.procurement_suppliers
     set org_aliases = array(select distinct unnest(org_aliases || array['5565293976']))
   where id = v_canon;

  if v_dup is not null then
    update public.procurement_suppliers
       set merged_into = v_canon,
           notes = coalesce(notes || chr(10), '') || 'Sammanslagen med Nomor AB (5565263976) 2026-09-25, felskrivet orgnr i TED-XML.'
     where id = v_dup and merged_into is null;
    update public.procurement_suppliers s
       set aliases = array(select distinct unnest(s.aliases || array['Nomor AB (publ.)']))
     where s.id = v_canon;
  end if;

  -- Tilldelningar: nyckeln byggs på orgnr, så den rättas också. Finns redan en
  -- rad med rätt nyckel flaggas felraden som dubblett i stället.
  for r in
    select id, award_key from public.procurement_awards
     where winner_org_number = '5565293976' or (v_dup is not null and supplier_id = v_dup)
  loop
    if exists (select 1 from public.procurement_awards where award_key = replace(r.award_key, '5565293976', '5565263976') and id <> r.id) then
      update public.procurement_awards
         set supplier_id = v_canon, winner_org_number = '5565263976',
             excluded_reason = 'Dubblett: samma tilldelning finns med Nomors rätta orgnr', excluded_at = now()
       where id = r.id;
    else
      update public.procurement_awards
         set supplier_id = v_canon, winner_org_number = '5565263976',
             award_key = replace(r.award_key, '5565293976', '5565263976')
       where id = r.id;
    end if;
  end loop;

  for r in
    select id, bidder_key from public.procurement_bidders
     where org_number = '5565293976' or (v_dup is not null and supplier_id = v_dup)
  loop
    if exists (select 1 from public.procurement_bidders where bidder_key = replace(r.bidder_key, '5565293976', '5565263976') and id <> r.id) then
      update public.procurement_bidders set supplier_id = v_canon, org_number = '5565263976' where id = r.id;
    else
      update public.procurement_bidders
         set supplier_id = v_canon, org_number = '5565263976', bidder_key = replace(r.bidder_key, '5565293976', '5565263976')
       where id = r.id;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Hash per PDF på signalkällorna

alter table public.procurement_signal_sources
  add column if not exists pdf_hashes jsonb not null default '{}'::jsonb;

comment on column public.procurement_signal_sources.pdf_hashes is
  'sha256 per PDF-adress från senaste lyckade läsningen. En oförändrad PDF skickas inte till AI igen.';

-- ---------------------------------------------------------------------------
-- 4. Kommuner och län (SCB:s kommunkoder, hämtade 2026-09-25 ur SCB:s API, 290 kommuner)

create table if not exists public.procurement_municipalities (
  code text primary key,                 -- SCB:s kommunkod, t.ex. 0180
  name text not null,                    -- Stockholm
  lan_code text not null,                -- SCB:s länskod, t.ex. 01
  county_code text not null,             -- NUTS3, t.ex. SE110
  county_name text not null,             -- Stockholms län
  org_number text unique,                -- 212000xxxx, fylls när en köpare matchas på namn
  updated_at timestamptz not null default now()
);

alter table public.procurement_municipalities enable row level security;
revoke all on public.procurement_municipalities from anon;
revoke insert, update, delete on public.procurement_municipalities from authenticated;
grant select on public.procurement_municipalities to authenticated;
drop policy if exists procurement_municipalities_select on public.procurement_municipalities;
create policy procurement_municipalities_select on public.procurement_municipalities
  for select to authenticated using (public.has_procurement_access());

insert into public.procurement_municipalities (code, name, lan_code, county_code, county_name) values
  ('0114', 'Upplands Väsby', '01', 'SE110', 'Stockholms län'),
  ('0115', 'Vallentuna', '01', 'SE110', 'Stockholms län'),
  ('0117', 'Österåker', '01', 'SE110', 'Stockholms län'),
  ('0120', 'Värmdö', '01', 'SE110', 'Stockholms län'),
  ('0123', 'Järfälla', '01', 'SE110', 'Stockholms län'),
  ('0125', 'Ekerö', '01', 'SE110', 'Stockholms län'),
  ('0126', 'Huddinge', '01', 'SE110', 'Stockholms län'),
  ('0127', 'Botkyrka', '01', 'SE110', 'Stockholms län'),
  ('0128', 'Salem', '01', 'SE110', 'Stockholms län'),
  ('0136', 'Haninge', '01', 'SE110', 'Stockholms län'),
  ('0138', 'Tyresö', '01', 'SE110', 'Stockholms län'),
  ('0139', 'Upplands-Bro', '01', 'SE110', 'Stockholms län'),
  ('0140', 'Nykvarn', '01', 'SE110', 'Stockholms län'),
  ('0160', 'Täby', '01', 'SE110', 'Stockholms län'),
  ('0162', 'Danderyd', '01', 'SE110', 'Stockholms län'),
  ('0163', 'Sollentuna', '01', 'SE110', 'Stockholms län'),
  ('0180', 'Stockholm', '01', 'SE110', 'Stockholms län'),
  ('0181', 'Södertälje', '01', 'SE110', 'Stockholms län'),
  ('0182', 'Nacka', '01', 'SE110', 'Stockholms län'),
  ('0183', 'Sundbyberg', '01', 'SE110', 'Stockholms län'),
  ('0184', 'Solna', '01', 'SE110', 'Stockholms län'),
  ('0186', 'Lidingö', '01', 'SE110', 'Stockholms län'),
  ('0187', 'Vaxholm', '01', 'SE110', 'Stockholms län'),
  ('0188', 'Norrtälje', '01', 'SE110', 'Stockholms län'),
  ('0191', 'Sigtuna', '01', 'SE110', 'Stockholms län'),
  ('0192', 'Nynäshamn', '01', 'SE110', 'Stockholms län'),
  ('0305', 'Håbo', '03', 'SE121', 'Uppsala län'),
  ('0319', 'Älvkarleby', '03', 'SE121', 'Uppsala län'),
  ('0330', 'Knivsta', '03', 'SE121', 'Uppsala län'),
  ('0331', 'Heby', '03', 'SE121', 'Uppsala län'),
  ('0360', 'Tierp', '03', 'SE121', 'Uppsala län'),
  ('0380', 'Uppsala', '03', 'SE121', 'Uppsala län'),
  ('0381', 'Enköping', '03', 'SE121', 'Uppsala län'),
  ('0382', 'Östhammar', '03', 'SE121', 'Uppsala län'),
  ('0428', 'Vingåker', '04', 'SE122', 'Södermanlands län'),
  ('0461', 'Gnesta', '04', 'SE122', 'Södermanlands län'),
  ('0480', 'Nyköping', '04', 'SE122', 'Södermanlands län'),
  ('0481', 'Oxelösund', '04', 'SE122', 'Södermanlands län'),
  ('0482', 'Flen', '04', 'SE122', 'Södermanlands län'),
  ('0483', 'Katrineholm', '04', 'SE122', 'Södermanlands län'),
  ('0484', 'Eskilstuna', '04', 'SE122', 'Södermanlands län'),
  ('0486', 'Strängnäs', '04', 'SE122', 'Södermanlands län'),
  ('0488', 'Trosa', '04', 'SE122', 'Södermanlands län'),
  ('0509', 'Ödeshög', '05', 'SE123', 'Östergötlands län'),
  ('0512', 'Ydre', '05', 'SE123', 'Östergötlands län'),
  ('0513', 'Kinda', '05', 'SE123', 'Östergötlands län'),
  ('0560', 'Boxholm', '05', 'SE123', 'Östergötlands län'),
  ('0561', 'Åtvidaberg', '05', 'SE123', 'Östergötlands län'),
  ('0562', 'Finspång', '05', 'SE123', 'Östergötlands län'),
  ('0563', 'Valdemarsvik', '05', 'SE123', 'Östergötlands län'),
  ('0580', 'Linköping', '05', 'SE123', 'Östergötlands län'),
  ('0581', 'Norrköping', '05', 'SE123', 'Östergötlands län'),
  ('0582', 'Söderköping', '05', 'SE123', 'Östergötlands län'),
  ('0583', 'Motala', '05', 'SE123', 'Östergötlands län'),
  ('0584', 'Vadstena', '05', 'SE123', 'Östergötlands län'),
  ('0586', 'Mjölby', '05', 'SE123', 'Östergötlands län'),
  ('0604', 'Aneby', '06', 'SE211', 'Jönköpings län'),
  ('0617', 'Gnosjö', '06', 'SE211', 'Jönköpings län'),
  ('0642', 'Mullsjö', '06', 'SE211', 'Jönköpings län'),
  ('0643', 'Habo', '06', 'SE211', 'Jönköpings län'),
  ('0662', 'Gislaved', '06', 'SE211', 'Jönköpings län'),
  ('0665', 'Vaggeryd', '06', 'SE211', 'Jönköpings län'),
  ('0680', 'Jönköping', '06', 'SE211', 'Jönköpings län'),
  ('0682', 'Nässjö', '06', 'SE211', 'Jönköpings län'),
  ('0683', 'Värnamo', '06', 'SE211', 'Jönköpings län'),
  ('0684', 'Sävsjö', '06', 'SE211', 'Jönköpings län'),
  ('0685', 'Vetlanda', '06', 'SE211', 'Jönköpings län'),
  ('0686', 'Eksjö', '06', 'SE211', 'Jönköpings län'),
  ('0687', 'Tranås', '06', 'SE211', 'Jönköpings län'),
  ('0760', 'Uppvidinge', '07', 'SE212', 'Kronobergs län'),
  ('0761', 'Lessebo', '07', 'SE212', 'Kronobergs län'),
  ('0763', 'Tingsryd', '07', 'SE212', 'Kronobergs län'),
  ('0764', 'Alvesta', '07', 'SE212', 'Kronobergs län'),
  ('0765', 'Älmhult', '07', 'SE212', 'Kronobergs län'),
  ('0767', 'Markaryd', '07', 'SE212', 'Kronobergs län'),
  ('0780', 'Växjö', '07', 'SE212', 'Kronobergs län'),
  ('0781', 'Ljungby', '07', 'SE212', 'Kronobergs län'),
  ('0821', 'Högsby', '08', 'SE213', 'Kalmar län'),
  ('0834', 'Torsås', '08', 'SE213', 'Kalmar län'),
  ('0840', 'Mörbylånga', '08', 'SE213', 'Kalmar län'),
  ('0860', 'Hultsfred', '08', 'SE213', 'Kalmar län'),
  ('0861', 'Mönsterås', '08', 'SE213', 'Kalmar län'),
  ('0862', 'Emmaboda', '08', 'SE213', 'Kalmar län'),
  ('0880', 'Kalmar', '08', 'SE213', 'Kalmar län'),
  ('0881', 'Nybro', '08', 'SE213', 'Kalmar län'),
  ('0882', 'Oskarshamn', '08', 'SE213', 'Kalmar län'),
  ('0883', 'Västervik', '08', 'SE213', 'Kalmar län'),
  ('0884', 'Vimmerby', '08', 'SE213', 'Kalmar län'),
  ('0885', 'Borgholm', '08', 'SE213', 'Kalmar län'),
  ('0980', 'Gotland', '09', 'SE214', 'Gotlands län'),
  ('1060', 'Olofström', '10', 'SE221', 'Blekinge län'),
  ('1080', 'Karlskrona', '10', 'SE221', 'Blekinge län'),
  ('1081', 'Ronneby', '10', 'SE221', 'Blekinge län'),
  ('1082', 'Karlshamn', '10', 'SE221', 'Blekinge län'),
  ('1083', 'Sölvesborg', '10', 'SE221', 'Blekinge län'),
  ('1214', 'Svalöv', '12', 'SE224', 'Skåne län'),
  ('1230', 'Staffanstorp', '12', 'SE224', 'Skåne län'),
  ('1231', 'Burlöv', '12', 'SE224', 'Skåne län'),
  ('1233', 'Vellinge', '12', 'SE224', 'Skåne län'),
  ('1256', 'Östra Göinge', '12', 'SE224', 'Skåne län'),
  ('1257', 'Örkelljunga', '12', 'SE224', 'Skåne län'),
  ('1260', 'Bjuv', '12', 'SE224', 'Skåne län'),
  ('1261', 'Kävlinge', '12', 'SE224', 'Skåne län'),
  ('1262', 'Lomma', '12', 'SE224', 'Skåne län'),
  ('1263', 'Svedala', '12', 'SE224', 'Skåne län'),
  ('1264', 'Skurup', '12', 'SE224', 'Skåne län'),
  ('1265', 'Sjöbo', '12', 'SE224', 'Skåne län'),
  ('1266', 'Hörby', '12', 'SE224', 'Skåne län'),
  ('1267', 'Höör', '12', 'SE224', 'Skåne län'),
  ('1270', 'Tomelilla', '12', 'SE224', 'Skåne län'),
  ('1272', 'Bromölla', '12', 'SE224', 'Skåne län'),
  ('1273', 'Osby', '12', 'SE224', 'Skåne län'),
  ('1275', 'Perstorp', '12', 'SE224', 'Skåne län'),
  ('1276', 'Klippan', '12', 'SE224', 'Skåne län'),
  ('1277', 'Åstorp', '12', 'SE224', 'Skåne län'),
  ('1278', 'Båstad', '12', 'SE224', 'Skåne län'),
  ('1280', 'Malmö', '12', 'SE224', 'Skåne län'),
  ('1281', 'Lund', '12', 'SE224', 'Skåne län'),
  ('1282', 'Landskrona', '12', 'SE224', 'Skåne län'),
  ('1283', 'Helsingborg', '12', 'SE224', 'Skåne län'),
  ('1284', 'Höganäs', '12', 'SE224', 'Skåne län'),
  ('1285', 'Eslöv', '12', 'SE224', 'Skåne län'),
  ('1286', 'Ystad', '12', 'SE224', 'Skåne län'),
  ('1287', 'Trelleborg', '12', 'SE224', 'Skåne län'),
  ('1290', 'Kristianstad', '12', 'SE224', 'Skåne län'),
  ('1291', 'Simrishamn', '12', 'SE224', 'Skåne län'),
  ('1292', 'Ängelholm', '12', 'SE224', 'Skåne län'),
  ('1293', 'Hässleholm', '12', 'SE224', 'Skåne län'),
  ('1315', 'Hylte', '13', 'SE231', 'Hallands län'),
  ('1380', 'Halmstad', '13', 'SE231', 'Hallands län'),
  ('1381', 'Laholm', '13', 'SE231', 'Hallands län'),
  ('1382', 'Falkenberg', '13', 'SE231', 'Hallands län'),
  ('1383', 'Varberg', '13', 'SE231', 'Hallands län'),
  ('1384', 'Kungsbacka', '13', 'SE231', 'Hallands län'),
  ('1401', 'Härryda', '14', 'SE232', 'Västra Götalands län'),
  ('1402', 'Partille', '14', 'SE232', 'Västra Götalands län'),
  ('1407', 'Öckerö', '14', 'SE232', 'Västra Götalands län'),
  ('1415', 'Stenungsund', '14', 'SE232', 'Västra Götalands län'),
  ('1419', 'Tjörn', '14', 'SE232', 'Västra Götalands län'),
  ('1421', 'Orust', '14', 'SE232', 'Västra Götalands län'),
  ('1427', 'Sotenäs', '14', 'SE232', 'Västra Götalands län'),
  ('1430', 'Munkedal', '14', 'SE232', 'Västra Götalands län'),
  ('1435', 'Tanum', '14', 'SE232', 'Västra Götalands län'),
  ('1438', 'Dals-Ed', '14', 'SE232', 'Västra Götalands län'),
  ('1439', 'Färgelanda', '14', 'SE232', 'Västra Götalands län'),
  ('1440', 'Ale', '14', 'SE232', 'Västra Götalands län'),
  ('1441', 'Lerum', '14', 'SE232', 'Västra Götalands län'),
  ('1442', 'Vårgårda', '14', 'SE232', 'Västra Götalands län'),
  ('1443', 'Bollebygd', '14', 'SE232', 'Västra Götalands län'),
  ('1444', 'Grästorp', '14', 'SE232', 'Västra Götalands län'),
  ('1445', 'Essunga', '14', 'SE232', 'Västra Götalands län'),
  ('1446', 'Karlsborg', '14', 'SE232', 'Västra Götalands län'),
  ('1447', 'Gullspång', '14', 'SE232', 'Västra Götalands län'),
  ('1452', 'Tranemo', '14', 'SE232', 'Västra Götalands län'),
  ('1460', 'Bengtsfors', '14', 'SE232', 'Västra Götalands län'),
  ('1461', 'Mellerud', '14', 'SE232', 'Västra Götalands län'),
  ('1462', 'Lilla Edet', '14', 'SE232', 'Västra Götalands län'),
  ('1463', 'Mark', '14', 'SE232', 'Västra Götalands län'),
  ('1465', 'Svenljunga', '14', 'SE232', 'Västra Götalands län'),
  ('1466', 'Herrljunga', '14', 'SE232', 'Västra Götalands län'),
  ('1470', 'Vara', '14', 'SE232', 'Västra Götalands län'),
  ('1471', 'Götene', '14', 'SE232', 'Västra Götalands län'),
  ('1472', 'Tibro', '14', 'SE232', 'Västra Götalands län'),
  ('1473', 'Töreboda', '14', 'SE232', 'Västra Götalands län'),
  ('1480', 'Göteborg', '14', 'SE232', 'Västra Götalands län'),
  ('1481', 'Mölndal', '14', 'SE232', 'Västra Götalands län'),
  ('1482', 'Kungälv', '14', 'SE232', 'Västra Götalands län'),
  ('1484', 'Lysekil', '14', 'SE232', 'Västra Götalands län'),
  ('1485', 'Uddevalla', '14', 'SE232', 'Västra Götalands län'),
  ('1486', 'Strömstad', '14', 'SE232', 'Västra Götalands län'),
  ('1487', 'Vänersborg', '14', 'SE232', 'Västra Götalands län'),
  ('1488', 'Trollhättan', '14', 'SE232', 'Västra Götalands län'),
  ('1489', 'Alingsås', '14', 'SE232', 'Västra Götalands län'),
  ('1490', 'Borås', '14', 'SE232', 'Västra Götalands län'),
  ('1491', 'Ulricehamn', '14', 'SE232', 'Västra Götalands län'),
  ('1492', 'Åmål', '14', 'SE232', 'Västra Götalands län'),
  ('1493', 'Mariestad', '14', 'SE232', 'Västra Götalands län'),
  ('1494', 'Lidköping', '14', 'SE232', 'Västra Götalands län'),
  ('1495', 'Skara', '14', 'SE232', 'Västra Götalands län'),
  ('1496', 'Skövde', '14', 'SE232', 'Västra Götalands län'),
  ('1497', 'Hjo', '14', 'SE232', 'Västra Götalands län'),
  ('1498', 'Tidaholm', '14', 'SE232', 'Västra Götalands län'),
  ('1499', 'Falköping', '14', 'SE232', 'Västra Götalands län'),
  ('1715', 'Kil', '17', 'SE311', 'Värmlands län'),
  ('1730', 'Eda', '17', 'SE311', 'Värmlands län'),
  ('1737', 'Torsby', '17', 'SE311', 'Värmlands län'),
  ('1760', 'Storfors', '17', 'SE311', 'Värmlands län'),
  ('1761', 'Hammarö', '17', 'SE311', 'Värmlands län'),
  ('1762', 'Munkfors', '17', 'SE311', 'Värmlands län'),
  ('1763', 'Forshaga', '17', 'SE311', 'Värmlands län'),
  ('1764', 'Grums', '17', 'SE311', 'Värmlands län'),
  ('1765', 'Årjäng', '17', 'SE311', 'Värmlands län'),
  ('1766', 'Sunne', '17', 'SE311', 'Värmlands län'),
  ('1780', 'Karlstad', '17', 'SE311', 'Värmlands län'),
  ('1781', 'Kristinehamn', '17', 'SE311', 'Värmlands län'),
  ('1782', 'Filipstad', '17', 'SE311', 'Värmlands län'),
  ('1783', 'Hagfors', '17', 'SE311', 'Värmlands län'),
  ('1784', 'Arvika', '17', 'SE311', 'Värmlands län'),
  ('1785', 'Säffle', '17', 'SE311', 'Värmlands län'),
  ('1814', 'Lekeberg', '18', 'SE124', 'Örebro län'),
  ('1860', 'Laxå', '18', 'SE124', 'Örebro län'),
  ('1861', 'Hallsberg', '18', 'SE124', 'Örebro län'),
  ('1862', 'Degerfors', '18', 'SE124', 'Örebro län'),
  ('1863', 'Hällefors', '18', 'SE124', 'Örebro län'),
  ('1864', 'Ljusnarsberg', '18', 'SE124', 'Örebro län'),
  ('1880', 'Örebro', '18', 'SE124', 'Örebro län'),
  ('1881', 'Kumla', '18', 'SE124', 'Örebro län'),
  ('1882', 'Askersund', '18', 'SE124', 'Örebro län'),
  ('1883', 'Karlskoga', '18', 'SE124', 'Örebro län'),
  ('1884', 'Nora', '18', 'SE124', 'Örebro län'),
  ('1885', 'Lindesberg', '18', 'SE124', 'Örebro län'),
  ('1904', 'Skinnskatteberg', '19', 'SE125', 'Västmanlands län'),
  ('1907', 'Surahammar', '19', 'SE125', 'Västmanlands län'),
  ('1960', 'Kungsör', '19', 'SE125', 'Västmanlands län'),
  ('1961', 'Hallstahammar', '19', 'SE125', 'Västmanlands län'),
  ('1962', 'Norberg', '19', 'SE125', 'Västmanlands län'),
  ('1980', 'Västerås', '19', 'SE125', 'Västmanlands län'),
  ('1981', 'Sala', '19', 'SE125', 'Västmanlands län'),
  ('1982', 'Fagersta', '19', 'SE125', 'Västmanlands län'),
  ('1983', 'Köping', '19', 'SE125', 'Västmanlands län'),
  ('1984', 'Arboga', '19', 'SE125', 'Västmanlands län'),
  ('2021', 'Vansbro', '20', 'SE312', 'Dalarnas län'),
  ('2023', 'Malung-Sälen', '20', 'SE312', 'Dalarnas län'),
  ('2026', 'Gagnef', '20', 'SE312', 'Dalarnas län'),
  ('2029', 'Leksand', '20', 'SE312', 'Dalarnas län'),
  ('2031', 'Rättvik', '20', 'SE312', 'Dalarnas län'),
  ('2034', 'Orsa', '20', 'SE312', 'Dalarnas län'),
  ('2039', 'Älvdalen', '20', 'SE312', 'Dalarnas län'),
  ('2061', 'Smedjebacken', '20', 'SE312', 'Dalarnas län'),
  ('2062', 'Mora', '20', 'SE312', 'Dalarnas län'),
  ('2080', 'Falun', '20', 'SE312', 'Dalarnas län'),
  ('2081', 'Borlänge', '20', 'SE312', 'Dalarnas län'),
  ('2082', 'Säter', '20', 'SE312', 'Dalarnas län'),
  ('2083', 'Hedemora', '20', 'SE312', 'Dalarnas län'),
  ('2084', 'Avesta', '20', 'SE312', 'Dalarnas län'),
  ('2085', 'Ludvika', '20', 'SE312', 'Dalarnas län'),
  ('2101', 'Ockelbo', '21', 'SE313', 'Gävleborgs län'),
  ('2104', 'Hofors', '21', 'SE313', 'Gävleborgs län'),
  ('2121', 'Ovanåker', '21', 'SE313', 'Gävleborgs län'),
  ('2132', 'Nordanstig', '21', 'SE313', 'Gävleborgs län'),
  ('2161', 'Ljusdal', '21', 'SE313', 'Gävleborgs län'),
  ('2180', 'Gävle', '21', 'SE313', 'Gävleborgs län'),
  ('2181', 'Sandviken', '21', 'SE313', 'Gävleborgs län'),
  ('2182', 'Söderhamn', '21', 'SE313', 'Gävleborgs län'),
  ('2183', 'Bollnäs', '21', 'SE313', 'Gävleborgs län'),
  ('2184', 'Hudiksvall', '21', 'SE313', 'Gävleborgs län'),
  ('2260', 'Ånge', '22', 'SE321', 'Västernorrlands län'),
  ('2262', 'Timrå', '22', 'SE321', 'Västernorrlands län'),
  ('2280', 'Härnösand', '22', 'SE321', 'Västernorrlands län'),
  ('2281', 'Sundsvall', '22', 'SE321', 'Västernorrlands län'),
  ('2282', 'Kramfors', '22', 'SE321', 'Västernorrlands län'),
  ('2283', 'Sollefteå', '22', 'SE321', 'Västernorrlands län'),
  ('2284', 'Örnsköldsvik', '22', 'SE321', 'Västernorrlands län'),
  ('2303', 'Ragunda', '23', 'SE322', 'Jämtlands län'),
  ('2305', 'Bräcke', '23', 'SE322', 'Jämtlands län'),
  ('2309', 'Krokom', '23', 'SE322', 'Jämtlands län'),
  ('2313', 'Strömsund', '23', 'SE322', 'Jämtlands län'),
  ('2321', 'Åre', '23', 'SE322', 'Jämtlands län'),
  ('2326', 'Berg', '23', 'SE322', 'Jämtlands län'),
  ('2361', 'Härjedalen', '23', 'SE322', 'Jämtlands län'),
  ('2380', 'Östersund', '23', 'SE322', 'Jämtlands län'),
  ('2401', 'Nordmaling', '24', 'SE331', 'Västerbottens län'),
  ('2403', 'Bjurholm', '24', 'SE331', 'Västerbottens län'),
  ('2404', 'Vindeln', '24', 'SE331', 'Västerbottens län'),
  ('2409', 'Robertsfors', '24', 'SE331', 'Västerbottens län'),
  ('2417', 'Norsjö', '24', 'SE331', 'Västerbottens län'),
  ('2418', 'Malå', '24', 'SE331', 'Västerbottens län'),
  ('2421', 'Storuman', '24', 'SE331', 'Västerbottens län'),
  ('2422', 'Sorsele', '24', 'SE331', 'Västerbottens län'),
  ('2425', 'Dorotea', '24', 'SE331', 'Västerbottens län'),
  ('2460', 'Vännäs', '24', 'SE331', 'Västerbottens län'),
  ('2462', 'Vilhelmina', '24', 'SE331', 'Västerbottens län'),
  ('2463', 'Åsele', '24', 'SE331', 'Västerbottens län'),
  ('2480', 'Umeå', '24', 'SE331', 'Västerbottens län'),
  ('2481', 'Lycksele', '24', 'SE331', 'Västerbottens län'),
  ('2482', 'Skellefteå', '24', 'SE331', 'Västerbottens län'),
  ('2505', 'Arvidsjaur', '25', 'SE332', 'Norrbottens län'),
  ('2506', 'Arjeplog', '25', 'SE332', 'Norrbottens län'),
  ('2510', 'Jokkmokk', '25', 'SE332', 'Norrbottens län'),
  ('2513', 'Överkalix', '25', 'SE332', 'Norrbottens län'),
  ('2514', 'Kalix', '25', 'SE332', 'Norrbottens län'),
  ('2518', 'Övertorneå', '25', 'SE332', 'Norrbottens län'),
  ('2521', 'Pajala', '25', 'SE332', 'Norrbottens län'),
  ('2523', 'Gällivare', '25', 'SE332', 'Norrbottens län'),
  ('2560', 'Älvsbyn', '25', 'SE332', 'Norrbottens län'),
  ('2580', 'Luleå', '25', 'SE332', 'Norrbottens län'),
  ('2581', 'Piteå', '25', 'SE332', 'Norrbottens län'),
  ('2582', 'Boden', '25', 'SE332', 'Norrbottens län'),
  ('2583', 'Haparanda', '25', 'SE332', 'Norrbottens län'),
  ('2584', 'Kiruna', '25', 'SE332', 'Norrbottens län')
on conflict (code) do nothing;

-- Län på köpare: orgnr mot kommunlistan, "X kommun"/"X stad", "Region X",
-- NUTS3 på köparen, tilldelningarnas län, sist kommunnamnet först i ett
-- bolagsnamn (Mölndalsbostäder, Hyresbostäder i Norrköping). Rör bara köpare
-- utan län. Returnerar antal köpare som fick län.
create or replace function public.procurement_resolve_buyer_counties()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_count integer := 0;
  v_n integer;
begin
  -- a) Kommunens orgnr ur köpare som heter "X kommun" eller "X stad"
  with named as (
    select distinct on (m.code) m.code, b.org_number
    from public.procurement_municipalities m
    join public.procurement_buyers b
      on b.org_number like '212000%'
     and lower(regexp_replace(b.name, '\s*\(.*\)\s*$', '')) in (
       lower(m.name) || ' kommun', lower(m.name) || 's kommun',
       lower(m.name) || ' stad', lower(m.name) || 's stad',
       lower(regexp_replace(m.name, 'n$', '')) || ' kommun'
     )
    where m.org_number is null
    order by m.code, b.org_number
  )
  update public.procurement_municipalities m
     set org_number = named.org_number, updated_at = now()
    from named
   where m.code = named.code
     and not exists (select 1 from public.procurement_municipalities x where x.org_number = named.org_number);

  -- b) Kommuner på orgnr
  update public.procurement_buyers b
     set county_code = m.county_code, county_name = m.county_name, sector = coalesce(b.sector, 'kommun')
    from public.procurement_municipalities m
   where b.county_code is null and m.org_number is not null and b.org_number = m.org_number;
  get diagnostics v_n = row_count; v_count := v_count + v_n;

  -- c) Kommuner på namn (även utan orgnr)
  update public.procurement_buyers b
     set county_code = m.county_code, county_name = m.county_name
    from public.procurement_municipalities m
   where b.county_code is null
     and lower(regexp_replace(b.name, '\s*\(.*\)\s*$', '')) in (
       lower(m.name) || ' kommun', lower(m.name) || 's kommun',
       lower(m.name) || ' stad', lower(m.name) || 's stad',
       lower(regexp_replace(m.name, 'n$', '')) || ' kommun'
     );
  get diagnostics v_n = row_count; v_count := v_count + v_n;

  -- d) Regioner
  update public.procurement_buyers b
     set county_code = r.county_code, county_name = r.county_name, sector = coalesce(b.sector, 'region')
    from (values
      ('region stockholm', 'SE110', 'Stockholms län'), ('region uppsala', 'SE121', 'Uppsala län'),
      ('region sörmland', 'SE122', 'Södermanlands län'), ('region östergötland', 'SE123', 'Östergötlands län'),
      ('region jönköping', 'SE211', 'Jönköpings län'), ('region kronoberg', 'SE212', 'Kronobergs län'),
      ('region kalmar', 'SE213', 'Kalmar län'), ('region gotland', 'SE214', 'Gotlands län'),
      ('region blekinge', 'SE221', 'Blekinge län'), ('region skåne', 'SE224', 'Skåne län'),
      ('region halland', 'SE231', 'Hallands län'), ('västra götalandsregionen', 'SE232', 'Västra Götalands län'),
      ('region värmland', 'SE311', 'Värmlands län'), ('region örebro', 'SE124', 'Örebro län'),
      ('region västmanland', 'SE125', 'Västmanlands län'), ('region dalarna', 'SE312', 'Dalarnas län'),
      ('region gävleborg', 'SE313', 'Gävleborgs län'), ('region västernorrland', 'SE321', 'Västernorrlands län'),
      ('region jämtland', 'SE322', 'Jämtlands län'), ('region västerbotten', 'SE331', 'Västerbottens län'),
      ('region norrbotten', 'SE332', 'Norrbottens län')
    ) as r(prefix, county_code, county_name)
   where b.county_code is null and lower(b.name) like r.prefix || '%';
  get diagnostics v_n = row_count; v_count := v_count + v_n;

  -- e) NUTS3 på köparen (TED)
  update public.procurement_buyers b
     set county_code = n.code, county_name = n.county_name
    from (
      select distinct on (b2.id) b2.id, c.code, m.county_name
      from public.procurement_buyers b2
      cross join lateral unnest(b2.nuts_codes) as c(code)
      join (select distinct county_code, county_name from public.procurement_municipalities) m on m.county_code = c.code
      where b2.county_code is null
      order by b2.id, c.code
    ) n
   where b.id = n.id;
  get diagnostics v_n = row_count; v_count := v_count + v_n;

  -- f) Tilldelningarnas län (vanligaste)
  update public.procurement_buyers b
     set county_code = t.county_code, county_name = t.county_name
    from (
      select distinct on (a.buyer_id) a.buyer_id, a.county_code, m.county_name
      from public.procurement_awards a
      join (select distinct county_code, county_name from public.procurement_municipalities) m on m.county_code = a.county_code
      where a.buyer_id is not null and a.county_code is not null
      group by a.buyer_id, a.county_code, m.county_name
      order by a.buyer_id, count(*) desc
    ) t
   where b.id = t.buyer_id and b.county_code is null;
  get diagnostics v_n = row_count; v_count := v_count + v_n;

  -- g) Kommunala bolag: kommunnamnet som ord eller ordbörjan i bolagsnamnet.
  -- Längsta namnet vinner, minst fem tecken så att korta namn inte ger falska träffar.
  update public.procurement_buyers b
     set county_code = x.county_code, county_name = x.county_name
    from (
      select distinct on (b2.id) b2.id, m.county_code, m.county_name
      from public.procurement_buyers b2
      join public.procurement_municipalities m
        on length(m.name) >= 5
       and lower(b2.name) ~ ('(^|[[:space:]-])' || lower(m.name))
      where b2.county_code is null
        and coalesce(b2.sector, '') in ('kommunalt bolag', 'regionalt bolag', '')
      order by b2.id, length(m.name) desc
    ) x
   where b.id = x.id;
  get diagnostics v_n = row_count; v_count := v_count + v_n;

  -- Tilldelningar utan län ärver köparens
  update public.procurement_awards a
     set county_code = b.county_code
    from public.procurement_buyers b
   where a.buyer_id = b.id and a.county_code is null and b.county_code is not null;

  return v_count;
end;
$$;

revoke execute on function public.procurement_resolve_buyer_counties() from public, anon, authenticated;

select public.procurement_resolve_buyer_counties();

-- ---------------------------------------------------------------------------
-- 5. Anbudsbibliotek och utkast per krav

create table if not exists public.procurement_answers (
  id uuid primary key default gen_random_uuid(),
  criterion_type text not null default 'annat',   -- rapportering, egenkontroll, miljo, kvalitetssakring, bemanning, installelsetid, kommunikation, annat
  title text not null,
  criterion_text text,                              -- kriteriet svaret skrevs för
  answer text not null,
  tags text[] not null default '{}',
  source_notice_id uuid references public.procurement_notices(id) on delete set null,
  source_requirement_id uuid references public.procurement_requirements(id) on delete set null,
  use_count integer not null default 0,
  last_used_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists procurement_answers_type_idx on public.procurement_answers (criterion_type);
create index if not exists procurement_answers_search_idx on public.procurement_answers
  using gin (to_tsvector('swedish', coalesce(title, '') || ' ' || coalesce(criterion_text, '') || ' ' || answer));

alter table public.procurement_answers enable row level security;
revoke all on public.procurement_answers from anon;
grant select, insert, update, delete on public.procurement_answers to authenticated;
drop policy if exists procurement_answers_select on public.procurement_answers;
create policy procurement_answers_select on public.procurement_answers
  for select to authenticated using (public.has_procurement_access());
drop policy if exists procurement_answers_write on public.procurement_answers;
create policy procurement_answers_write on public.procurement_answers
  for all to authenticated using (public.has_procurement_access()) with check (public.has_procurement_access());

drop trigger if exists procurement_answers_touch on public.procurement_answers;
create trigger procurement_answers_touch before update on public.procurement_answers
  for each row execute function public.procurement_touch_updated_at();

alter table public.procurement_requirements
  add column if not exists criterion_type text,
  add column if not exists draft_answer text,
  add column if not exists draft_sources jsonb,
  add column if not exists draft_updated_at timestamptz,
  add column if not exists answer_id uuid references public.procurement_answers(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 6. Utfall sätter status

create or replace function public.procurement_bid_outcome_to_status()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_status text;
  v_label text;
begin
  if new.outcome is null or new.outcome = 'pending' or not coalesce(new.is_current, true) then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.outcome is not distinct from old.outcome then
    return new;
  end if;
  v_status := case new.outcome when 'won' then 'won' when 'lost' then 'lost' when 'cancelled' then 'cancelled' when 'withdrawn' then 'declined' end;
  v_label := case new.outcome when 'won' then 'Vunnen' when 'lost' then 'Förlorad' when 'cancelled' then 'Avbruten' when 'withdrawn' then 'Avstådd' end;
  if v_status is null then return new; end if;

  update public.procurement_notices set our_status = v_status where id = new.notice_id and our_status is distinct from v_status;
  if found then
    insert into public.procurement_events (notice_id, event_type, title, detail, actor_id)
    values (new.notice_id, 'status_from_outcome', 'Status: ' || v_label, 'Satt automatiskt av utfallet på anbudet', auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists procurement_bids_outcome_status on public.procurement_bids;
create trigger procurement_bids_outcome_status
  after insert or update of outcome on public.procurement_bids
  for each row execute function public.procurement_bid_outcome_to_status();

-- ---------------------------------------------------------------------------
-- 7a. Uppföljning av avtalsklockan
--
-- Per tilldelning (ej felträff):
--   new_notice        köparen har en senare annons om skadedjur (matchpoäng från
--                     60 eller CPV 9092) publicerad minst sex månader efter
--                     avtalsstarten och tidigast 30 månader före slutet
--   new_award         köparen har en senare tilldelning om skadedjur med startbas
--                     minst tolv månader efter den här
--   passed_no_notice  slutet har passerat under de senaste två åren utan något av ovan
--   stale             slutet passerade för mer än två år sedan
create or replace function public.procurement_refresh_award_followups()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_today date := (now() at time zone 'Europe/Stockholm')::date;
  v_result jsonb;
begin
  with base as (
    select a.id, a.buyer_id, a.source, a.source_ref, a.notice_id,
           coalesce(a.corrected_end_date, a.calc_end_date) as end_date,
           coalesce(a.start_basis_date, a.contract_start, a.contract_signed_date, a.award_date,
                    (coalesce(a.corrected_end_date, a.calc_end_date) - interval '48 months')::date) as basis
    from public.procurement_awards a
    where a.excluded_reason is null
  ),
  nn as (
    select distinct on (b.id) b.id, n.id as notice_id, n.title, n.published_at,
           coalesce(n.platform_url, (select s.url from public.procurement_notice_sources s where s.notice_id = n.id order by s.fetched_at desc limit 1)) as url
    from base b
    join public.procurement_notices n
      on n.buyer_id = b.buyer_id
     and n.id is distinct from b.notice_id
     and n.notice_kind in ('tender', 'direct', 'rfi', 'prior_information')
     and n.published_at is not null
     and b.basis is not null
     and (n.published_at at time zone 'Europe/Stockholm')::date >= b.basis + 180
     and (b.end_date is null or (n.published_at at time zone 'Europe/Stockholm')::date >= b.end_date - interval '30 months')
     and (n.match_score >= 60 or exists (select 1 from unnest(n.cpv_codes) c where c like '9092%'))
    where b.buyer_id is not null
    order by b.id, n.published_at desc
  ),
  na as (
    select distinct on (b.id) b.id, ob.id as award_id, o.title, ob.basis
    from base b
    join base ob
      on ob.buyer_id = b.buyer_id
     and not (ob.source = b.source and ob.source_ref is not distinct from b.source_ref)
     and b.basis is not null and ob.basis is not null
     and ob.basis >= b.basis + 365
    join public.procurement_awards o on o.id = ob.id
    where b.buyer_id is not null
    order by b.id, ob.basis desc
  ),
  computed as (
    select b.id,
           case
             when nn.id is not null then 'new_notice'
             when na.id is not null then 'new_award'
             when b.end_date is not null and b.end_date < v_today and b.end_date >= v_today - 730 then 'passed_no_notice'
             when b.end_date is not null and b.end_date < v_today - 730 then 'stale'
           end as status,
           nn.notice_id, na.award_id,
           nn.url,
           coalesce(nn.title, na.title) as title,
           coalesce((nn.published_at at time zone 'Europe/Stockholm')::date, na.basis) as fdate
    from base b
    left join nn on nn.id = b.id
    left join na on na.id = b.id
  ),
  upd as (
    update public.procurement_awards a
       set followup_status = c.status,
           followup_notice_id = case when c.status = 'new_notice' then c.notice_id end,
           followup_award_id = case when c.status = 'new_award' then c.award_id end,
           followup_url = case when c.status = 'new_notice' then c.url end,
           followup_title = case when c.status in ('new_notice', 'new_award') then c.title end,
           followup_date = case when c.status in ('new_notice', 'new_award') then c.fdate end,
           followup_checked_at = now()
      from computed c
     where a.id = c.id
    returning a.followup_status
  )
  select jsonb_build_object(
    'checked', count(*),
    'new_notice', count(*) filter (where followup_status = 'new_notice'),
    'new_award', count(*) filter (where followup_status = 'new_award'),
    'passed_no_notice', count(*) filter (where followup_status = 'passed_no_notice'),
    'stale', count(*) filter (where followup_status = 'stale')
  ) into v_result from upd;

  -- Felträffar bär ingen uppföljning
  update public.procurement_awards
     set followup_status = null, followup_notice_id = null, followup_award_id = null,
         followup_url = null, followup_title = null, followup_date = null
   where excluded_reason is not null and followup_status is not null;

  return v_result;
end;
$$;

revoke execute on function public.procurement_refresh_award_followups() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7b. Marknadsdatan i ett anrop
--
-- PostgREST begränsar svaret till max-rows (1 000 i Supabase) även när
-- klienten ber om 5 000. Funktionen returnerar ett enda jsonb-värde med alla
-- tilldelningar (utom felträffar) och anbudsgivare, med leverantör och köpare
-- inline och en bantad rådata (bara fälten marknadsvyerna läser). Körs som
-- anroparen, så RLS (has_procurement_access) gäller.
create or replace function public.procurement_market_dataset()
returns jsonb
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $$
  select jsonb_build_object(
    'awards', coalesce((
      select jsonb_agg(
        (to_jsonb(a) - 'raw')
        || jsonb_build_object(
             'raw', nullif(jsonb_strip_nulls(jsonb_build_object(
               'year', a.raw -> 'year',
               'upphandling', a.raw -> 'upphandling',
               'uppskattat_varde', a.raw -> 'uppskattat_varde',
               'kontrakterat_varde', a.raw -> 'kontrakterat_varde'
             )), '{}'::jsonb),
             'supplier', case when s.id is null then null else jsonb_build_object('id', s.id, 'name', s.name, 'org_number', s.org_number, 'is_begone', s.is_begone) end,
             'buyer', case when b.id is null then null else jsonb_build_object('id', b.id, 'name', b.name, 'org_number', b.org_number, 'county_name', b.county_name, 'customer_id', b.customer_id) end
           )
        order by a.award_date desc nulls last
      )
      from public.procurement_awards a
      left join public.procurement_suppliers s on s.id = a.supplier_id
      left join public.procurement_buyers b on b.id = a.buyer_id
      where a.excluded_reason is null
    ), '[]'::jsonb),
    'bidders', coalesce((
      select jsonb_agg(
        (to_jsonb(d) - 'raw')
        || jsonb_build_object(
             'supplier', case when s.id is null then null else jsonb_build_object('id', s.id, 'name', s.name, 'org_number', s.org_number, 'is_begone', s.is_begone) end
           )
      )
      from public.procurement_bidders d
      left join public.procurement_suppliers s on s.id = d.supplier_id
      where not exists (
        select 1 from public.procurement_awards a
        where a.source = d.source and a.source_ref = d.source_ref and a.excluded_reason is not null
      ) or exists (
        select 1 from public.procurement_awards a2
        where a2.source = d.source and a2.source_ref = d.source_ref and a2.excluded_reason is null
      )
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.procurement_market_dataset() from public, anon;
grant execute on function public.procurement_market_dataset() to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Mercells länkformat, verifierat 2026-09-25 mot app.mercell.com
--    (https://app.mercell.com/tender/{id}, samma id som sök-API:et)

update public.procurement_notice_sources
   set url = 'https://app.mercell.com/tender/' || source_id
 where source = 'mercell' and (url is null or url like 'https://discover.app.mercell.com/tender/%');

update public.procurement_notices
   set platform_url = replace(platform_url, 'https://discover.app.mercell.com/tender/', 'https://app.mercell.com/tender/')
 where platform_url like 'https://discover.app.mercell.com/tender/%';
