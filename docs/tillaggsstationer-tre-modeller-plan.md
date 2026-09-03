# Plan: tilläggsstationer med tre betalningsmodeller och två avtalslägen

Status: skriven 2026-09-03, validerad av två expertagenter (ekonomi/fakturering respektive fältflöde/RLS/avtalskarta) samma dag, fas 0 till 4 implementerade och pushade till main 2026-09-03. Inget browser-testat.

## 1. Affärsregler (Christian 2026-09-03)

1. En tilläggsstation (station utöver avtalet, `is_addon`) betalas på ett av tre sätt, valt av teknikern vid utsättning: **per år**, **per månad** (årspriset delat med tolv) eller **per etablering/kontroll**.
2. Priset kommer från kundens prislista. Finns inget pris ska ett årspris läggas upp som utgångsläge.
3. Per år: vid utsättning faktureras perioden fram till nästa årspremie. När årspremien faktureras debiteras stationerna för kommande år igen, parallellt med avtalet.
4. Debitering sker alltid mot antal utplacerade tilläggsstationer vid debiteringstillfället. Inga krediteringar.
5. Två avtalslägen, styrda från avtalskartan med drag och släpp:
   - **Inbakat i avtalet**: stationerna bakas in i årspremien. Det ska framgå i text att stationerna adderats, med antal och datum.
   - **Tillägg utöver avtalet**: stationerna löper parallellt och faktureras på egna fakturor som avser tilläggen (LOU-kunden FEV).

## 2. Beslut som planen utgår från

Öppna frågor besvaras så här om inget annat sägs:

- Etableringsavgift tas bara ut för per kontroll. Per år och per månad får i stället en första periodfaktura (pro rata) från utsättningsdatumet.
- Debiteringstillfället för en avtalsfaktura är sändningen till Fortnox. Fakturan planeras om före sändning, och cronen uppdaterar redigerbara fakturor vars tilläggsrader avviker. Skickade fakturor rörs aldrig.
- Per månad ger alltid egna månadsfakturor, oavsett kundens gruppering av ärendefakturor.
- Förvald modell i utsättningsformuläret är per år när ett årspris finns i kundens prislista, annars per kontroll.
- Inbakat-läget ger ett premiesteg med text plus en textrad på nästa årspremiefaktura. Ingen § 4-rad.
- Årspriset bärs av en ny tjänst "Tilläggsstation per år" (flagga `used_for_addon_stations_annual`). Tjänst 43 "Betesstation Månadskostnad" fortsätter betyda pris per kontroll. Månad = årspris / 12, avrundat till hela kronor.
- Byte av modell eller läge slår igenom vid nästa debitering. Ingen kreditering.

## 3. Datamodell

| Tabell | Kolumn | Värden | Kommentar |
|---|---|---|---|
| equipment_placements, indoor_stations | `addon_billing_model` | per_year, per_month, per_round, null | CHECK: satt om och endast om `is_addon`. Befintliga tilläggsstationer backfylls till per_round. |
| equipment_placements, indoor_stations | `addon_contract_mode` | included, separate, null | Sätts från avtalskartan. null = ej beslutat (brickan visas). per_round-stationer har alltid null. |
| contracts | `equipment_invoice_mode` | with_premium, separate | Default with_premium. FEV får separate. |
| case_billing_items | `billing_model` | premium, per_year, per_month, per_round | CHECK utökas med per_month. |
| case_billing_items | `site_customer_id` | uuid null | Enheten en § 6-rad avser, så raden kan visa "typ · enhet · N st". |
| services | `used_for_addon_stations_annual` | bool | Partiellt unikt index, som `used_for_addon_stations`. |
| invoices | `contract_invoice_kind` | premium, equipment | Finns redan i CHECK. Egna fakturor för tillägg får equipment. |

## 4. Flöden

### 4.1 Utsättning (tekniker)

