// src/components/shared/specialReports/BedomningOchAtgarder.tsx
// Vyn "Bedömning och åtgärder" i redigeraren (3.54.1), i samma stil som Om
// rapporten: en mörkgrön banderoll med rapportens siffror, sedan kort för
// bedömningen, avvikelserna (bara när det finns några) och de rekommenderade
// åtgärderna. Banderollen har fasta färger, korten följer temat via
// slate-klasserna (KORT ger vit yta i ljust läge och slate-900 i mörkt).

import { Icon } from '../../icons/Icon'
import { atgardsRader, avvikelserIRapporten, type SpecialReportFull } from '../../../types/specialReport'
import AtgardsLista from './AtgardsLista'
import { KORT, SNYGGA_KNAPP, TEXTFALT, fargForDel } from './specialReportUtils'

/** Kort med grön accent: samma yta och skugga som KORT men grön kant */
const KORT_GRON =
  'bg-slate-900 ring-[1.5px] ring-emerald-500/40 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_6px_20px_rgba(15,23,42,0.05)]'
/** Kort med röd accent för avvikelserna */
const KORT_ROD =
  'bg-slate-900 ring-[1.5px] ring-red-500/30 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_6px_20px_rgba(15,23,42,0.05)]'

interface BedomningOchAtgarderProps {
  report: SpecialReportFull
  onAssessment: (text: string | null) => void
  onRecommendations: (text: string | null) => void
  onPolish: () => void
  /** Öppnar delen och lägger fokus på dess händelser */
  onGaTillDel: (sectionId: string) => void
}

