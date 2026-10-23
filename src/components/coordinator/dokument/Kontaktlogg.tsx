// src/components/coordinator/dokument/Kontaktlogg.tsx
// Kontaktloggen i kontorets dokumentdetalj: allt som har med kunden att göra i
// tidsordning, äldst först (skrivrutan ligger under, i Konversation). Samtal, mejl
// och sms, Oneflow-chatten åt båda håll, interna anteckningar, förlängningar,
// påminnelser, signeringshändelser, Boka in och Skriv av. Varje post har ikon,
// vem, när och en kort text. Kontorets egna poster står som Du.

import { Icon } from '../../icons/Icon'
import { svDatum, svTid } from '../../technician/ny/dokument/dokumentData'
import { KONTAKT_IKON, type KontaktPost, type KontaktTyp } from './kontorData'

const FARG: Partial<Record<KontaktTyp, string>> = {
  'oneflow-in': 'text-sky-400',
  'oneflow-ut': 'text-[#20c58f]',
  signerad: 'text-[#20c58f]',
  bokad: 'text-[#20c58f]',
  forfallen: 'text-amber-500',
  avbojd: 'text-slate-400',
  'paminnelse-tekniker': 'text-violet-400',
  'paminnelse-kund': 'text-violet-400',
  forlangning: 'text-violet-400',
}

const RUBRIK: Partial<Record<KontaktTyp, string>> = {
  skickad: 'Oneflow',
  signerad: 'Oneflow',
  avbojd: 'Oneflow',
  forfallen: 'Oneflow',
  raderad: 'Oneflow',
  forlangning: 'Kontoret',
  'paminnelse-kund': 'Kontoret',
  'paminnelse-tekniker': 'Kontoret',
  bokad: 'Kontoret',
  avskriven: 'Kontoret',
}

interface Props {
  poster: KontaktPost[]
  laddar: boolean
  /** Den inloggades namn: egna poster står som Du */
  minNamn: string | null
}

export function Kontaktlogg({ poster, laddar, minNamn }: Props) {
  if (laddar && poster.length === 0) return <p className="py-6 text-center text-sm text-slate-400">Hämtar kontaktloggen</p>
  if (poster.length === 0) return <p className="py-6 text-center text-sm text-slate-400">Ingen kontakt loggad än.</p>
  return (
    <div className="flex flex-col gap-3">
      <ol aria-label="Kontaktlogg" className="flex flex-col">
        {poster.map((p, i) => {
          const vem = p.vem && minNamn && p.vem === minNamn ? 'Du' : p.vem || RUBRIK[p.typ] || 'Systemet'
          return (
            <li key={p.key} className="relative flex items-start gap-3 pb-4">
              {i < poster.length - 1 && <span aria-hidden="true" className="absolute left-[17px] top-9 bottom-0 w-px bg-slate-700" />}
              <span aria-hidden="true" className={`relative w-9 h-9 flex-shrink-0 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center ${FARG[p.typ] ?? 'text-slate-300'}`}>
                <Icon name={KONTAKT_IKON[p.typ]} size={20} />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm text-slate-400">
                  <span className="font-semibold text-white">{vem}</span>
                  <span>{p.etikett}</span>
                  <span className="font-mono">{svDatum(p.at)} {svTid(p.at)}</span>
                </p>
                {p.text && <p className="mt-0.5 text-[15px] leading-relaxed text-white whitespace-pre-wrap break-words">{p.text}</p>}
              </div>
            </li>
          )
        })}
      </ol>
      <p className="text-sm text-slate-400">Äldst först. Samtal, mejl, Oneflow-chatt åt båda håll, förlängningar, påminnelser, signeringshändelser och Boka in i samma lista.</p>
    </div>
  )
}

export default Kontaktlogg