- Formulären ute och inne visar, när "tillägg utöver avtal" är ikryssat, tre val med pris: "per år 2 348 kr", "per månad 196 kr", "per kontroll 587 kr". Priserna hämtas via prislist-RPC:n: årstjänsten för år och månad, tjänst 43 för kontroll. Saknas pris visas "pris saknas".
- Valet sparas på stationen och följer med i "kopiera från föregående".
- Bakgrundssynken vid utsättning: per kontroll synkar etableringsraden som i dag (RPC filtrerar per_round). Per år och per månad synkar i stället § 6-raden på kundens avtal via ny RPC `sync_addon_period_lines` (SECURITY DEFINER): en rad per (avtal, stationstyp, modell, enhet) med `quantity` = antal aktiva stationer, `unit_price` = årspris (per_year) eller årspris/12 (per_month).
- "Färdig med etablering": per kontroll som i dag. Per år och per månad: en tjänsterad på etableringsärendet "Tilläggsstationer per år, pro rata 2026-10-12 till 2027-06-30, 3 st" med belopp = årspris × antal × dagar/365 (per månad: månadspris × antal × dagar kvar/30), som faktureras via merförsäljningsflödet. Ingen etableringsavgift.

### 4.2 Per kontroll

Som i dag. Rundräkning, etableringsräkning och avslutsvakten räknar bara stationer med `addon_billing_model = per_round`.

### 4.3 Per år och per månad, tillägg utöver avtalet

- § 6-raderna med billing_model per_year och per_month planeras av `contractPlanner`. per_year följer avtalets perioder som i dag (`equipmentRows`). per_month får egna månadsperioder via ny `computePlannedEquipmentPeriods`.
- `contracts.equipment_invoice_mode = separate`: per_year-rader lyfts ur premiefakturan och bildar egna fakturor med `contract_invoice_kind = equipment` per period. per_month-rader bildar alltid egna månadsfakturor.
- `with_premium`: per_year-rader ligger kvar på premiefakturan (dagens beteende).
- Antal vid debiteringstillfället: `loadContractSources` synkar `quantity` på § 6-raderna från aktiva stationer innan planering, i webben och i cronen. Cronen får ett nytt steg som uppdaterar redigerbara fakturor (draft, pending_approval, ready) vars tilläggsrader avviker. InvoiceDetailModal planerar om avtalsfakturan före Fortnox-sändning.
- Samlad faktura: equipment-fakturor samlas aldrig, de planeras per avtal.
- Fakturatext: "Tilläggsstationer Aurotrap, utöver avtal Avfallsanläggning, 2027-07-01 t.o.m. 2028-06-30, 3 st". Remarks: "Tilläggsstationer utöver avtal {label} · Period …". Märkning = enhetens referens när alla rader avser en enhet, annars avtalets.

### 4.4 Inbakat i avtalet

- Släpp av brickan på § 7: `ContractScopeService.addAddonStationsToPremium`: premiesteg `addition` från valt datum med `annual_value` = gällande + antal × årspris och note "Tilläggsstationer adderade till avtalet, 3 st Aurotrap på Återvinningscentralen, 2026-10-12". contract_events-post. Stationerna får `addon_contract_mode = included`. Eventuell § 6-rad för stationerna avslutas.
- Fakturan: `buildRowsForContract` (webb) och `buildRows` (cron) lägger en textrad (0 kr, line_kind index_note) med stegets note på fakturan för den period där steget träder i kraft.
- Rundräkning och etableringsräkning hoppar över included-stationer.

### 4.5 Avtalskartan

- Bricka "Tilläggsstationer · {enhet} · {typ} · N st" per (enhet, stationstyp) för stationer med modell per år eller per månad och `addon_contract_mode` null eller separate utan § 6-rad. Visas i § 6-området på det avtal vars omfattning täcker enheten.
- Ny släppzon `premium` runt § 7. Släpp på § 7 = inbakat, släpp på § 6 = tillägg utöver avtalet. Datumpopover med datum och pris per station.
- § 6 visar raderna med typ, enhet och antal, plus en växel "Utrustning faktureras: på premiefakturan / på egen faktura" (`equipment_invoice_mode`).
- § 7 får rad 7.5 "Tillägg faktureras separat: nästa … kr" när egna fakturor finns. Fakturaplanens förhandsvisning märker posterna med typ.

### 4.6 Rättelse av "Lägg till i avtalet"

RPC `apply_contract_addition` v2 höjer årspremien och lägger samtidigt en § 6-rad per_year. Planeraren summerar båda. Rättelse: raden skapas med billing_model `premium` (innehåll, beloppet via trappan). Inga tillägg finns i produktion ännu.

