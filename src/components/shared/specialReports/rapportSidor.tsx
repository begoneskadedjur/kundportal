// src/components/shared/specialReports/rapportSidor.tsx
// Rapportens sidor som papper (3.55.0): samma innehåll som PDF:en, uppdelat i
// A4-sidor med automatiska sidbrytningar. Används av förhandsvisningen (rullen)
// och av "Hela PDF:en".
//
// Så fungerar sidbrytningen:
// 1. Varje logisk sida (Om rapporten, Översikt, en per del, Bedömning) delas i
//    bitar: rubrik, stycken, kartutsnitt, en bit per händelserad, en bit per
//    bildrad och så vidare.
// 2. Alla bitar renderas osynligt i en mätbehållare med sidans innerbredd och
//    samma typsnitt, och höjden läses av (ResizeObserver mäter om när något
//    ändrar storlek, till exempel typsnitt som laddas).
// 3. Bitarna fördelas i ett enda varv på fysiska sidor (fordela). Får en bit
//    inte plats börjar en ny sida med sidhuvud, "2.x Namn, fortsättning" och
//    tabellhuvudet upprepat om biten är en tabellrad. En bit som är högre än en
//    hel sida får en egen sida som sträcks på höjden, så att inget klipps.
//    Varje bit placeras exakt en gång och fördelningen kan aldrig fastna i en
//    loop.
// Sidan ritas i 420 x 594 px (högre bara när en bit inte ryms) och skalas med
// transform till den bredd som får plats, så att mätningen inte beror på
// panelens bredd. Mätningen ritar bilder och kartor som tomma ytor med fast
// höjd, så den behöver aldrig vänta på att bilder laddas.
// Allt här föreställer papper: bara fasta färger, aldrig slate-klasser.

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { BEGONE_LOGO_DATA_URI } from '../../../lib/begoneLogo'
import { Icon } from '../../icons/Icon'
import {
  AVVIKELSE_FARG,
  AVVIKELSE_TON,
  EVENT_TYPES,
  SECTION_LABELS,
  atgardsRader,
  avvikelserIRapporten,
  handelseOrdning,
  type SpecialReportFull,
} from '../../../types/specialReport'
import type { FullSection } from './sectionOps'
import AreaMiniMap from './AreaMiniMap'
import { byggSidor, fargForDel } from './specialReportUtils'

// ── Papperets mått och färger ──
export const SIDA_B = 420
export const SIDA_H = 594
const PAD_Y = 26
const PAD_X = 30
const INNER_B = SIDA_B - 2 * PAD_X
const INNER_H = SIDA_H - 2 * PAD_Y
/** Avstånd mellan bitar på sidan */
const GAP = 10

const BRAND = '#20c58f'
const TEXT = '#1f2937'
const RUBRIK = '#0f172a'
const GRA = '#6b7280'
const LINJE = '#e5e7eb'
const TOM = '#9ca3af'
/** Ljust grön yta och tunn grön ram för rekommenderade åtgärder */
const ATGARD_TON = '#f0fdf9'
const ATGARD_RAM = '#a7f3d0'
const AVVIKELSE_RAM = '#fecaca'
const MANADER = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december']

/** Papperets typsnitt, samma i mätningen och på sidan */
const PAPPER_TEXT: CSSProperties = {
  fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
  color: TEXT,
  fontSize: 9,
  lineHeight: 1.45,
}

function manadsspann(fran: string | null, till: string | null): string {
  if (!fran || !till) return ''
  const [fy, fm] = fran.split('-').map(Number)
  const [ty, tm] = till.split('-').map(Number)
  if (!fy || !fm || !ty || !tm) return ''
  if (fy === ty && fm === tm) return `${MANADER[fm - 1]} ${fy}`
  if (fy === ty) return `${MANADER[fm - 1]} till ${MANADER[tm - 1]} ${fy}`
  return `${MANADER[fm - 1]} ${fy} till ${MANADER[tm - 1]} ${ty}`
}

/** Fri text i stycken: tom rad = nytt stycke */
function stycken(text: string | null | undefined): string[] {
  return (text ?? '').trim().split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
}

// ── Kontexter ──

/** Hur sidan visas: i mätningen och i miniatyrer ritas kartor och bilder som tomma ytor */
const VisningKontext = createContext<{ matning: boolean; miniatyr: boolean }>({ matning: false, miniatyr: false })

/** Det Ram behöver: vad som har fokus, ramens färg och vart ett klick leder */
interface RamVarde {
  fokus: string | null
  farg: string
  sida: string
  onValj: ((vy: string, falt: string | null) => void) | null
}
const RamKontext = createContext<RamVarde>({ fokus: null, farg: BRAND, sida: 'om', onValj: null })

/** Klickbar yta på sidan med ram när fältet har fokus. Utan onValj en vanlig yta med samma mått */
function Ram({ falt, aktiv, etikett, children, style }: { falt: string; aktiv?: string[]; etikett: string; children: ReactNode; style?: CSSProperties }) {
  const { fokus, farg, sida, onValj } = useContext(RamKontext)
  const harFokus = !!fokus && (aktiv ?? [falt]).includes(fokus)
  const stil: CSSProperties = { padding: '4px 6px', margin: '0 -6px', outline: `1.5px solid ${harFokus ? farg : 'transparent'}`, ...style }
  if (!onValj) return <div className="rounded-[4px]" style={stil}>{children}</div>
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={etikett}
      onClick={() => onValj(sida, falt)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onValj(sida, falt) } }}
      className="cursor-pointer rounded-[4px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
      style={stil}
    >
      {children}
    </div>
  )
}

