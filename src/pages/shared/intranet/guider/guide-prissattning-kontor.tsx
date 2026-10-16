// src/pages/shared/intranet/guider/guide-prissattning-kontor.tsx
// Guidemodul: Prislistor och marginal (admin, dator).
// Etiketterna kommer från PriceListsSettings och PriceListsTable (Prislistor,
// Fasta kundpriser för tjänster utöver avtalet, Standard), PriceListItemsEditor
// (Tjänster, Artiklar, Grundpris, Diff, Läge, Kundpris, Prisguide,
// Fast pris (kr), Prisguide används, Bekräfta (Enter), Pris sparat),
// ServiceCatalogSettings (Tjänsteutbud, Inställningar), PricingSettingsModal
// (Kalkylatorinställningar, Marginalregler, Önskvärd marginal %, Minsta marginal %,
// Inställningar sparade) och DiscountApprovals (Godkännanden, Rabatter & tillägg,
// Rabatter att granska, Avslå, Godkänn, Faktura godkänd - tekniker notifierad).
// Påhittade kunder och priser, ingenting sparas.

import { useState } from 'react'
import { Icon } from '../../../../components/icons/Icon'
import { Ark, Dator, Falt, Knapprad, Markor, Notis, OvningRam, PKnapp, Rad, Status, type MarkorProps, type OvningSvar } from '../skarmkit'
import { KontorSida, type AdminMeny } from './_pris'
import type { GuideModul } from './registry'

type Vy = 'start' | 'listor' | 'oppen' | 'tjanst' | 'kalkyl' | 'godk'

interface Lage {
  vy: Vy
  /** Getingbekämpning i läget Fast pris */
  fast: boolean
  /** Inskrivet kundpris */
  pris: number
  sparat: boolean
  godkand: boolean
  notis: string | null
}

const GRUNDPRIS = 1690
const mk = (markera: string | undefined, id: string, nr: number): MarkorProps | undefined =>
  markera === id ? { pa: true, nr } : undefined

