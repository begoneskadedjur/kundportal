// src/components/shared/specialReports/SectionEditor.tsx
// Delvyn i redigeraren. Ett rubrikband tonat i delens färg med siffra, rubrik
// och underrubrik, en egenskapsrad (typ, färg och plats på kartan) och blocken
// som kort med en ⋯-meny för flytta och ta bort.
// 3.55.0: tätare, i stil med V5-mellantinget: siffran cirka 36 px, rubriken
// cirka 19 px med underrubriken på samma rad, Typ, Färg och Plats på en rad.
// Blockkorten har tunn kant i stället för skugga, padding 10 till 12 px och en
// rubrikrad på 32 px utan ikonruta.
// Fält och block bär data-falt så att redigeraren vet vad som har fokus (ramen
// i förhandsvisningen) och kan flytta fokus hit vid klick på sidan.
// Layouten följer behållarens bredd (container queries), inte fönstrets.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import ConfirmModal from '../../ui/ConfirmModal'
import { Icon, type IconName } from '../../icons/Icon'
import {
  BLOCK_LABELS,
  SECTION_COLORS,
  SECTION_LABELS,
  type SpecialReportBlock,
  type SpecialReportBlockType,
  type SpecialReportSectionLabel,
} from '../../../types/specialReport'
import type { FullSection, PolishTarget, SectionOps } from './sectionOps'
import { KORT, LITEN_IKON_KNAPP, LITEN_TEXT_KNAPP, TEXTFALT } from './specialReportUtils'
import EventsBlock from './EventsBlock'
import ImagesBlock from './ImagesBlock'
import AreaMiniMap from './AreaMiniMap'
import SectionColorPicker from './SectionColorPicker'
import Meny from './Meny'

/** Blockets ikon, ton (i Lägg till) och förklaring i kortets huvud */
const BLOCK_INFO: Record<SpecialReportBlockType, { ikon: IconName; ton: string; hint: string }> = {
  text: { ikon: 'rapport.text', ton: 'bg-emerald-500/10 text-emerald-400', hint: 'Beskriv läget med egna ord' },
  events: { ikon: 'rapport.handelser', ton: 'bg-blue-500/10 text-blue-400', hint: 'Fynd och åtgärder med datum' },
  images: { ikon: 'rapport.bilder', ton: 'bg-pink-500/10 text-pink-400', hint: 'Koppla en bild till en händelse' },
  map: { ikon: 'rapport.karta', ton: 'bg-cyan-500/10 text-cyan-400', hint: 'Området inzoomat, kommer med i rapporten' },
}

/** Korten under "Lägg till i delen" */
const NYTT_BLOCK: Record<SpecialReportBlockType, { rubrik: string; text: string }> = {
  text: { rubrik: 'Mer text', text: 'Ett stycke till' },
  events: { rubrik: 'Händelser', text: 'Fynd och åtgärder med datum' },
  images: { rubrik: 'Bilder', text: 'Foton från platsen' },
  map: { rubrik: 'Kartutsnitt', text: 'Området inzoomat' },
}

/** Delens typer med ikon och förklaring i typmenyn */
const TYP_INFO: Record<SpecialReportSectionLabel, { ikon: IconName; text: string }> = {
  omrade: { ikon: 'rapport.omrade', text: 'En plats på kartan' },
  besok: { ikon: 'rapport.besok', text: 'Vad som gjordes en viss dag' },
  underlev: { ikon: 'rapport.underlev', text: 'Arbete som någon annan utförde' },
  fritt: { ikon: 'rapport.text', text: 'Valfri text och bilder' },
}

const TYPER = Object.keys(SECTION_LABELS) as SpecialReportSectionLabel[]

/** Knappen som öppnar typ- eller färgmenyn i egenskapsraden */
const EGENSKAP_KNAPP =
  'flex h-8 max-w-full items-center gap-1.5 rounded-lg px-2 text-[13px] hover:bg-slate-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]/60'

