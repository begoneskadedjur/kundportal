// src/components/shared/specialReports/SectionEditor.tsx
// Delvyn i redigeraren: rubrik, underrubrik, typ av del, färg, område på kartan
// och blocken i ordning (flytta upp/ned, ta bort, lägg till).
// Fält och block bär data-falt så att redigeraren vet vad som har fokus (ramen
// i förhandsvisningen) och kan flytta fokus hit vid klick på sidan.

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import ConfirmModal from '../../ui/ConfirmModal'
import { Icon, type IconName } from '../../icons/Icon'
import {
  BLOCK_LABELS,
  SECTION_LABELS,
  type SpecialReportBlock,
  type SpecialReportBlockType,
  type SpecialReportSectionLabel,
} from '../../../types/specialReport'
import type { FullSection, PolishTarget, SectionOps } from './sectionOps'
import { FALT, IKON_KNAPP, IKON_KNAPP_LATT, SNYGGA_KNAPP, TEXTFALT } from './specialReportUtils'
import EventsBlock from './EventsBlock'
import ImagesBlock from './ImagesBlock'
import AreaMiniMap from './AreaMiniMap'
import SectionColorPicker from './SectionColorPicker'

const BLOCK_ICON: Record<SpecialReportBlockType, IconName> = {
  text: 'rapport.text',
  events: 'rapport.handelser',
  images: 'rapport.bilder',
  map: 'rapport.karta',
}

/** Kort hjälptext i blockets huvud */
const BLOCK_HINT: Record<SpecialReportBlockType, string> = {
  text: 'Beskriv läget',
  events: 'Fynd och åtgärder med datum',
  images: 'Foton från platsen',
  map: 'Området inzoomat',
}

/** Knapparna under "Lägg till i delen" */
const NYTT_BLOCK: Record<SpecialReportBlockType, { rubrik: string; text: string }> = {
  text: { rubrik: 'Mer text', text: 'Ett stycke till' },
  events: { rubrik: 'Händelser', text: 'Fynd och åtgärder med datum' },
  images: { rubrik: 'Bilder', text: 'Foton från platsen' },
  map: { rubrik: 'Kartutsnitt', text: 'Området inzoomat' },
}

