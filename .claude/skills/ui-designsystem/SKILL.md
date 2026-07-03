---
name: ui-designsystem
description: UI-designsystem i BeGone Kundportal - modaler, tema, brandfärg och bas-komponenter. Använd vid arbete med src/components/ui/Modal.tsx, Portal.tsx, Card.tsx, Button.tsx, Input.tsx, Select.tsx, ConfirmModal.tsx, ModernCard/ModernList/ModernNavigation/ModernViewSelector, src/styles/globals.css, tailwind.config.js, ny modal, modal-styling, brandfärg #20c58f, dark theme, .glass, z-index-krockar med FullCalendar/Leaflet.
---

## Nyckelfiler

| Fil | Syfte |
|---|---|
| `src/components/ui/Modal.tsx` | Bas-modal. Icke-portal som default, kan renderas via `Portal` med `usePortal=true` |
| `src/components/ui/Portal.tsx` | Global mutable DOM-container (`#modal-root`). Används av `Modal` (via `usePortal`); `Select` monterar INTE `Portal`-komponenten utan anropar `createPortal` direkt mot `#modal-root` med fallback `document.body` (`Select.tsx:156`) |
| `src/components/ui/Card.tsx` | `.glass`-yta, `p-6`. ALDRIG inuti modaler (se Invarianter) |
| `src/components/ui/Select.tsx` | Custom portal-baserad dropdown. Använd i modaler istället för native `<select>` |
| `src/components/ui/Input.tsx` | Textfält, kompakt-standard (`px-3 py-1.5`) |
| `src/components/ui/Button.tsx` | Enda källan till knappfärg. `variant="primary"` = brandgrönt |
| `src/components/ui/ConfirmModal.tsx` | Mest disciplinerade följaren av kompakt-standarden - bra referens för storlek/footer |
| `src/components/admin/customers/CustomerRevenueModal.tsx` | Historisk "referensmodal" i minnet, men fristående (ingen `Modal.tsx`) och `p-6`-padding - kopiera INTE paddningen |
| `src/components/customer/CustomerSettingsModal.tsx`, `src/components/customer/CreateCaseModal.tsx` | Använder `Card` som modal-skal (bekräftat brott, se Fallgropar) |
| `src/styles/globals.css` | Tailwind v4-tema, `.glass`-def (rad 270-274), native `<select>`-styling (rad 44-78). `--color-begone-green` definieras i `@layer theme` (rad 3-9) men konsumeras ingenstans |
| `tailwind.config.js` | Mestadels vestigial: content-glob + keyframes/animation + `backdropBlur.xs`. Ingen brandfärg definierad här |

## Arkitektur

Två helt olika modal-mönster samexisterar i kodbasen:

1. **`Modal.tsx`-baserad** - props `isOpen/onClose/title/size/footer/preventClose/allowBackdropClose/zIndex/usePortal`. Detta är målmönstret för ny kod.
2. **Handrullad modal** - egen `fixed inset-0 bg-black/60`-backdrop, egen header/stängknapp, ibland med `Card` som yttre skal. Äldre stil, finns kvar i flera filer (`CustomerRevenueModal`, `CustomerSettingsModal`, `CreateCaseModal` m.fl.).

`usePortal=true` renderar via `Portal.tsx` till `#modal-root` (skapas i `document.body`, `zIndex: 2147483647`). Detta används av stora ärende-/inspektionsmodaler med kartor/bilder (`EgenkontrollCaseModal`, `EditCaseModal` i `admin/technicians/`, `CreateCaseModal` i `admin/coordinator/`, `EditContractCaseModal`, `InspectionCaseModal`, `RonderingCaseModal`) just för att undvika z-index-krock med FullCalendar/Leaflet. `Select.tsx`s dropdown-meny renderar till samma `#modal-root`, vilket är avsiktligt (dropdown ska hamna ovanpå modaler) men gör att stacking-ordningen mellan en öppen `Select`-meny och en portal-modal styrs av DOM-insättningsordning, inte explicit z-index-lager.

Brandfärgen `#20c58f` är hårdkodad som Tailwind arbitrary value (`bg-[#20c58f]`, `text-[#20c58f]`, `focus:ring-[#20c58f]`) genomgående i JSX. `--color-begone-green` finns som CSS-variabel i `globals.css` men används inte av någon komponent - det finns alltså ingen faktisk single source of truth för brandfärgen idag, bara en konsekvent kopierad hex-sträng.

