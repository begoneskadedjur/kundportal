// src/pages/shared/intranet/interactive/tillagg/TillaggSkarmbilder.tsx
// Statiska skärmbilder för guiden Tilläggsstationer, en per steg i kedjan.
// Texterna är samma som i portalen (EquipmentPlacementForm, AddonModelPicker,
// ContractMapSection, CaseServiceSelector, AddonLabourStep, AddonDropPrompt).
// Tidslinjen i Ekonomi-fliken är portalens egen komponent.

import AddonBillingTimeline from '../../../../../components/shared/AddonBillingTimeline'
import { formatKr, monthsLabel, premiumRaise } from '../../../../../shared/addonEconomics'
import { EXEMPEL, raknaExempel } from './tillaggExempel'
import { FakeCheckbox, FakeInput, FakeRadio, MiniScreen, SECTION, SUB_SECTION } from './tillaggShared'

const ex = raknaExempel()
const perMonthPrice = Math.round((EXEMPEL.stationPrice / 12) * 100) / 100
const kr2 = (n: number) => `${n.toLocaleString('sv-SE', { maximumFractionDigits: 2 })} kr`
const tal = (n: number) => Math.round(n).toLocaleString('sv-SE')

/** Steg 1: koordinatorn bokar etableringen */
export function SkarmBokaEtablering() {
  return (
    <MiniScreen where="Schema › Skapa ärende">
      <div className="space-y-2 text-xs">
        <div>
          <p className="font-medium text-slate-400 mb-1">Ärendetyp</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {['Extrabesök Avtalskund', 'Stationskontroll Avtalskund', 'Etablering Avtalskund'].map((t) => {
              const on = t === 'Etablering Avtalskund'
              return (
                <span
                  key={t}
                  className={`px-2 py-1.5 rounded-lg border ${on ? 'border-[#20c58f] bg-[#20c58f]/10 text-white font-medium' : 'border-slate-700 text-slate-400'}`}
                >
                  {t}
                </span>
              )
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-300">
          <span><span className="text-slate-500">Kund </span>{EXEMPEL.customerName} · {EXEMPEL.unitName}</span>
          <span><span className="text-slate-500">Tekniker </span>den som ska sätta ut</span>
        </div>
      </div>
    </MiniScreen>
  )
}

/** Steg 2: teknikern markerar stationen som tillägg */
export function SkarmMarkeraTillagg() {
  const rows = [
    { label: 'per år', price: `${kr2(EXEMPEL.stationPrice)}/år`, help: 'Betalas för månaderna kvar till avtalets nästa år, sedan på en egen faktura i samband med årsfakturan. Slutar när avtalet slutar. Ingen etableringsavgift.', on: true },
    { label: 'per månad', price: `${kr2(perMonthPrice)}/mån`, help: 'Faktureras månadsvis, årspriset delat med tolv. Ingen etableringsavgift.', on: false },
    { label: 'per kontroll', price: 'pris saknas', help: 'Debiteras etablering och varje kontrollrunda stationen kontrolleras i.', on: false },
  ]
  return (
    <MiniScreen where="Utrustning › Placera station" caption="Priserna hämtas ur kundens prislista när du väljer stationstyp.">
      <div className="space-y-2 text-xs">
        <div>
          <p className="font-medium text-slate-300 mb-1">Produkt <span className="text-slate-500 font-normal">(intern)</span></p>
          <span className="block px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-200">Den produkt du satte ut</span>
          <p className="text-slate-500 mt-1">Används för intern kostnad och marginal. Kunden ser bara stationstypen.</p>
        </div>
        <div className="flex items-start gap-2.5 p-2.5 bg-slate-800/30 border border-slate-700 rounded-xl">
          <FakeCheckbox checked />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-slate-200 text-sm">Tillägg utöver avtal</p>
            <p className="text-slate-400 mt-0.5">Stationen ingår inte i avtalets årspremie. Välj hur den betalas: priserna kommer från kundens prislista.</p>
            <p className="font-medium text-slate-400 mt-2 mb-1">Betalas</p>
            <div className="space-y-1">
              {rows.map((r) => (
                <div key={r.label} className={`flex items-start gap-2 px-2 py-1.5 rounded-lg border ${r.on ? 'border-[#20c58f]/60 bg-[#20c58f]/5' : 'border-slate-700 bg-slate-800/40'}`}>
                  <span className="mt-0.5"><FakeRadio checked={r.on} /></span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-slate-200">{r.label}</span>
                      <span className="tabular-nums whitespace-nowrap text-slate-400">{r.price}</span>
                    </span>
                    <span className="block text-slate-500 mt-0.5 leading-snug">{r.help}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MiniScreen>
  )
}

/** Steg 2: det faktureringsansvariga ser direkt */
export function SkarmNotisOchLista() {
  const annual = EXEMPEL.stationPrice * EXEMPEL.count
  return (
    <MiniScreen where="Notisklockan och Befintliga kunder" caption="Syns bara för den som har behörigheten att godkänna fakturor.">
      <div className="space-y-2 text-xs">
        <div className={SUB_SECTION}>
          <p className="flex items-center gap-1.5 font-semibold text-white">
            <span className="w-2 h-2 rounded-full bg-[#20c58f]" aria-hidden />
            Tillägg att besluta · {EXEMPEL.customerName}
          </p>
          <p className="text-slate-400 mt-0.5">
            {EXEMPEL.count} tilläggsstationer på 1 avtal väntar på beslut om fakturering, {tal(annual)} kr/år.
          </p>
        </div>
        <div className={SUB_SECTION}>
          <p className="text-slate-500 mb-1">Befintliga kunder · Kräver åtgärd</p>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-slate-200 font-medium">{EXEMPEL.customerName}</span>
            <span className="text-amber-400 whitespace-nowrap"><span aria-hidden>● </span>{EXEMPEL.count} tillägg att besluta</span>
          </div>
          <p className="text-slate-500 text-right tabular-nums">{tal(annual)} kr/år · 1 avtal</p>
        </div>
      </div>
    </MiniScreen>
  )
}

/** Steg 3: Ekonomi-fliken på etableringsärendet */
export function SkarmEkonomiFlik() {
  return (
    <MiniScreen where="Ärendet › Ekonomi › Tillägg utöver avtalet" caption="Den gröna delen betalas nu, den randiga följer avtalets år.">
      <div className={SECTION}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-sm font-semibold text-white">Tillägg utöver avtalet</span>
          <span className="text-xs font-medium text-[#c084fc] whitespace-nowrap"><span className="mr-1">●</span>{EXEMPEL.count} nya stationer</span>
        </div>
        <div className="space-y-3">
          <div className="pb-3 border-b border-slate-700/50">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">{EXEMPEL.stationType} · {EXEMPEL.count} st</p>
                <p className="text-xs text-slate-400">Fast pris {formatKr(EXEMPEL.stationPrice)} per station och år</p>
              </div>
              <span className="text-sm font-semibold text-white tabular-nums whitespace-nowrap">{formatKr(ex.stations.totalNow)}</span>
            </div>
            <AddonBillingTimeline timeline={ex.stations} />
          </div>
          <div>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">Arbetstid för att hantera tilläggen · {EXEMPEL.hours} h per år</p>
                <p className="text-xs text-slate-400">Kundens timpris {formatKr(EXEMPEL.hourlyPrice)}</p>
              </div>
              <span className="text-sm font-semibold text-white tabular-nums whitespace-nowrap">{formatKr(ex.labour.totalNow)}</span>
            </div>
            <AddonBillingTimeline timeline={ex.labour} />
          </div>
        </div>
      </div>
    </MiniScreen>
  )
}

/** Steg 4: frågan om arbetstid, ny enhet */
export function SkarmArbetstidNy() {
  return (
    <MiniScreen where="Färdig med etablering › Arbetstid för att hantera tilläggen" caption="Variant 1: enheten hade inga tillägg innan.">
      <div className="space-y-2 text-xs">
        <div className={SECTION}>
          <p className="text-sm font-semibold text-white mb-1.5">Nya tillägg du har satt ut</p>
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 tabular-nums">
            <span className="text-slate-400">Station</span>
            <span className="text-slate-400 text-right">Antal</span>
            <span className="text-slate-400 text-right">Per år</span>
            <span className="text-slate-200"><span className="text-[#c084fc]" aria-hidden>● </span>{EXEMPEL.stationType}</span>
            <span className="text-slate-200 text-right">{EXEMPEL.count} st</span>
            <span className="text-slate-200 text-right">{formatKr(ex.stations.totalAnnual)}</span>
          </div>
        </div>
        <div className={SECTION}>
          <p className="text-sm font-medium text-slate-200 mb-1.5">Hur mycket arbetstid ska vi debitera för att hantera dessa tillägg?</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <FakeInput value={String(EXEMPEL.hours)} className="w-12" />
            <span className="font-semibold text-white">timmar per år</span>
            <span className="text-slate-400">× {formatKr(EXEMPEL.hourlyPrice)}</span>
            <span className="ml-auto font-semibold text-white tabular-nums">{formatKr(ex.labour.totalAnnual)} per år</span>
          </div>
          <p className="text-slate-400 mt-1.5">Tiden gäller ett helt år: kontroller, byten och rapportering av tilläggsstationerna. Timpriset kommer från kundens prislista.</p>
        </div>
        <div className={SECTION}>
          <p className="text-sm font-semibold text-white mb-1.5">Så faktureras det</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="font-semibold text-[#20c58f]">Nu, {monthsLabel(ex.stations.months)}</p>
              <p className="flex justify-between gap-2"><span className="text-slate-300">Stationer</span><span className="tabular-nums text-slate-200">{formatKr(ex.stations.totalNow)}</span></p>
              <p className="flex justify-between gap-2"><span className="text-slate-300">Arbetstid</span><span className="tabular-nums text-slate-200">{formatKr(ex.labour.totalNow)}</span></p>
              <p className="flex justify-between gap-2 font-semibold border-t border-slate-700 pt-1"><span className="text-white">På den här fakturan</span><span className="tabular-nums text-white">{formatKr(ex.nowTotal)}</span></p>
            </div>
            <div className="space-y-0.5">
              <p className="font-semibold text-slate-300">Från 1 jul 2027</p>
              <p className="text-sm font-semibold text-white tabular-nums">{formatKr(ex.annualTotal)} per år</p>
              <p className="text-slate-400">Egen faktura i samband med avtalets årsfaktura</p>
            </div>
          </div>
        </div>
      </div>
    </MiniScreen>
  )
}

/** Steg 4: frågan om arbetstid, enhet som redan har tillägg */
export function SkarmArbetstidBefintlig() {
  const before = 4
  const added = 2
  const after = before + added
  const hoursToday = 2
  return (
    <MiniScreen
      where="Färdig med etablering › Arbetstid för att hantera tilläggen"
      caption="Variant 2: enheten hade redan 4 tillägg med 2 timmar per år, nu kommer 2 till."
    >
      <div className="space-y-2 text-xs">
        <div className={SECTION}>
          <p className="text-sm font-semibold text-white mb-1.5">Tillägg på enheten</p>
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1 tabular-nums">
            <span className="text-slate-400">Station</span>
            <span className="text-slate-400 text-right">Innan</span>
            <span className="text-slate-400 text-right">Nya</span>
            <span className="text-slate-400 text-right">Efter</span>
            <span className="text-slate-200"><span className="text-[#c084fc]" aria-hidden>● </span>{EXEMPEL.stationType}</span>
            <span className="text-slate-300 text-right">{before}</span>
            <span className="text-[#20c58f] font-medium text-right">+{added}</span>
            <span className="text-slate-200 text-right">{after}</span>
          </div>
        </div>
        <div className={SECTION}>
          <p className="text-sm font-semibold text-white mb-1.5">Arbetstid för att hantera tilläggen</p>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div><p className="text-slate-400">Debiteras idag</p><p className="font-semibold text-white">{hoursToday} h per år</p></div>
            <div><p className="text-slate-400">Kostar kunden</p><p className="font-semibold text-white">{formatKr(hoursToday * EXEMPEL.hourlyPrice)} per år</p></div>
            <div><p className="text-slate-400">Per station idag</p><p className="font-semibold text-white">0,5 h per år</p></div>
          </div>
          <p className="font-medium text-slate-200 border-t border-slate-700/50 pt-2 mb-1.5">Behöver vi debitera mer tid nu när det blivit {after} stationer?</p>
          <p className="flex items-center gap-2 py-1"><FakeRadio checked /><span className="text-slate-200">Nej, {hoursToday} timmar per år räcker</span></p>
          <p className="flex flex-wrap items-center gap-2 py-1">
            <FakeRadio checked={false} /><span className="text-slate-200">Ja, nytt totalt:</span>
            <FakeInput value="" className="w-12 h-5" /><span className="font-semibold text-white">timmar per år</span>
          </p>
          <p className="text-slate-400 mt-1">Samma tid per station som idag skulle vara ungefär 3 timmar per år.</p>
        </div>
      </div>
    </MiniScreen>
  )
}

/** Steg 5: merförsäljningsfakturan när ärendet stängs */
export function SkarmMerforsaljning() {
  return (
    <MiniScreen where="Fakturering › Merförsäljning Avtal" caption="Bara tjänsteraderna blir fakturarader. Produkterna är interna kostnader.">
      <div className="text-xs">
        <div className="flex items-baseline justify-between gap-2 mb-2">
          <span className="text-slate-200 font-medium">{EXEMPEL.customerName} · {EXEMPEL.unitName}</span>
          <span className="text-amber-400 whitespace-nowrap"><span aria-hidden>● </span>Godkännas</span>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 tabular-nums">
          <span className="text-slate-300">{EXEMPEL.stationType} (tilläggsstation), {EXEMPEL.count} × {formatKr(ex.stations.perUnitNow)}</span>
          <span className="text-slate-200 text-right">{formatKr(ex.stations.totalNow)}</span>
          <span className="text-slate-300">Arbetstid för att hantera tilläggen, {EXEMPEL.hours} h × {formatKr(ex.labour.perUnitNow)}</span>
          <span className="text-slate-200 text-right">{formatKr(ex.labour.totalNow)}</span>
          <span className="text-white font-semibold border-t border-slate-700 pt-1">Summa exkl. moms</span>
          <span className="text-white font-semibold border-t border-slate-700 pt-1 text-right">{formatKr(ex.nowTotal)}</span>
        </div>
      </div>
    </MiniScreen>
  )
}

/** Steg 6: uppgiftsremsan i avtalskartan */
export function SkarmUppgiftsremsa() {
  const annual = EXEMPEL.stationPrice * EXEMPEL.count
  return (
    <MiniScreen where="Kundkortet › Avtalskarta">
      <div className="px-3 py-2 rounded-xl border border-amber-500/40 bg-amber-500/10 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold text-amber-200">{EXEMPEL.count} tillägg att besluta · {tal(annual)} kr/år</p>
          <p className="text-[11px] text-amber-200/80 mt-0.5">Tekniker har satt ut stationer utöver avtalet. Bestäm per rad om de ska faktureras som tillägg eller bakas in i premien.</p>
          <p className="text-[11px] text-amber-200/70 mt-0.5">Avtal 1 av 1 · {EXEMPEL.count} här</p>
        </div>
        <span className="shrink-0 text-[12px] px-3 py-1 rounded-md bg-[#20c58f] text-[#0b1220] font-semibold">Öppna § 5</span>
      </div>
      <div className="mt-2 p-3 rounded-xl border border-amber-500/30 bg-slate-800/30 text-xs">
        <p className="text-white mb-1.5">{EXEMPEL.count} st {EXEMPEL.stationType} · {EXEMPEL.unitName} · per år</p>
        <div className="flex flex-wrap gap-2">
          <span className="px-2.5 py-1 rounded-md border border-slate-600 text-slate-200">Lägg till i avtalet</span>
          <span className="px-2.5 py-1 rounded-md bg-[#20c58f] text-[#0b1220] font-semibold">Tillägg utöver avtalet</span>
        </div>
      </div>
    </MiniScreen>
  )
}

/** Steg 6: dialogen Besluta tillägg */
export function SkarmBeslutaTillagg() {
  const raise = premiumRaise(EXEMPEL.premium, ex.annualTotal)
  return (
    <MiniScreen where="Avtalskarta › Besluta tillägg" caption="Årspremien 24 000 kr är påhittad för bilden.">
      <div className="text-xs space-y-2">
        <div>
          <p className="text-sm font-semibold text-slate-100">Besluta tillägg</p>
          <p className="text-slate-400">{EXEMPEL.unitName} · Avtalet</p>
        </div>
        <div className={SECTION}>
          <p className="font-medium text-slate-400 mb-1.5">Vad teknikern satte ut</p>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[#c084fc]" aria-hidden>●</span>
              <span className="flex-1 min-w-[7rem] text-slate-200">{EXEMPEL.stationType}</span>
              <span className="text-slate-300 tabular-nums">{EXEMPEL.count} st</span>
              <span className="inline-flex items-center gap-1 text-slate-400"><FakeInput value={String(EXEMPEL.stationPrice)} className="w-14" /> kr per år</span>
              <span className="w-16 text-right text-slate-100 tabular-nums">{formatKr(ex.stations.totalAnnual)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-slate-500" aria-hidden>●</span>
              <span className="flex-1 min-w-[7rem]">
                <span className="block text-slate-200">Arbetstid för att hantera tilläggen</span>
                <span className="block text-[11px] text-slate-500">Teknikerns förslag vid etableringsärendet</span>
              </span>
              <span className="inline-flex items-center gap-1 text-slate-400"><FakeInput value={String(EXEMPEL.hours)} className="w-10" /> h × {tal(EXEMPEL.hourlyPrice)}</span>
              <span className="w-16 text-right text-slate-100 tabular-nums">{formatKr(ex.labour.totalAnnual)}</span>
            </div>
          </div>
          <p className="flex justify-between gap-2 mt-2 pt-2 border-t border-slate-700/50">
            <span className="font-medium text-slate-300">Per år</span>
            <span className="font-semibold text-slate-100 tabular-nums">{formatKr(ex.annualTotal)}</span>
          </p>
        </div>
        <div className={SECTION}>
          <p className="font-medium text-slate-400 mb-1.5">Hur ska tillägget faktureras?</p>
          <div className="flex items-start gap-2 mb-2">
            <span className="mt-0.5"><FakeRadio checked /></span>
            <span>
              <span className="block font-medium text-slate-100">Tillägg utöver avtalet</span>
              <span className="block text-slate-300 mt-0.5">Egen faktura i samband med avtalets årsfaktura, första 1 jul 2027.</span>
              <span className="block text-slate-500 mt-0.5">Premien och avtalets innehåll rörs inte. Tilläggen slutar när avtalet slutar. Utrustning och arbetstid räknas i tilläggets kalkyl.</span>
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5"><FakeRadio checked={false} /></span>
            <span>
              <span className="block font-medium text-slate-100">Lägg till i avtalet</span>
              <span className="block text-slate-300 mt-0.5 tabular-nums">Årspremien höjs med {formatKr(raise.add)}, från {tal(raise.from)} till {formatKr(raise.to)}, och faktureras med avtalet.</span>
              <span className="block text-slate-500 mt-0.5">Stationerna och arbetstiden blir en del av avtalets innehåll, och kostnaden läggs i § 4.</span>
            </span>
          </div>
        </div>
        <div className={SUB_SECTION}>
          <p className="font-medium text-slate-400 mb-1">Tilläggets kalkyl</p>
          <p className="font-medium text-[#20c58f]"><span aria-hidden>● </span>Betalt tillbaka cirka {ex.calc.paybackLabel}</p>
          <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
            Utrustning {formatKr(ex.calc.equipmentCost)} en gång · intäkt {formatKr(ex.calc.annualRevenue)} per år · arbetstid {formatKr(ex.calc.annualLabourCost)} per år
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <span className="px-3 py-1 rounded-lg text-slate-300">Avbryt</span>
          <span className="px-3 py-1 rounded-lg bg-[#20c58f] text-[#fff] font-semibold">Besluta</span>
        </div>
      </div>
    </MiniScreen>
  )
}

/** Steg 7: planerade fakturor efter beslutet */
export function SkarmPlaneradeFakturor() {
  const rows = [
    { name: 'Årsfaktura, avtalets premie', period: '2027-07-01 till 2028-06-30', amount: 'premien', tone: 'text-slate-200' },
    { name: 'Tilläggsfaktura, egen faktura', period: '2027-07-01 till 2028-06-30', amount: formatKr(ex.annualTotal), tone: 'text-[#c084fc]' },
  ]
  return (
    <MiniScreen where="Avtalskarta › Fakturaplanen" caption="Två fakturor för samma period: premien och tillägget var för sig.">
      <div className="space-y-1.5 text-xs">
        {rows.map((r) => (
          <div key={r.name} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-2 bg-slate-800/40 border border-slate-700 rounded-lg">
            <span className={`font-medium ${r.tone}`}><span aria-hidden>● </span>{r.name}</span>
            <span className="text-slate-400 tabular-nums">{r.period}</span>
            <span className="text-slate-200 tabular-nums">{r.amount}</span>
            <span className="text-slate-400 w-full sm:w-auto"><span className="text-sky-400" aria-hidden>● </span>Planerad</span>
          </div>
        ))}
        <p className="text-slate-500 pt-1">Tilläggsfakturan: {EXEMPEL.count} × {formatKr(EXEMPEL.stationPrice)} + {EXEMPEL.hours} h × {formatKr(EXEMPEL.hourlyPrice)}.</p>
      </div>
    </MiniScreen>
  )
}