export default function BedomningOchAtgarder({ report, onAssessment, onRecommendations, onPolish, onGaTillDel }: BedomningOchAtgarderProps) {
  const avvikelser = avvikelserIRapporten(report.sections)
  const antalHandelser = report.sections.reduce((n, s) => n + s.events.length, 0)
  const antalAtgarder = atgardsRader(report.recommendations).length

  const siffror: { n: number; etikett: string; rod?: boolean }[] = [
    { n: avvikelser.length, etikett: avvikelser.length === 1 ? 'avvikelse' : 'avvikelser', rod: avvikelser.length > 0 },
    { n: antalHandelser, etikett: antalHandelser === 1 ? 'händelse' : 'händelser' },
    { n: antalAtgarder, etikett: antalAtgarder === 1 ? 'rekommenderad åtgärd' : 'rekommenderade åtgärder' },
  ]

  return (
    <div className="@container space-y-4">
      {/* ── Banderoll: fasta färger som framsidan ── */}
      <section
        aria-label="Din slutsats till kunden"
        className="relative flex flex-col gap-3 overflow-hidden rounded-[22px] bg-[#0f2a22] p-5 text-[#fff] @2xl:px-[30px] @2xl:py-[24px]"
      >
        <span className="pointer-events-none absolute -right-12 -top-20 h-[300px] w-[300px] rounded-full bg-[#20c58f]/[0.12]" aria-hidden="true" />
        <div className="relative flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#6ee7b7]">Din slutsats till kunden</span>
          <h2 className="text-2xl font-extrabold text-[#fff] @2xl:text-[28px]">Bedömning och åtgärder</h2>
          <p className="max-w-[560px] text-[13px] leading-relaxed text-[#a7f3d0]">
            Det här är vad kunden tar med sig: hur läget ser ut nu och vad kunden behöver göra.
          </p>
        </div>
        <div className="relative mt-1 grid grid-cols-3 gap-x-[22px] gap-y-3 border-t border-[#ffffff22] pt-3.5 @md:flex">
          {siffror.map(s => (
            <span key={s.etikett} className="flex flex-col">
              <span className={`text-[26px] font-extrabold leading-tight ${s.rod ? 'text-[#fca5a5]' : ''}`}>{s.n}</span>
              <span className={`text-xs ${s.rod ? 'text-[#fecaca]' : 'text-[#a7f3d0]'}`}>{s.etikett}</span>
            </span>
          ))}
        </div>
      </section>

      {/* ── Bedömning ── */}
      <section aria-label="Bedömning" className={`flex flex-col gap-3 rounded-[18px] p-4 @2xl:px-5 @2xl:py-[18px] ${KORT}`}>
        <div className="flex items-start gap-3">
          <span className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[11px] bg-indigo-500/10 text-indigo-400">
            <Icon name="rapport.bedomning" size={20} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-base font-bold text-white">Bedömning</span>
            <span className="text-xs text-slate-400">Hur ser läget ut nu? Två eller tre meningar.</span>
          </span>
          <button
            type="button"
            aria-label="Snygga till bedömning och rekommenderade åtgärder"
            title="Snygga till bedömning och rekommenderade åtgärder"
            onClick={onPolish}
            className={SNYGGA_KNAPP}
          >
            <Icon name="rapport.snygga" size={16} />
            <span className="hidden sm:inline">Snygga till</span>
          </button>
        </div>
        <div data-falt="rapport:assessment">
          <textarea
            aria-label="Bedömning"
            value={report.assessment ?? ''}
            onChange={e => onAssessment(e.target.value || null)}
            rows={4}
            placeholder="Till exempel: Aktiviteten har minskat tydligt sedan första besöket. Vi ser inga nya spår i byggnad A, men fortsätter att följa upp byggnad B."
            className={`${TEXTFALT} rounded-[14px] px-4 py-3 text-[15px]`}
          />
        </div>
      </section>

      {/* ── Avvikelser att åtgärda: bara när det finns några ── */}
      {avvikelser.length > 0 && (
        <section aria-label="Avvikelser att åtgärda" className={`flex flex-col gap-3 rounded-[18px] p-4 @2xl:px-5 @2xl:py-[18px] ${KORT_ROD}`}>
          <div className="flex items-start gap-3">
            <span className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[11px] bg-red-500/10 text-red-400">
              <Icon name="rapport.avvikelse" size={20} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-base font-bold text-white">Avvikelser att åtgärda ({avvikelser.length})</span>
              <span className="text-xs text-slate-400">Det här hittade vi i rapportens delar. Tänk på dem när du skriver bedömningen och åtgärderna.</span>
            </span>
          </div>
          <ul className="flex flex-col gap-1.5">
            {avvikelser.map(a => {
              const sektion = report.sections[a.del - 1]
              if (!sektion) return null
              const farg = fargForDel(sektion.color, a.del - 1)
              const rubrik = a.event.title.trim() || 'Avvikelse'
              return (
                <li key={a.event.id}>
                  <button
                    type="button"
                    onClick={() => onGaTillDel(sektion.id)}
                    aria-label={`${rubrik}, ${a.event.event_date}, del ${a.del} ${a.delTitel}. Öppna delen.`}
                    className="flex min-h-[52px] w-full items-center gap-3 rounded-xl bg-slate-800/60 px-3 py-2 text-left transition-colors hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]/60"
                  >
                    <span
                      className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-lg text-xs font-extrabold text-[#fff]"
                      style={{ background: farg }}
                      aria-hidden="true"
                    >
                      {a.del}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-semibold text-white">{rubrik}</span>
                      <span className="truncate text-xs text-slate-400">{a.delTitel}</span>
                    </span>
                    <span className="flex-shrink-0 text-xs tabular-nums text-slate-400">{a.event.event_date}</span>
                    <Icon name="allman.chevron" size={16} className="flex-shrink-0 text-slate-500" />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* ── Rekommenderade åtgärder: vitt kort med grön accent ── */}
      <section
        aria-label="Rekommenderade åtgärder"
        data-falt="rapport:recommendations"
        className={`flex flex-col gap-3 rounded-[18px] p-4 @2xl:px-5 @2xl:py-[18px] ${KORT_GRON}`}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[11px] bg-emerald-500/10 text-emerald-400">
            <Icon name="rapport.atgarder" size={20} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-base font-bold text-white">Rekommenderade åtgärder</span>
            <span className="text-xs text-slate-400">Det här ska kunden göra. En åtgärd per rad.</span>
          </span>
        </div>
        <AtgardsLista text={report.recommendations} onChange={onRecommendations} />
      </section>
    </div>
  )
}
