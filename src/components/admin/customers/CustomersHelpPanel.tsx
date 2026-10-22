// src/components/admin/customers/CustomersHelpPanel.tsx
// Hjälpen i Befintliga kunder: panel från höger med texterna ur den godkända
// skissen (Hjalp.dc.html). Stängs med X, klick utanför och Escape.

import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../icons/Icon'
import { SetupGlyph } from './SetupStatus'
import { SETUP_ICON } from './setupStatusPaths'
import type { SetupKey } from '../../../shared/customerSetupStatus'

const STATUS_TEXT: Array<{ key: SetupKey; label: string; text: string }> = [
  { key: 'avtal', label: 'Avtal', text: 'Klart när premie, period, faktureringsintervall och fakturaplan är ifyllda i avtalsvyn.' },
  { key: 'fortnox', label: 'Fortnox', text: 'Klart när kunden har kundnummer och det är verifierat mot Fortnox.' },
  { key: 'vag', label: 'Fakturaväg', text: 'Sätts automatiskt ur avtalet. Påbörjat betyder att fakturan går till kontaktpersonen som reserv.' },
  { key: 'schema', label: 'Schema', text: 'Klart när återkommande besök med tekniker finns för hela avtalsåret.' },
  { key: 'portal', label: 'Kundportalen', text: 'Klart när en kontakt är inbjuden. Gäller inte privatkunder.' },
]

const EVENTS = [
  { icon: 'kund.period' as const, tone: 'text-emerald-400', label: 'Ny period', text: 'Datumet då nästa avtalsperiod börjar och premiefakturan skapas.' },
  { icon: 'kund.uppsagd' as const, tone: 'text-red-400', label: 'Uppsagd', text: 'Datumet då avtalet slutar.' },
  { icon: 'kund.beslut' as const, tone: 'text-amber-400', label: 'Tilläggsstationer att besluta', text: 'Antal stationer som placerats utöver avtalet och väntar på beslut om debitering.' },
]

interface Props {
  open: boolean
  onClose: () => void
  /** T.ex. "/admin/befintliga-kunder" */
  basePath: string
}

export default function CustomersHelpPanel({ open, onClose, basePath }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null
  const prefix = basePath.split('/befintliga-kunder')[0]

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Stäng hjälpen"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/40"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="befintliga-kunder-hjalp"
        className="relative flex h-full w-full max-w-[460px] flex-col gap-6 overflow-y-auto border-l border-slate-700 bg-slate-900 px-5 py-6 shadow-2xl sm:px-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="befintliga-kunder-hjalp" className="text-lg font-bold text-white">Hjälp</h2>
            <p className="text-sm text-slate-400">Befintliga kunder i korthet</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Stäng hjälpen"
            onClick={onClose}
            className="inline-flex rounded-lg p-1.5 text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
          >
            <Icon name="allman.stang" size={20} />
          </button>
        </div>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-white">Vad vyn visar</h3>
          <p className="text-[13px] leading-relaxed text-slate-300">
            Alla avtalskunder. Överst ligger kunder som kräver åtgärd, sedan de som får en ny avtalsperiod inom 90 dagar, sedan resten. Tryck på en rad för att se kunden.
          </p>
        </section>

        <section className="flex flex-col gap-2.5">
          <h3 className="text-sm font-semibold text-white">Status: är kunden färdigupplagd?</h3>
          <p className="text-[13px] leading-relaxed text-slate-300">
            Fem ikoner i den ordning en kund läggs upp. När alla är gröna står det Komplett. Annars står det hur många som är kvar och vad som är nästa steg.
          </p>
          {STATUS_TEXT.map((s) => (
            <div key={s.key} className="flex items-start gap-3">
              <span className="mt-px shrink-0">
                <SetupGlyph name={SETUP_ICON[s.key]} state="done" size={22} />
              </span>
              <span className="flex flex-col gap-px">
                <span className="text-[13px] font-semibold text-white">{s.label}</span>
                <span className="text-[12.5px] leading-snug text-slate-400">{s.text}</span>
              </span>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-2.5">
          <h3 className="text-sm font-semibold text-white">Märket i hörnet visar läget</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[12.5px] text-slate-300">
            <span className="flex items-center gap-2.5"><SetupGlyph name="kund.fortnox" state="done" size={22} />Grön, inget märke: klart</span>
            <span className="flex items-center gap-2.5"><SetupGlyph name="kund.fortnox" state="partial" size={22} />Halv prick: påbörjat</span>
            <span className="flex items-center gap-2.5"><SetupGlyph name="kund.fortnox" state="missing" size={22} />Ring med streck: saknas</span>
            <span className="flex items-center gap-2.5"><SetupGlyph name="kund.fortnox" state="na" size={22} />Snedstreck: gäller inte kunden</span>
          </div>
        </section>

        <section className="flex flex-col gap-2.5">
          <h3 className="text-sm font-semibold text-white">Händelse</h3>
          {EVENTS.map((e) => (
            <div key={e.label} className="flex items-start gap-3">
              <span className={`mt-px shrink-0 ${e.tone}`}><Icon name={e.icon} size={24} /></span>
              <span className="flex flex-col gap-px">
                <span className="text-[13px] font-semibold text-white">{e.label}</span>
                <span className="text-[12.5px] leading-snug text-slate-400">{e.text}</span>
              </span>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-white">Så jobbar du i vyn</h3>
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[13px] leading-relaxed text-slate-300">
            <li>Börja med Kräver åtgärd överst.</li>
            <li>Välj snabbvyn Inte kompletta. Kunderna med flest steg kvar står först. Ikonerna ovanför listan filtrerar, till exempel bara de som saknar Fortnox.</li>
            <li>Håll muspekaren över en ikon för att se varför den har sitt läge. Tryck på ikonen eller på nästa åtgärd för att komma direkt dit.</li>
            <li>Uppsagda kunder visar ingen status. De ska inte läggas upp mer.</li>
          </ol>
        </section>

        <section className="flex flex-col gap-1.5 border-t border-slate-800 pt-4">
          <span className="text-[12.5px] text-slate-400">Mer i handboken:</span>
          <Link
            to={`${prefix}/intranat/dokument/guide-fakturering-kontor`}
            onClick={onClose}
            className="text-[13px] font-semibold text-emerald-400 hover:underline"
          >
            Fakturera från ärende till betalning
          </Link>
          <span className="text-[12.5px] text-slate-400">Frågor: skriv i Teams-chatten Systemet.</span>
        </section>
      </aside>
    </div>
  )
}