interface SectionEditorProps {
  reportId: string
  section: FullSection
  nr: number
  /** Delens färg (med reserv om den saknas) */
  color: string
  ops: SectionOps
  /** Fältet som har fokus i redigeraren (data-falt), för ramen runt blocket */
  fokus: string | null
  /** Ny del: fokus i rubrikfältet direkt */
  autoFokusRubrik?: boolean
  /** Snygga till ett block (text, händelser eller bildtexter) */
  onPolish?: (mal: PolishTarget) => void
}

/** Vad Snygga till läser i ett block, och knappens text för skärmläsare */
function polishFor(sectionId: string, b: SpecialReportBlock): { mal: PolishTarget; aria: string } | null {
  if (b.type === 'text') return { mal: { typ: 'block', sectionId, blockId: b.id }, aria: 'Snygga till texten' }
  if (b.type === 'events') return { mal: { typ: 'handelser', sectionId }, aria: 'Snygga till händelsernas text' }
  if (b.type === 'images') return { mal: { typ: 'bilder', sectionId }, aria: 'Snygga till bildtexterna' }
  return null
}

export default function SectionEditor({ reportId, section, nr, color, ops, fokus, autoFokusRubrik = false, onPolish }: SectionEditorProps) {
  const [bekraftaSektion, setBekraftaSektion] = useState(false)
  const [bekraftaBlock, setBekraftaBlock] = useState<SpecialReportBlock | null>(null)
  const [bekraftaOmrade, setBekraftaOmrade] = useState(false)
  const [arbetar, setArbetar] = useState<string | null>(null)
  const [meny, setMeny] = useState<'typ' | 'farg' | null>(null)
  const rotRef = useRef<HTMLDivElement>(null)
  const rubrikRef = useRef<HTMLInputElement>(null)
  const typKnappRef = useRef<HTMLButtonElement>(null)
  const fargKnappRef = useRef<HTMLButtonElement>(null)
  // Bildblockets filväljare, för "Ladda upp" i blockets huvud
  const bildValjRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (autoFokusRubrik) rubrikRef.current?.focus()
  }, [autoFokusRubrik])

  const block = useMemo(() => [...section.blocks].sort((a, b) => a.position - b.position), [section.blocks])
  const harTyp = (t: SpecialReportBlockType) => block.some(b => b.type === t)
  const harOmrade = !!section.area && section.area.length >= 3
  const fargNamn = SECTION_COLORS.find(c => c.value.toLowerCase() === color.toLowerCase())?.name ?? 'Egen färg'

  const tillgangliga: SpecialReportBlockType[] = [
    ...(!harTyp('events') ? ['events' as const] : []),
    ...(!harTyp('images') ? ['images' as const] : []),
    ...(harOmrade && !harTyp('map') ? ['map' as const] : []),
    'text',
  ]

  const laggTillBlock = async (t: SpecialReportBlockType) => {
    setArbetar(`nytt-${t}`)
    try {
      await ops.addBlock(section.id, t)
      // Nytt textblock: skrivmarkören dit direkt
      if (t === 'text') {
        requestAnimationFrame(() => {
          const falt = rotRef.current?.querySelectorAll<HTMLTextAreaElement>('[data-falt^="block:"] textarea')
          falt?.[falt.length - 1]?.focus()
        })
      }
    } finally {
      setArbetar(null)
    }
  }

  const taBortBlock = async (b: SpecialReportBlock) => {
    setArbetar(b.id)
    try { await ops.deleteBlock(section.id, b.id) } finally { setArbetar(null); setBekraftaBlock(null) }
  }

  const bekraftaBlockText = bekraftaBlock?.type === 'events'
    ? (section.events.length > 0 ? 'Händelserna finns kvar i delen och visas igen om du lägger till ett händelseblock.' : 'Blocket tas bort från delen.')
    : bekraftaBlock?.type === 'images'
      ? (section.images.length > 0 ? 'Bilderna finns kvar i delen och visas igen om du lägger till ett bildblock.' : 'Blocket tas bort från delen.')
      : bekraftaBlock?.type === 'text' && (bekraftaBlock.content.text ?? '').trim()
        ? 'Texten i blocket försvinner.'
        : 'Blocket tas bort från delen.'

  // data-falt per block: händelser och bilder har ett fält per del, text och karta ett per block
  const faltFor = (b: SpecialReportBlock) =>
    b.type === 'events' ? `del:${section.id}:handelser` : b.type === 'images' ? `del:${section.id}:bilder` : `block:${b.id}`

  /** Grå text efter blockets rubrik */
  const hintFor = (b: SpecialReportBlock): string => {
    if (b.type === 'events') {
      const n = section.events.length
      return n > 1 ? `${n} st · dra i greppet för att ändra ordning` : n === 1 ? '1 st' : BLOCK_INFO.events.hint
    }
    if (b.type === 'images') return section.images.length > 0 ? `${section.images.length} st` : BLOCK_INFO.images.hint
    if (b.type === 'map') return BLOCK_INFO.map.hint
    return ''
  }

  return (
    <div ref={rotRef} className="@container space-y-2.5" style={{ ['--del' as string]: color }}>
      {/* ── Rubrikband och egenskaper ── */}
      <div className={`overflow-visible rounded-xl ${KORT}`}>
        <div className="flex items-center gap-3 rounded-t-xl border-b border-slate-800 px-3 py-2.5 @lg:px-3.5" style={{ background: `${color}14` }}>
          <span
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] text-[17px] font-extrabold text-[#fff]"
            style={{ background: color }}
            aria-hidden="true"
          >
            {nr}
          </span>
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5">
            <label data-falt={`del:${section.id}:rubrik`} className="block min-w-0 max-w-full">
              <span className="sr-only">Delens rubrik</span>
              <input
                ref={rubrikRef}
                value={section.title}
                onChange={e => ops.updateSection(section.id, { title: e.target.value })}
                placeholder="Till exempel Källaren"
                size={Math.max(12, section.title.length + 1)}
                className="max-w-full border-0 border-b-2 border-transparent bg-transparent px-0 py-0 text-[19px] font-bold text-white placeholder-slate-500 outline-none [field-sizing:content] focus:border-[var(--del)] focus:ring-0"
              />
            </label>
            <label data-falt={`del:${section.id}:underrubrik`} className="block min-w-[140px] flex-1">
              <span className="sr-only">Underrubrik</span>
              <input
                value={section.subtitle ?? ''}
                onChange={e => ops.updateSection(section.id, { subtitle: e.target.value || null })}
                placeholder="Lägg till adress eller datum"
                className="w-full border-0 border-b border-transparent bg-transparent px-0 py-0 text-[13px] text-slate-400 placeholder-slate-500 outline-none focus:border-[var(--del)] focus:ring-0"
              />
            </label>
          </div>
          <button
            type="button"
            aria-label="Ta bort delen"
            title="Ta bort delen"
            onClick={() => setBekraftaSektion(true)}
            className={`${LITEN_IKON_KNAPP} hover:text-red-400`}
          >
            <Icon name="allman.radera" size={16} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1 px-2 py-1.5">
          {/* Typ */}
          <span className="relative">
            <button
              ref={typKnappRef}
              type="button"
              aria-haspopup="menu"
              aria-expanded={meny === 'typ'}
              onClick={() => setMeny(m => (m === 'typ' ? null : 'typ'))}
              className={EGENSKAP_KNAPP}
            >
              <span className="text-slate-500">Typ</span>
              <Icon name={TYP_INFO[section.label].ikon} size={16} className="text-emerald-400" />
              <span className="truncate font-semibold text-white">{SECTION_LABELS[section.label]}</span>
              <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
            </button>
            <Meny open={meny === 'typ'} onClose={() => setMeny(null)} anchorRef={typKnappRef} label="Typ av del" className="sm:w-72">
              {TYPER.map(l => {
                const vald = section.label === l
                return (
                  <button
                    key={l}
                    type="button"
                    role="menuitemradio"
                    aria-checked={vald}
                    onClick={() => { ops.updateSection(section.id, { label: l }); setMeny(null); typKnappRef.current?.focus() }}
                    className={`flex min-h-[44px] w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-left outline-none hover:bg-slate-800 focus:bg-slate-800 ${vald ? 'bg-[#20c58f]/10' : ''}`}
                  >
                    <Icon name={TYP_INFO[l].ikon} size={20} className={vald ? 'text-emerald-400' : 'text-slate-400'} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-white">{SECTION_LABELS[l]}</span>
                      <span className="block text-xs text-slate-400">{TYP_INFO[l].text}</span>
                    </span>
                    {vald && <Icon name="allman.bock" size={16} className="text-emerald-400" />}
                  </button>
                )
              })}
            </Meny>
          </span>

          <span className="hidden h-[18px] w-px bg-slate-800 @md:block" aria-hidden="true" />

          {/* Färg */}
          <span className="relative">
            <button
              ref={fargKnappRef}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={meny === 'farg'}
              onClick={() => setMeny(m => (m === 'farg' ? null : 'farg'))}
              className={EGENSKAP_KNAPP}
            >
              <span className="text-slate-500">Färg</span>
              <span className="h-3.5 w-3.5 flex-shrink-0 rounded-full" style={{ background: color }} />
              <span className="truncate font-semibold text-white">{fargNamn}</span>
              <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
            </button>
            <Meny open={meny === 'farg'} onClose={() => setMeny(null)} anchorRef={fargKnappRef} label="Färg på delen" role="dialog">
              {/* Klick (och Enter) väljer och stänger, piltangenterna flyttar utan att stänga */}
              <div onClick={() => { setMeny(null); fargKnappRef.current?.focus() }} className="px-1 sm:w-[176px]">
                <SectionColorPicker value={color} onChange={c => ops.updateSection(section.id, { color: c })} size={44} />
              </div>
            </Meny>
          </span>

          <span className="hidden h-[18px] w-px bg-slate-800 @md:block" aria-hidden="true" />

          {/* Plats */}
          <span className="flex min-w-0 items-center gap-2 px-2 text-[13px]">
            <span className="text-slate-500">Plats</span>
            {harOmrade ? (
              <AreaMiniMap area={section.area!} color={color} className="h-6 w-10 rounded-[5px] bg-slate-800" />
            ) : null}
            <span className={`truncate font-semibold ${harOmrade ? 'text-white' : 'text-slate-400'}`}>{harOmrade ? 'Ritat område' : 'Ingen plats ritad'}</span>
          </span>
          <span className="flex-1" />
          {harOmrade ? (
            <span className="flex gap-0.5">
              <button type="button" aria-label="Visa på kartan" title="Visa på kartan" onClick={() => ops.showArea(section.id)} className={LITEN_IKON_KNAPP}>
                <Icon name="rapport.karta" size={16} />
              </button>
              <button type="button" aria-label="Rita om området" title="Rita om" onClick={() => ops.drawArea(section.id)} className={LITEN_IKON_KNAPP}>
                <Icon name="rapport.penna" size={16} />
              </button>
              <button type="button" aria-label="Ta bort området" title="Ta bort området" onClick={() => setBekraftaOmrade(true)} className={`${LITEN_IKON_KNAPP} hover:text-red-400`}>
                <Icon name="allman.radera" size={16} />
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => ops.drawArea(section.id)} className={`${LITEN_TEXT_KNAPP} h-8 font-semibold text-emerald-400`}>
              <Icon name="rapport.penna" size={16} />
              Rita område
            </button>
          )}
        </div>
      </div>

      {/* ── Block ── */}
      {block.map((b, i) => {
        const falt = faltFor(b)
        const harFokus = fokus === falt
        const polish = onPolish ? polishFor(section.id, b) : null
        return (
          <div
            key={b.id}
            data-falt={falt}
            className={`flex flex-col gap-2 rounded-xl px-3 pb-3 pt-2 transition-shadow ${KORT}`}
            style={harFokus ? { boxShadow: `0 0 0 1.5px ${color}` } : undefined}
          >
            <BlockHuvud
              typ={b.type}
              hint={hintFor(b)}
              polish={polish ? { aria: polish.aria, onClick: () => onPolish?.(polish.mal) } : null}
              extra={b.type === 'images' ? (
                <button type="button" onClick={() => bildValjRef.current?.()} className={`${LITEN_TEXT_KNAPP} border border-slate-700 text-slate-200`}>
                  <Icon name="rapport.ladda-upp" size={16} />
                  <span className="hidden @md:inline">Ladda upp</span>
                </button>
              ) : null}
              forsta={i === 0}
              sista={i === block.length - 1}
              arbetar={arbetar === b.id}
              onFlytta={steg => ops.moveBlock(section.id, b.id, steg)}
              onTaBort={() => setBekraftaBlock(b)}
            />
            {b.type === 'text' && (
              <TextBlock
                initial={b.content.text ?? ''}
                onChange={t => ops.updateBlockText(section.id, b.id, t)}
              />
            )}
            {b.type === 'events' && <EventsBlock reportId={reportId} section={section} ops={ops} />}
            {b.type === 'images' && <ImagesBlock section={section} ops={ops} valjRef={bildValjRef} />}
            {b.type === 'map' && (
              harOmrade ? (
                <AreaMiniMap area={section.area!} color={color} className="h-[130px] w-full max-w-[260px] rounded-lg bg-slate-800" />
              ) : (
                <p className="text-xs text-slate-500">
                  Delen har inget område.{' '}
                  <button type="button" onClick={() => ops.drawArea(section.id)} className="font-semibold text-emerald-400 hover:underline">Rita ett på kartan</button>
                </p>
              )
            )}
          </div>
        )
      })}

      {/* ── Lägg till i delen ── */}
      <div className="space-y-1.5 pt-1">
        <span className="block text-[11px] uppercase tracking-wider text-slate-500">Lägg till i delen</span>
        <div className="grid grid-cols-1 gap-2 @md:grid-cols-2 @3xl:grid-cols-4">
          {tillgangliga.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => laggTillBlock(t)}
              disabled={arbetar !== null}
              className={`flex min-h-[44px] items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left transition-colors hover:border-[#20c58f] disabled:opacity-50 ${KORT}`}
            >
              <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${BLOCK_INFO[t].ton}`}>
                {arbetar === `nytt-${t}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon name={BLOCK_INFO[t].ikon} size={16} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-white">{NYTT_BLOCK[t].rubrik}</span>
                <span className="block truncate text-[11px] text-slate-400">{NYTT_BLOCK[t].text}</span>
              </span>
              <Icon name="allman.plus" size={16} className="flex-shrink-0 text-slate-500" />
            </button>
          ))}
        </div>
      </div>

      <ConfirmModal
        isOpen={bekraftaSektion}
        onClose={() => setBekraftaSektion(false)}
        onConfirm={async () => {
          setArbetar('sektion')
          try { await ops.deleteSection(section.id) } finally { setArbetar(null); setBekraftaSektion(false) }
        }}
        title="Ta bort delen?"
        message={`"${section.title.trim() || 'Utan rubrik'}" tas bort med ${section.events.length} händelser och ${section.images.length} bilder. Det går inte att ångra.`}
        confirmLabel="Ta bort"
        variant="danger"
        loading={arbetar === 'sektion'}
      />
      <ConfirmModal
        isOpen={!!bekraftaBlock}
        onClose={() => setBekraftaBlock(null)}
        onConfirm={() => bekraftaBlock && taBortBlock(bekraftaBlock)}
        title="Ta bort blocket?"
        message={bekraftaBlockText}
        confirmLabel="Ta bort"
        variant="danger"
        loading={!!bekraftaBlock && arbetar === bekraftaBlock.id}
      />
      <ConfirmModal
        isOpen={bekraftaOmrade}
        onClose={() => setBekraftaOmrade(false)}
        onConfirm={() => { ops.updateSection(section.id, { area: null }); setBekraftaOmrade(false) }}
        title="Ta bort området?"
        message="Området försvinner från översiktskartan. Delen och dess innehåll finns kvar."
        confirmLabel="Ta bort"
        variant="danger"
      />
    </div>
  )
}

