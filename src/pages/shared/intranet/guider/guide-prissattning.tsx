// src/pages/shared/intranet/guider/guide-prissattning.tsx
// Guidemodul: Sätt rätt pris i ärendet (tekniker, telefon).
// Etiketterna kommer från EditCaseModal (fliken Ekonomi), CaseServiceSelector
// (Tjänster & fakturarader, Interna kostnader, Sök artikel..., Prisguide,
// marginalen i rubriken, prisrutan kr/st) och PriceCalculatorPanel (Prisguide,
// Tilldela interna kostnader till fakturarader, — Ej tilldelad —,
// Justera påslag & marginal, Applicera priser). Privatärende: priser inkl. moms.
// Påhittad kund och påhittade priser, ingenting sparas.

import { useState } from 'react'
import { Icon } from '../../../../components/icons/Icon'
import {
  Ark, ArendeHuvud, Falt, Flikar, IkonKnapp, Knapprad, Kort, Markor, Notis, OvningRam, PKnapp, Rad, Status, Telefon,
  type MarkorProps, type OvningSvar,
} from '../skarmkit'
import type { GuideModul } from './registry'

type ArtikelId = 'arbetstid' | 'betesstation' | 'falla'

const ARTIKLAR: { id: ArtikelId; namn: string; kategori: string; pris: string; antal: string; kostnad: number }[] = [
  { id: 'arbetstid', namn: 'Arbetstid tekniker', kategori: 'Arbetstid', pris: '400 kr', antal: '5 h', kostnad: 2000 },
  { id: 'betesstation', namn: 'Betesstation råtta', kategori: 'Stationer', pris: '250 kr', antal: '2 st', kostnad: 500 },
  { id: 'falla', namn: 'Snapfälla mus', kategori: 'Fällor', pris: '45 kr', antal: '1 st', kostnad: 45 },
]

type Vy = 'arende' | 'ekonomi' | 'artiklar' | 'prisguide'

interface Lage {
  vy: Vy
  tillagda: ArtikelId[]
  tilldelade: ArtikelId[]
  /** Pris på raden, inkl. moms */
  pris: number
  /** Prisguiden har applicerats */
  applicerat: boolean
  notis: string | null
}

const kr = (n: number) => `${Math.round(n).toLocaleString('sv-SE')} kr`
/** Marginal på exkl.-basen, som marginalmotorn */
function marginal(l: Lage): number | null {
  const kostnad = ARTIKLAR.filter(a => l.tillagda.includes(a.id)).reduce((s, a) => s + a.kostnad, 0)
  if (kostnad === 0) return null
  const exkl = l.pris / 1.25
  return ((exkl - kostnad) / exkl) * 100
}
const fargMarginal = (m: number) => (m >= 35 ? 'text-emerald-400' : m >= 20 ? 'text-yellow-400' : 'text-red-400')

/** Markör bara på det element som är steg nr i visningen */
const mk = (markera: string | undefined, id: string, nr: number): MarkorProps | undefined =>
  markera === id ? { pa: true, nr } : undefined