/** Klickbar yta utan egen ram (tabellrader), leder till ett fält i en vy */
function Lank({ vy, falt, etikett, children, style }: { vy?: string; falt: string | null; etikett: string; children: ReactNode; style?: CSSProperties }) {
  const { sida, onValj } = useContext(RamKontext)
  if (!onValj) return <div style={style}>{children}</div>
  const mal = vy ?? sida
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={etikett}
      onClick={() => onValj(mal, falt)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onValj(mal, falt) } }}
      className="cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
      style={style}
    >
      {children}
    </div>
  )
}

/** Kartutsnitt: i mätningen och miniatyrer en tom yta med samma mått */
function Karta(props: { area?: FullSection['area']; color?: string; areas?: { area: NonNullable<FullSection['area']>; color: string }[]; view?: SpecialReportFull['map_view']; className: string }) {
  const { matning, miniatyr } = useContext(VisningKontext)
  if (matning || miniatyr) return <div className={`flex-shrink-0 ${props.className}`} />
  return <AreaMiniMap area={props.area ?? undefined} color={props.color} areas={props.areas} view={props.view} className={props.className} />
}

/** Bild i rapporten med fast höjd */
function Bild({ url, hojd }: { url?: string; hojd: number }) {
  const { matning } = useContext(VisningKontext)
  if (!url || matning) return <span style={{ display: 'block', height: hojd, background: LINJE }} />
  return <img src={url} alt="" loading="lazy" style={{ display: 'block', width: '100%', height: hojd, objectFit: 'cover', borderRadius: 1, background: LINJE }} />
}

const tomt = (text: string) => <span style={{ color: TOM, fontStyle: 'italic' }}>{text}</span>

// ── Bitar och logiska sidor ──

interface Bit {
  key: string
  /** Avstånd ovanför biten när den inte är först på sidan */
  gap: number
  /** Tabellen biten är en rad i (tabellhuvudet upprepas på nästa sida) */
  grupp?: string
  /** Biten ska hamna på samma sida som nästa (rubrik över en tabell) */
  hallIhop?: boolean
  render: () => ReactNode
}

interface LogiskSida {
  key: string
  namn: string
  /** Ramens och sidlinjens färg */
  farg: string
  /** Har sidhuvud (logga och dokumenttyp) redan på första sidan */
  sidhuvud: boolean
  /** Raden överst på en fortsättningssida */
  fortsattning: string
  bitar: Bit[]
  /** Tabellhuvud per grupp, upprepas på fortsättningssidor */
  tabellHuvud: Record<string, () => ReactNode>
}

export interface FysiskSida {
  key: string
  logisk: string
  /** 0 för den logiska sidans första fysiska sida */
  del: number
  sidhuvud: boolean
  fortsattning: boolean
  /** Tabellhuvud som upprepas överst */
  tabell: string | null
  bitar: string[]
  /** "Tabellen fortsätter på nästa sida" längst ned */
  notis: boolean
  /** Sidnummer i hela rapporten, från 1 */
  nr: number
  /** Sidans höjd i px: SIDA_H, eller mer när en bit är högre än en hel sida */
  hojd: number
}

const HANDELSE_KOLUMNER = '58px 62px 1fr 34px'
const OVERSIKT_KOLUMNER = '22px 1fr 70px 58px'

function HandelseHuvud() {
  return (
    <div className="grid" style={{ gridTemplateColumns: HANDELSE_KOLUMNER, background: '#f0fdf9', fontWeight: 600 }}>
      <span style={{ padding: '3px 5px' }}>Datum</span>
      <span style={{ padding: '3px 5px' }}>Typ</span>
      <span style={{ padding: '3px 5px' }}>Vad vi gjorde och såg</span>
      <span style={{ padding: '3px 5px' }}>Bild</span>
    </div>
  )
}

function OversiktHuvud() {
  return (
    <div className="grid" style={{ gridTemplateColumns: OVERSIKT_KOLUMNER, background: '#f0fdf9', fontWeight: 600 }}>
      <span style={{ padding: '3px 5px' }}>Nr</span>
      <span style={{ padding: '3px 5px' }}>Del</span>
      <span style={{ padding: '3px 5px' }}>Gäller</span>
      <span style={{ padding: '3px 5px' }}>Senast</span>
    </div>
  )
}

function harSammanfattning(report: SpecialReportFull): boolean {
  return avvikelserIRapporten(report.sections).length > 0 || atgardsRader(report.recommendations).length > 0
}

/** Rapportens logiska sidor och deras bitar, i PDF:ens ordning */
function byggLogiska(report: SpecialReportFull): LogiskSida[] {
  return byggSidor(report).map(p => {
    if (p.key === 'om') return sidaOm(report)
    if (p.key === 'oversikt') return sidaOversikt(report)
    if (p.key === 'samm') return sidaSamm(report)
    const i = report.sections.findIndex(s => s.id === p.key)
    return sidaDel(report.sections[i], i + 1, fargForDel(report.sections[i].color, i))
  })
}