const TYPER = Object.keys(SECTION_LABELS) as SpecialReportSectionLabel[]

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
  const rotRef = useRef<HTMLDivElement>(null)
  const rubrikRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFokusRubrik) rubrikRef.current?.focus()
  }, [autoFokusRubrik])

  const block = useMemo(() => [...section.blocks].sort((a, b) => a.position - b.position), [section.blocks])
  const harTyp = (t: SpecialReportBlockType) => block.some(b => b.type === t)
  const harOmrade = !!section.area && section.area.length >= 3

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

  // Block med innehåll som döljs bekräftas först
  const begarTaBortBlock = (b: SpecialReportBlock) => {
    const doljer = (b.type === 'events' && section.events.length > 0)
      || (b.type === 'images' && section.images.length > 0)
      || (b.type === 'text' && (b.content.text ?? '').trim().length > 0)
    if (doljer) setBekraftaBlock(b)
    else void taBortBlock(b)
  }

  const bekraftaBlockText = bekraftaBlock?.type === 'events'
    ? 'Händelserna finns kvar i delen och visas igen om du lägger till ett händelseblock.'
    : bekraftaBlock?.type === 'images'
      ? 'Bilderna finns kvar i delen och visas igen om du lägger till ett bildblock.'
      : 'Texten i blocket försvinner.'

  // data-falt per block: händelser och bilder har ett fält per del, text och karta ett per block
  const faltFor = (b: SpecialReportBlock) =>
    b.type === 'events' ? `del:${section.id}:handelser` : b.type === 'images' ? `del:${section.id}:bilder` : `block:${b.id}`

  const rubrikFokus = fokus === `del:${section.id}:rubrik` || fokus === `del:${section.id}:underrubrik`

  return (
    <div ref={rotRef} className="space-y-4">
      {/* Rubrik */}
      <div className="flex flex-wrap items-end gap-3">
        <span
          className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-xl text-xl font-extrabold text-[#fff]"
          style={{ background: color }}
          aria-hidden="true"
        >
          {nr}
        </span>
        <label className="min-w-[180px] flex-[1.3]" data-falt={`del:${section.id}:rubrik`}>
          <span className="block text-xs font-medium text-slate-400 mb-1">Rubrik</span>
          <input
            ref={rubrikRef}
            value={section.title}
            onChange={e => ops.updateSection(section.id, { title: e.target.value })}
            placeholder="Till exempel Källaren, Gårdshuset eller Besök 3 maj"
            className={`${FALT} text-[15px] font-semibold`}
            style={rubrikFokus ? { borderColor: color } : undefined}
          />
        </label>
        <label className="min-w-[160px] flex-1" data-falt={`del:${section.id}:underrubrik`}>
          <span className="block text-xs font-medium text-slate-400 mb-1">Underrubrik</span>
          <input
            value={section.subtitle ?? ''}
            onChange={e => ops.updateSection(section.id, { subtitle: e.target.value || null })}
            placeholder="Till exempel adress eller datum"
            className={FALT}
            style={rubrikFokus ? { borderColor: color } : undefined}
          />
        </label>
        <button type="button" aria-label="Ta bort delen" title="Ta bort delen" onClick={() => setBekraftaSektion(true)} className={IKON_KNAPP}>
          <Icon name="allman.radera" size={20} />
        </button>
      </div>

      {/* Typ av del och färg */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400">Typ av del</span>
          <div role="radiogroup" aria-label="Typ av del" className="flex flex-wrap gap-1 rounded-xl border border-slate-700/60 bg-slate-900/60 p-1">
            {TYPER.map(l => {
              const vald = section.label === l
              return (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={vald}
                  onClick={() => ops.updateSection(section.id, { label: l })}
                  className={`h-9 rounded-lg px-3 text-xs transition-colors ${vald ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {SECTION_LABELS[l]}
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-xs text-slate-400">Färg</span>
          <SectionColorPicker value={color} onChange={c => ops.updateSection(section.id, { color: c })} size={36} />
        </div>
      </div>

      {/* Område på kartan */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-slate-400">Område på kartan</span>
        {harOmrade ? (
          <>
            <span className="flex items-center gap-1.5 text-xs text-slate-200">
              <span className="h-[7px] w-[7px] rounded-full" style={{ background: color }} />
              Ritat
            </span>
            <button type="button" aria-label="Visa området på kartan" title="Visa på kartan" onClick={() => ops.showArea(section.id)} className={IKON_KNAPP_LATT}>
              <Icon name="rapport.karta" size={16} />
            </button>
            <button type="button" aria-label="Rita om området" title="Rita om" onClick={() => ops.drawArea(section.id)} className={IKON_KNAPP_LATT}>
              <Icon name="rapport.omrade" size={16} />
            </button>
            <button type="button" aria-label="Ta bort området" title="Ta bort området" onClick={() => setBekraftaOmrade(true)} className={IKON_KNAPP_LATT}>
              <Icon name="allman.radera" size={16} />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => ops.drawArea(section.id)}
            className="inline-flex h-11 items-center gap-1.5 rounded-lg px-2 text-xs text-[#20c58f] hover:bg-slate-800"
          >
            <Icon name="rapport.omrade" size={16} />
            Rita område
          </button>
        )}
      </div>

      {/* Block */}
      <div className="space-y-2.5">
        {block.map((b, i) => {
          const falt = faltFor(b)
          const harFokus = fokus === falt
          const polish = onPolish ? polishFor(section.id, b) : null
          return (
            <div
              key={b.id}
              data-falt={falt}
              className="overflow-hidden rounded-xl border-[1.5px] border-slate-700/60 bg-slate-900/60 transition-colors"
              style={harFokus ? { borderColor: color } : undefined}
            >
              <div className="flex items-center gap-1 border-b border-slate-700/60 py-0.5 pl-3.5 pr-1">
                <Icon name={BLOCK_ICON[b.type]} size={16} className="text-slate-500" />
                <span className="ml-1.5 text-xs text-slate-300">{BLOCK_LABELS[b.type]}</span>
                <span className="ml-1.5 hidden flex-1 truncate text-xs text-slate-500 sm:inline">{BLOCK_HINT[b.type]}</span>
                <span className="flex-1 sm:hidden" />
                {polish && (
                  <button type="button" aria-label={polish.aria} title={polish.aria} onClick={() => onPolish?.(polish.mal)} className={SNYGGA_KNAPP}>
                    <Icon name="rapport.snygga" size={16} />
                    <span className="hidden sm:inline">Snygga till</span>
                  </button>
                )}
                <button type="button" aria-label="Flytta blocket uppåt" disabled={i === 0} onClick={() => ops.moveBlock(section.id, b.id, -1)} className={IKON_KNAPP_LATT}>
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button type="button" aria-label="Flytta blocket nedåt" disabled={i === block.length - 1} onClick={() => ops.moveBlock(section.id, b.id, 1)} className={IKON_KNAPP_LATT}>
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button type="button" aria-label="Ta bort blocket" disabled={arbetar === b.id} onClick={() => begarTaBortBlock(b)} className={IKON_KNAPP_LATT}>
                  {arbetar === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon name="allman.stang" size={16} />}
                </button>
              </div>
              <div className="p-3.5">
                {b.type === 'text' && (
                  <TextBlock
                    initial={b.content.text ?? ''}
                    onChange={t => ops.updateBlockText(section.id, b.id, t)}
                  />
                )}
                {b.type === 'events' && <EventsBlock reportId={reportId} section={section} ops={ops} />}
                {b.type === 'images' && <ImagesBlock section={section} ops={ops} />}
                {b.type === 'map' && (
                  harOmrade ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <AreaMiniMap area={section.area!} color={color} />
                      <p className="max-w-xs text-sm leading-relaxed text-slate-400">Utsnitt av området på översiktskartan. Det här kommer med i rapporten.</p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Delen har inget område.{' '}
                      <button type="button" onClick={() => ops.drawArea(section.id)} className="text-[#20c58f] hover:underline">Rita ett på kartan</button>
                    </p>
                  )
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Lägg till i delen */}
      <div className="flex flex-wrap gap-2">
        <span className="w-full text-xs text-slate-400">Lägg till i delen</span>
        {tillgangliga.map(t => (
          <button
            key={t}
            type="button"
            onClick={() => laggTillBlock(t)}
            disabled={arbetar !== null}
            className="inline-flex min-h-[52px] items-center gap-2.5 rounded-xl border-[1.5px] border-dashed border-slate-600 px-3.5 text-left hover:border-[#20c58f] disabled:opacity-50"
          >
            {arbetar === `nytt-${t}`
              ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              : <Icon name={BLOCK_ICON[t]} size={20} className="text-slate-400" />}
            <span>
              <span className="block text-sm font-semibold text-slate-100">{NYTT_BLOCK[t].rubrik}</span>
              <span className="block text-[11px] text-slate-400">{NYTT_BLOCK[t].text}</span>
            </span>
          </button>
        ))}
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
      className={`${TEXTFALT} border-transparent bg-transparent px-0 focus:ring-0 focus:border-transparent`}
    />
  )
}