`ModernCard`/`ModernList`/`ModernNavigation`/`ModernViewSelector`/`AnimatedProgressBar` är en separat komponentfamilj med annan färgvokabulär (blå/lila/gul-gradienter, stock-grön `green-500`). De refererar mest varandra internt (`ModernNavigation` och `ModernList` wrappar `ModernCard`). Externa konsumenter: `src/components/admin/economics/BeGoneMonthlyStatsChart.tsx:8` importerar `CombinedNavigation` från `ModernNavigation` (inte `ModernCard` direkt), och `src/pages/admin/OneflowContractCreator.tsx:15` använder `AnimatedProgressBar` aktivt. `ModernViewSelector` och `ModernList` har inga externa konsumenter alls; `ModernCard` har ingen direkt extern konsument.

## Invarianter

- ALDRIG rendera `<Card>` inuti en modal eller som modal-skal - `.glass` (`backdrop-filter: blur(12px)` + vit 5%-overlay) ovanpå modalens svarta backdrop ger en grå/beige-artefakt. Använd istället `div` med kompakt sektionsstandard (se nedan). Detta är en etablerad regel som ändå aktivt bryts på flera ställen idag (se Fallgropar) - ny kod ska följa regeln, gamla brott är kända teknisk skuld.
- ALDRIG native `<select>` inuti en modal - modalens `overflow-hidden`/`overflow-y-auto` klipper dropdown-listan. Använd alltid `Select.tsx` (portal-baserad, klipps inte av overflow).
- ALDRIG hand-skriven `<button className="bg-blue-600...">`/`bg-purple-600` för primära call-to-action-knappar - använd `<Button variant="primary">`. Om en `className`-override läggs på en `Button`, verifiera att den inte tyst vinner över `variant`-klassen (Tailwind-specificitet/ordning avgör, inte avsikt).
- Alla primärknappar och aktiva/fokus-states ska vara brandgröna `#20c58f`, aldrig Tailwinds stock `green-500` eller blå/lila. Kolla alltid mot `Select.tsx` (`focus:ring-[#20c58f]/50`) som referens för korrekt implementation, inte mot `Input.tsx` som idag avviker.
- Stora formulärmodaler med karta/bilder (Leaflet/FullCalendar i närheten) måste använda `usePortal=true` - annars uppstår z-index-krock med kart-/kalenderkomponenternas egna lager.

## Kompakt modal-standard (snabbreferens)

Etablerad standard för alla nya modaler. `ConfirmModal.tsx` är den mest disciplinerade följaren.

| Element | Klasser |
|---|---|
| Body-padding | `p-4` |
| Sektioner | `p-3 bg-slate-800/30 border border-slate-700 rounded-xl` |
| Sub-sektioner | `p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl` |
| Sektionsheaders | `text-sm font-semibold`, ikon `w-4 h-4`, `gap-1.5`, `mb-2` |
| Labels | `text-xs font-medium text-slate-400 mb-1` |
| Inputs/selects (native) | `px-3 py-1.5` (`Input`-komponenten har det inbyggt) |
| Textareas | `px-3 py-1.5`, default `rows={2}` |
| Grid-gaps | `gap-3` |
| Form-spacing | `space-y-3` |
| List items | `px-3 py-2`, `space-y-2` |
| Form-footers | `pt-2 border-t border-slate-700/50` |
| Modal-footer | `px-4 py-2.5` |
| Empty states | `py-4`, ikon `w-8 h-8 mb-2` |
| Checkboxar/radio | `text-[#20c58f] focus:ring-[#20c58f]` |
| Focus rings | `focus:ring-[#20c58f]` genomgående |
| Aktiva tabbar/filter | `bg-[#20c58f]` (aldrig lila/blå) |
| Primärknappar | `<Button variant="primary">` (aldrig `bg-blue-600`/`bg-purple-600`) |

## Vanliga uppgifter