function Skarm({ l, tryck, markera, nr }: { l: Lage; tryck: (id: string) => void; markera?: string; nr: number }) {
  const m = marginal(l)
  const kostnad = ARTIKLAR.filter(a => l.tillagda.includes(a.id)).reduce((s, a) => s + a.kostnad, 0)
  const flikMarkor = markera === 'flik-ekonomi' ? { flik: 2, pa: true, nr } : undefined
  return (
    <Telefon>
      <ArendeHuvud
        nr="BE-0001234"
        status={<Status text="Pågående" />}
        kund="Familjen Exempel · Exempelvägen 4, Södertälje"
        ikoner={<IkonKnapp ikon="allman.historik" etikett="Ärendehistorik" onClick={() => tryck('historik')} />}
      />
      <Flikar flikar={['Ärende', 'Utförande', 'Ekonomi']} aktiv={l.vy === 'arende' ? 0 : 2}
        onClick={i => tryck(i === 2 ? 'flik-ekonomi' : 'flik-annan')} markor={flikMarkor} />

      {l.vy === 'arende' ? (
        <>
          <Kort titel="Ärendeinformation" ikon="arende.arende"><Rad v="Råttor i källaren, spår vid tvättstugan." /></Kort>
          <Kort titel="Schemaläggning" ikon="allman.kalender"><Rad v="Tisdag 2026-10-13, 08:00 till 13:00" /></Kort>
        </>
      ) : (
        <div className="h-[408px] overflow-y-auto pb-16">
          <Kort titel="Tjänster & fakturarader" ikon="sok.faktura">
            <div className="flex items-center justify-end gap-2">
              {m !== null && (
                <span className={`flex items-center gap-1 text-[11px] font-medium ${fargMarginal(m)}`}>
                  <Icon name={m >= 20 ? 'station.klar' : 'rapport.avvikelse'} size={16} className="h-3.5 w-3.5" />
                  {m.toFixed(1).replace('.', ',')}% marginal
                </span>
              )}
              <Markor markor={mk(markera, 'prisguide', nr)}>
                <button type="button" onClick={() => tryck('prisguide')}
                  className="flex items-center gap-1 rounded-lg bg-slate-700 px-2 py-1 text-[11px] text-slate-300">
                  <Icon name="allman.kalkyl" size={16} className="h-3.5 w-3.5" />
                  Prisguide
                </button>
              </Markor>
            </div>
            <div className="grid gap-1.5 rounded-lg border border-slate-700/50 bg-slate-800/40 p-2">
              <span className="text-xs font-medium text-white">Råttbekämpning</span>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-xs text-slate-300">
                  <Icon name="allman.minus" size={16} className="h-3 w-3" /> 1 <Icon name="allman.plus" size={16} className="h-3 w-3" />
                </span>
                <span className="ml-auto flex items-center gap-1">
                  <Markor markor={mk(markera, 'pris', nr)}>
                    <button type="button" onClick={() => tryck('pris')} aria-label="Pris"
                      className="w-20 rounded border border-slate-600 bg-slate-700 px-2 py-0.5 text-right text-xs text-white">
                      {l.pris.toLocaleString('sv-SE')}
                    </button>
                  </Markor>
                  <span className="text-[11px] text-slate-400">kr/st</span>
                </span>
                <span className="text-slate-500"><Icon name="allman.radera" size={16} className="h-3.5 w-3.5" /></span>
              </div>
            </div>
            <button type="button" onClick={() => tryck('tillagg')} className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Icon name="allman.plus" size={16} className="h-3.5 w-3.5" /> Lägg till tilläggstjänst
            </button>
            <Rad v="Inkl. moms" h={<span className="text-[#20c58f]">{kr(l.pris)}</span>} />
          </Kort>

          <div className="m-2.5 grid gap-1.5 rounded-xl border border-slate-700/50 bg-slate-800/20 p-2.5">
            <Markor markor={mk(markera, 'interna', nr)} block>
              <button type="button" onClick={() => tryck('interna')} className="flex w-full items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <Icon name="bokning.artikel" size={16} className="text-slate-400" />
                  Interna kostnader
                  {l.tillagda.length > 0 && <span className="text-[11px] font-normal text-slate-400">{l.tillagda.length}</span>}
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  {kostnad > 0 && `${kr(kostnad)} ink.`}
                  <Icon name="allman.chevron" size={16} className={l.vy === 'artiklar' ? 'rotate-90' : ''} />
                </span>
              </button>
            </Markor>
            {l.vy === 'artiklar' && (
              <>
                <p className="text-[11px] leading-snug text-slate-500">Interna kostnader visas inte på fakturan, de används bara för att beräkna inköpskostnad och marginal.</p>
                {ARTIKLAR.filter(a => l.tillagda.includes(a.id)).map(a => <Rad key={a.id} v={`${a.namn}, ${a.antal}`} h={kr(a.kostnad)} />)}
                <div className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-500">
                  <Icon name="allman.sok" size={16} className="h-3.5 w-3.5" /> Sök artikel...
                </div>
                {ARTIKLAR.filter(a => !l.tillagda.includes(a.id)).map(a => (
                  <Markor key={a.id} markor={mk(markera, `artikel-${a.id}`, nr)} block>
                    <button type="button" onClick={() => tryck(`artikel-${a.id}`)}
                      className="flex w-full items-center justify-between rounded-lg bg-slate-800/50 px-2 py-1 text-left">
                      <span className="text-xs text-white">{a.namn}<span className="ml-1 text-[10px] text-slate-500">{a.kategori}</span></span>
                      <span className="text-[11px] text-slate-400">{a.pris}</span>
                    </button>
                  </Markor>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {l.vy === 'prisguide' && (
        <Ark titel="Prisguide" under="Tilldela interna kostnader till fakturarader">
          {ARTIKLAR.filter(a => l.tillagda.includes(a.id)).map((a, i) => (
            <Falt key={a.id} etikett={`${a.namn} · ${kr(a.kostnad)}`}
              varde={l.tilldelade.includes(a.id) ? 'Råttbekämpning' : '— Ej tilldelad —'}
              tom={!l.tilldelade.includes(a.id)}
              onClick={() => tryck(`tilldela-${a.id}`)}
              markor={i === 0 ? mk(markera, 'tilldela', nr) : undefined} />
          ))}
          {l.tilldelade.length > 0 && (() => {
            const bas = ARTIKLAR.filter(a => l.tilldelade.includes(a.id)).reduce((s, a) => s + a.kostnad, 0)
            return (
              <div className="grid gap-1 rounded-lg border border-slate-700 p-2">
                <span className="text-xs font-semibold text-slate-300">Justera påslag & marginal</span>
                <Rad v={`Inköp: ${kr(bas)} · Påslag 40%`} h={`${kr(bas * 1.4 * 1.25)} Inkl. moms`} />
              </div>
            )
          })()}
          <Knapprad>
            <PKnapp onClick={() => tryck('avbryt')}>Avbryt</PKnapp>
            <PKnapp prim inaktiv={l.tilldelade.length === 0} onClick={() => tryck('applicera')} markor={mk(markera, 'applicera', nr)}>Applicera priser</PKnapp>
          </Knapprad>
        </Ark>
      )}

      {l.notis && <Notis text={l.notis} />}
    </Telefon>
  )
}

// ─── Visning: en skärm per steg ───

const BAS: Lage = { vy: 'arende', tillagda: [], tilldelade: [], pris: 2990, applicerat: false, notis: null }
const BADA: ArtikelId[] = ['arbetstid', 'betesstation']

const VISNING: { lage: Lage; markera: string }[] = [
  { lage: BAS, markera: 'flik-ekonomi' },
  { lage: { ...BAS, vy: 'ekonomi' }, markera: 'interna' },
  { lage: { ...BAS, vy: 'artiklar', tillagda: ['betesstation'] }, markera: 'artikel-arbetstid' },
  { lage: { ...BAS, vy: 'ekonomi', tillagda: BADA }, markera: 'prisguide' },
  { lage: { ...BAS, vy: 'prisguide', tillagda: BADA }, markera: 'tilldela' },
  { lage: { ...BAS, vy: 'prisguide', tillagda: BADA, tilldelade: BADA }, markera: 'applicera' },
  { lage: { ...BAS, vy: 'ekonomi', tillagda: BADA, tilldelade: BADA, pris: 4375, applicerat: true }, markera: 'pris' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera || (v.markera === 'tilldela' && id.startsWith('tilldela'))) onNasta() }} />
}

// ─── Övning: samma skärmar utan markörer ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Du står i ärendet. Priset sätter du under en av flikarna. Vilken?' }

const TIPS: Record<string, string> = {
  historik: 'Klockan är ärendehistoriken. Priset sätter du under fliken Ekonomi.',
  'flik-annan': 'Den fliken har inte priserna. Leta efter Ekonomi.',
  tillagg: 'Tilläggstjänster är fler rader på fakturan. Här är det samma tjänst, men kostnaderna ska in först.',
  avbryt: 'Avbryt stänger Prisguiden utan att något ändras. Tilldela artiklarna och tryck Applicera priser.',
  'artikel-falla': 'Du har inte använt någon snapfälla i det här ärendet. Lägg bara in det du faktiskt förbrukat.',
}

function Ovning() {
  const [l, setL] = useState<Lage>(BAS)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })
  const satt = (p: Partial<Lage>) => setL(x => ({ ...x, notis: null, ...p }))

  const tryck = (id: string) => {
    if (l.vy === 'arende') {
      if (id === 'flik-ekonomi') { satt({ vy: 'ekonomi' }); tips('Rätt flik', 'Tjänsten ligger redan som rad med grundpriset. Börja med det ärendet har kostat oss.') }
      else miss(TIPS[id] ?? 'Tryck på fliken Ekonomi.')
      return
    }
    if (l.vy === 'prisguide') {
      if (id.startsWith('tilldela-')) {
        const a = id.replace('tilldela-', '') as ArtikelId
        const ny = l.tilldelade.includes(a) ? l.tilldelade.filter(x => x !== a) : [...l.tilldelade, a]
        satt({ tilldelade: ny })
        tips(ny.length === l.tillagda.length ? 'Alla artiklar är kopplade' : 'Kopplad', ny.length === l.tillagda.length ? 'Förslaget syns under Justera påslag & marginal. Tryck Applicera priser.' : 'Koppla också den andra artikeln till Råttbekämpning.')
      } else if (id === 'applicera') {
        if (l.tilldelade.length < l.tillagda.length) miss('Koppla alla artiklar först. En okopplad artikel räknas inte in i priset.')
        else {
          satt({ vy: 'ekonomi', pris: 4375, applicerat: true, notis: 'Priser uppdaterade' })
          tips('Priset är framräknat', '2 500 kr i kostnad plus 40 % påslag blir 4 375 kr inkl. moms. Marginalen är gul, under målet. Avrunda till 4 500 kr i prisrutan.')
        }
      } else miss(TIPS[id] ?? 'Välj tjänsten i rutan under varje artikel.')
      return
    }
    // Ekonomi med eller utan artikellistan
    if (id === 'interna') {
      satt({ vy: l.vy === 'artiklar' ? 'ekonomi' : 'artiklar' })
      if (l.vy !== 'artiklar') tips('Interna kostnader', 'Här lägger du in det du har förbrukat. Kunden ser det aldrig.')
    } else if (id.startsWith('artikel-')) {
      const a = id.replace('artikel-', '') as ArtikelId
      if (a === 'falla') { miss(TIPS['artikel-falla']); return }
      const ny = [...l.tillagda, a]
      satt({ tillagda: ny })
      tips('Tillagd', ny.length === 2 ? 'Båda kostnaderna är inne. Öppna Prisguiden uppe i Tjänster & fakturarader.' : 'Lägg också in den andra artikeln du använt.')
    } else if (id === 'prisguide') {
      if (l.tillagda.length < 2) miss('Lägg in båda artiklarna under Interna kostnader först, annars räknar Prisguiden på för lite.')
      else { satt({ vy: 'prisguide' }); tips('Prisguiden', 'Koppla varje artikel till tjänsten den hör till.') }
    } else if (id === 'pris') {
      if (!l.applicerat) miss('Låt Prisguiden räkna fram priset först, sedan avrundar du.')
      else {
        satt({ pris: 4500, notis: null })
        setSvar({
          typ: 'ok',
          titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
          text: `Priset är 4 500 kr inkl. moms och marginalen räknades om. Kostnaderna syns inte på fakturan, men de gör att marginalen stämmer i statistiken.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
        })
      }
    } else miss(TIPS[id] ?? 'Lägg in kostnaderna under Interna kostnader och använd Prisguiden.')
  }

  const klart = l.pris === 4500
  const framsteg = klart ? 7 : l.applicerat ? 6 : l.vy === 'prisguide' ? (l.tilldelade.length === 2 ? 5 : 4) : l.tillagda.length === 2 ? 3 : l.tillagda.length === 1 ? 2 : l.vy === 'arende' ? 0 : 1
  return (
    <OvningRam framsteg={framsteg} totalt={7} svar={svar} onBorjaOm={() => { setL(BAS); setSvar(BORJA); setFel(0) }}>
      <Skarm l={l} tryck={klart ? () => {} : tryck} nr={0} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
