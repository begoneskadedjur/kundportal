// src/components/shared/specialReports/ReportPreview.tsx
// Levande förhandsvisning: en vit A4-sida (210:297) som visar hur kunden ser
// rapporten, byggd direkt från redigerarens lokala tillstånd (ingen väntan på
// sparning). Sidorna: Om rapporten, Översikt (om kartan är med), en per del och
// Bedömning och åtgärder. Fältet som har fokus ramas in i delens färg, och
// klick på något på sidan väljer motsvarande fält i redigeraren.
// 3.54.0: avvikelser (röd accent i tabellen, ruta per del, sammanfattning på
// översikten) och rekommenderade åtgärder som numrerad lista i grön panel, som i PDF:en.
// Allt här föreställer papper: bara fasta färger, aldrig slate-klasser (de
// byter färg med temat).

import { createContext, useContext, type CSSProperties, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { BEGONE_LOGO_DATA_URI } from '../../../lib/begoneLogo'
import { Icon } from '../../icons/Icon'
import {
  AVVIKELSE_FARG,
  AVVIKELSE_TON,
  EVENT_TYPES,
  SECTION_LABELS,
  atgardsRader,
  avvikelserIRapporten,
  type SpecialReportFull,
} from '../../../types/specialReport'
import type { FullSection } from './sectionOps'
import AreaMiniMap from './AreaMiniMap'
import { byggSidor, fargForDel, sidaForVy, type PreviewPage } from './specialReportUtils'

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

function manadsspann(fran: string | null, till: string | null): string {
  if (!fran || !till) return ''
  const [fy, fm] = fran.split('-').map(Number)
  const [ty, tm] = till.split('-').map(Number)
  if (!fy || !fm || !ty || !tm) return ''
  if (fy === ty && fm === tm) return `${MANADER[fm - 1]} ${fy}`
  if (fy === ty) return `${MANADER[fm - 1]} till ${MANADER[tm - 1]} ${fy}`
  return `${MANADER[fm - 1]} ${fy} till ${MANADER[tm - 1]} ${ty}`
}

/** Det Ram behöver: vad som har fokus, ramens färg och vart ett klick leder */
const RamKontext = createContext<{ fokus: string | null; farg: string; sida: string; onValj: (vy: string, falt: string | null) => void }>({
  fokus: null,
  farg: BRAND,
  sida: 'om',
  onValj: () => {},
})

/** Klickbar yta på sidan med ram när fältet har fokus */
function Ram({ falt, aktiv, etikett, children, style }: { falt: string; aktiv?: string[]; etikett: string; children: ReactNode; style?: CSSProperties }) {
  const { fokus, farg, sida, onValj } = useContext(RamKontext)
  const harFokus = !!fokus && (aktiv ?? [falt]).includes(fokus)
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={etikett}
      onClick={() => onValj(sida, falt)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onValj(sida, falt) } }}
      className="cursor-pointer rounded-[4px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
      style={{
        padding: '4px 6px',
        margin: '0 -6px',
        outline: `1.5px solid ${harFokus ? farg : 'transparent'}`,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

const tomt = (text: string) => <span style={{ color: TOM, fontStyle: 'italic' }}>{text}</span>

interface ReportPreviewProps {
  report: SpecialReportFull
  /** Vald vy i redigeraren */
  vy: string
  /** Fältet som har fokus (data-falt) */
  fokus: string | null
  /** Klick på något på sidan: välj vyn och fältet */
  onValj: (vy: string, falt: string | null) => void
  /** Bläddra till en annan sida */
  onBladdra: (vy: string) => void
  /** Visa rubrik och bläddring ovanför sidan */
  visaHuvud?: boolean
  className?: string
}

export default function ReportPreview({ report, vy, fokus, onValj, onBladdra, visaHuvud = true, className = '' }: ReportPreviewProps) {
  const sidor = byggSidor(report)
  const index = sidaForVy(sidor, vy)
  const sida = sidor[index]
  const delIndex = report.sections.findIndex(s => s.id === sida.key)
  const del = delIndex >= 0 ? report.sections[delIndex] : null
  const ramFarg = sida.farg ?? BRAND

  const sidhuvud = (
    <div className="flex items-center justify-between" style={{ paddingBottom: 6, borderBottom: `1px solid ${LINJE}` }}>
      <img src={BEGONE_LOGO_DATA_URI} alt="BeGone" style={{ width: 54, height: 'auto' }} />
      <span style={{ fontSize: 7, letterSpacing: '0.14em', color: GRA, textTransform: 'uppercase' }}>
        {[report.doc_type, report.case_number].filter(Boolean).join(' · ')}
      </span>
    </div>
  )

  return (
    <RamKontext.Provider value={{ fokus, farg: ramFarg, sida: sida.key, onValj }}>
    <div className={`flex w-full flex-col items-center gap-2.5 ${className}`}>
      {visaHuvud && (
        <div className="flex w-full max-w-[420px] items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Icon name="rapport.forhandsgranska" size={20} className="text-slate-400" />
            Så ser kunden rapporten
          </span>
          <Bladdring sidor={sidor} index={index} onBladdra={onBladdra} />
        </div>
      )}

      <div
        className="flex w-full max-w-[420px] flex-col"
        style={{
          aspectRatio: '210 / 297',
          background: '#ffffff',
          boxShadow: '0 6px 24px rgba(15,23,42,0.25)',
          borderRadius: 2,
          padding: '26px 30px',
          gap: 10,
          fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
          color: TEXT,
          fontSize: 9,
          lineHeight: 1.45,
        }}
      >
        {sida.key === 'om' && (
          <>
            <SidaOm report={report} />
            {!report.map_view && <Sammanfattning report={report} />}
          </>
        )}
        {sida.key === 'oversikt' && (
          <>
            {sidhuvud}
            <SidaOversikt report={report} />
            <Sammanfattning report={report} />
          </>
        )}
        {del && (
          <>
            {sidhuvud}
            <SidaDel del={del} nr={delIndex + 1} farg={ramFarg} />
          </>
        )}
        {sida.key === 'samm' && (
          <>
            {sidhuvud}
            <span style={{ fontSize: 13, fontWeight: 700, color: RUBRIK }}><span style={{ color: BRAND }}>3.</span> Bedömning och åtgärder</span>
            <Ram falt="rapport:assessment" etikett="Redigera bedömningen" style={{ background: '#f0fdf9', borderLeft: `3px solid ${BRAND}` }}>
              <span style={{ display: 'block', fontWeight: 700, color: RUBRIK, marginBottom: 2 }}>Vår bedömning</span>
              {report.assessment?.trim() ? <Stycken text={report.assessment} /> : tomt('Här hamnar din bedömning')}
            </Ram>
            <Ram falt="rapport:recommendations" etikett="Redigera de rekommenderade åtgärderna" style={{ margin: 0, padding: 0 }}>
              <AtgardsPanel rader={atgardsRader(report.recommendations)} />
            </Ram>
          </>
        )}

        <div className="flex justify-between gap-2" style={{ marginTop: 'auto', paddingTop: 6, borderTop: `1px solid ${LINJE}`, fontSize: 7, color: GRA }}>
          <span>Begone Skadedjur</span>
          <span className="truncate">{report.title}</span>
          <span className="whitespace-nowrap">Sida {index + 1} av {sidor.length}</span>
        </div>
      </div>
    </div>
    </RamKontext.Provider>
  )
}

/** Föregående/nästa sida med "Sida N av M" */
export function Bladdring({ sidor, index, onBladdra, stor = false }: { sidor: PreviewPage[]; index: number; onBladdra: (vy: string) => void; stor?: boolean }) {
  const knapp = `flex items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 disabled:opacity-30 ${stor ? 'h-11 w-11' : 'h-9 w-9'}`
  return (
    <span className="flex items-center gap-1 text-xs text-slate-400">
      <button type="button" aria-label="Föregående sida" disabled={index <= 0} onClick={() => onBladdra(sidor[index - 1].key)} className={knapp}>
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="tabular-nums">Sida {index + 1} av {sidor.length}</span>
      <button type="button" aria-label="Nästa sida" disabled={index >= sidor.length - 1} onClick={() => onBladdra(sidor[index + 1].key)} className={knapp}>
        <ChevronRight className="w-4 h-4" />
      </button>
    </span>
  )
}

/** Fri text: tom rad = nytt stycke, radbrytningar behålls */
function Stycken({ text }: { text: string }) {
  return (
    <>
      {text.trim().split(/\n\s*\n/).map((p, i) => (
        <p key={i} style={{ margin: '0 0 4px', whiteSpace: 'pre-line' }}>{p.trim()}</p>
      ))}
    </>
  )
}

function SidaOm({ report }: { report: SpecialReportFull }) {
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
  return (
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
      <div className="grid grid-cols-4" style={{ borderTop: `1px solid ${LINJE}`, borderBottom: `1px solid ${LINJE}`, padding: '4px 0', rowGap: 4, columnGap: 6 }}>
        {meta.map(([etikett, varde]) => (
          <span key={etikett} className="min-w-0 break-words">
            <span style={{ display: 'block', color: GRA }}>{etikett}</span>
            <span style={{ fontWeight: 600, color: RUBRIK }}>{varde && varde.trim() ? varde : '-'}</span>
          </span>
        ))}
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: RUBRIK, paddingBottom: 3, borderBottom: `1px solid ${LINJE}` }}>
        <span style={{ color: BRAND }}>1.</span> Översikt
      </span>
      <Ram falt="rapport:intro" etikett="Redigera inledningen">
        {report.intro?.trim() ? <Stycken text={report.intro} /> : tomt('Här hamnar din inledning')}
      </Ram>
      {report.address && <span style={{ color: GRA }}>{report.address}</span>}
    </>
  )
}

