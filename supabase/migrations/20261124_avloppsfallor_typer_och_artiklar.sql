-- Avloppsfällor som egna stationstyper med valbara produkter (2026-11-24, Christian).
-- Två typer, Avloppsfälla Trap-X och Avloppsfälla RAT-EXX, upplagda som Mekanisk fälla
-- (antal avdödade, samma gränser, serienummer krävs) tills teknikerna vet vad som ska
-- registreras. 21 interna artiklar: inköpspris som default_price, Fortnox-numret i
-- fortnox_article_id. RAT-EXX har RSK-numret som kod, Trap-X saknar leverantörsnummer
-- och får TRAPX-<Fortnox-nummer>. Bara fällorna är valbara som produkt vid placering.
-- Varaktig utrustning = det som står kvar hos kunden. Tänger, förlängning och laddare
-- är egna verktyg, kommunikationen är en löpande kostnad per år.
-- Typerna har ingen egen tilläggstjänst (annual_service_id tom).

with gnagare as (
  select id from article_groups where slug = 'gnagare'
),
nya_artiklar as (
  insert into articles (code, name, description, unit, default_price, vat_rate, category, is_active, sort_order, fortnox_article_id, group_id, is_durable, icon)
  select v.code, v.name, v.description, 'st', v.pris, 25.00, v.category, true, v.sort_order, v.fortnox, (select id from gnagare), v.durable, v.icon
  from (values
    ('2358555', 'RAT-EXX 110, dim Ø114, längd 210 mm', 'Avloppsfälla RAT-EXX. RSK 2358555. Inköp: listpris 18 858 kr, 20 % rabatt.', 15086.40, 'Bekämpning', 220, '201', true,  'avloppsfalla'),
    ('2358556', 'RAT-EXX 160, dim Ø168, längd 288 mm', 'Avloppsfälla RAT-EXX. RSK 2358556. Inköp: listpris 19 647 kr, 20 % rabatt.', 15717.60, 'Bekämpning', 221, '202', true,  'avloppsfalla'),
    ('2358561', 'RAT-EXX 200, dim Ø204, längd 356 mm', 'Avloppsfälla RAT-EXX. RSK 2358561. Inköp: listpris 22 016 kr, 20 % rabatt.', 17612.80, 'Bekämpning', 222, '203', true,  'avloppsfalla'),
    ('2358613', 'RAT-EXX 250, dim Ø250, längd 356 mm', 'Avloppsfälla RAT-EXX. RSK 2358613. Inköp: listpris 26 847 kr, 20 % rabatt.', 21477.60, 'Bekämpning', 223, '204', true,  'avloppsfalla'),
    ('2358614', 'RAT-EXX 315, dim Ø315, längd 510 mm', 'Avloppsfälla RAT-EXX. RSK 2358614. Inköp: listpris 35 472 kr, 20 % rabatt.', 28377.60, 'Bekämpning', 224, '205', true,  'avloppsfalla'),
    ('2358557', 'Impulsgenerator utbytesenhet RAT-EXX 110/160', 'Utbytesenhet till RAT-EXX 110 och 160. RSK 2358557. Inköp: listpris 12 611 kr, 20 % rabatt.', 10088.80, 'Tillbehör', 225, '206', true, null),
    ('2358558', 'Impulsgenerator utbytesenhet RAT-EXX 200/250', 'Utbytesenhet till RAT-EXX 200 och 250. RSK 2358558. Inköp: listpris 14 082 kr, 20 % rabatt.', 11265.60, 'Tillbehör', 226, '207', true, null),
    ('TRAPX-31',  'Trap X fälla (ATEX)', 'Komplett avloppsfälla Trap X. Normalpris 1 till 9 fällor, inköpspris omräknat från danska kronor.', 25500.00, 'Bekämpning', 227, '31', true, 'avloppsfalla'),
    ('TRAPX-46',  'Trap X kommunikation per år', 'Löpande kostnad per fälla och år för kommunikationen. Ska tas betalt för av kunden.', 735.00, 'Övrigt', 228, '46', false, null),
    ('TRAPX-146', 'Batteri - Trap X', 'Tillbehör som köps separat.', 3562.50, 'Tillbehör', 229, '146', true, null),
    ('TRAPX-147', 'Batteriladdare - Trap-X', 'Tillbehör som köps separat. Eget verktyg.', 1650.00, 'Tillbehör', 230, '147', false, null),
    ('TRAPX-148', 'Extra antennkabel och antenn - Trap X', 'Tillbehör som köps separat.', 487.50, 'Tillbehör', 231, '148', true, null),
    ('TRAPX-149', 'Extra vingar 160 - Trap X', 'Tillbehör som köps separat.', 735.00, 'Tillbehör', 232, '149', true, null),
    ('TRAPX-150', 'Extra vingar 200 - Trap X', 'Tillbehör som köps separat.', 735.00, 'Tillbehör', 233, '150', true, null),
    ('TRAPX-151', 'Extra vingar 250 - Trap X', 'Tillbehör som köps separat.', 735.00, 'Tillbehör', 234, '151', true, null),
    ('TRAPX-152', 'Montagetång 220-400 mm - Trap X', 'Tillbehör som köps separat. Eget verktyg.', 1125.00, 'Tillbehör', 235, '152', false, null),
    ('TRAPX-153', 'Montagetång 170-300 mm - Trap X', 'Tillbehör som köps separat. Eget verktyg.', 802.50, 'Tillbehör', 236, '153', false, null),
    ('TRAPX-154', 'Montagestångsförlängning 1,5 meter - Trap X', 'Tillbehör som köps separat. Eget verktyg.', 2475.00, 'Tillbehör', 237, '154', false, null),
    ('TRAPX-155', 'Montage krok - Trap X', 'Tillbehör som köps separat.', 487.50, 'Tillbehör', 238, '155', true, null),
    ('TRAPX-156', 'Fleximbel montagekrok - Trap X', 'Tillbehör som köps separat.', 1725.00, 'Tillbehör', 239, '156', true, null),
    ('TRAPX-157', 'Huv till fälla - Trap X', 'Tillbehör som köps separat.', 330.00, 'Tillbehör', 240, '157', true, null)
  ) as v(code, name, description, pris, category, sort_order, fortnox, durable, icon)
  returning id, code
),
medlemskap as (
  insert into article_group_memberships (article_id, group_id)
  select a.id, (select id from gnagare) from nya_artiklar a
  returning id
),
nya_typer as (
  insert into station_types (code, name, description, prefix, color, icon, requires_serial_number,
                             measurement_unit, measurement_label, threshold_warning, threshold_critical,
                             threshold_direction, threshold_source, is_active, sort_order, annual_service_id)
  values
    ('avloppsfalla_trapx',  'Avloppsfälla Trap-X',  'Avloppsfälla av typen Trap X, placeras i brunn eller avloppsledning', 'AT', '#92400e', 'avloppsfalla', true,
     'st', 'Antal avdödade (st)', 5.00, 8.00, 'above', 'station', true, 0, null),
    ('avloppsfalla_ratexx', 'Avloppsfälla RAT-EXX', 'Avloppsfälla av typen RAT-EXX, placeras i avloppsledning. Finns i fem dimensioner', 'AR', '#db2777', 'avloppsfalla', true,
     'st', 'Antal avdödade (st)', 5.00, 8.00, 'above', 'station', true, 0, null)
  returning id, code
),
kopplingar as (
  insert into station_type_articles (station_type_id, article_id, is_default, sort_order)
  select t.id, a.id, (a.code = 'TRAPX-31'), k.sort_order
  from (values
    ('avloppsfalla_trapx',  'TRAPX-31', 0),
    ('avloppsfalla_ratexx', '2358555', 0),
    ('avloppsfalla_ratexx', '2358556', 1),
    ('avloppsfalla_ratexx', '2358561', 2),
    ('avloppsfalla_ratexx', '2358613', 3),
    ('avloppsfalla_ratexx', '2358614', 4)
  ) as k(typkod, artikelkod, sort_order)
  join nya_typer t on t.code = k.typkod
  join nya_artiklar a on a.code = k.artikelkod
  returning id
)
select (select count(*) from nya_artiklar) as artiklar,
       (select count(*) from medlemskap) as gruppmedlemskap,
       (select count(*) from nya_typer) as stationstyper,
       (select count(*) from kopplingar) as produktkopplingar;