**Bygga en ny stor formulärmodal (med karta/bilder eller mycket innehåll):**
1. Använd `Modal.tsx` med `usePortal=true`, välj `size` efter innehåll (`usePortal` tvingar `min-h-[600px]` - undvik för korta modaler, då blir de onödigt höga).
2. Bygg fält med `Input.tsx`/`Select.tsx` (aldrig native select), knappar med `Button.tsx`.
3. Sektionera innehåll med kompakt-standarden: `p-3 bg-slate-800/30 border border-slate-700 rounded-xl` för sektioner, `p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl` för sub-sektioner.
4. Ta `RonderingCaseModal.tsx` eller `InspectionCaseModal.tsx` som mall - de är byggda konsekvent med `Modal`+`Select`+`Button`, bättre referens än `CustomerRevenueModal`.
5. Om `react-datepicker` används, kom ihåg `registerLocale('sv', sv)` i just den filen - inte centraliserat, måste upprepas per modal.

**Bygga en liten/kompakt modal (bekräftelse, enkelt formulär):**
1. Använd `Modal.tsx` med `usePortal=false` (default), `size="sm"` eller `"md"`.
2. Ta `ConfirmModal.tsx` som mall för footer (`px-4 py-2.5`) och body-padding (`p-4`).

**Fixa en "Card-i-modal"-förekomst:**
1. Ersätt `<Card className="...">` med `<div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl ...">`, ta bort `Card`-importen.
2. Om `Card` är själva modal-skalet (som i `CustomerSettingsModal.tsx`/`CreateCaseModal.tsx`), migrera hela modalen till `Modal.tsx` (`isOpen/onClose/title/size`) istället - detta är en strukturell omskrivning, gör en fil i taget med visuell verifiering.

**Byta ut en hand-skriven primärknapp:**
1. Identifiera om knappen faktiskt är en primär CTA (inte en statusfärg-badge).
2. Byt `<button className="bg-blue-600...">` mot `<Button variant="primary">` (eller `variant="secondary"` för sekundär vikt).
3. Om `Button variant="primary"` redan används men med en `className`-override som ger fel färg, ta bort overriden istället för att byta variant.

## Fallgropar

- `Modal.tsx:43-52` - body-scroll-spärren (`document.body.style.overflow = 'hidden'`) är global. Om två `Modal`-instanser är öppna samtidigt och en stängs, sätts `overflow: 'unset'` oavsett om den andra fortfarande lever - cleanup kollar inte andra instansers state. Sällan ett praktiskt problem (appen har oftast en modal öppen åt gången) men relevant vid nästlade modaler (t.ex. `ConfirmModal` ovanpå en annan modal).
- `Modal.tsx:56-70` - ESC-hantering är inte stacking-medveten. Om flera modaler är öppna trycks ESC igenom till alla `keydown`-listeners, inte bara den översta.
- `Modal.tsx:92` - `usePortal=true` tvingar `zIndex: 9999` oavsett vad `zIndex`-prop är satt till.
- `Modal.tsx:102,108` - `usePortal=true` tvingar `min-h-[600px]`. Bra för modaler med dynamiskt innehåll som annars hoppar i höjd, dåligt (onödigt högt) för korta modaler.
- `Input.tsx:24` - `focus:ring-green-500` är Tailwinds stock-grön (`#22c55e`), INTE brandgrönt `#20c58f`. Enda avvikelsen bland bas-komponenterna (`Modal`/`Select`/`Button`/`Card`/`ConfirmModal`); syns vid sida-vid-sida med `Select.tsx:183` som är korrekt. Modern*-familjen och `AnimatedProgressBar` använder också stock-grön/blå men är en egen komponentfamilj (se Arkitektur).
- `Portal.tsx:35-40` - mobil-layout (`alignItems: 'flex-start'`, `paddingTop: 20px`) beräknas engångs när `#modal-root` skapas, inte reaktivt vid resize/rotation.
- `Portal.tsx:47-52` - containern tas bara bort om `children.length === 0` vid unmount. Flera `Portal`-instanser delar samma `containerId='modal-root'` som default (t.ex. `EditCaseModal.tsx` som renderar två `Modal` med `usePortal={true}`, rad 1341 + 1411), så vid överlappande mount/unmount finns ett litet race: en instans kan ta bort containern medan en annan fortfarande håller en referens till den i state och då renderar in i en lösgjord DOM-nod. OBS: `Select`-menyn är INTE en `Portal`-instans - den gör `createPortal` direkt mot `#modal-root` (fallback `document.body`) och deltar inte i cleanup-logiken, men dess meny-children räknas in i `children.length` och kan därmed blockera borttagning.
- Bekräftade "Card i modal"-brott: `CustomerSettingsModal.tsx:167` och `CreateCaseModal.tsx:103,124` (båda i `src/components/customer/`) använder `Card` som själva modal-skalet. Andra filer har `Card` som inre sektioner i modaler (bekräftat: `QuoteDetailModal.tsx` renderar många `<Card className="p-6">` inuti modalen). Kolla innan du antar att en fil är ren - `src/components/customer/CaseDetailsModal.tsx` importerar `Card` (rad 26) men renderar den aldrig, falsk positiv vid grep.
- Bekräftat hand-skrivna primärknappar utanför `Button`: `src/components/admin/contractBilling/ContractInvoiceModal.tsx` har CTA-knappar som inte går via `Button`-komponenten (OBS: filen är orutad legacy-kod, se skill fakturering-prislistor) - grepp efter `bg-blue-600`/`bg-purple-600` innan du litar på att en modal följer brandfärgsregeln.
- Två parallella select-implementationer existerar: native `<select>` (stylead korrekt brandgrönt i `globals.css:44-78`) och `Select.tsx` (portal-baserad). Native funkar visuellt men klipps av `overflow-hidden` i modaler - se Invarianter.