function sidaOm(report: SpecialReportFull): LogiskSida {
  const datum = report.sections.flatMap(s => s.events.map(e => e.event_date)).filter(Boolean).sort()
  const fran = datum[0] ?? null
  const till = datum[datum.length - 1] ?? null
  const kicker = [report.customer_name, manadsspann(fran, till)].filter(Boolean).join(' · ')
  const period = fran && till ? (fran === till ? fran : `${fran} till ${till}`) : '-'
  const meta: [string, string | null][] = [
    ['Kund', report.customer_name],
    ['Kundnummer', report.customer_number],
    ['Ärende', report.case_number],
    ['Version', String(report.current_version)],
    ['Period', period],
    ['Kontakt', report.contact_name],
    ['Telefon', report.contact_phone],
  ]
  const intro = stycken(report.intro)
  const bitar: Bit[] = [
    {
      key: 'om:huvud',
      gap: GAP,
      render: () => (
        <>
          <div className="flex items-start justify-between">
            <img src={BEGONE_LOGO_DATA_URI} alt="BeGone" style={{ width: 80, height: 'auto' }} />
            <Ram falt="rapport:doc_type" etikett="Ändra typ av rapport" style={{ margin: 0 }}>
              <span style={{ fontSize: 7, letterSpacing: '0.16em', color: GRA, textTransform: 'uppercase' }}>{report.doc_type}</span>
            </Ram>
          </div>
          <div style={{ marginTop: 14 }}>
            {kicker && <span style={{ display: 'block', fontSize: 7, fontWeight: 700, letterSpacing: '0.14em', color: BRAND, textTransform: 'uppercase', marginBottom: 4 }}>{kicker}</span>}
            <Ram falt="rapport:title" etikett="Redigera rapportens titel">
              <span style={{ display: 'block', fontSize: 18, fontWeight: 700, color: RUBRIK, lineHeight: 1.15 }}>{report.title}</span>
            </Ram>
            <span style={{ display: 'block', width: 28, height: 2, background: BRAND, marginTop: 6 }} />
          </div>
          <div className="grid grid-cols-4" style={{ marginTop: GAP, borderTop: `1px solid ${LINJE}`, borderBottom: `1px solid ${LINJE}`, padding: '4px 0', rowGap: 4, columnGap: 6 }}>
            {meta.map(([etikett, varde]) => (
              <span key={etikett} className="min-w-0 break-words">
                <span style={{ display: 'block', color: GRA }}>{etikett}</span>
                <span style={{ fontWeight: 600, color: RUBRIK }}>{varde && varde.trim() ? varde : '-'}</span>
              </span>
            ))}
          </div>
        </>
      ),
    },
    {
      key: 'om:rubrik',
      gap: GAP,
      hallIhop: true,
      render: () => (
        <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: RUBRIK, paddingBottom: 3, borderBottom: `1px solid ${LINJE}` }}>
          <span style={{ color: BRAND }}>1.</span> Översikt
        </span>
      ),
    },
    ...(intro.length > 0 ? intro : ['']).map((p, i): Bit => ({
      key: `om:intro:${i}`,
      gap: i === 0 ? GAP : 0,
      render: () => (
        <Ram falt="rapport:intro" etikett="Redigera inledningen" style={{ padding: '2px 6px' }}>
          {p ? <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{p}</p> : tomt('Här hamnar din inledning')}
        </Ram>
      ),
    })),
    ...(report.address ? [{ key: 'om:adress', gap: GAP, render: () => <span style={{ display: 'block', color: GRA }}>{report.address}</span> }] : []),
    ...(!report.map_view && harSammanfattning(report) ? [{ key: 'om:samm', gap: GAP, render: () => <Sammanfattning report={report} /> }] : []),
  ]
  return { key: 'om', namn: 'Om rapporten', farg: BRAND, sidhuvud: false, fortsattning: 'Om rapporten, fortsättning', bitar, tabellHuvud: {} }
}

function sidaOversikt(report: SpecialReportFull): LogiskSida {
  const omraden = report.sections
    .map((s, i) => ({ area: s.area ?? [], color: fargForDel(s.color, i) }))
    .filter(o => o.area.length >= 3)
  const bitar: Bit[] = [
    { key: 'ov:rubrik', gap: GAP, hallIhop: true, render: () => <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: RUBRIK }}><span style={{ color: BRAND }}>1.</span> Översikt</span> },
    { key: 'ov:karta', gap: GAP, render: () => <Karta areas={omraden} view={report.map_view} className="h-[150px] w-full rounded-[2px] bg-[#a9b8a3]" /> },
  ]
  if (report.sections.length > 0) {
    bitar.push({ key: 'ov:thead', gap: GAP, hallIhop: true, render: () => <OversiktHuvud /> })
    report.sections.forEach((s, i) => {
      bitar.push({
        key: `ov:rad:${s.id}`,
        gap: 0,
        grupp: 'ov:t',
        render: () => {
          const senast = s.events.map(e => e.event_date).sort().pop() ?? '-'
          return (
            <Lank vy={s.id} falt={`del:${s.id}:rubrik`} etikett={`Gå till del ${i + 1}`} style={{ display: 'grid', gridTemplateColumns: OVERSIKT_KOLUMNER, borderTop: `1px solid ${LINJE}` }}>
              <span style={{ padding: '3px 5px', fontWeight: 700, color: fargForDel(s.color, i) }}>{i + 1}</span>
              <span className="truncate" style={{ padding: '3px 5px', color: s.title.trim() ? TEXT : TOM }}>{s.title.trim() || SECTION_LABELS[s.label]}</span>
              <span style={{ padding: '3px 5px' }}>{s.label === 'omrade' ? 'Område på kartan' : SECTION_LABELS[s.label]}</span>
              <span style={{ padding: '3px 5px' }}>{senast}</span>
            </Lank>
          )
        },
      })
    })
  }
  if (harSammanfattning(report)) bitar.push({ key: 'ov:samm', gap: GAP, render: () => <Sammanfattning report={report} /> })
  return { key: 'oversikt', namn: 'Översikt', farg: BRAND, sidhuvud: true, fortsattning: '1. Översikt, fortsättning', bitar, tabellHuvud: { 'ov:t': () => <OversiktHuvud /> } }
}

