// src/pages/shared/intranet/guider/_dokument.tsx
// Delade delar för kontorets guider om Dokumentsignering (guide-dokumentsignering
// och guide-boka-in). Efterbildning av KontorDokumentsignering, KontorLista och
// KontorDetalj (components/coordinator/dokument): sidhuvudet med räknarna, kön i
// grupperna Att boka in, Väntar på kontoret, Fastnat hos tekniker och Bokade,
// hopfällda Väntar på kunden och Klara, och valt dokument till höger med
// Nästa steg-rutan och fliken Kontaktlogg. Påhittade kunder och kollegor.

import type { ReactNode } from 'react'
import { Dator, DatorSida, Markor } from '../skarmkit'
import { Icon, type IconName } from '../../../../components/icons/Icon'
import type { Mk, Tryck } from './_arenden'

export const MENY_KONTOR = ['Översikt', 'Ärenden', 'Schema & Planering', 'Befintliga kunder', 'Leads (B2B)', 'Leads (Webb)', 'Dokumentsignering']

export type Ton = 'gron' | 'gul' | 'rod' | 'bla' | 'gra'

const PUNKT: Record<Ton, string> = {
  gron: 'bg-[#20c58f]',
  gul: 'bg-amber-400',
  rod: 'bg-red-400',
  bla: 'bg-sky-400',
  gra: 'bg-slate-500',
}

const RUTA: Record<Ton, string> = {
  gron: 'border-[#20c58f]/40 bg-[#20c58f]/10',
  gul: 'border-amber-500/40 bg-amber-500/10',
  rod: 'border-red-500/40 bg-red-500/10',
  bla: 'border-sky-500/40 bg-sky-500/10',
  gra: 'border-slate-700 bg-slate-800/40',
}

/** Status som punkt och text, aldrig piller */
export function Punkt({ ton, children }: { ton: Ton; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-200">
      <span className={`h-2 w-2 flex-none rounded-full ${PUNKT[ton]}`} aria-hidden />
      {children}
    </span>
  )
}

export interface KoRadData {
  id: string
  namn: string
  ton: Ton
  status: string
  detalj?: string
  belopp: string
  typ: string
}

export function KoRad({ r, vald, mk, tryck }: { r: KoRadData; vald?: boolean; mk: Mk; tryck: Tryck }) {
  return (
    <Markor markor={mk(r.id)} block>
      <button type="button" onClick={() => tryck(r.id)}
        className={`grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 border-l-2 px-2.5 py-1.5 text-left ${vald ? 'border-[#20c58f] bg-slate-800' : 'border-transparent hover:bg-slate-800/50'}`}>
        <span className="grid min-w-0 gap-0.5">
          <span className="truncate text-[12px] font-semibold text-white">{r.namn}</span>
          <Punkt ton={r.ton}>{r.status}</Punkt>
          {r.detalj && <span className="truncate text-[10.5px] text-slate-400">{r.detalj}</span>}
        </span>
        <span className="grid content-start justify-items-end gap-0.5">
          <span className="whitespace-nowrap font-mono text-[11px] text-white">{r.belopp}</span>
          <span className="whitespace-nowrap text-[10.5px] text-slate-400">{r.typ}</span>
        </span>
      </button>
    </Markor>
  )
}

/** Gruppens rubrik med ikon, antal och förklaring */
export function Grupp({ ikon, farg, rubrik, antal, text, children }: { ikon: IconName; farg: string; rubrik: string; antal: number; text?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <div className="flex items-start gap-1.5">
        <Icon name={ikon} size={16} className={`mt-0.5 flex-none ${farg}`} />
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-white">{rubrik} <span className="font-mono font-medium text-slate-400">{antal}</span></p>
          {text && <p className="text-[10px] leading-snug text-slate-500">{text}</p>}
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-700/60 bg-slate-900 divide-y divide-slate-700/60">{children}</div>
    </div>
  )
}

