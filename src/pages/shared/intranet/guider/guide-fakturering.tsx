// src/pages/shared/intranet/guider/guide-fakturering.tsx
// Guidemodul: Fyll i fakturaraderna (tekniker, telefon).
// Etiketterna kommer från EditCaseModal (statusraden Öppen/Bokad/Avslutat, fliken Ekonomi,
// Spara ändringar) och CaseServiceSelector (Tjänster & fakturarader, Prisguide, kr/st,
// Lägg till tilläggstjänst, Sök tilläggstjänst..., Dela upp för ROT/RUT, Varav arbetskostnad,
// Timmar, Avdrag, ROT (30 %), RUT (50 %), Dela upp, Material och övrigt, Fastighetsbeteckning *,
// Inkl. moms, ROT-avdrag, Att betala (kund), Interna kostnader, Sök artikel..., Total inköpskostnad).
// Påhittad kund, ingenting sparas.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from '../../../../components/icons/Icon'
import { ArendeHuvud, Flikar, IkonKnapp, Markor, Notis, OvningRam, PKnapp, Status, Telefon, type OvningSvar } from '../skarmkit'
import type { GuideModul } from './registry'
import { mk } from './_fakturering'

type Split = 'nej' | 'form' | 'klar'

interface Lage {
  flik: number
  picker: boolean
  tillagd: boolean
  split: Split
  belopp: boolean
  timmar: boolean
  rot: boolean
  fastighet: boolean
  interna: boolean
  artikel: boolean
  avslutat: boolean
  sparad: boolean
}

const TOM: Lage = {
  flik: 0, picker: false, tillagd: false, split: 'nej', belopp: false, timmar: false, rot: false,
  fastighet: false, interna: false, artikel: false, avslutat: false, sparad: false,
}

type Bas = { l: Lage; tryck: (id: string) => void; markera?: string; nr: number }

/** Prisruta som i portalen: siffran och kr/st */
function Prisruta({ varde }: { varde: string }) {
  return (
    <span className="ml-auto flex items-center gap-1">
      <span className="w-16 rounded border border-slate-600 bg-slate-700 px-1.5 py-0.5 text-right text-[12px] text-white">{varde}</span>
      <span className="text-[10.5px] text-slate-400">kr/st</span>
    </span>
  )
}

function Antal() {
  return (
    <span className="flex items-center gap-1 text-[12px] text-white">
      <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-700 text-slate-300"><Icon name="allman.minus" size={16} className="h-3 w-3" /></span>
      1
      <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-700 text-slate-300"><Icon name="allman.plus" size={16} className="h-3 w-3" /></span>
    </span>
  )
}

function Radio({ pa, text, onClick, markor }: { pa: boolean; text: string; onClick: () => void; markor?: ReturnType<typeof mk> }) {
  return (
    <Markor markor={markor}>
      <button type="button" role="radio" aria-checked={pa} onClick={onClick} className="flex items-center gap-1 text-[11.5px] text-slate-300">
        <span className={`h-3 w-3 rounded-full border ${pa ? 'border-[#20c58f] bg-[#20c58f]' : 'border-slate-500'}`} />
        {text}
      </button>
    </Markor>
  )
}

function Faltrad({ etikett, varde, tom, onClick, markor }: { etikett: string; varde: string; tom: boolean; onClick: () => void; markor?: ReturnType<typeof mk> }) {
  return (
    <label className="grid gap-0.5">
      <span className="text-[10.5px] text-slate-400">{etikett}</span>
      <Markor markor={markor} block>
        <button type="button" onClick={onClick} className={`w-full rounded border border-slate-600 bg-slate-700 px-1.5 py-0.5 text-right text-[12px] ${tom ? 'text-slate-500' : 'text-white'}`}>{varde}</button>
      </Markor>
    </label>
  )
}

