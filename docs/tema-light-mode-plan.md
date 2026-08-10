# Kartläggning: Light mode + dark mode i hela systemet

**Datum:** 2026-08-10
**Status:** Utredning, ej påbörjad. Beslutsunderlag inför implementation.
**Bakgrund:** Portalen är idag hårdkodat mörk. Önskemål: ett ljust läge, valbart per användare.

## Nuläge och omfattning

- **Tailwind 4.1 med CSS-first-setup** (`@import "tailwindcss"` i `src/styles/globals.css`). Mörkt tema är inbyggt i baslagret: `body { bg-slate-950 }`, globala regler tvingar vit text på rubriker, inputs och selects.
- **Omfattningen är enorm om man angriper den naivt:**
  - 592 komponentfiler, varav 512 har mörka bakgrunder
  - ~2 900 `bg-slate-800/900/950`, ~3 700 `text-white`, ~8 300 `text-slate-*`, ~3 300 `border-slate-*` = **över 18 000 hårdkodade färgklasser**
  - `dark:`-varianten används i praktiken inte alls (22 förekomster)
- **Specialfall utanför Tailwind-klasserna:**
  - 1 762 hårdkodade `#20c58f` (brandgrönt, samma i båda teman - OK)
  - 154 ställen med vit text på brandgrön/teal yta (knappar, CTA:er)
  - 187 inline styles med färg, 47 filer med Recharts-diagram (hårdkodade hex i tooltips/axlar)
  - `FullCalendar.css` (20 hex-färger), `DatePickerDarkTheme.css` (38 hex)
  - Toast-styling hårdkodad mörk i `App.tsx`

## Varför den klassiska vägen är fel

Att lägga `dark:`-varianter eller byta till semantiska klasser (`bg-surface` etc.) på 18 000 ställen i 512 filer är månader av arbete med hög regressionsrisk. Det ska vi inte göra.

## Rekommenderad strategi: palett-remapping via CSS-variabler

Tailwind 4 kompilerar färgklasser till CSS-variabler: `bg-slate-900` blir `background-color: var(--color-slate-900)`. Det betyder att **hela appen kan byta tema genom att skriva över variablerna** under en selektor, utan att en enda komponentklass ändras:

```css
html[data-theme="light"] {
  --color-slate-950: #eef2f6;   /* sidbakgrund */
  --color-slate-900: #ffffff;   /* kort, modaler, sidomeny */
  --color-slate-800: #f8fafc;   /* upphöjda ytor, inputs */
  --color-slate-700: #e2e8f0;   /* kanter */
  --color-slate-600: #cbd5e1;
  --color-slate-500: #94a3b8;   /* mittpunkt, ungefär oförändrad */
  --color-slate-400: #64748b;   /* sekundärtext */
  --color-slate-300: #475569;   /* brödtext */
  --color-slate-200: #334155;
  --color-slate-100: #1e293b;
  --color-slate-50:  #0f172a;
  --color-white:     #0f172a;   /* "vit" text blir mörk */
}
```

Kurerad mappningstabell, inte naiv inversion: mörka bakgrunder blir ljusa ytor, ljus text blir mörk, kanterna byter håll. Opacity-varianter (`bg-slate-800/50`) följer med automatiskt eftersom Tailwind 4 löser dem med `color-mix` vid användning. Justeringar efteråt är enradsändringar i en central tabell.

**Verifiering först:** att v4 verkligen kompilerar till `var()` i vår build kontrolleras första timmen av implementationen (bygg + inspektera). Faller det skulle strategin behöva omprövas, men allt talar för att det håller.

## Kända undantag som kräver riktade insatser

1. **Vit text på färgade ytor** (154 st): efter remapping blir "vit" mörk även på gröna knappar. Läsbart men inte snyggt. Fix: byt till `text-[#fff]` (arbitrary value går förbi variabeln) - centralt i `Button.tsx` plus ett svep.
2. **Brandgrön som text på vitt** har svag kontrast (~2.2:1). Acceptabelt initialt; ev. mörkare grön textvariant i ljust läge senare.
3. **Globala basregler** i `globals.css` (body, h1-h6, select-styling, scrollbars) villkoras per tema.
4. **Recharts** (47 filer): delad `chartTheme`-modul som läser aktivt tema för tooltips, axlar, grid.
5. **FullCalendar.css + DatePickerDarkTheme.css**: skrivs om till CSS-variabler (~58 hex totalt, hanterbart).
6. **Toaster**: dynamiska `toastOptions` från tema.
7. **Inline styles** (187): svep, merparten är diagramrelaterade och täcks av punkt 4.

## Per-användare-val

- **DB**: `profiles.theme_preference text CHECK (IN ('dark','light','system')) DEFAULT 'dark'`
- **ThemeContext**: sätter `data-theme` på `<html>`, lyssnar på `prefers-color-scheme` vid 'system', sparar till profil + localStorage
- **Flash-skydd**: litet inline-script i `index.html` som läser localStorage innan första render (annars blinkar fel tema vid sidladdning)
- **UI**: sol/måne-toggle i topheadern i alla portaler + val på profilsidan. Personligt val, inte admin-styrt.

## Fasplan och estimat

| Fas | Innehåll | Estimat |
|---|---|---|
| 1. Grunden | Mappningstabell i globals.css, ThemeContext, DB-kolumn, toggle, flash-skydd. Hela appen får fungerande ljust läge direkt, med skavanker | ~1 dag |
| 2. Undantagen | text-white-på-färg-svepet, Toaster, DatePicker/FullCalendar-CSS, basregler, scrollbars | ~1-2 dagar |
| 3. Diagram + kontrast | chartTheme för Recharts, inline styles, kontrastjusteringar | ~1-2 dagar |
| 4. QA/polish | Skärmgenomgång av stora vyer per portal (dashboards, schema, modaler), justera mappningen centralt | löpande |

**Totalt ~3-5 arbetsdagar till bra nivå.** Utrullning: dark förblir default, light lanseras som opt-in så att skavanker i fas 2-3 aldrig drabbar någon som inte valt det.

## Risker

- Enstaka ytor ser fel ut i ljust läge tills fas 2-3 är klara (vita ikoner, chips, kartvyer). Mitigeras av opt-in.
- FullCalendar och kartkomponenter (RegionalMapView) kan behöva egna justeringar.
- Modal-standarden (bg-slate-900 + border-slate-700) följer med automatiskt via remappingen - ingen modal behöver röras.
