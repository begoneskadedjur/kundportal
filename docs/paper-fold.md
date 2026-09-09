# Hopfällning av paragrafer på avtalspappret

Beslutat 2026-09-09 efter UX-genomgång. Avtal med många enheter (WBAB: 28) blev en vägg av rader. Alla rader finns kvar, men reglerna nedan avgör vad som är öppet när pappret laddas. Kod: `src/components/admin/customers/record/paperFold.tsx`.

## Grundregler

- Rubrikraden är klickytan. Inga knappar, inga chevroner. Till höger i rubrikraden står "visa 28 rader" respektive "dölj" i samma prickiga understrykning som "visa händelser".
- Under en hopfälld rubrik står en sammanfattningsrad i dämpat bläck, som en invikt bilaga. Den är också klickbar.
- Varningar går aldrig att fälla in. Det som skulle stått i orange på en dold rad lyfts till sammanfattningsraden, före den neutrala texten.
- Reglerna styr vid varje laddning. Manuell öppning sparas per avtal och paragraf i sessionStorage. Manuell stängning av ett stycke som reglerna ändå vill ha öppet sparas inte.
- Drag: ett hopfällt stycke öppnar sig efter 400 ms när något dras över det (§ 1 för enheter, § 6 för brickor).
- Utskrift visar allt. Innehållet göms med `hidden print:block`, aldrig avmonterat.

## Per paragraf

| § | Regel | Sammanfattning |
|---|---|---|
| 1 Omfattning | hopfälld över 5 enheter; hela verksamheten och enhetsavtal alltid öppna | "Bylandet, Gonäs, Sörvik … och 25 till · alla gäller fr. 2026-06-30", varning "N enheter upphör inom 30 dagar" |
| 2 Prislista | alltid öppen | |
| 3 Uppföljning | aldrig helt stängd; över 5 enheter visas bara avvikelser (inget schema, efter plan), resten fälls in | "23 enheter följer schemat · nästa 2027-03-02", länk "visa alla 28" |
| 4, 6 | alltid öppna, avtalets ekonomi | |
| 5 Utrustning | hopfälld när det finns rader men inget att besluta; brickor eller nya/borttagna rader sedan senast sedd öppnar stycket | "10 tilläggsrader på 6 enheter · 14 stationer · 1 rad ingår i premien" |

Tröskeln är `FOLD_THRESHOLD = 5` på ett ställe. "Senast sedd" för § 6 är radernas id-lista i localStorage per avtal (`useSeenRows`), sparad så fort stycket visats öppet.

## Omnumrering 2026-09-10

Marginalen är inte längre en paragraf utan en intern notis under § 4 (grå, sans, vänsterkant). Därför: § 5 Utrustning, § 6 Premie och fakturering, § 7 Referenser, § 8 Löptid. "Visa som kund" i pappershuvudet ritar kundportalens komponent (CustomerContractPaper) ur `contract_customer_view()`, som aldrig returnerar kostnader.