function Tjanster({ l, tryck, markera, nr }: Bas) {
  const delad = l.split === 'klar'
  const avdrag = delad && l.rot
  return (
    <div data-del="tjanster" className="m-2.5 grid gap-1.5 rounded-xl border border-slate-700 bg-slate-800/40 p-2.5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-white"><Icon name="sok.faktura" className="text-[#20c58f]" />Tjänster & fakturarader</p>
        <button type="button" onClick={() => tryck('prisguide')} className="flex items-center gap-1 rounded-lg bg-slate-700 px-1.5 py-0.5 text-[10.5px] text-slate-300">
          <Icon name="allman.kalkyl" size={16} className="h-3 w-3" />Prisguide
        </button>
      </div>

      <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-1.5">
        <p className="mb-1 text-[12px] font-medium text-white">Råttbekämpning</p>
        <div className="flex items-center gap-2"><Antal /><Prisruta varde="2250" /></div>
      </div>

      {l.tillagd && (
        <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-1.5">
          <p className="mb-1 text-[12px] font-medium text-white">Tätning av ventil</p>
          <div className="flex items-center gap-2"><Antal /><Prisruta varde="1250" /></div>
          {l.split === 'nej' && (
            <div className="mt-1.5">
              <Markor markor={mk(markera, 'dela-upp', nr)}>
                <button type="button" onClick={() => tryck('dela-upp')} className="flex items-center gap-1 text-[11.5px] text-slate-400">
                  <Icon name="allman.kalkyl" size={16} className="h-3.5 w-3.5" />Dela upp för ROT/RUT
                </button>
              </Markor>
            </div>
          )}
          {l.split === 'form' && (
            <div className="mt-1.5 grid gap-1.5 rounded-md border border-slate-700/50 bg-slate-800/30 p-1.5">
              <p className="text-[10.5px] leading-snug text-slate-400">ROT/RUT gäller bara arbetskostnaden. Ange hur stor del av totalpriset 1 250 kr som är arbete.</p>
              <div className="grid grid-cols-2 gap-1.5">
                <Faltrad etikett="Varav arbetskostnad" varde={l.belopp ? '1000' : '0'} tom={!l.belopp} onClick={() => tryck('belopp')} markor={mk(markera, 'belopp', nr)} />
                <Faltrad etikett="Timmar" varde={l.timmar ? '1' : '1'} tom={!l.timmar} onClick={() => tryck('timmar')} />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10.5px] text-slate-400">Avdrag</span>
                <Radio pa={l.rot} text="ROT (30 %)" onClick={() => tryck('rot')} />
                <Radio pa={false} text="RUT (50 %)" onClick={() => tryck('rut')} />
              </div>
              <div className="flex items-center justify-end gap-3">
                <button type="button" onClick={() => tryck('split-avbryt')} className="text-[11px] text-slate-400">Avbryt</button>
                <PKnapp prim onClick={() => tryck('split-ok')} markor={mk(markera, 'split-ok', nr)}>Dela upp</PKnapp>
              </div>
            </div>
          )}
          {delad && (
            <div className="mt-1.5 grid gap-1 border-l-2 border-[#20c58f]/40 pl-2">
              <p className="text-[11px] text-slate-300"><span className="mr-1 text-[#20c58f]">●</span>Varav arbetskostnad <b className="text-white">1 000 kr</b>, 1 h, ROT</p>
              <p className="text-[11px] text-slate-500">Material och övrigt 250 kr</p>
              <Markor markor={mk(markera, 'fastighet', nr)} block>
                <button type="button" onClick={() => tryck('fastighet')} className={`w-full rounded border bg-slate-800 px-1.5 py-1 text-left text-[11px] ${l.fastighet ? 'border-slate-600 text-white' : 'border-slate-600 text-slate-500'}`}>
                  {l.fastighet ? 'Exempelby 1:23' : 'Fastighetsbeteckning *'}
                </button>
              </Markor>
            </div>
          )}
        </div>
      )}

      {l.picker ? (
        <div className="grid gap-1">
          <button type="button" onClick={() => tryck('sok')} className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 text-left text-[12px] text-slate-500">
            <Icon name="allman.sok" size={16} className="h-3.5 w-3.5" />Sök tilläggstjänst...
          </button>
          {[['tatning', 'Tätning av ventil'], ['sanering', 'Sanering efter råttor']].map(([id, namn]) => (
            <Markor key={id} block markor={mk(markera, `tjanst-${id}`, nr)}>
              <button type="button" onClick={() => tryck(`tjanst-${id}`)} className="w-full rounded-lg bg-slate-800/50 px-2 py-1 text-left text-[12px] text-white">
                {namn}
              </button>
            </Markor>
          ))}
          <button type="button" onClick={() => tryck('stang-picker')} className="w-max text-[11px] text-slate-400">Stäng</button>
        </div>
      ) : (
        <Markor markor={mk(markera, 'lagg-till', nr)}>
          <button type="button" onClick={() => tryck('lagg-till')} className="flex items-center gap-1 text-[11.5px] text-slate-400">
            <Icon name="allman.plus" size={16} className="h-3.5 w-3.5" />Lägg till tilläggstjänst
          </button>
        </Markor>
      )}

      <div className="mt-1 grid gap-0.5 border-t border-slate-700/60 pt-1 text-[12px]">
        <p className="flex justify-between"><span className="text-slate-400">Inkl. moms</span><b className="text-white">{l.tillagd ? '3 500 kr' : '2 250 kr'}</b></p>
        {avdrag && <>
          <p className="flex justify-between text-[#20c58f]"><span>ROT-avdrag</span><span>-300 kr</span></p>
          <p className="flex justify-between"><span className="font-medium text-slate-300">Att betala (kund)</span><b className="text-[#20c58f]">3 200 kr</b></p>
        </>}
      </div>
    </div>
  )
}