/** Underrubrik inne i en grupp, till exempel Kunden har skrivit eller teknikerns namn */
export function UnderRubrik({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-2 bg-slate-800/40 px-2.5 py-1 text-[10.5px] font-semibold text-slate-300">{children}</div>
}

/** Hopfälld grupp: Väntar på kunden och Klara */
export function Hopfalld({ ikon, rubrik, antal, onClick }: { ikon: IconName; rubrik: string; antal: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-900 px-2.5 py-1.5 text-left">
      <Icon name={ikon} size={16} className="text-slate-400" />
      <span className="text-[11.5px] font-semibold text-white">{rubrik} <span className="font-mono font-medium text-slate-400">{antal}</span></span>
      <Icon name="allman.chevron" size={16} className="ml-auto text-slate-400" />
    </button>
  )
}

/** Nästa steg-rutan i valt dokument */
export function NastaRuta({ ton, status, text, children, fot }: { ton: Ton; status: string; text: string; children?: ReactNode; fot?: string }) {
  return (
    <div className={`mx-2.5 grid gap-2 rounded-xl border p-2.5 ${RUTA[ton]}`}>
      <div className="grid gap-0.5">
        <Punkt ton={ton}><span className="text-[12px] font-semibold text-white">{status}</span></Punkt>
        <p className="text-[11.5px] leading-snug text-white"><strong className="font-semibold">Nästa steg:</strong> {text}</p>
      </div>
      {children}
      {fot && <p className="text-[10px] text-slate-400">{fot}</p>}
    </div>
  )
}

/** Valt dokument: huvudet med namn, typ, belopp och kontakt */
export function DetaljHuvud({ namn, rad1, rad2, kontakt, tryck }: { namn: string; rad1: string; rad2: string; kontakt: string; tryck: Tryck }) {
  return (
    <div className="grid gap-1 px-2.5 pb-2 pt-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[14px] font-bold leading-tight text-white">{namn}</p>
        <button type="button" onClick={() => tryck('oneflow')} className="flex flex-none items-center gap-1 rounded-lg border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300">
          <Icon name="rapport.oppna" size={16} className="h-3 w-3" />Öppna i Oneflow
        </button>
      </div>
      <p className="text-[10.5px] text-slate-300">{rad1}</p>
      <p className="text-[10.5px] text-slate-400">{rad2}</p>
      <p className="flex items-center gap-1 text-[10.5px] text-white"><Icon name="rapport.person" size={16} className="h-3 w-3 text-slate-400" />{kontakt}</p>
    </div>
  )
}

export interface LoggPost { ikon: IconName; vem: string; etikett: string; nar: string; text?: string }

/** Flikarna Kontaktlogg och Innehåll med loggens poster, äldst först */
export function KontaktloggFlik({ poster, tryck }: { poster: LoggPost[]; tryck: Tryck }) {
  return (
    <div className="mt-2">
      <div className="flex gap-1 border-b border-slate-700/60 px-2.5 text-[11px]">
        <span className="flex items-center gap-1 border-b-2 border-[#20c58f] px-1.5 pb-1 font-semibold text-white">
          <Icon name="allman.historik" size={16} className="h-3.5 w-3.5 text-[#20c58f]" />Kontaktlogg <span className="font-mono font-medium text-slate-400">{poster.length}</span>
        </span>
        <button type="button" onClick={() => tryck('innehall')} className="flex items-center gap-1 border-b-2 border-transparent px-1.5 pb-1 text-slate-400">
          <Icon name="falt.pris" size={16} className="h-3.5 w-3.5" />Innehåll
        </button>
      </div>
      <ol className="grid gap-1.5 px-2.5 py-2">
        {poster.map((p, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300"><Icon name={p.ikon} size={16} className="h-3.5 w-3.5" /></span>
            <span className="min-w-0">
              <span className="block text-[10.5px] text-slate-400"><span className="font-semibold text-white">{p.vem}</span> {p.etikett} <span className="font-mono">{p.nar}</span></span>
              {p.text && <span className="block text-[11px] text-white">{p.text}</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Hela sidan: sidhuvud med räknarna, kön till vänster och valt dokument till höger */
export function KontorSida({ raknare, lista, detalj, notis }: {
  raknare: string
  lista: ReactNode
  detalj: ReactNode
  notis?: ReactNode
}) {
  return (
    <Dator adress="koordinator › dokumentsignering">
      <DatorSida meny={MENY_KONTOR} aktiv="Dokumentsignering" titel="Dokumentsignering">
        <p className="-mt-1.5 mb-2 text-[11px] text-slate-300">{raknare}</p>
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[10.5px]">
          <span className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-white"><Icon name="rapport.person" size={16} className="h-3 w-3 text-slate-400" />Alla tekniker</span>
          <span className="flex min-w-0 flex-1 items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-slate-500"><Icon name="allman.sok" size={16} className="h-3 w-3" /><span className="truncate">Sök kund, kontaktperson, ärendenummer eller tekniker</span></span>
          <span className="flex rounded-lg bg-slate-800 p-0.5">
            <span className="rounded-md border border-slate-600 bg-slate-900 px-1.5 font-semibold text-white">Alla</span>
            <span className="px-1.5 text-slate-300">Offerter</span>
            <span className="px-1.5 text-slate-300">Avtal</span>
          </span>
        </div>
        <div className="relative grid gap-2.5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="grid content-start gap-2.5">{lista}</div>
          <div className="min-w-0 self-start overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900 pb-1">{detalj}</div>
        </div>
      </DatorSida>
      {notis}
    </Dator>
  )
}