function Skarm({ l, tryck, markera, nr }: { l: Lage; tryck: (id: string) => void; markera?: string; nr: number }) {
  const sida: Record<Vy, { aktiv: AdminMeny; titel: string; under?: string }> = {
    start: { aktiv: 'Ekonomisk översikt', titel: 'Ekonomisk översikt' },
    listor: { aktiv: 'Prislistor', titel: 'Prislistor', under: 'Fasta kundpriser för tjänster utöver avtalet' },
    oppen: { aktiv: 'Prislistor', titel: 'Prislistor', under: 'Fasta kundpriser för tjänster utöver avtalet' },
    tjanst: { aktiv: 'Tjänsteutbud', titel: 'Tjänsteutbud' },
    kalkyl: { aktiv: 'Tjänsteutbud', titel: 'Tjänsteutbud' },
    godk: { aktiv: 'Godkännanden', titel: 'Godkännanden', under: 'Granska rabatter, avtalstillägg och årspremiefakturor innan de går vidare till Fortnox.' },
  }
  const s = sida[l.vy]
  const menyMarkor = markera?.startsWith('meny-') ? { rad: markera.replace('meny-', '') as AdminMeny, pa: true, nr } : undefined
  const diff = l.pris - GRUNDPRIS
  const dirty = l.fast && !l.sparat

  return (
    <Dator adress={s.titel}>
      <KontorSida aktiv={s.aktiv} titel={s.titel} under={s.under} onMeny={m => tryck(`meny-${m}`)} menyMarkor={menyMarkor}>
        {l.vy === 'start' && <p className="text-xs text-slate-400">Välj en sida i menyn.</p>}

        {(l.vy === 'listor' || l.vy === 'oppen') && (
          <div className="grid gap-1 rounded-xl border border-slate-700 bg-slate-800/30 p-2 text-xs">
            <div className="grid grid-cols-[24px_1fr_70px_70px] gap-2 border-b border-slate-700 pb-1 text-[10.5px] uppercase tracking-wider text-slate-400">
              <span /><span>Namn</span><span>Tjänster</span><span>Status</span>
            </div>
            {[
              { id: 'standard', namn: 'Standardprislista', standard: true, antal: 12 },
              { id: 'exempel', namn: 'Exempel AB', standard: false, antal: l.sparat ? 4 : 3 },
            ].map(r => (
              <div key={r.id} className="grid grid-cols-[24px_1fr_70px_70px] items-center gap-2">
                <Markor markor={mk(markera, `oppna-${r.id}`, nr)}>
                  <button type="button" onClick={() => tryck(`oppna-${r.id}`)} aria-label={`Visa tjänstepriser i ${r.namn}`}
                    className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-700 hover:text-white">
                    <Icon name="allman.chevron" size={16} className={l.vy === 'oppen' && r.id === 'exempel' ? 'rotate-90' : ''} />
                  </button>
                </Markor>
                <span className="flex items-center gap-1.5 text-white">
                  {r.namn}
                  {r.standard && <span className="flex items-center gap-1 text-[10.5px] text-[#20c58f]"><Icon name="allman.stjarna" size={16} className="h-3 w-3" />Standard</span>}
                </span>
                <span className="text-slate-300">{r.antal}</span>
                <Status text="Aktiv" farg="bg-emerald-400" />
              </div>
            ))}
            {l.vy === 'oppen' && (
              <div className="mt-1 grid gap-1 rounded-lg bg-slate-900/50 p-2">
                <div className="flex gap-3 border-b border-slate-700 pb-1 text-[11.5px]">
                  <span className="font-semibold text-[#20c58f]">Tjänster</span>
                  <button type="button" onClick={() => tryck('artiklar')} className="text-slate-400">Artiklar</button>
                </div>
                <div className="grid grid-cols-[1fr_62px_86px_96px_96px] gap-2 text-[10px] uppercase tracking-wider text-slate-400">
                  <span>Tjänst</span><span className="text-right">Grundpris</span><span className="text-right">Diff</span><span>Läge</span><span className="text-right">Kundpris</span>
                </div>
                {[
                  { id: 'geting', namn: 'Getingbekämpning', grund: GRUNDPRIS },
                  { id: 'ratt', namn: 'Råttbekämpning', grund: 2390 },
                ].map(t => {
                  const arFast = t.id === 'geting' && l.fast
                  return (
                    <div key={t.id} className={`grid grid-cols-[1fr_62px_86px_96px_96px] items-center gap-2 rounded px-1 py-0.5 ${arFast && dirty ? 'bg-amber-500/10' : ''}`}>
                      <span className="truncate text-white">{t.namn}</span>
                      <span className="text-right text-slate-500">{t.grund.toLocaleString('sv-SE')} kr</span>
                      <span className={`text-right ${arFast && diff < 0 ? 'text-amber-400' : arFast && diff > 0 ? 'text-[#20c58f]' : 'text-slate-500'}`}>
                        {arFast ? `${diff > 0 ? '+' : ''}${diff} kr (${diff > 0 ? '+' : ''}${((l.pris / GRUNDPRIS - 1) * 100).toFixed(1).replace('.', ',')}%)` : '—'}
                      </span>
                      <Markor markor={t.id === 'geting' ? mk(markera, 'lage', nr) : undefined}>
                        <button type="button" onClick={() => tryck(`lage-${t.id}`)}
                          className="flex w-full items-center justify-between rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-[11px] text-white">
                          {arFast ? 'Fast pris (kr)' : 'Prisguide'}
                          <Icon name="allman.chevron" size={16} className="h-3 w-3 rotate-90 text-slate-400" />
                        </button>
                      </Markor>
                      <span className="flex items-center justify-end gap-1">
                        {arFast ? (
                          <>
                            <button type="button" onClick={() => tryck('prisfalt')} aria-label="Kundpris"
                              className="w-14 rounded border border-[#20c58f]/50 bg-slate-900 px-1 py-0.5 text-right text-[11px] text-white">
                              {l.pris}
                            </button>
                            {dirty ? (
                              <Markor markor={mk(markera, 'bekrafta', nr)}>
                                <button type="button" onClick={() => tryck('bekrafta')} aria-label="Bekräfta (Enter)" title="Bekräfta (Enter)"
                                  className="flex h-5 w-5 items-center justify-center rounded bg-[#20c58f] text-[#fff]">
                                  <Icon name="allman.bock" size={16} className="h-3.5 w-3.5" />
                                </button>
                              </Markor>
                            ) : <Icon name="allman.bock" size={16} className="text-[#20c58f]" />}
                          </>
                        ) : <span className="italic text-slate-400">Prisguide används</span>}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {(l.vy === 'tjanst' || l.vy === 'kalkyl') && (
          <>
            <div className="mb-2 flex justify-end gap-1.5">
              <PKnapp onClick={() => tryck('installningar')} markor={mk(markera, 'installningar', nr)}>Inställningar</PKnapp>
              <PKnapp onClick={() => tryck('ny-grupp')}>Ny grupp</PKnapp>
              <PKnapp prim onClick={() => tryck('ny-tjanst')}>Ny tjänst</PKnapp>
            </div>
            <div className="grid gap-1 rounded-xl border border-slate-700 bg-slate-800/30 p-2">
              <Rad v="Getingbekämpning" h="1 690 kr" />
              <Rad v="Råttbekämpning" h="2 390 kr" />
              <Rad v="Musbekämpning" h="1 990 kr" />
            </div>
          </>
        )}

        {l.vy === 'godk' && (
          <div className="grid gap-2">
            <div className="flex gap-2 text-[11.5px]">
              <span className="rounded-lg bg-[#20c58f]/15 px-2 py-0.5 font-semibold text-[#20c58f]">Rabatter & tillägg {l.godkand ? 0 : 1}</span>
              <button type="button" onClick={() => tryck('arspremier')} className="px-2 py-0.5 text-slate-400">Årspremier 0</button>
            </div>
            {l.godkand ? (
              <p className="rounded-xl border border-slate-700 bg-slate-800/30 p-4 text-center text-xs text-slate-300">Inga fakturor väntar på godkännande</p>
            ) : (
              <div className="grid gap-2 rounded-xl border border-slate-700 bg-slate-800/30 p-2.5">
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="flex items-center gap-2 font-mono text-xs font-semibold text-white">INV-202610-0057 <Status text="Kräver godkännande" /></p>
                    <p className="text-xs text-slate-300">Familjen Exempel · Privat</p>
                  </div>
                  <div className="text-right"><p className="text-[10.5px] text-slate-400">Totalbelopp</p><p className="font-mono text-sm font-bold text-white">3 364 kr</p></div>
                </div>
                <div className="grid gap-0.5 rounded-lg bg-slate-900/40 p-2">
                  <span className="text-[11.5px] font-semibold text-white">Rabatter att granska</span>
                  <Rad v="Råttbekämpning" h={<span><span className="text-amber-400">-10%</span> 2 691 kr</span>} />
                  <span className="text-[11px] italic text-slate-400">Anna Exempel · "Vi kom en dag senare än bokat."</span>
                </div>
                <div className="flex justify-between">
                  <PKnapp onClick={() => tryck('oppna-faktura')}>Öppna faktura</PKnapp>
                  <span className="flex gap-1.5">
                    <PKnapp fara onClick={() => tryck('avsla')}>Avslå</PKnapp>
                    <PKnapp prim onClick={() => tryck('godkann')} markor={mk(markera, 'godkann', nr)}>Godkänn</PKnapp>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </KontorSida>

      {l.vy === 'kalkyl' && (
        <Ark titel="Kalkylatorinställningar" under="Marginalregler">
          <div className="grid grid-cols-2 gap-2">
            <Falt etikett="Önskvärd marginal %" varde="35" onClick={() => tryck('falt')} />
            <Falt etikett="Minsta marginal %" varde="25" onClick={() => tryck('falt')} />
          </div>
          <div className="flex gap-3 text-[11px]">
            <span className="text-emerald-400">≥ 35%</span><span className="text-yellow-400">25 till 35%</span><span className="text-red-400">&lt; 25%</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Falt etikett="Rekommenderat påslag %" varde="40" onClick={() => tryck('falt')} />
            <Falt etikett="Minsta debitering (kr, exkl. moms)" varde="3490" onClick={() => tryck('falt')} />
          </div>
          <Knapprad>
            <PKnapp onClick={() => tryck('avbryt')}>Avbryt</PKnapp>
            <PKnapp prim onClick={() => tryck('spara')} markor={mk(markera, 'spara', nr)}>Spara</PKnapp>
          </Knapprad>
        </Ark>
      )}

      {l.notis && <Notis text={l.notis} />}
    </Dator>
  )
}

// ─── Visning ───

const BAS: Lage = { vy: 'start', fast: false, pris: GRUNDPRIS, sparat: false, godkand: false, notis: null }

const VISNING: { lage: Lage; markera: string }[] = [
  { lage: BAS, markera: 'meny-Prislistor' },
  { lage: { ...BAS, vy: 'listor' }, markera: 'oppna-exempel' },
  { lage: { ...BAS, vy: 'oppen' }, markera: 'lage' },
  { lage: { ...BAS, vy: 'oppen', fast: true, pris: 1500 }, markera: 'bekrafta' },
  { lage: { ...BAS, vy: 'tjanst' }, markera: 'installningar' },
  { lage: { ...BAS, vy: 'kalkyl' }, markera: 'spara' },
  { lage: { ...BAS, vy: 'godk' }, markera: 'godkann' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera || (v.markera === 'lage' && id === 'lage-geting')) onNasta() }} />
}

// ─── Övning ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Kundpriserna ligger i prislistorna. Leta upp sidan i menyn.' }

const TIPS: Record<string, string> = {
  'meny-Ekonomisk översikt': 'Där ser du siffrorna, men priserna sätts i Prislistor.',
  'meny-Fakturering': 'Fakturorna byggs av priserna. Sätt priset i Prislistor först.',
  'meny-Artiklar (Inköp)': 'Artiklar är vad det kostar oss. Kundens pris sätts i Prislistor.',
  'meny-Tjänsteutbud': 'Tjänsteutbudet har grundpriset för alla kunder. Exempel AB ska ha ett eget pris i sin prislista.',
  'oppna-standard': 'Standardprislistan gäller alla utan egen lista. Exempel AB har en egen, längre ner.',
  'lage-ratt': 'Det är Råttbekämpning. Uppdraget gällde Getingbekämpning.',
  artiklar: 'Fliken Artiklar är äldre artikelpriser. Tjänstepriset sätts under Tjänster.',
  installningar: 'Inställningarna styr marginalen för alla ärenden. Uppdraget var ett pris för en kund.',
  'ny-grupp': 'Du ska inte skapa något nytt. Gå till Prislistor.',
  'ny-tjanst': 'Tjänsten finns redan. Gå till Prislistor.',
  'oppna-faktura': 'Där ser du hela fakturan. Motiveringen står redan på kortet, så du kan godkänna här.',
  avsla: 'Motiveringen finns och rabatten är rimlig. Avslå använder du när rabatten är för hög eller motivering saknas.',
  arspremier: 'Årspremierna är avtalsfakturor. Rabatten ligger under Rabatter & tillägg.',
}

function Ovning() {
  const [l, setL] = useState<Lage>(BAS)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })
  const satt = (p: Partial<Lage>) => setL(x => ({ ...x, notis: null, ...p }))

  const tryck = (id: string) => {
    if (l.godkand) return
    if (id === 'meny-Prislistor') {
      satt({ vy: 'listor' })
      if (!l.sparat) tips('Prislistorna', 'Öppna listan för Exempel AB med pilen framför namnet.')
      else tips('Priset är sparat', 'Nu återstår rabatten som väntar. Den ligger under Godkännanden.')
      return
    }
    if (id === 'meny-Godkännanden') {
      if (!l.sparat) { miss('Lägg in priset för Exempel AB först, rabatten tar du sedan.'); return }
      satt({ vy: 'godk' })
      tips('Godkännanden', 'Läs rabatten och motiveringen på kortet.')
      return
    }
    if (id.startsWith('meny-')) { miss(TIPS[id] ?? 'Gå till Prislistor.'); return }

    if (l.vy === 'listor' || l.vy === 'oppen') {
      if (id === 'oppna-exempel') { satt({ vy: l.vy === 'oppen' ? 'listor' : 'oppen' }); if (l.vy !== 'oppen') tips('Tjänsterna i listan', 'Getingbekämpning följer Prisguiden i dag. Byt läge på den raden.') }
      else if (id === 'lage-geting') {
        if (l.fast) tips('Redan Fast pris', 'Prisrutan har fått grundpriset. Skriv 1 500.')
        else { satt({ fast: true, pris: GRUNDPRIS, sparat: false }); tips('Fast pris', 'Prisrutan fylls med grundpriset 1 690 kr. Skriv kundens pris.') }
      } else if (id === 'prisfalt') {
        satt({ pris: 1500 }); tips('1 500 kr', 'Diff visar skillnaden mot grundpriset. Spara med bocken.')
      } else if (id === 'bekrafta') {
        if (l.pris !== 1500) miss('Priset står fortfarande på grundpriset. Skriv 1 500 i prisrutan först.')
        else { satt({ sparat: true, notis: 'Pris sparat' }); tips('Pris sparat', 'Exempel AB får nu 1 500 kr i varje ärende med Getingbekämpning. Nästa del av uppdraget väntar under Godkännanden.') }
      } else miss(TIPS[id] ?? 'Öppna listan Exempel AB och byt läge på Getingbekämpning.')
      return
    }
    if (l.vy === 'godk') {
      if (id === 'godkann') {
        satt({ godkand: true, notis: 'Faktura godkänd - tekniker notifierad' })
        setSvar({
          typ: 'ok',
          titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
          text: `Exempel AB har fast pris 1 500 kr på Getingbekämpning och fakturan med rabatten är godkänd. Teknikern får en notis.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
        })
      } else miss(TIPS[id] ?? 'Godkänn rabatten.')
      return
    }
    miss(TIPS[id] ?? 'Gå till Prislistor i menyn.')
  }

  const framsteg = l.godkand ? 6 : l.vy === 'godk' ? 5 : l.sparat ? 4 : l.fast ? (l.pris === 1500 ? 3 : 2) : l.vy === 'oppen' ? 1 : 0
  return (
    <OvningRam bred framsteg={framsteg} totalt={6} svar={svar} onBorjaOm={() => { setL(BAS); setSvar(BORJA); setFel(0) }}>
      <Skarm l={l} tryck={tryck} nr={0} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