function SidaOversikt({ report }: { report: SpecialReportFull }) {
  const omraden = report.sections
    .map((s, i) => ({ area: s.area ?? [], color: fargForDel(s.color, i) }))
    .filter(o => o.area.length >= 3)
  return (
    <>
      <span style={{ fontSize: 13, fontWeight: 700, color: RUBRIK }}><span style={{ color: BRAND }}>1.</span> Översikt</span>
      <AreaMiniMap areas={omraden} view={report.map_view} className="h-[150px] w-full rounded-[2px] bg-[#a9b8a3]" />
      {report.sections.length > 0 && (
        <div>
          <div className="grid" style={{ gridTemplateColumns: '22px 1fr 70px 58px', background: '#f0fdf9', fontWeight: 600 }}>
            <span style={{ padding: '3px 5px' }}>Nr</span>
            <span style={{ padding: '3px 5px' }}>Del</span>
            <span style={{ padding: '3px 5px' }}>Gäller</span>
            <span style={{ padding: '3px 5px' }}>Senast</span>
          </div>
          {report.sections.map((s, i) => {
            const senast = s.events.map(e => e.event_date).sort().pop() ?? '-'
            return (
              <div key={s.id} className="grid" style={{ gridTemplateColumns: '22px 1fr 70px 58px', borderTop: `1px solid ${LINJE}` }}>
                <span style={{ padding: '3px 5px', fontWeight: 700, color: fargForDel(s.color, i) }}>{i + 1}</span>
                <span className="truncate" style={{ padding: '3px 5px', color: s.title.trim() ? TEXT : TOM }}>{s.title.trim() || SECTION_LABELS[s.label]}</span>
                <span style={{ padding: '3px 5px' }}>{s.label === 'omrade' ? 'Område på kartan' : SECTION_LABELS[s.label]}</span>
                <span style={{ padding: '3px 5px' }}>{senast}</span>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function SidaDel({ del, nr, farg }: { del: FullSection; nr: number; farg: string }) {
  const block = [...del.blocks].sort((a, b) => a.position - b.position)
  const handelser = [...del.events].sort((a, b) => a.event_date.localeCompare(b.event_date) || a.created_at.localeCompare(b.created_at))
  const bilder = [...del.images].sort((a, b) => a.position - b.position)
  const harOmrade = !!del.area && del.area.length >= 3
  // Bilderna numreras löpande i delen, händelsetabellen hänvisar till numren (som PDF:en)
  const bildNr = new Map(bilder.map((b, i) => [b.id, i + 1]))
  const handelseFor = new Map(del.events.map(e => [e.id, e]))
  const kolumner = '58px 62px 1fr 34px'
  const avvikelser = handelser.filter(e => e.type === 'avvikelse')

  const handelseTabell = (
    <Ram key="handelser" falt={`del:${del.id}:handelser`} etikett="Redigera händelserna">
      <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: RUBRIK, marginBottom: 4 }}>Händelser</span>
      <div className="grid" style={{ gridTemplateColumns: kolumner, background: '#f0fdf9', fontWeight: 600 }}>
        <span style={{ padding: '3px 5px' }}>Datum</span>
        <span style={{ padding: '3px 5px' }}>Typ</span>
        <span style={{ padding: '3px 5px' }}>Vad vi gjorde och såg</span>
        <span style={{ padding: '3px 5px' }}>Bild</span>
      </div>
      {handelser.length === 0 ? (
        <div style={{ padding: '6px 5px', borderTop: `1px solid ${LINJE}` }}>{tomt('Här hamnar dina händelser')}</div>
      ) : handelser.map(e => {
        const avv = e.type === 'avvikelse'
        return (
          <div
            key={e.id}
            className="grid"
            style={{
              gridTemplateColumns: kolumner,
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
            <span style={{ padding: '3px 5px' }}>
              <b>{e.title}</b>
              {e.description?.trim() && <span style={{ whiteSpace: 'pre-line' }}> {e.description.trim()}</span>}
            </span>
            <span style={{ padding: '3px 5px', color: GRA }}>
              {bilder.filter(b => b.event_id === e.id).map(b => bildNr.get(b.id)).join(', ')}
            </span>
          </div>
        )
      })}
    </Ram>
  )

  const bildRutor = (
    <Ram key="bilder" falt={`del:${del.id}:bilder`} etikett="Redigera bilderna">
      <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: RUBRIK, marginBottom: 4 }}>Bilder</span>
      {bilder.length === 0 ? tomt('Här hamnar dina bilder') : (
        <div className="grid grid-cols-3" style={{ gap: 6 }}>
          {bilder.map((b, i) => (
            <span key={b.id} className="flex min-w-0 flex-col" style={{ gap: 2 }}>
              {b.url
                ? <img src={b.url} alt="" style={{ width: '100%', height: 54, objectFit: 'cover', borderRadius: 1, background: LINJE }} />
                : <span style={{ height: 54, background: LINJE }} />}
              <span style={{ fontSize: 7, color: '#4b5563' }}>
                <b>Bild {i + 1}.</b>{b.caption?.trim() ? ` ${b.caption.trim()}` : ''}
                {b.event_id && handelseFor.get(b.event_id) && (
                  <span style={{ display: 'block', color: GRA }}>Hör till: {handelseFor.get(b.event_id)!.title?.trim() || 'Utan rubrik'}, {handelseFor.get(b.event_id)!.event_date}</span>
                )}
              </span>
            </span>
          ))}
        </div>
      )}
    </Ram>
  )

  const innehall: ReactNode[] = []
  let visadeHandelser = false
  let visadeBilder = false
  for (const b of block) {
    if (b.type === 'text') {
      const text = b.content.text ?? ''
      innehall.push(
        <Ram key={b.id} falt={`block:${b.id}`} etikett="Redigera texten">
          {text.trim() ? <Stycken text={text} /> : tomt('Här hamnar din beskrivning')}
        </Ram>,
      )
    } else if (b.type === 'map') {
      innehall.push(
        <Ram key={b.id} falt={`block:${b.id}`} etikett="Kartutsnittet">
          {harOmrade
            ? <AreaMiniMap area={del.area!} color={farg} className="h-[110px] w-[62%] rounded-[2px] bg-[#a9b8a3]" />
            : <span className="flex items-center justify-center" style={{ height: 80, width: '62%', background: '#eef0ec', color: TOM, fontStyle: 'italic' }}>Inget område ritat</span>}
        </Ram>,
      )
    } else if (b.type === 'events' && !visadeHandelser) {
      innehall.push(handelseTabell)
      visadeHandelser = true
    } else if (b.type === 'images' && !visadeBilder) {
      innehall.push(bildRutor)
      visadeBilder = true
    }
  }
  // Som i PDF:en: innehåll utan block visas ändå sist
  if (!visadeHandelser && handelser.length > 0) innehall.push(handelseTabell)
  if (!visadeBilder && bilder.length > 0) innehall.push(bildRutor)

  const underrubrik = [del.subtitle?.trim() || null, harOmrade ? `område ${nr} på översiktskartan` : null].filter(Boolean).join(' · ')

  return (
    <>
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
      {avvikelser.length > 0 && (
        <Ram falt={`del:${del.id}:handelser`} etikett="Redigera avvikelserna" style={{ margin: 0, padding: 0 }}>
          <AvvikelseRuta
            rubrik={`Avvikelser i den här delen (${avvikelser.length})`}
            rader={avvikelser.map(e => ({ key: e.id, datum: e.event_date, text: e.title.trim() || 'Avvikelse' }))}
          />
        </Ram>
      )}
      {innehall.length > 0 ? innehall : tomt('Delen har inget innehåll än')}
    </>
  )
}

/** Klickbar yta som leder till en annan vy i redigeraren (rutorna på översikten) */
function Lank({ vy, falt, etikett, children, style }: { vy: string; falt: string | null; etikett: string; children: ReactNode; style?: CSSProperties }) {
  const { onValj } = useContext(RamKontext)
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={etikett}
      onClick={() => onValj(vy, falt)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onValj(vy, falt) } }}
      className="cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
      style={style}
    >
      {children}
    </div>
  )
}

/**
 * Översiktens rutor (3.54.0): "Avvikelser att åtgärda" och "Det här
 * rekommenderar vi" bredvid varandra, under varandra när det är trångt.
 * Visas bara när det finns något att visa, som i PDF:en.
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