function sidaDel(del: FullSection, nr: number, farg: string): LogiskSida {
  const block = [...del.blocks].sort((a, b) => a.position - b.position)
  const handelser = [...del.events].sort(handelseOrdning)
  const bilder = [...del.images].sort((a, b) => a.position - b.position)
  const harOmrade = !!del.area && del.area.length >= 3
  // Bilderna numreras löpande i delen, händelsetabellen hänvisar till numren (som PDF:en)
  const bildNr = new Map(bilder.map((b, i) => [b.id, i + 1]))
  const handelseFor = new Map(del.events.map(e => [e.id, e]))
  const avvikelser = handelser.filter(e => e.type === 'avvikelse')
  const evGrupp = `ev:${del.id}`
  const evFalt = `del:${del.id}:handelser`
  const biFalt = `del:${del.id}:bilder`

  const handelseBitar = (): Bit[] => [
    {
      key: `${evGrupp}:titel`,
      gap: GAP,
      hallIhop: true,
      render: () => (
        <Ram falt={evFalt} etikett="Redigera händelserna" style={{ paddingBottom: 0 }}>
          <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: RUBRIK, marginBottom: 4 }}>Händelser</span>
          <HandelseHuvud />
        </Ram>
      ),
    },
    ...(handelser.length === 0
      ? [{ key: `${evGrupp}:tom`, gap: 0, render: () => <div style={{ padding: '6px 5px', borderTop: `1px solid ${LINJE}` }}>{tomt('Här hamnar dina händelser')}</div> }]
      : handelser.map((e): Bit => ({
        key: `${evGrupp}:${e.id}`,
        gap: 0,
        grupp: evGrupp,
        render: () => {
          const avv = e.type === 'avvikelse'
          return (
            <Lank
              falt={evFalt}
              etikett={`Redigera händelsen ${e.title || ''}`.trim()}
              style={{
                display: 'grid',
                gridTemplateColumns: HANDELSE_KOLUMNER,
                borderTop: `1px solid ${LINJE}`,
                ...(avv ? { background: AVVIKELSE_TON, boxShadow: `inset 3px 0 0 ${AVVIKELSE_FARG}` } : {}),
              }}
            >
              <span style={{ padding: '3px 5px', fontVariantNumeric: 'tabular-nums' }}>{e.event_date}</span>
              {avv ? (
                <span className="flex items-start" style={{ padding: '3px 5px', gap: 3, color: AVVIKELSE_FARG, fontWeight: 700 }}>
                  <Icon name="rapport.avvikelse" size={16} className="h-[10px] w-[10px] flex-shrink-0" />
                  {EVENT_TYPES.avvikelse.label}
                </span>
              ) : (
                <span style={{ padding: '3px 5px' }}>{EVENT_TYPES[e.type]?.label ?? e.type}</span>
              )}
              <span style={{ padding: '3px 5px', minWidth: 0, overflowWrap: 'anywhere' }}>
                <b>{e.title}</b>
                {e.description?.trim() && <span style={{ whiteSpace: 'pre-line' }}> {e.description.trim()}</span>}
              </span>
              <span style={{ padding: '3px 5px', color: GRA }}>
                {bilder.filter(b => b.event_id === e.id).map(b => bildNr.get(b.id)).join(', ')}
              </span>
            </Lank>
          )
        },
      }))),
  ]

  const bildBitar = (): Bit[] => {
    const rader: (typeof bilder)[] = []
    for (let i = 0; i < bilder.length; i += 3) rader.push(bilder.slice(i, i + 3))
    return [
      {
        key: `bi:${del.id}:titel`,
        gap: GAP,
        hallIhop: rader.length > 0,
        render: () => (
          <Ram falt={biFalt} etikett="Redigera bilderna" style={{ paddingBottom: bilder.length === 0 ? 4 : 0 }}>
            <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: RUBRIK }}>Bilder</span>
            {bilder.length === 0 && tomt('Här hamnar dina bilder')}
          </Ram>
        ),
      },
      ...rader.map((rad, r): Bit => ({
        key: `bi:${del.id}:${rad[0].id}`,
        gap: r === 0 ? 4 : 6,
        render: () => (
          <Lank falt={biFalt} etikett="Redigera bilderna" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
            {rad.map(b => {
              const ev = b.event_id ? handelseFor.get(b.event_id) : undefined
              return (
                <span key={b.id} className="flex min-w-0 flex-col" style={{ gap: 2 }}>
                  <Bild url={b.url} hojd={54} />
                  <span style={{ fontSize: 7, color: '#4b5563', overflowWrap: 'anywhere' }}>
                    <b>Bild {bildNr.get(b.id)}.</b>{b.caption?.trim() ? ` ${b.caption.trim()}` : ''}
                    {ev && <span style={{ display: 'block', color: GRA }}>Hör till: {ev.title?.trim() || 'Utan rubrik'}, {ev.event_date}</span>}
                  </span>
                </span>
              )
            })}
          </Lank>
        ),
      })),
    ]
  }

  const underrubrik = [del.subtitle?.trim() || null, harOmrade ? `område ${nr} på översiktskartan` : null].filter(Boolean).join(' · ')
  const bitar: Bit[] = [
    {
      key: `d:${del.id}:rubrik`,
      gap: GAP,
      hallIhop: true,
      render: () => (
        <Ram falt={`del:${del.id}:rubrik`} aktiv={[`del:${del.id}:rubrik`, `del:${del.id}:underrubrik`]} etikett="Redigera delens rubrik">
          <div className="flex items-center" style={{ gap: 6 }}>
            <span style={{ width: 4, height: 16, background: farg, flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: RUBRIK }}>
              <span style={{ color: farg }}>2.{nr}</span>{' '}
              {/* Utan rubrik visar PDF:en typen av del, här nedtonat så att det syns att rubriken saknas */}
              {del.title.trim() ? del.title : <span style={{ color: TOM, fontStyle: 'italic', fontWeight: 600 }}>{SECTION_LABELS[del.label]}</span>}
            </span>
          </div>
          {underrubrik && <div style={{ color: GRA, marginLeft: 10 }}>{underrubrik}</div>}
        </Ram>
      ),
    },
  ]
  if (avvikelser.length > 0) {
    bitar.push({
      key: `d:${del.id}:avvikelser`,
      gap: GAP,
      render: () => (
        <Ram falt={evFalt} etikett="Redigera avvikelserna" style={{ margin: 0, padding: 0 }}>
          <AvvikelseRuta
            rubrik={`Avvikelser i den här delen (${avvikelser.length})`}
            rader={avvikelser.map(e => ({ key: e.id, datum: e.event_date, text: e.title.trim() || 'Avvikelse' }))}
          />
        </Ram>
      ),
    })
  }

  let visadeHandelser = false
  let visadeBilder = false
  const fore = bitar.length
  for (const b of block) {
    if (b.type === 'text') {
      const delar = stycken(b.content.text)
      ;(delar.length > 0 ? delar : ['']).forEach((p, i) => {
        bitar.push({
          key: `d:${b.id}:${i}`,
          gap: i === 0 ? GAP : 0,
          render: () => (
            <Ram falt={`block:${b.id}`} etikett="Redigera texten" style={{ padding: '2px 6px' }}>
              {p ? <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{p}</p> : tomt('Här hamnar din beskrivning')}
            </Ram>
          ),
        })
      })
    } else if (b.type === 'map') {
      bitar.push({
        key: `d:${b.id}`,
        gap: GAP,
        render: () => (
          <Ram falt={`block:${b.id}`} etikett="Kartutsnittet">
            {harOmrade
              ? <Karta area={del.area} color={farg} className="h-[110px] w-[62%] rounded-[2px] bg-[#a9b8a3]" />
              : <span className="flex items-center justify-center" style={{ height: 80, width: '62%', background: '#eef0ec', color: TOM, fontStyle: 'italic' }}>Inget område ritat</span>}
          </Ram>
        ),
      })
    } else if (b.type === 'events' && !visadeHandelser) {
      bitar.push(...handelseBitar())
      visadeHandelser = true
    } else if (b.type === 'images' && !visadeBilder) {
      bitar.push(...bildBitar())
      visadeBilder = true
    }
  }
  // Som i PDF:en: innehåll utan block visas ändå sist
  if (!visadeHandelser && handelser.length > 0) bitar.push(...handelseBitar())
  if (!visadeBilder && bilder.length > 0) bitar.push(...bildBitar())
  if (bitar.length === fore && avvikelser.length === 0) {
    bitar.push({ key: `d:${del.id}:tomt`, gap: GAP, render: () => tomt('Delen har inget innehåll än') })
  }

  const namn = del.title.trim() || SECTION_LABELS[del.label]
  return {
    key: del.id,
    namn,
    farg,
    sidhuvud: true,
    fortsattning: `2.${nr} ${namn}, fortsättning`,
    bitar,
    tabellHuvud: { [evGrupp]: () => <HandelseHuvud /> },
  }
}