function Interna({ l, tryck, markera, nr }: Bas) {
  return (
    <div data-del="interna" className="m-2.5 grid gap-1.5 rounded-xl border border-slate-700/50 bg-slate-800/20 p-2.5">
      <Markor markor={mk(markera, 'interna', nr)} block>
        <button type="button" onClick={() => tryck('interna')} className="flex w-full items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-300"><Icon name="bokning.artikel" className="text-slate-400" />Interna kostnader</span>
          <Icon name="allman.chevron" size={16} className={`text-slate-400 ${l.interna ? 'rotate-90' : ''}`} />
        </button>
      </Markor>
      {l.interna && <>
        <p className="text-[10.5px] leading-snug text-slate-500">Interna kostnader visas <b>inte</b> på fakturan, de används bara för att beräkna inköpskostnad och marginal.</p>
        {l.artikel && (
          <div className="grid gap-0.5">
            <div className="flex items-center justify-between rounded-lg border border-slate-700/30 bg-slate-800/40 px-2 py-1 text-[12px] text-white"><span>Snapfälla råtta</span><span className="text-slate-300">1 st · 45 kr</span></div>
            <p className="flex justify-between px-1 text-[11px] text-slate-400"><span>Total inköpskostnad</span><span>45 kr</span></p>
          </div>
        )}
        <button type="button" onClick={() => tryck('sok-artikel')} className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 text-left text-[12px] text-slate-500">
          <Icon name="allman.sok" size={16} className="h-3.5 w-3.5" />Sök artikel...
        </button>
        {[['snap', 'Snapfälla råtta', '45 kr'], ['bete', 'Betesblock', '120 kr']].map(([id, namn, pris]) => (
          <Markor key={id} block markor={mk(markera, `artikel-${id}`, nr)}>
            <button type="button" onClick={() => tryck(`artikel-${id}`)} className="flex w-full justify-between rounded px-2 py-1 text-left text-[12px] text-slate-200 hover:bg-slate-800/60">
              <span>{namn}</span><span className="text-[11px] text-slate-400">{pris}</span>
            </button>
          </Markor>
        ))}
      </>}
    </div>
  )
}

