# Guidemallen

Standard för alla guider i handboken, godkänd av Christian 2026-10-16.
Förslaget med exempel: https://claude.ai/artifact/LV99EAhqPvXZ6WG1Y4DFsr

## Grundregler

- **En guide, en uppgift, en roll.** Titeln är uppgiften skriven som det man vill göra: "Boka ett återbesök", inte "Återbesök".
- **Tekniker och kontor ser aldrig varandras guider.** Gör båda samma sak blir det två guider: tekniker i telefonen, kontor på datorn. `audience_roles` styr vem som ser guiden. Tekniker = `['technician']`. Kontor = `['admin','koordinator']`, plus `'säljare'` när säljare gör samma sak.
- **Läs koden, inte minnet.** Varje påstående, knappnamn och felmeddelande kontrolleras mot källkoden i dag. Knappnamn och felmeddelanden citeras exakt.
- **Teknikerna behöver mest hjälp.** Skriv för någon som aldrig har sett skärmen. En handling per steg. Säg alltid vad man ser efteråt.

## De åtta delarna, alltid i denna ordning

| # | Block | Innehåll | Regler |
|---|---|---|---|
| 1 | `intro` | `roller`, `var`, `tar`, `behover`, `enhet` (`mobil`/`dator`) | `var` = var i portalen, t.ex. "Ärendet › fotspåren uppe till höger" |
| 2 | `kortsvar` | `text` | 1 till 3 meningar. Det man ska veta om man inte läser mer |
| 3 | `visning` | `steg: [{ text, ser }]` | Högst 7 steg. Fler = dela guiden. Modulens `Visning` ritar skärmen per steg |
| 4 | `felsok` | `items: [{ fraga, svar }]` | Det man ser när det krånglar, felmeddelanden ordagrant. 2 till 5 st |
| 5 | `bra` | `items` | Högst 5 punkter: regler, undantag, vad som händer i bakgrunden |
| 6 | `ovning` | `uppdrag` | Alltid med. Modulens `Ovning`: samma skärmar utan markörer, tips vid fel |
| 7 | `quiz` | `fragor: [{ fraga, alternativ, ratt, forklaring }]` | 2 eller 3 frågor ur verkligheten, 3 alternativ var |
| 8 | `avslut` | `lankar` (högst 3), `fraga` | Länka bara till guider som samma roll ser. `fraga` = vem man frågar |

Rubrikerna för del 3 till 8 skrivs ut automatiskt. Skriv inga egna `h2`.
Enstaka `p`, `callout`, `list` eller `interactive` får läggas in efter en del när det verkligen behövs, till exempel en räknare efter Bra att veta. Mallkollen på guidesidan (syns bara för admin) varnar när en del saknas eller ligger fel.

I all text i mallens block blir `[[Knappnamn]]` en knapp och `[[Knappnamn|ikon.namn]]` en knapp med portalens ikon.

## Skrivregler

- Du-form. Korta meningar. En handling per mening.
- **Tryck**, aldrig klicka.
- Knappnamn, fältnamn och felmeddelanden exakt som i portalen.
- Datum som 2026-10-20. Belopp som 2 750 kr. Komma som decimaltecken.
- Inga tankstreck (varken – eller —). Använd punkt, kolon eller komma.
- Inga piller i skärmarna: status är punkt och text (`Status` i skärmkitet).
- Påhittade kunder och kollegor: Familjen Exempel, Exempel AB, Brf Exempelgården, Anna Exempel. Aldrig riktiga kunder.
- Inga löften om sådant portalen inte gör. Är något osäkert: skriv det inte, rapportera det.

## Guidemodulen

En fil per guide: `src/pages/shared/intranet/guider/<slug>.tsx`. Den hittas automatiskt.
Delade hjälpdelar för flera guider läggs i filer som börjar med `_`, till exempel `guider/_leads.tsx`.

```tsx
import type { GuideModul } from './registry'
function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) { ... }
function Ovning() { ... }
export default { Visning, Ovning } satisfies GuideModul
```

- `Visning` ritar skärmen för steg `steg` (0 = första) med `markor={{ pa: true, nr: steg + 1 }}` på det man ska trycka på, och anropar `onNasta` när man trycker på det markerade.
- `Ovning` använder `OvningRam` (framsteg, svar, Börja om) runt samma skärm utan markörer. Fel tryck ger `{ typ: 'fel' }` med ett konkret tips. Klart ger `{ typ: 'ok' }` med vad som hände.
- Skärmarna byggs med skärmkitet `src/pages/shared/intranet/skarmkit`: `Telefon`, `Dator`, `DatorSida`, `ArendeHuvud`, `IkonKnapp`, `Flikar`, `Kort`, `Rad`, `Ark`, `Val`, `Falt`, `Kryssruta`, `PKnapp`, `Knapprad`, `Notis`, `Status`, `Markor`, `OvningRam`.
- Ikoner: `Icon` från `src/components/icons/Icon` med portalens namn (`arende.aterbesok`, `allman.kalender`, `sok.faktura` ...). Samma ikon som portalen visar på samma ställe.
- Facit: `guider/guide-aterbesok.tsx` och `supabase/migrations/20261016_guidemallen_00_aterbesok.sql`.

## När en funktion ändras

Guiden ändras i samma leverans, precis som uppdateringsloggen.