function sidaSamm(report: SpecialReportFull): LogiskSida {
  const bedomning = stycken(report.assessment)
  const bitar: Bit[] = [
    { key: 'samm:rubrik', gap: GAP, hallIhop: true, render: () => <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: RUBRIK }}><span style={{ color: BRAND }}>3.</span> Bedömning och åtgärder</span> },
    ...(bedomning.length > 0 ? bedomning : ['']).map((p, i): Bit => ({
      key: `samm:bedomning:${i}`,
      gap: i === 0 ? GAP : 0,
      render: () => (
        <Ram falt="rapport:assessment" etikett="Redigera bedömningen" style={{ background: '#f0fdf9', borderLeft: `3px solid ${BRAND}`, padding: i === 0 ? '4px 6px 2px' : '2px 6px' }}>
          {i === 0 && <span style={{ display: 'block', fontWeight: 700, color: RUBRIK, marginBottom: 2 }}>Vår bedömning</span>}
          {p ? <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{p}</p> : tomt('Här hamnar din bedömning')}
        </Ram>
      ),
    })),
    {
      key: 'samm:atgarder',
      gap: GAP,
      render: () => (
        <Ram falt="rapport:recommendations" etikett="Redigera de rekommenderade åtgärderna" style={{ margin: 0, padding: 0 }}>
          <AtgardsPanel rader={atgardsRader(report.recommendations)} />
        </Ram>
      ),
    },
  ]
  return { key: 'samm', namn: 'Bedömning och åtgärder', farg: BRAND, sidhuvud: true, fortsattning: '3. Bedömning och åtgärder, fortsättning', bitar, tabellHuvud: {} }
}

// ── Fördelning på sidor ──