interface BlockHuvudProps {
  typ: SpecialReportBlockType
  /** Grå text efter rubriken (antal, förklaring) */
  hint: string
  polish: { aria: string; onClick: () => void } | null
  /** Extra knapp före ⋯-menyn (Ladda upp i bildblocket) */
  extra?: ReactNode
  forsta: boolean
  sista: boolean
  arbetar: boolean
  onFlytta: (steg: -1 | 1) => void
  onTaBort: () => void
}

/** Blockets huvud (32 px): ikon, rubrik och grå förklaring, Snygga till och ⋯-menyn */
function BlockHuvud({ typ, hint, polish, extra, forsta, sista, arbetar, onFlytta, onTaBort }: BlockHuvudProps) {
  const [oppen, setOppen] = useState(false)
  const knappRef = useRef<HTMLButtonElement>(null)
  const info = BLOCK_INFO[typ]
  const val = 'flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[13px] outline-none hover:bg-slate-800 focus:bg-slate-800 disabled:opacity-40'

  return (
    <div className="flex h-8 items-center gap-2">
      <Icon name={info.ikon} size={20} className="flex-shrink-0 text-slate-400" />
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="flex-shrink-0 text-sm font-bold text-white">{BLOCK_LABELS[typ]}</span>
        {hint && <span className="hidden truncate text-xs text-slate-500 @md:inline">{hint}</span>}
      </span>
      {polish && (
        <button type="button" aria-label={polish.aria} title={polish.aria} onClick={polish.onClick} className={`${LITEN_TEXT_KNAPP} font-semibold text-emerald-400`}>
          <Icon name="rapport.snygga" size={16} />
          <span className="hidden @md:inline">Snygga till</span>
        </button>
      )}
      {extra}
      <span className="relative">
        <button
          ref={knappRef}
          type="button"
          aria-label={`Fler val för blocket ${BLOCK_LABELS[typ].toLowerCase()}`}
          aria-haspopup="menu"
          aria-expanded={oppen}
          onClick={() => setOppen(o => !o)}
          className={`${LITEN_IKON_KNAPP} h-7 w-7`}
        >
          {arbetar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon name="allman.meny" size={16} />}
        </button>
        <Meny open={oppen} onClose={() => setOppen(false)} anchorRef={knappRef} label={`Blocket ${BLOCK_LABELS[typ].toLowerCase()}`} align="right" className="sm:w-48">
          <button type="button" role="menuitem" disabled={forsta} onClick={() => { setOppen(false); onFlytta(-1) }} className={`${val} text-slate-200`}>
            <Icon name="allman.chevron" size={16} className="-rotate-90 text-slate-400" />
            Flytta upp
          </button>
          <button type="button" role="menuitem" disabled={sista} onClick={() => { setOppen(false); onFlytta(1) }} className={`${val} text-slate-200`}>
            <Icon name="allman.chevron" size={16} className="rotate-90 text-slate-400" />
            Flytta ned
          </button>
          <button type="button" role="menuitem" onClick={() => { setOppen(false); onTaBort() }} className={`${val} text-red-400`}>
            <Icon name="allman.radera" size={16} />
            Ta bort blocket
          </button>
        </Meny>
      </span>
    </div>
  )
}

/** Textblock med eget lokalt värde så markören aldrig hoppar */
function TextBlock({ initial, onChange }: { initial: string; onChange: (t: string) => void }) {
  const [text, setText] = useState(initial)
  useEffect(() => { setText(initial) }, [initial])
  return (
    <textarea
      aria-label="Text"
      value={text}
      onChange={e => { setText(e.target.value); onChange(e.target.value) }}
      rows={3}
      placeholder="Beskriv vad du såg, till exempel spår, ingångar och skador."
      className={`${TEXTFALT} rounded-lg px-3 py-2`}
    />
  )
}
