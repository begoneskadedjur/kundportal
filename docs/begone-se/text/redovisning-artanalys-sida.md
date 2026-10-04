# Redovisning av artanalysens egen sida

2026-10-04. Begone Artanalys har nu en egen sida, /artanalys/. Målet med verktyget är försäljning, inte sökmotorer. Artikeln /identifiera-skadedjur/ är kvar i sin helhet. Rutan i artikeln ser ut som förut, men knappen säger nu "Starta analysen" och leder till den nya sidan.

Inget är pushat. Arbetet ligger i begone-se i fyra commits: 5689023 (sidan och ingångarna), 3e5c8f4 och 646ae2c (granskningens rättningar) och 7d5a81c (knappen och släppytan radbryts i smala datorfönster). Kundportalen är inte ändrad. API:t tar redan emot fältet fran och bortser från det, så ingen ny deploy behövdes.

## Kontroller

- `npm run build -- --force` byggde 126 sidor utan fel. `npm run check` gav 0 fel och 0 varningar.
- I dist har /artanalys/, artikeln, startsidan, 404, /prisforslag/, /kontakt/ och de 17 sidorna med förväxlingsrad inga tankstreck, inga belopp, ingen garanti, inga kolonrubriker och inga trasiga interna länkar. Markören KONTROLLERA finns inte kvar i dist.
- /artanalys/ har `noindex, follow`, ingen canonical och inget JSON-LD, och sidan finns inte i sitemap.
- Skärmbilderna togs i 1280 och 390 bredd mot en egen statisk server. Alla externa anrop stängdes av, utom analysanropet, som gick via en proxy till kundportalens API. Två riktiga analyser gjordes på bilden av en vuxen pälsänger på en fönsterbräda. Båda svarade "Vanlig pälsänger", säkerhet Hög, och skickade fran=meny. Ingen sida scrollar i sidled.
- Bilderna ligger i `docs/begone-se/skisser-v3/bygge/artanalys-sida/`. Det finns sidan i viloläge (dator, smalt fönster och mobil med pekskärm), sidan efter analysen, artikelns ruta, megamenyn, mobilmenyn och startsidans ingång.
- Rättning: i ett smalt datorfönster klämdes knappen "Välj film eller bild" ihop bredvid släppytan. Nu hamnar släppytan under knappen när bredden inte räcker.

## Sidans uppbyggnad

1. Överst står rubriken "Vad är det du har hittat?" och en mening om vad besökaren får: ett förslag på art, hur säkert förslaget är och vad hen kan göra nu.
2. Uppladdningen syns utan att besökaren behöver scrolla. På mobil finns knapparna "Ta en bild", "Filma" och "Välj från mobilen". På dator finns en knapp och en yta att släppa filen på.
3. Därefter kommer "Så blir bilden bra" i tre steg och en mening om vad som skickas. Sist i den delen står telefonnumret för den som hellre vill prata direkt.
4. Labbet visar bilden, analyskedjan i fem steg och loggen. I viloläge spelas exemplet en gång och märks "Exempel". Om besökaren har valt reducerad rörelse visas exemplet färdigt och stilla.
5. Efter analysen visas analysprotokollet: trolig art, säkerhet, vad analysen såg, vad arten kan förväxlas med och en bedömning. Under det står "Det här kan du göra nu" och säljrutan. Fokus flyttas till protokollets rubrik.
6. Säljrutan beror på svaret. Så länge formuläret är dolt är telefonen huvudknapp i alla grupper utom "ingen åtgärd" och "inget djur". När ärendet är akut och växeln har stängt men jouren har öppet visas jourens knapp först.
7. Längst ner finns en rad om fastigheter och verksamheter och "Om analysen" som en utfällbar text. Där står vad som sparas: tidpunkt, art, säkerhet och en kod som räknas fram ur IP-adressen. Bilder sparas inte.

## Ingångar

Alla länkar har med ?fran= så att det går att se var besökaren kom ifrån.

- Artikeln /identifiera-skadedjur/: knappen "Starta analysen" (fran=artikel), "Se ett exempel" och "Om analysen" till sidans ankare, och länken i stycket om bilden.
- Megamenyn och mobilmenyn: "Analysera en bild" (fran=meny). Artikellänken "Identifiera skadedjuret" står kvar bredvid.
- Startsidan: en sekundär knapp, "Analysera en bild", under "Vad har du hittat?" (fran=start).
- /prisforslag/ och /kontakt/: en rad under beskrivningen som bara visas vid "Vet inte" och vid "Annat" utan konkret svar (fran=prisforslag och fran=kontakt).
- 404 (fran=404) och ortsidorna via mallen (fran=ort-ortnamn).
- Förväxlingsrader på 17 sidor. Artiklarna är /vaggloss/, /tecken-pa-vaggloss/, /vaggloss-sanering/, /loppor/, /silverfisk/, /kackerlacka/, /bli-av-med-mjolbaggar/, /palsanger/, /kladesmal-palsmal/, /bli-av-med-myror/, /balgeting/ och /rattor/. Tjänstesidorna är silverfisk, kackerlackor, mjölbaggar, pälsänger och mal. Raden står bara där båda arterna som jämförs finns i referenssamlingen.

## Formuläret och det som saknas

Formuläret visas inte än, eftersom INBOUND_URL är tom. Till dess är telefonen huvudknapp. Både artanalysen och offertflödet skickar nu via samma funktion, `skickaForfragan()` i `src/lib/offert.ts`. Därför fungerar formuläret så fort INBOUND_URL är satt och sajten har byggts om. En förfrågan skickar med ingången, resultatet, arten och säkerheten. "Tack" visas bara när mottagaren har svarat att förfrågan kom fram. Annars får besökaren telefonnumret.

Förfrågningsmodulen i kundportalen, som ska ta emot webbförfrågningarna, är inte byggd. Tacket på /prisforslag/ visas fortfarande fast ingenting skickas.

## Mätning

Varje analysanrop skickar fran med sig. API:t sparar inte fältet än. I dag går det alltså att räkna antal analyser, arter och säkerhet i artanalys_anrop, men inte per ingång. Klick på Ring räknas inte.

## Frågor till Christian

1. Ska tabellen artanalys_anrop få en kolumn för ingången, så att antalet analyser per ingång syns?
2. Ska klick på Ring räknas, och i så fall i vilket verktyg?
3. Är det rätt att formuläret är dolt tills INBOUND_URL är satt? Ska tacket på /prisforslag/ rättas samtidigt?
4. Megamenyn har två länkar, "Identifiera skadedjuret" och "Analysera en bild". Vill du ha kvar båda eller bara en?
5. Duger "Starta analysen"? Copyn valde det före ditt förslag "Påbörja analysen" eftersom det är kortare och säger att något händer direkt. Vill du hellre ha "Påbörja" är det ett ord att byta.
6. Fråga E.2 behöver svar före lansering: sparar AI-tjänsten bildrutorna, och i så fall hur länge? E.3 och resten av planens frågor E.1 till E.8 är också öppna.

Underlaget finns i `docs/begone-se/kluster/artanalys-sida.md`.