/**
 * Fördelar bitarna på fysiska sidor i ett varv. Varje bit placeras exakt en
 * gång: får den inte plats och sidan redan har bitar börjar en ny sida, annars
 * läggs den ändå. Är den högre än en hel sida sträcks sidan (hojd), så att
 * inget klipps bort.
 */
function fordela(logiska: LogiskSida[], h: (key: string) => number): FysiskSida[] {
  const ut: FysiskSida[] = []
  const tillganglig = INNER_H - h('sidfot') - GAP
  // Använd höjd per sida (index i ut), för att kunna sträcka en sida som inte rymmer sin bit
  const innehall: number[] = []
  for (const L of logiska) {
    let n = 0
    let anvant = 0
    let element = 0
    let antalBitar = 0
    let sida: FysiskSida
    const lagg = (hojd: number, gap: number) => {
      anvant += (element > 0 ? gap : 0) + hojd
      element += 1
      innehall[ut.length - 1] = anvant
    }
    const ny = (fortsattning: boolean, tabell: string | null): FysiskSida => {
      const s: FysiskSida = { key: `${L.key}:${n}`, logisk: L.key, del: n, sidhuvud: L.sidhuvud || fortsattning, fortsattning, tabell, bitar: [], notis: false, nr: 0, hojd: SIDA_H }
      n += 1
      ut.push(s)
      innehall.push(0)
      anvant = 0
      element = 0
      antalBitar = 0
      if (s.sidhuvud) lagg(h('sidhuvud'), GAP)
      if (fortsattning) lagg(h(`fots:${L.key}`), GAP)
      if (tabell) lagg(h(`thead:${tabell}`), GAP)
      return s
    }
    sida = ny(false, null)
    for (let i = 0; i < L.bitar.length; i++) {
      const b = L.bitar[i]
      const nasta = L.bitar[i + 1]
      let behov = (element > 0 ? b.gap : 0) + h(b.key)
      if (b.hallIhop && nasta) behov += nasta.gap + h(nasta.key)
      // Fortsätter tabellen efter raden: plats för "Tabellen fortsätter på nästa sida"
      if (b.grupp && nasta?.grupp === b.grupp) behov += GAP + h('notis')
      if (anvant + behov > tillganglig && antalBitar > 0) {
        const forra = L.bitar[i - 1]
        const tabell = b.grupp && forra?.grupp === b.grupp ? b.grupp : null
        if (tabell) sida.notis = true
        sida = ny(true, tabell)
      }
      lagg(h(b.key), b.gap)
      sida.bitar.push(b.key)
      antalBitar += 1
    }
  }
  ut.forEach((s, i) => {
    s.nr = i + 1
    const anvant = innehall[i] + (s.notis ? GAP + h('notis') : 0)
    // Sträck sidan, med två px marginal mot avrundning i mätningen
    if (anvant > tillganglig) s.hojd = Math.ceil(2 * PAD_Y + anvant + GAP + h('sidfot') + 2)
  })
  return ut
}

// ── Hooken: mät och fördela ──

export interface RapportSidor {
  sidor: FysiskSida[]
  /** Logiska sidor per nyckel (namn, färg, bitar) */
  logiska: Map<string, LogiskSida>
  /** Den osynliga mätbehållaren, ska renderas någonstans i trädet */
  matning: ReactNode
}

export function useRapportSidor(report: SpecialReportFull): RapportSidor {
  const logiskaLista = useMemo(() => byggLogiska(report), [report])
  const logiska = useMemo(() => new Map(logiskaLista.map(l => [l.key, l])), [logiskaLista])
  const [hojder, setHojder] = useState<Record<string, number>>({})
  const matRef = useRef<HTMLDivElement>(null)

  const mat = useCallback(() => {
    const rot = matRef.current
    if (!rot) return
    const ny: Record<string, number> = {}
    rot.querySelectorAll<HTMLElement>('[data-mat]').forEach(el => {
      ny[el.dataset.mat!] = el.offsetHeight
    })
    setHojder(gammal => {
      const nycklar = Object.keys(ny)
      if (nycklar.length === Object.keys(gammal).length && nycklar.every(k => gammal[k] === ny[k])) return gammal
      return ny
    })
  }, [])

  // Mät efter varje ändring av innehållet (synkront, före målning) och när
  // något byter storlek (typsnitt, loggan som avkodas). Mätningen beror aldrig
  // på hojder och setHojder behåller samma objekt när inget ändrats, så det
  // blir ingen render-loop. ResizeObserver samlas till en mätning per bildruta.
  useLayoutEffect(() => {
    mat()
    const rot = matRef.current
    if (!rot || typeof ResizeObserver === 'undefined') return
    let ram = 0
    const ro = new ResizeObserver(() => {
      if (ram) return
      ram = requestAnimationFrame(() => { ram = 0; mat() })
    })
    rot.querySelectorAll<HTMLElement>('[data-mat]').forEach(el => ro.observe(el))
    return () => {
      ro.disconnect()
      if (ram) cancelAnimationFrame(ram)
    }
  }, [logiskaLista, mat])

  const sidor = useMemo(() => fordela(logiskaLista, k => hojder[k] ?? 0), [logiskaLista, hojder])

  // Ytterlådan har storleken noll och klipper, så att mätningen aldrig gör rullen längre
  const matning = (
    <div aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, overflow: 'hidden', visibility: 'hidden', pointerEvents: 'none' }}>
    <div ref={matRef} style={{ width: INNER_B, ...PAPPER_TEXT }}>
      <VisningKontext.Provider value={{ matning: true, miniatyr: false }}>
        <RamKontext.Provider value={{ fokus: null, farg: BRAND, sida: 'om', onValj: null }}>
          <div data-mat="sidhuvud"><Sidhuvud report={report} /></div>
          <div data-mat="sidfot"><Sidfot report={report} nr={1} antal={1} /></div>
          <div data-mat="notis"><Notis /></div>
          {logiskaLista.map(l => (
            <div key={l.key}>
              <div data-mat={`fots:${l.key}`}><Fortsattning text={l.fortsattning} farg={l.farg} /></div>
              {Object.entries(l.tabellHuvud).map(([g, r]) => <div key={g} data-mat={`thead:${g}`}>{r()}</div>)}
              {l.bitar.map(b => <div key={b.key} data-mat={b.key}>{b.render()}</div>)}
            </div>
          ))}
        </RamKontext.Provider>
      </VisningKontext.Provider>
    </div>
    </div>
  )

  return { sidor, logiska, matning }
}

