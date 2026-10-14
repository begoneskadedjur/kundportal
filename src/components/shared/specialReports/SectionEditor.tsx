// src/components/shared/specialReports/SectionEditor.tsx
// Delvyn i redigeraren (3.53.0): ett rubrikband tonat i delens färg med stor
// siffra, rubrik och underrubrik, en egenskapsrad (typ, färg och plats på
// kartan) och blocken som kort med en ⋯-meny för flytta och ta bort.
// Fält och block bär data-falt så att redigeraren vet vad som har fokus (ramen
// i förhandsvisningen) och kan flytta fokus hit vid klick på sidan.
// Layouten följer behållarens bredd (container queries), inte fönstrets.

import { useEffect, useMemo, useRef, useState } from 'react'
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
import { IKON_KNAPP, IKON_KNAPP_LATT, KORT, SNYGGA_KNAPP, TEXTFALT } from './specialReportUtils'
import EventsBlock from './EventsBlock'
import ImagesBlock from './ImagesBlock'
import AreaMiniMap from './AreaMiniMap'
import SectionColorPicker from './SectionColorPicker'
import Meny from './Meny'

/** Blockets ikon, ton och förklaring i kortets huvud */
const BLOCK_INFO: Record<SpecialReportBlockType, { ikon: IconName; ton: string; hint: string }> = {
  text: { ikon: 'rapport.text', ton: 'bg-emerald-500/10 text-emerald-400', hint: 'Beskriv läget med egna ord.' },
  events: { ikon: 'rapport.handelser', ton: 'bg-blue-500/10 text-blue-400', hint: 'Fynd och åtgärder med datum. Bifoga bilder till varje händelse.' },
  images: { ikon: 'rapport.bilder', ton: 'bg-pink-500/10 text-pink-400', hint: 'Koppla en bild till en händelse, så hänvisar rapporten till den.' },
  map: { ikon: 'rapport.karta', ton: 'bg-cyan-500/10 text-cyan-400', hint: 'Området inzoomat på kartan.' },
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

/** Liten rubrik över ett fält i egenskapsraden */
const FALTETIKETT = 'text-[11px] uppercase tracking-wider text-slate-500'
/** Knappen som öppnar typ- eller färgmenyn */
const EGENSKAP_KNAPP =
  'flex h-11 max-w-full items-center gap-2.5 rounded-xl pr-2 text-[15px] font-semibold text-white hover:bg-slate-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]/60'

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

  return (
    <div ref={rotRef} className="@container space-y-4" style={{ ['--del' as string]: color }}>
      {/* ── Rubrikband och egenskaper ── */}
      <div className={`rounded-[22px] ${KORT}`}>
        <div className="flex items-center gap-3.5 rounded-t-[22px] px-4 py-4 @lg:gap-[18px] @lg:px-6 @lg:pb-[18px] @lg:pt-[22px]" style={{ background: `${color}1a` }}>
          <span
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-[22px] font-extrabold text-[#fff] @lg:h-16 @lg:w-16 @lg:rounded-[18px] @lg:text-[28px]"
            style={{ background: color, boxShadow: `0 6px 16px ${color}55` }}
            aria-hidden="true"
          >
            {nr}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <label data-falt={`del:${section.id}:rubrik`} className="block">
              <span className="sr-only">Delens rubrik</span>
              <input
                ref={rubrikRef}
                value={section.title}
                onChange={e => ops.updateSection(section.id, { title: e.target.value })}
                placeholder="Till exempel Källaren eller Besök 3 maj"
                className="w-full border-0 border-b-2 border-transparent bg-transparent px-0 py-0.5 text-[21px] font-extrabold text-white placeholder-slate-500 outline-none focus:border-[var(--del)] focus:ring-0 @lg:text-[26px]"
              />
            </label>
            <label data-falt={`del:${section.id}:underrubrik`} className="block">
              <span className="sr-only">Underrubrik</span>
              <input
                value={section.subtitle ?? ''}
                onChange={e => ops.updateSection(section.id, { subtitle: e.target.value || null })}
                placeholder="Lägg till adress eller datum"
                className="w-full border-0 border-b border-transparent bg-transparent px-0 py-0.5 text-[15px] text-slate-400 placeholder-slate-500 outline-none focus:border-[var(--del)] focus:ring-0"
              />
            </label>
          </div>
          <button
            type="button"
            aria-label="Ta bort delen"
            title="Ta bort delen"
            onClick={() => setBekraftaSektion(true)}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center self-start rounded-xl bg-slate-900/70 text-slate-400 transition-colors hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]/60"
          >
            <Icon name="allman.radera" size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 border-t border-slate-800 @md:grid-cols-2 @3xl:grid-cols-[1fr_1fr_1.4fr]">
          {/* Typ */}
          <div className="relative flex flex-col gap-1 border-b border-slate-800 px-4 py-3 @md:border-r @lg:px-5 @3xl:border-b-0">
            <span className={FALTETIKETT}>Typ</span>
            <button
              ref={typKnappRef}
              type="button"
              aria-haspopup="menu"
              aria-expanded={meny === 'typ'}
              onClick={() => setMeny(m => (m === 'typ' ? null : 'typ'))}
              className={EGENSKAP_KNAPP}
            >
              <span className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-[9px] bg-emerald-500/10 text-emerald-400">
                <Icon name={TYP_INFO[section.label].ikon} size={16} />
              </span>
              <span className="truncate">{SECTION_LABELS[section.label]}</span>
              <ChevronDown className="h-4 w-4 flex-shrink-0 text-slate-500" />
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
                    className={`flex min-h-[48px] w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left outline-none hover:bg-slate-800 focus:bg-slate-800 ${vald ? 'bg-[#20c58f]/10' : ''}`}
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
          </div>

          {/* Färg */}
          <div className="relative flex flex-col gap-1 border-b border-slate-800 px-4 py-3 @lg:px-5 @3xl:border-b-0 @3xl:border-r">
            <span className={FALTETIKETT}>Färg</span>
            <button
              ref={fargKnappRef}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={meny === 'farg'}
              onClick={() => setMeny(m => (m === 'farg' ? null : 'farg'))}
              className={EGENSKAP_KNAPP}
            >
              <span
                className="h-[26px] w-[26px] flex-shrink-0 rounded-full"
                style={{ background: color, boxShadow: '0 0 0 3px var(--color-slate-900, #0f172a), 0 0 0 4px var(--color-slate-700, #334155)' }}
              />
              <span className="truncate">{fargNamn}</span>
              <ChevronDown className="h-4 w-4 flex-shrink-0 text-slate-500" />
            </button>
            <Meny open={meny === 'farg'} onClose={() => setMeny(null)} anchorRef={fargKnappRef} label="Färg på delen" role="dialog">
              {/* Klick (och Enter) väljer och stänger, piltangenterna flyttar utan att stänga */}
              <div onClick={() => { setMeny(null); fargKnappRef.current?.focus() }} className="px-1 sm:w-[176px]">
                <SectionColorPicker value={color} onChange={c => ops.updateSection(section.id, { color: c })} size={44} />
              </div>
            </Meny>
          </div>

          {/* Plats */}
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 @md:col-span-2 @lg:px-5 @3xl:col-span-1">
            {harOmrade ? (
              <AreaMiniMap area={section.area!} color={color} className="h-[52px] w-[84px] rounded-[10px] bg-slate-800" />
            ) : (
              <span className="flex h-[52px] w-[84px] flex-shrink-0 items-center justify-center rounded-[10px] border-[1.5px] border-dashed border-slate-700 text-slate-500" aria-hidden="true">
                <Icon name="rapport.omrade" size={20} />
              </span>
            )}
            <span className="flex min-w-[120px] flex-1 flex-col gap-0.5">
              <span className={FALTETIKETT}>Plats</span>
              <span className="text-sm font-semibold text-white">{harOmrade ? 'Ritat område på kartan' : 'Ingen plats ritad'}</span>
            </span>
            {harOmrade ? (
              <span className="flex gap-1.5">
                <button type="button" aria-label="Visa på kartan" title="Visa på kartan" onClick={() => ops.showArea(section.id)} className={IKON_KNAPP}>
                  <Icon name="rapport.karta" size={16} />
                </button>
                <button type="button" aria-label="Rita om området" title="Rita om" onClick={() => ops.drawArea(section.id)} className={IKON_KNAPP}>
                  <Icon name="rapport.penna" size={16} />
                </button>
                <button type="button" aria-label="Ta bort området" title="Ta bort området" onClick={() => setBekraftaOmrade(true)} className={IKON_KNAPP}>
                  <Icon name="allman.radera" size={16} />
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => ops.drawArea(section.id)}
                className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-slate-700 px-3 text-sm font-semibold text-emerald-400 hover:bg-slate-800"
              >
                <Icon name="rapport.penna" size={16} />
                Rita område
              </button>
            )}
          </div>
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
            className={`rounded-[20px] transition-shadow ${KORT}`}
            style={harFokus ? { boxShadow: `0 0 0 2px ${color}` } : undefined}
          >
            <BlockHuvud
              typ={b.type}
              polish={polish ? { aria: polish.aria, onClick: () => onPolish?.(polish.mal) } : null}
              forsta={i === 0}
              sista={i === block.length - 1}
              arbetar={arbetar === b.id}
              onFlytta={steg => ops.moveBlock(section.id, b.id, steg)}
              onTaBort={() => setBekraftaBlock(b)}
            />
            <div className="px-4 pb-4 @lg:px-[18px] @lg:pb-[18px]">
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
                    <AreaMiniMap area={section.area!} color={color} className="h-40 w-full max-w-[320px] rounded-2xl bg-slate-800" />
                    <p className="max-w-xs text-sm leading-relaxed text-slate-400">Utsnitt av området på översiktskartan. Det här kommer med i rapporten.</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    Delen har inget område.{' '}
                    <button type="button" onClick={() => ops.drawArea(section.id)} className="inline-flex min-h-[44px] items-center text-emerald-400 hover:underline">Rita ett på kartan</button>
                  </p>
                )
              )}
            </div>
          </div>
        )
      })}

      {/* ── Lägg till i delen ── */}
      <div className="space-y-2">
        <span className="block text-xs uppercase tracking-wider text-slate-500">Lägg till i delen</span>
        <div className="grid grid-cols-1 gap-2.5 @md:grid-cols-2">
          {tillgangliga.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => laggTillBlock(t)}
              disabled={arbetar !== null}
              className={`flex min-h-[64px] items-center gap-3 rounded-2xl p-3 text-left transition-shadow hover:ring-[#20c58f] disabled:opacity-50 ${KORT}`}
            >
              <span className={`flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[11px] ${BLOCK_INFO[t].ton}`}>
                {arbetar === `nytt-${t}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon name={BLOCK_INFO[t].ikon} size={20} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-white">{NYTT_BLOCK[t].rubrik}</span>
                <span className="block text-xs text-slate-400">{NYTT_BLOCK[t].text}</span>
              </span>
              <Icon name="allman.plus" size={20} className="flex-shrink-0 text-slate-500" />
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
  polish: { aria: string; onClick: () => void } | null
  forsta: boolean
  sista: boolean
  arbetar: boolean
  onFlytta: (steg: -1 | 1) => void
  onTaBort: () => void
}

/** Blockets huvud: ikonruta, rubrik och förklaring, Snygga till och ⋯-menyn */
function BlockHuvud({ typ, polish, forsta, sista, arbetar, onFlytta, onTaBort }: BlockHuvudProps) {
  const [oppen, setOppen] = useState(false)
  const knappRef = useRef<HTMLButtonElement>(null)
  const info = BLOCK_INFO[typ]
  const val = 'flex h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm outline-none hover:bg-slate-800 focus:bg-slate-800 disabled:opacity-40'

  return (
    <div className="flex items-center gap-3 py-3 pl-4 pr-2 @lg:pl-[18px]">
      <span className={`flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[11px] ${info.ton}`}>
        <Icon name={info.ikon} size={20} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-base font-bold text-white">{BLOCK_LABELS[typ]}</span>
        <span className="hidden text-xs text-slate-400 @md:block">{info.hint}</span>
      </span>
      {polish && (
        <button type="button" aria-label={polish.aria} title={polish.aria} onClick={polish.onClick} className={SNYGGA_KNAPP}>
          <Icon name="rapport.snygga" size={16} />
          <span className="hidden @md:inline">Snygga till</span>
        </button>
      )}
      <span className="relative">
        <button
          ref={knappRef}
          type="button"
          aria-label={`Fler val för blocket ${BLOCK_LABELS[typ].toLowerCase()}`}
          aria-haspopup="menu"
          aria-expanded={oppen}
          onClick={() => setOppen(o => !o)}
          className={IKON_KNAPP_LATT}
        >
          {arbetar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon name="allman.meny" size={20} />}
        </button>
        <Meny open={oppen} onClose={() => setOppen(false)} anchorRef={knappRef} label={`Blocket ${BLOCK_LABELS[typ].toLowerCase()}`} align="right" className="sm:w-52">
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
      rows={4}
      placeholder="Beskriv vad du såg, till exempel spår, ingångar och skador."
      className={`${TEXTFALT} rounded-[14px] px-4 py-3 text-[15px]`}
    />
  )
}
