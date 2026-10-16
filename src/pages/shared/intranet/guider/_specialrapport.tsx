// src/pages/shared/intranet/guider/_specialrapport.tsx
// Delade hjälpdelar för specialrapportguiderna (tekniker och kontor).
// Samma ord som SpecialReportEditorPage: Klar att skicka, Rapportens delar,
// Om rapporten (Kund, adress och inledning), Översiktskarta, Lägg till del,
// Bedömning och åtgärder (Din slutsats till kunden). Raderna i Klar att skicka
// kommer från klarAttSkicka i specialReportUtils.ts.

import { Icon, type IconName } from '../../../../components/icons/Icon'
import { Markor, type MarkorProps } from '../skarmkit'

export const KLAR_RADER = [
  { key: 'intro', text: 'Inledning skriven' },
  { key: 'delar', text: 'Minst ett område eller besök' },
  { key: 'handelser', text: 'Händelser registrerade' },
  { key: 'bedomning', text: 'Bedömning skriven' },
  { key: 'rekommendationer', text: 'Rekommenderade åtgärder skrivna' },
] as const
export type KlarNyckel = (typeof KLAR_RADER)[number]['key']

export interface Del {
  nr: number
  titel: string
  /** Område, Besök, Underleverantör eller Fritt */
  typ: string
  handelser: number
  farg: string
}

/** Rutan Klar att skicka. tryck(key) när en rad trycks. */
export function KlarAttSkicka({ klara, tryck, markor, kompakt }: {
  klara: KlarNyckel[]
  tryck?: (key: KlarNyckel) => void
  markor?: { key: KlarNyckel } & MarkorProps
  kompakt?: boolean
}) {
  return (
    <div className="grid gap-1 rounded-xl border border-[#20c58f]/30 bg-[#20c58f]/5 p-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-bold text-white">Klar att skicka</span>
        <span className="text-[11px] text-[#20c58f]">{klara.length} av {KLAR_RADER.length}</span>
      </div>
      <div className="h-1 rounded-full bg-[#20c58f]/20">
        <div className="h-1 rounded-full bg-[#20c58f]" style={{ width: `${(klara.length / KLAR_RADER.length) * 100}%` }} />
      </div>
      {!kompakt && KLAR_RADER.map(r => {
        const klar = klara.includes(r.key as KlarNyckel)
        const knapp = (
          <button key={r.key} type="button" onClick={() => tryck?.(r.key)}
            className={`flex w-full items-center gap-1.5 rounded px-0.5 text-left text-[11px] hover:bg-slate-800/60 ${klar ? 'text-slate-300' : 'text-slate-400'}`}>
            <span className={`h-1.5 w-1.5 flex-none rounded-full ${klar ? 'bg-[#20c58f]' : 'bg-slate-600'}`} aria-hidden />
            {r.text}
          </button>
        )
        return markor && markor.key === r.key ? <Markor key={r.key} markor={markor} block>{knapp}</Markor> : knapp
      })}
    </div>
  )
}

function ListRad({ ikon, titel, text, onClick }: { ikon: IconName; titel: string; text: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-900/60 px-2 py-1 text-left">
      <Icon name={ikon} size={16} className="flex-none text-slate-400" />
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-white">{titel}</span>
        <span className="block truncate text-[10.5px] text-slate-400">{text}</span>
      </span>
    </button>
  )
}

/** Listan Rapportens delar med Lägg till del */
export function RapportensDelar({ delar, omraden, kartanMed, tryck, markera, nr }: {
  delar: Del[]
  omraden: number
  /** Bocken Med i rapporten på översiktskartan */
  kartanMed?: boolean
  tryck: (id: string) => void
  markera?: string
  nr: number
}) {
  return (
    <div className="grid gap-1">
      <span className="text-[10.5px] uppercase tracking-wider text-slate-500">Rapportens delar</span>
      <ListRad ikon="rapport.rapport" titel="Om rapporten" text="Kund, adress och inledning" onClick={() => tryck('om')} />
      <ListRad ikon="rapport.karta" titel="Översiktskarta" text={`${omraden} ${omraden === 1 ? 'område' : 'områden'}${kartanMed ? '' : ' · inte med i rapporten'}`} onClick={() => tryck('oversikt')} />
      {delar.map(d => (
        <button key={d.nr} type="button" onClick={() => tryck(`del-${d.nr}`)}
          className="flex w-full items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-900/60 px-1.5 py-1 text-left">
          <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md text-xs font-extrabold text-[#fff]" style={{ background: d.farg }}>{d.nr}</span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold text-white">{d.titel}</span>
            <span className="block truncate text-[10.5px] text-slate-400">{d.typ} · {d.handelser} {d.handelser === 1 ? 'händelse' : 'händelser'}</span>
          </span>
        </button>
      ))}
      <Markor markor={markera === 'lagg-till-del' ? { pa: true, nr } : undefined} block>
        <button type="button" onClick={() => tryck('lagg-till-del')}
          className="flex w-full items-center gap-2 rounded-lg border-[1.5px] border-dashed border-slate-600 px-2 py-1 text-xs text-slate-300">
          <Icon name="allman.plus" size={16} /> Lägg till del
        </button>
      </Markor>
      <ListRad ikon="allman.bock" titel="Bedömning och åtgärder" text="Din slutsats till kunden" onClick={() => tryck('samm')} />
    </div>
  )
}