// ── Sidans delar ──

function Sidhuvud({ report }: { report: SpecialReportFull }) {
  return (
    <div className="flex items-center justify-between" style={{ paddingBottom: 6, borderBottom: `1px solid ${LINJE}` }}>
      <img src={BEGONE_LOGO_DATA_URI} alt="BeGone" style={{ width: 54, height: 'auto' }} />
      <span style={{ fontSize: 7, letterSpacing: '0.14em', color: GRA, textTransform: 'uppercase' }}>
        {[report.doc_type, report.case_number].filter(Boolean).join(' · ')}
      </span>
    </div>
  )
}

function Sidfot({ report, nr, antal }: { report: SpecialReportFull; nr: number; antal: number }) {
  return (
    <div className="flex justify-between gap-2" style={{ paddingTop: 6, borderTop: `1px solid ${LINJE}`, fontSize: 7, color: GRA }}>
      <span>Begone Skadedjur</span>
      <span className="truncate">{report.title}</span>
      <span className="whitespace-nowrap">Sida {nr} av {antal}</span>
    </div>
  )
}

function Fortsattning({ text, farg }: { text: string; farg: string }) {
  return (
    <div className="flex items-center" style={{ gap: 5, fontSize: 8.5, color: GRA }}>
      <span style={{ width: 3, height: 10, background: farg, flexShrink: 0 }} />
      {text}
    </div>
  )
}

function Notis() {
  return <span style={{ display: 'block', color: TOM, fontStyle: 'italic' }}>Tabellen fortsätter på nästa sida</span>
}

interface RapportSidaProps {
  report: SpecialReportFull
  sida: FysiskSida
  logisk: LogiskSida
  antal: number
  fokus?: string | null
  onValj?: ((vy: string, falt: string | null) => void) | null
  /** Kartor och bilder som tomma ytor (sidminiatyrer) */
  miniatyr?: boolean
}

/** En fysisk sida i full storlek (420 x 594 px), skalas av den som visar den */
export function RapportSida({ report, sida, logisk, antal, fokus = null, onValj = null, miniatyr = false }: RapportSidaProps) {
  const bitFor = useMemo(() => new Map(logisk.bitar.map(b => [b.key, b])), [logisk])
  const element: { key: string; gap: number; node: ReactNode }[] = []
  if (sida.sidhuvud) element.push({ key: 'sidhuvud', gap: GAP, node: <Sidhuvud report={report} /> })
  if (sida.fortsattning) element.push({ key: 'fots', gap: GAP, node: <Fortsattning text={logisk.fortsattning} farg={logisk.farg} /> })
  if (sida.tabell && logisk.tabellHuvud[sida.tabell]) element.push({ key: 'thead', gap: GAP, node: logisk.tabellHuvud[sida.tabell]() })
  for (const k of sida.bitar) {
    const b = bitFor.get(k)
    if (b) element.push({ key: k, gap: b.gap, node: b.render() })
  }
  if (sida.notis) element.push({ key: 'notis', gap: GAP, node: <Notis /> })

  return (
    <VisningKontext.Provider value={{ matning: false, miniatyr }}>
      <RamKontext.Provider value={{ fokus, farg: logisk.farg, sida: logisk.key, onValj }}>
        <div
          className="flex flex-col"
          style={{
            width: SIDA_B,
            height: sida.hojd,
            background: '#ffffff',
            padding: `${PAD_Y}px ${PAD_X}px`,
            boxSizing: 'border-box',
            overflow: 'hidden',
            ...PAPPER_TEXT,
          }}
        >
          <div style={{ flex: '1 1 auto', minHeight: 0, overflow: 'hidden' }}>
            {element.map((e, i) => (
              <div key={e.key} style={{ marginTop: i > 0 ? e.gap : 0 }}>{e.node}</div>
            ))}
          </div>
          <div style={{ marginTop: GAP, flexShrink: 0 }}>
            <Sidfot report={report} nr={sida.nr} antal={antal} />
          </div>
        </div>
      </RamKontext.Provider>
    </VisningKontext.Provider>
  )
}

/**
 * Sidan skalad till en given bredd (transform, så mätningen gäller i alla
 * storlekar). hojd är sidans höjd i full storlek (FysiskSida.hojd)
 */
export function SkaladSida({ bredd, hojd = SIDA_H, children, style }: { bredd: number; hojd?: number; children: ReactNode; style?: CSSProperties }) {
  const skala = bredd / SIDA_B
  return (
    <div style={{ width: bredd, height: hojd * skala, overflow: 'hidden', flexShrink: 0, ...style }}>
      <div style={{ width: SIDA_B, height: hojd, transform: `scale(${skala})`, transformOrigin: 'top left' }}>
        {children}
      </div>
    </div>
  )
}