function Skarm({ l, tryck, markera, nr, fokus, notis }: Bas & { fokus?: string; notis?: string }) {
  const rull = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const ram = rull.current
    if (!ram) return
    const del = fokus ? ram.querySelector<HTMLElement>(`[data-del="${fokus}"]`) : null
    ram.scrollTop = del ? Math.max(0, del.offsetTop - 8) : 0
  }, [fokus, l.flik])

  const steg = ['Öppen', 'Bokad', 'Avslutat']
  const aktiv = l.avslutat ? 'Avslutat' : 'Bokad'
  let innehall: ReactNode
  if (l.flik === 2) {
    innehall = <><Tjanster l={l} tryck={tryck} markera={markera} nr={nr} /><Interna l={l} tryck={tryck} markera={markera} nr={nr} /></>
  } else {
    innehall = (
      <div className="m-2.5 grid gap-1.5 rounded-xl border border-slate-700 bg-slate-800/40 p-2.5 text-xs text-slate-400">
        <p className="font-semibold text-white">Ärendeinformation</p>
        <p>Råttor i källaren. Ventil vid husgrunden tätas.</p>
      </div>
    )
  }
  return (
    <Telefon>
      <div className="flex h-full flex-col">
        <ArendeHuvud
          nr="BE-0001357"
          status={<Status text={l.sparad ? 'Avslutat' : 'Bokad'} farg={l.sparad ? 'bg-[#20c58f]' : 'bg-amber-400'} />}
          kund="Familjen Exempel · Exempelvägen 4, Södertälje"
          ikoner={<IkonKnapp ikon="arende.aterbesok" etikett="Boka återbesök eller skapa nytt ärende" onClick={() => tryck('fotspar')} />}
        />
        <div className="flex gap-1 border-b border-slate-700 px-2.5 py-1.5">
          {steg.map(s => (
            <Markor key={s} markor={s === 'Avslutat' ? mk(markera, 'avslutat', nr) : undefined}>
              <button type="button" onClick={() => tryck(s === 'Avslutat' ? 'avslutat' : 'status')}
                className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] ${s === aktiv ? 'font-semibold text-[#20c58f]' : 'text-slate-400'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${s === aktiv ? 'bg-[#20c58f]' : 'bg-slate-600'}`} />{s}
              </button>
            </Markor>
          ))}
        </div>
        <Flikar flikar={['Ärende', 'Utförande', 'Ekonomi']} aktiv={l.flik} onClick={i => tryck(i === 2 ? 'flik-ekonomi' : 'flik')}
          markor={markera === 'flik-ekonomi' ? { flik: 2, pa: true, nr } : undefined} />
        <div ref={rull} className="relative min-h-0 flex-1 overflow-y-auto">{innehall}</div>
        <div className="flex justify-end gap-1.5 border-t border-slate-700 px-2.5 py-2">
          <PKnapp onClick={() => tryck('avbryt')}>Avbryt</PKnapp>
          <PKnapp prim onClick={() => tryck('spara')} markor={mk(markera, 'spara', nr)}>Spara ändringar</PKnapp>
        </div>
      </div>
      {notis && <Notis text={notis} fel={notis.startsWith('Fastighet')} />}
    </Telefon>
  )
}

// ─── Visning ───

const VISNING: { lage: Lage; markera: string; fokus?: string }[] = [
  { lage: TOM, markera: 'flik-ekonomi' },
  { lage: { ...TOM, flik: 2, picker: true }, markera: 'tjanst-tatning', fokus: 'tjanster' },
  { lage: { ...TOM, flik: 2, tillagd: true }, markera: 'dela-upp', fokus: 'tjanster' },
  { lage: { ...TOM, flik: 2, tillagd: true, split: 'form', belopp: true, timmar: true, rot: true }, markera: 'split-ok', fokus: 'tjanster' },
  { lage: { ...TOM, flik: 2, tillagd: true, split: 'klar', belopp: true, timmar: true, rot: true }, markera: 'fastighet', fokus: 'tjanster' },
  { lage: { ...TOM, flik: 2, tillagd: true, split: 'klar', belopp: true, timmar: true, rot: true, fastighet: true, interna: true }, markera: 'artikel-snap', fokus: 'interna' },
  { lage: { ...TOM, flik: 2, tillagd: true, split: 'klar', belopp: true, timmar: true, rot: true, fastighet: true, interna: true, artikel: true, avslutat: true }, markera: 'spara', fokus: 'interna' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} markera={v.markera} fokus={v.fokus} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Jobbet hos Familjen Exempel är klart. Fakturaraderna fyller du i under fliken Ekonomi.' }

const TIPS: Record<string, string> = {
  flik: 'Fakturaraderna finns under fliken Ekonomi.',
  fotspar: 'Fotspåren är för återbesök. Jobbet är klart, så du fyller i raderna och avslutar.',
  status: 'Ärendet ska avslutas, men fyll i raderna först.',
  prisguide: 'Prisguiden hjälper dig räkna fram ett pris. Här finns priset redan.',
  sok: 'Tätning av ventil syns redan i listan. Tryck på den.',
  'tjanst-sanering': 'Du har inte sanerat. Uppdraget var tätning av ventil.',
  'stang-picker': 'Stäng utan att välja? Tryck i stället på Tätning av ventil.',
  rut: 'Familjen vill ha ROT. Välj ROT.',
  'split-avbryt': 'Avbryt stänger rutan. Fyll i den i stället.',
  'sok-artikel': 'Snapfällan syns redan i listan. Tryck på den.',
  'artikel-bete': 'Du använde en snapfälla, inte betesblock.',
  avbryt: 'Avbryt stänger ärendet utan att spara. Fortsätt i stället.',
}

function Ovning() {
  const [l, setL] = useState<Lage>(TOM)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)
  const [notis, setNotis] = useState<string | undefined>()
  const [fokus, setFokus] = useState<string | undefined>()

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte riktigt', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })
  const satt = (ny: Partial<Lage>) => setL(prev => ({ ...prev, ...ny }))

  const tryck = (id: string) => {
    if (l.sparad) return
    setNotis(undefined)
    if (l.flik !== 2) {
      if (id === 'flik-ekonomi') { satt({ flik: 2 }); setFokus('tjanster'); tips('Ekonomi', 'Råttbekämpningen ligger redan där. Lägg till tätningen.') }
      else if (id === 'avslutat') miss('Fyll i raderna innan du avslutar. Börja i fliken Ekonomi.')
      else miss(TIPS[id] ?? 'Gå till fliken Ekonomi.')
      return
    }
    switch (id) {
      case 'lagg-till': satt({ picker: true }); tips('Listan öppnas', 'Tryck på tjänsten du har gjort.'); return
      case 'tjanst-tatning':
        satt({ picker: false, tillagd: true }); setNotis('Tätning av ventil tillagd')
        tips('Tillagd', 'Tätningen kostar 1 250 kr och 1 000 kr är arbete. Familjen vill ha ROT.'); return
      case 'dela-upp': satt({ split: 'form' }); tips('Dela upp', 'Skriv arbetskostnaden och timmarna och välj ROT.'); return
      case 'belopp': satt({ belopp: true }); tips('1 000 kr', 'Fyll i timmarna också.'); return
      case 'timmar': satt({ timmar: true }); tips('1 timme', 'Välj ROT.'); return
      case 'rot': satt({ rot: true }); tips('ROT valt', 'Tryck Dela upp.'); return
      case 'split-ok':
        if (!l.belopp) miss('Portalen säger: Ange arbetskostnaden i kronor.')
        else if (!l.timmar) miss('Portalen säger: Ange antal timmar (större än 0).')
        else if (!l.rot) miss('Portalen säger: Välj ROT eller RUT.')
        else { satt({ split: 'klar' }); setNotis('Arbetskostnaden uppdelad (ROT)'); tips('Uppdelad', 'Nu syns ROT-avdraget i summan. Fyll i fastighetsbeteckningen, Exempelby 1:23.') }
        return
      case 'fastighet': satt({ fastighet: true }); tips('Fastighet ifylld', 'Lägg in snapfällan du använde under Interna kostnader.'); setFokus('interna'); return
      case 'interna': satt({ interna: !l.interna }); setFokus('interna'); tips(l.interna ? 'Stängd' : 'Interna kostnader', l.interna ? 'Öppna den igen och lägg till snapfällan.' : 'Tryck på snapfällan.'); return
      case 'artikel-snap':
        satt({ artikel: true }); tips('Snapfällan är med', 'Den syns inte på fakturan men ger rätt marginal. Avsluta nu ärendet.'); return
      case 'avslutat': satt({ avslutat: true }); tips('Avslutat valt', 'Tryck Spara ändringar.'); return
      case 'spara':
        if (!l.tillagd) miss('Tätningen saknas. Tryck Lägg till tilläggstjänst först.')
        else if (l.split !== 'klar') miss('Familjen vill ha ROT. Tryck Dela upp för ROT/RUT under tätningen.')
        else if (!l.fastighet) { setNotis('Fastighetsbeteckning krävs för ROT/RUT'); miss('Portalen stoppar sparandet: fastighetsbeteckningen saknas. Fyll i Fastighetsbeteckning * under tätningen.') }
        else if (!l.artikel) miss('Lägg in snapfällan under Interna kostnader först, så blir marginalen rätt.')
        else if (!l.avslutat) miss('Ärendet är fortfarande Bokad. Tryck Avslutat i statusraden överst först.')
        else {
          satt({ sparad: true })
          setSvar({
            typ: 'ok',
            titel: fel === 0 ? 'Felfritt, fakturan blir rätt' : 'Klart, fakturan blir rätt',
            text: `Ärendet är avslutat. Fakturan byggs av raderna: 3 500 kr inkl. moms, ROT-avdrag 300 kr på arbetet, kunden betalar 3 200 kr. Snapfällan syns inte för kunden. Kontoret tar fakturan vidare.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
          })
        }
        return
      default: miss(TIPS[id] ?? 'Följ uppdraget: tätningen, ROT, fastigheten, snapfällan och sedan avsluta.')
    }
  }

  const framsteg = [l.flik === 2, l.tillagd, l.split !== 'nej', l.split === 'klar', l.fastighet, l.artikel, l.avslutat, l.sparad].filter(Boolean).length
  return (
    <OvningRam framsteg={framsteg} totalt={8} svar={svar} onBorjaOm={() => { setL(TOM); setSvar(BORJA); setFel(0); setNotis(undefined); setFokus(undefined) }}>
      <Skarm l={l} tryck={tryck} nr={0} fokus={fokus} notis={notis} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