## Riktning

Nedan är utvalda förbättringar. Dagens läge = det som beskrivs i Arkitektur/Fallgropar ovan; målbild anges per punkt.

1. **Brandfärg-token utan konsument.** Dagens läge: `--color-begone-green` i `globals.css` är död kod, alla ställen hårdkodar `#20c58f`. Målbild: gör CSS-variabeln till faktisk sanningskälla (`bg-[var(--color-begone-green)]`) så en framtida färgändring blir en enda rad istället för en projektbred grep-och-ersätt. Börja inte med en stor refaktor - fixa `Input.tsx:24` (`ring-green-500` → `ring-[#20c58f]`) som första, lågrisk steg, det är rent kosmetiskt och isolerat.

2. **`Card` i modal-kontext.** Dagens läge: regeln "aldrig Card i modal" finns redan men bryts aktivt i flera filer, bekräftat i `CustomerSettingsModal.tsx` och `CreateCaseModal.tsx` (Card som modal-skal). Målbild: dessa migreras till `Modal.tsx` som skal och kompakt-standardens `div`-sektioner istället för `Card`. Gör en fil i taget med visuell regressionstest - `CustomerSettingsModal`/`CreateCaseModal` kräver en strukturell omskrivning (props, footer-layout), inte bara en klassbyte.

3. **Hand-skrivna primärknappar som kringgår `Button`.** Dagens läge: flera LEVANDE flöden där en `className`-override tyst vinner över `variant="primary"` (t.ex. `ServiceRequestModal.tsx:531` med `bg-purple-500`, `RevisitModal.tsx:714,724` och `RevisitContractModal.tsx:594` med `bg-teal-600`). `ContractInvoiceModal.tsx` (rad 767, 777) och `MonthlyBillingPipeline.tsx` har också `bg-blue-600`/`bg-purple-600`, men de är orutad legacy-batch-kod som ska pensioneras (se skill fakturering-prislistor, Riktning 4) - lägg ingen stiltid där. Målbild: alla CTA-knappar i levande flöden går via `Button`-komponenten så att en framtida temaändring bara kräver ändring i en fil. Verifiera med klicktest efter varje ändring eftersom knapparna sitter i fakturamarkering/ärendeflöden - byt aldrig färg och `onClick`-logik i samma steg.

4. **`ModernCard`/`ModernList`/`ModernNavigation`/`ModernViewSelector`.** Dagens läge: egen färgvokabulär (blå/lila/gul-gradienter) som avviker helt från brandgrönt/kompakt-standarden, i praktiken nästan dead code (enda externa användning är `CombinedNavigation` från `ModernNavigation` i `BeGoneMonthlyStatsChart.tsx:8`; noll konsumenter för `ModernViewSelector` och `ModernList`; `ModernCard` används bara internt av familjen). Målbild: antingen radera filerna och migrera den enda konsumenten (`BeGoneMonthlyStatsChart.tsx`) till vanlig `div` + kompakt-standard, eller åtminstone märka filerna `@deprecated` så de inte av misstag tas som mall för ny UI. Verifiera med grep att inga dolda/dynamiska imports finns innan radering. OBS: `AnimatedProgressBar` är INTE dead code - den används av `OneflowContractCreator.tsx:15` och ska inte raderas i samma svep.