// ── Rutor som återkommer ──

/**
 * Översiktens rutor (3.54.0): "Avvikelser att åtgärda" och "Det här
 * rekommenderar vi" bredvid varandra, under varandra när det är trångt.
 */
function Sammanfattning({ report }: { report: SpecialReportFull }) {
  const avvikelser = avvikelserIRapporten(report.sections)
  const atgarder = atgardsRader(report.recommendations)
  if (avvikelser.length === 0 && atgarder.length === 0) return null
  const ruta: CSSProperties = { flex: '1 1 150px', minWidth: 0 }
  // Klick på avvikelserna leder till den första delen som har en
  const forstaDel = avvikelser.length > 0 ? report.sections[avvikelser[0].del - 1] : undefined
  return (
    <div className="flex flex-wrap" style={{ gap: 6 }}>
      {avvikelser.length > 0 && (
        <Lank vy={forstaDel?.id ?? 'om'} falt={forstaDel ? `del:${forstaDel.id}:handelser` : null} etikett="Gå till avvikelserna" style={ruta}>
          <AvvikelseRuta
            rubrik={`Avvikelser att åtgärda (${avvikelser.length})`}
            rader={avvikelser.map(a => ({ key: a.event.id, datum: a.event.event_date, text: a.event.title.trim() || 'Avvikelse', del: `2.${a.del} ${a.delTitel}` }))}
          />
        </Lank>
      )}
      {atgarder.length > 0 && (
        <Lank vy="samm" falt="rapport:recommendations" etikett="Gå till de rekommenderade åtgärderna" style={ruta}>
          <div style={{ height: '100%', background: ATGARD_TON, border: `1px solid ${ATGARD_RAM}`, borderRadius: 3, padding: '6px 8px' }}>
            <span className="flex items-center" style={{ gap: 4, fontWeight: 700, color: RUBRIK, marginBottom: 3 }}>
              <span style={{ color: BRAND, display: 'inline-flex' }}><Icon name="rapport.atgarder" size={16} className="h-[11px] w-[11px]" /></span>
              Det här rekommenderar vi
            </span>
            <Numrerad rader={atgarder.slice(0, 3)} liten />
            <span style={{ display: 'block', marginTop: 2, color: GRA, fontSize: 7.5 }}>
              {atgarder.length > 3 ? `Ytterligare ${atgarder.length - 3} i avsnitt 3. ` : ''}Se avsnitt 3.
            </span>
          </div>
        </Lank>
      )}
    </div>
  )
}

/** Röd ruta med avvikelser: tunn röd ram, röd accent till vänster, ljust röd yta */
function AvvikelseRuta({ rubrik, rader }: { rubrik: string; rader: { key: string; datum: string; text: string; del?: string }[] }) {
  return (
    <div style={{ height: '100%', background: AVVIKELSE_TON, border: `1px solid ${AVVIKELSE_RAM}`, borderLeft: `3px solid ${AVVIKELSE_FARG}`, borderRadius: 3, padding: '6px 8px' }}>
      <span className="flex items-center" style={{ gap: 4, fontWeight: 700, color: AVVIKELSE_FARG, marginBottom: 3 }}>
        <Icon name="rapport.avvikelse" size={16} className="h-[11px] w-[11px] flex-shrink-0" />
        {rubrik}
      </span>
      {rader.map(r => (
        <span key={r.key} style={{ display: 'block', paddingTop: 2 }}>
          {r.del && <span style={{ display: 'block', fontSize: 7.5, color: GRA }}>{r.del}</span>}
          <span style={{ fontVariantNumeric: 'tabular-nums', color: GRA }}>{r.datum}</span>{' '}
          <span style={{ fontWeight: 600, color: RUBRIK }}>{r.text}</span>
        </span>
      ))}
    </div>
  )
}

/** Numrerade punkter med runda gröna nummer */
function Numrerad({ rader, liten = false }: { rader: string[]; liten?: boolean }) {
  const storlek = liten ? 11 : 14
  return (
    <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
      {rader.map((r, i) => (
        <li key={i} className="flex items-start" style={{ gap: 5, padding: liten ? '1px 0' : '2px 0' }}>
          <span
            className="flex flex-shrink-0 items-center justify-center"
            style={{ width: storlek, height: storlek, borderRadius: '50%', background: BRAND, color: '#ffffff', fontSize: liten ? 6.5 : 7.5, fontWeight: 700, marginTop: 1 }}
          >
            {i + 1}
          </span>
          <span style={{ minWidth: 0, color: TEXT }}>{r}</span>
        </li>
      ))}
    </ol>
  )
}

/** Avsnitt 3: Rekommenderade åtgärder som framträdande panel */
function AtgardsPanel({ rader }: { rader: string[] }) {
  return (
    <div style={{ background: ATGARD_TON, border: `1px solid ${ATGARD_RAM}`, borderRadius: 3, padding: '8px 10px' }}>
      <span className="flex items-center" style={{ gap: 5, fontSize: 10, fontWeight: 700, color: RUBRIK, marginBottom: 4 }}>
        <span style={{ color: BRAND, display: 'inline-flex' }}><Icon name="rapport.atgarder" size={16} className="h-[13px] w-[13px]" /></span>
        Rekommenderade åtgärder
      </span>
      {rader.length > 0 ? <Numrerad rader={rader} /> : tomt('Här hamnar dina rekommenderade åtgärder')}
    </div>
  )
}