## 5. Faser

| Fas | Innehåll |
|---|---|
| 0 | Rättelse 4.6. Migration: alla kolumner i avsnitt 3, ny tjänst, RPC-filter per_round, ny RPC sync_addon_period_lines, typer. |
| 1 | Tekniker: modellval i båda formulären, spara och kopiera, filter i addonStationBillingService och avslutsvakten, Färdig-dialogen per modell med pro rata-rad. |
| 2 | Planerare, generator, cron: fakturatyp equipment, equipment_invoice_mode, per_month-perioder, antalssynk vid planering, cronuppdatering av redigerbara fakturor, textrad för addition-steg, omplanering före Fortnox-sändning, badge i förhandsvisningen, import med kind. |
| 3 | Avtalskartan: bricka, zoner, inbakat och tillägg, § 6-växel och radvisning, rad 7.5. |
| 4 | Data: tjänsten "Tilläggsstation per år" med golvpris i standardprislistan, FEV:s 2 348 kr flyttas dit, FEV equipment_invoice_mode separate. Dokument och minne. |

## 6. Risker

- Diffen i generatorn måste vara typmedveten i varje gren, annars raderas eller dubbleras fakturor. Testfall: ett avtal med premie plus equipment samma period, i båda lägena.
- Cronens täckningsnyckel måste innehålla typ, annars skapas dubbla fakturor första körningen.
- Modellkrock: alla räkningar filtrerar på `addon_billing_model` och `addon_contract_mode`.
- Vikarie-RLS: all synk via SECURITY DEFINER-RPC med rollkontroll.
- Multisite: stationer ligger på enhetsrader, fakturerande kund är avtalskunden. Räkning via contract_sites.
- Synth-kunder utan avtalsrad kan inte få per år eller per månad. Formuläret visar bara per kontroll då.


## 7. Validering och avvikelser från planen (2026-09-03)

Granskningarna gav 33 fynd. De som ändrade bygget:

- Diffen, cronens täckningsnyckel, samlingsfakturan och Fortnox-täckningen är typmedvetna: nyckel = fakturatyp + periodstart. Ny fakturatyp `equipment_monthly` för per månad, eftersom per år och per månad annars kolliderar på samma periodstart.
- § 6-raderna fick `billing_start_date` (nästa periodstart vid skapande). Pro rata-raden täcker fram dit, raden tas med i perioder från och med datumet. Ingen dubbeldebitering mellan pro rata och första helårsrad. Pro rata skapas inte alls när periodens faktura fortfarande är redigerbar: då tar den fakturan upp stationerna.
- Pro rata-raden görs av en SECURITY DEFINER-RPC (`sync_addon_prorata_line`) med egen markör `is_addon_prorata_line`, eftersom vikarier inte kan läsa ärendet. Periodstart räknas i SQL (`contract_next_period_start`).
- Stationerna fick `addon_contract_id` (sätts av avtalskartan). RPC:n löser annars avtal per enhet i samma ordning som get_contract_candidates. Trigger `addon_station_normalize` håller kolumnerna konsekventa så äldre skrivvägar utan modell inte spricker.
- Godkänd faktura (ready) vars rader ändras går tillbaka till pending_approval. Cronen byter bara utrustningsrader när övriga rader är oförändrade.
- Fakturamodalen planerar om bara den aktuella fakturan före sändning och skickar textrader som ren Description. Radtext kapas vid 200 tecken.
- Befintliga RPC:n `sync_addon_station_line` fick behörighetsvakt. Stationspolicyerna på equipment_placements går på profiles.user_id (7 av 26 profiler hade id skilt från user_id).
- Inbakat-läget upsertar trappsteget per dag och typ (unik nyckel) och lyfter senare steg med samma belopp.
- Månadspris avrundas till öre, inte hela kronor (2 348 / 12 = 195,67).

Kvar efter bygget: klicktest av hela kedjan, golvpris på tjänst 144 i standardprislistan (affärsdata), Pulse Rat iQ för larmet på Nytäppan (ej skapad), FEV:s Fortnox 648/744/745/862 importeras som typ equipment i § 7.
