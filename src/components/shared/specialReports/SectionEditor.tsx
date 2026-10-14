// src/components/shared/specialReports/SectionEditor.tsx
// Sektionsvyn i redigeraren: rubrik, underrubrik, etikett, område på kartan
// och blocken i ordning (flytta upp/ned, ta bort, lägg till).

import { useEffect, useMemo, useState } from 'react'
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
import type { FullSection, SectionOps } from './sectionOps'
import { FALT, IKON_KNAPP, IKON_KNAPP_LATT, TEXTFALT } from './specialReportUtils'
import EventsBlock from './EventsBlock'
import ImagesBlock from './ImagesBlock'
import AreaMiniMap from './AreaMiniMap'

const BLOCK_ICON: Record<SpecialReportBlockType, IconName> = {
  text: 'rapport.text',
  events: 'rapport.handelser',
  images: 'rapport.bilder',
  map: 'rapport.karta',
}

const ETIKETTER = Object.keys(SECTION_LABELS) as SpecialReportSectionLabel[]

interface SectionEditorProps {
  reportId: string
  section: FullSection
  nr: number
  ops: SectionOps
}

export default function SectionEditor({ reportId, section, nr, ops }: SectionEditorProps) {
  const [bekraftaSektion, setBekraftaSektion] = useState(false)
  const [bekraftaBlock, setBekraftaBlock] = useState<SpecialReportBlock | null>(null)
  const [bekraftaOmrade, setBekraftaOmrade] = useState(false)
  const [arbetar, setArbetar] = useState<string | null>(null)

  const block = useMemo(() => [...section.blocks].sort((a, b) => a.position - b.position), [section.blocks])
  const harTyp = (t: SpecialReportBlockType) => block.some(b => b.type === t)
  const harOmrade = !!section.area && section.area.length >= 3

  const tillgangliga: SpecialReportBlockType[] = [
    'text',
    ...(!harTyp('events') ? ['events' as const] : []),
    ...(!harTyp('images') ? ['images' as const] : []),
    ...(harOmrade && !harTyp('map') ? ['map' as const] : []),
  ]

  const laggTillBlock = async (t: SpecialReportBlockType) => {
    setArbetar(`nytt-${t}`)
    try { await ops.addBlock(section.id, t) } finally { setArbetar(null) }
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
    ? 'Händelserna finns kvar i sektionen och visas igen om du lägger till ett händelseblock.'
    : bekraftaBlock?.type === 'images'
      ? 'Bilderna finns kvar i sektionen och visas igen om du lägger till ett bildblock.'
      : 'Texten i blocket försvinner.'

  return (
    <div className="space-y-4">
      {/* Rubrik */}
      <div className="flex flex-wrap items-end gap-3">
        <span className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-xl bg-[#20c58f] text-xl font-extrabold text-[#04140d]">
          {nr}
        </span>
        <label className="min-w-[180px] flex-[1.2]">
          <span className="block text-xs font-medium text-slate-400 mb-1">Rubrik</span>
          <input
            value={section.title}
            onChange={e => ops.updateSection(section.id, { title: e.target.value })}
            className={`${FALT} text-[15px] font-semibold`}
          />
        </label>
        <label className="min-w-[160px] flex-1">
          <span className="block text-xs font-medium text-slate-400 mb-1">Underrubrik</span>
          <input
            value={section.subtitle ?? ''}
            onChange={e => ops.updateSection(section.id, { subtitle: e.target.value || null })}
            placeholder="Adress, datum eller företag"
            className={FALT}
          />
        </label>
        <button type="button" aria-label="Ta bort sektionen" onClick={() => setBekraftaSektion(true)} className={IKON_KNAPP}>
          <Icon name="allman.radera" size={20} />
        </button>
      </div>

      {/* Etikett och område */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Etikett</span>
          <div role="radiogroup" aria-label="Etikett" className="flex gap-1 rounded-xl border border-slate-700/60 bg-slate-900/60 p-1">
            {ETIKETTER.map(l => {
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

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400">Område på kartan</span>
          {harOmrade ? (
            <>
              <span className="text-xs text-slate-200">Område {nr}</span>
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
      </div>

      {/* Block */}
      <div className="space-y-2.5">
        {block.map((b, i) => (
          <div key={b.id} className="overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/60">
            <div className="flex items-center gap-1 border-b border-slate-700/60 py-0.5 pl-3.5 pr-1">
              <Icon name={BLOCK_ICON[b.type]} size={16} className="text-slate-500" />
              <span className="ml-1.5 flex-1 text-xs uppercase tracking-wider text-slate-400">{BLOCK_LABELS[b.type]}</span>
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
                    <AreaMiniMap area={section.area!} />
                    <p className="max-w-xs text-sm leading-relaxed text-slate-400">Utsnitt av området på översiktskartan. Det här kommer med i rapporten.</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    Sektionen har inget område.{' '}
                    <button type="button" onClick={() => ops.drawArea(section.id)} className="text-[#20c58f] hover:underline">Rita ett på kartan</button>
                  </p>
                )
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Lägg till block */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">Lägg till block</span>
        {tillgangliga.map(t => (
          <button
            key={t}
            type="button"
            onClick={() => laggTillBlock(t)}
            disabled={arbetar !== null}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-dashed border-slate-600 px-3 text-xs text-slate-300 hover:border-[#20c58f] hover:text-white disabled:opacity-50"
          >
            {arbetar === `nytt-${t}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon name={BLOCK_ICON[t]} size={16} />}
            {BLOCK_LABELS[t]}
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
        title="Ta bort sektionen?"
        message={`"${section.title}" tas bort med ${section.events.length} händelser och ${section.images.length} bilder. Det går inte att ångra.`}
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
        message="Området försvinner från översiktskartan. Sektionen och dess innehåll finns kvar."
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
      placeholder="Skriv här."
      className={`${TEXTFALT} border-transparent bg-transparent px-0 focus:ring-0 focus:border-transparent`}
    />
  )
}
