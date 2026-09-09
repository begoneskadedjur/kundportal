# Ramavtal: skrivs en gång, avtalen ärver

Byggt 2026-09-10 (migration `20260910_ramavtal.sql`). WBAB:s tre avtal hade § 2 prislista, § 8 löptid och option samt standardreferensen identiskt på tre papper.

## Modell

- Tabell `framework_agreements`: namn, diarienummer, prislista, start, slut, uppsägningstid, förlängningsläge, option, referens, rytm, faktureringsfrekvens och ankarmånad. Kopplad till kund och organisation.
- `contracts.framework_id` pekar på ramavtalet. `contracts.framework_overrides` listar de fält avtalet äger själv (avvikelser). Tomt = allt ärvs.
- Avtalets kolumner FÖRBLIR de effektiva värdena. Planerare, fakturagenerator och cron läser dem som förut. Databasen kopierar ur ramavtalet till varje ärvt fält (`apply_framework_to_contract`) när avtalet kopplas, när ett ärvt fält skrivs och när ramavtalet ändras.
- Skriver klienten ett eget värde på ett ärvt fält blir fältet en avvikelse (BEFORE-trigger). Skriver den null, eller samma värde som ramavtalet, ärvs fältet igen. Ingen kod i klienten behöver veta om ramavtal.

## Pappret

Ett ord: "ur GNU 2026/60" i rubrikraden på § 2, § 7 och § 8 när fältet ärvs. Innehållet visas alltid, aldrig bara en länk.

## Panelen (Avtalet)

Välj ramavtal, "skapa ramavtal ur det här avtalet" (kopierar avtalets värden), "skriv avtalets värden till ramavtalet" (syskonen följer). Antal avvikande fält visas.

## Steg två (ej byggt)

Mallvärden per avtalstyp (§ 2, § 3, § 6, § 8 förifyllda, märkta "från mall") läggs på samma resolver: eget värde, annars ramavtal, annars mall.
