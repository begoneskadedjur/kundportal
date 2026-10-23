// src/components/technician/ny/dokument/DokumentLista.tsx
// Kön i teknikerns Dokumentsignering: fyra grupper efter vem som gör nästa steg.
// Att göra har underrubriker, Klara är hopfälld. Raden har namn, status som
// punkt och text, en tredje rad med orsaken, och belopp, typ och nummer.

import type { ReactNode } from 'react'
import { Icon, type IconName } from '../../../icons/Icon'
import { HjalpText } from '../hjalp/HjalpText'
import type { FollowUpOffer } from '../../../../services/offerFollowUpService'
import {
  UNDERGRUPPER, kr, radStatus,
  type Bokning, type Grupperat, type SamtalInfo,
} from './dokumentData'
import { Punkt } from './dokumentUi'

interface RadProps {
  offer: FollowUpOffer
  vald: boolean
  onValj: (o: FollowUpOffer) => void
  status: ReturnType<typeof radStatus>
}

function Rad({ offer: o, vald, onValj, status }: RadProps) {
  const namn = o.company_name || o.contact_person || 'Namnlös'
  const belopp = kr(o.total_value)
  const typ = o.type === 'offer' ? 'Offert' : 'Avtal'
  const nummer = o.source_case_number || o.quote_reference_number
  const ikon: IconName = o.type === 'offer' ? 'dok.offert' : 'dok.avtal'
  return (
    <li className="relative">
      {vald && <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#20c58f] z-[1]" />}
      <button
        type="button"
        data-queue-row={o.id}
        aria-current={vald ? 'true' : undefined}
        onClick={() => onValj(o)}
        className={`w-full text-left grid grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[36px_minmax(0,1fr)_auto] gap-3 items-start px-4 py-3 min-h-[76px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f] ${
          vald ? 'bg-slate-800' : 'hover:bg-slate-800/60'
        }`}
      >
        <span aria-hidden="true" className="hidden lg:flex w-9 h-9 rounded-xl bg-slate-800 text-slate-300 items-center justify-center">
          <Icon name={ikon} size={20} />
        </span>
        <span className="flex flex-col gap-0.5 min-w-0">
          <span className="flex items-baseline justify-between gap-3">
            <span className={`text-[15px] truncate ${o.unread_customer_comments > 0 ? 'font-bold text-white' : 'font-semibold text-white'}`}>{namn}</span>
            {belopp && <span className="lg:hidden flex-shrink-0 font-mono text-sm text-white">{belopp}</span>}
          </span>
          <Punkt ton={status.ton}>{status.text}</Punkt>
          <span className="text-sm text-slate-400 truncate">
            <span className="lg:hidden">{typ}{status.detalj ? ', ' : ''}</span>
            {status.detalj}
          </span>
        </span>
        <span className="hidden lg:flex flex-col items-end gap-0.5">
          {belopp && <span className="font-mono text-sm font-medium text-white whitespace-nowrap">{belopp}</span>}
          <span className="text-sm text-slate-400 whitespace-nowrap">
            {typ}{nummer ? <>, <span className="font-mono">{nummer}</span></> : null}
          </span>
        </span>
      </button>
    </li>
  )
}

const LISTRUTA = 'rounded-2xl bg-slate-900 border border-slate-700/60 overflow-hidden divide-y divide-slate-700/60'

interface Props {
  g: Grupperat
  valdId: string | null
  onValj: (o: FollowUpOffer) => void
  samtal: Map<string, SamtalInfo>
  bokningar: Map<string, Bokning>
  minTeknikerId: string | null
  klaraOppen: boolean
  onKlara: () => void
  doldaAntal: number
  visaDolda: boolean
  onVisaDolda: () => void
  soker: boolean
  /** Sökning eller typfilter är aktivt (styr texten när listan är tom) */
  filtrerat: boolean
}

export function DokumentLista({ g, valdId, onValj, samtal, bokningar, minTeknikerId, klaraOppen, onKlara, doldaAntal, visaDolda, onVisaDolda, soker, filtrerat }: Props) {
  const rad = (o: FollowUpOffer) => {
    const p = g.plats.get(o.id) ?? { grupp: 'klara' as const }
    return (
      <Rad
        key={o.id}
        offer={o}
        vald={o.id === valdId}
        onValj={onValj}
        status={radStatus(o, p, samtal.get(o.id), o.booked_case_id ? bokningar.get(o.booked_case_id) : undefined, minTeknikerId)}
      />
    )
  }
  const tomt = g.antal.attgora + g.antal.vantar + g.antal.signerade + g.antal.klara === 0
  const visaKlara = klaraOppen || soker

  return (
    <div className="space-y-6">
      {tomt && (
        <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-12 flex flex-col items-center text-center gap-2">
          <Icon name="falt.signera" size={32} className="text-[#20c58f]" />
          <p className="text-[15px] font-semibold text-white">{filtrerat ? 'Inga träffar' : 'Inga dokument än'}</p>
          <p className="max-w-sm text-sm text-slate-400">
            {filtrerat ? 'Inget dokument matchar sökningen eller filtret.' : 'Offerter och avtal du skickar från Avtal och offerter hamnar här.'}
          </p>
        </div>
      )}

      {g.antal.attgora > 0 && (
        <section data-genomgang="dok-attgora" aria-labelledby="hjalp-dok-attgora-rubrik" className="space-y-2">
          <Sektion id="dok-attgora" ikon="falt.attgora" farg="text-orange-400" rubrik="Att göra" antal={g.antal.attgora}>
            Kunden väntar på dig, eller dokumentet riskerar att tappas.
          </Sektion>
          <ul className={LISTRUTA}>
            {UNDERGRUPPER.map(u => {
              const lista = g.attgora[u.key]
              if (lista.length === 0) return null
              return [
                <li key={`rubrik-${u.key}`} className="px-4 pt-2.5 pb-1.5 bg-slate-800/40 text-sm font-semibold text-slate-300">
                  {u.rubrik}<span className="ml-1.5 font-mono font-medium text-slate-400">{lista.length}</span>
                </li>,
                ...lista.map(rad),
              ]
            })}
          </ul>
        </section>
      )}

      {g.antal.vantar > 0 && (
        <section aria-labelledby="hjalp-dok-vantar-rubrik" className="space-y-2">
          <Sektion id="dok-vantar" ikon="falt.vantar" farg="text-sky-400" rubrik="Väntar på kunden" antal={g.antal.vantar}>
            Skickade och inom fristen. Inget att göra än.
          </Sektion>
          <ul className={LISTRUTA}>{g.vantar.map(rad)}</ul>
        </section>
      )}

      {g.antal.signerade > 0 && (
        <section data-genomgang="dok-signerade" aria-labelledby="hjalp-dok-signerade-rubrik" className="space-y-2">
          <Sektion id="dok-signerade" ikon="falt.signera" farg="text-[#20c58f]" rubrik="Signerade" antal={g.antal.signerade}>
            Kontoret registrerar kunden och bokar in, du behöver inte göra något. Här ser du när det är bokat.
          </Sektion>
          <ul className={LISTRUTA}>{g.signerade.map(rad)}</ul>
        </section>
      )}

      {(g.antal.klara > 0 || doldaAntal > 0) && (
        <section className="space-y-2">
          {g.antal.klara > 0 && (
            <button
              type="button"
              aria-expanded={visaKlara}
              aria-controls="dok-klara-lista"
              onClick={onKlara}
              className="w-full min-h-[56px] flex items-center gap-3 px-4 rounded-2xl bg-slate-900 border border-slate-700/60 text-left hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
            >
              <Icon name="falt.klart" size={20} className="flex-shrink-0 text-slate-400" />
              <span className="text-base font-semibold text-white">Klara<span className="ml-1.5 font-mono font-medium text-slate-400">{g.antal.klara}</span></span>
              <span className="hidden sm:inline text-sm text-slate-400 truncate">Bokade, avböjda och avskrivna</span>
              <Icon name="allman.chevron" size={20} className={`ml-auto flex-shrink-0 text-slate-400 transition-transform ${visaKlara ? 'rotate-90' : ''}`} />
            </button>
          )}
          {visaKlara && g.antal.klara > 0 && <ul id="dok-klara-lista" className={LISTRUTA}>{g.klara.map(rad)}</ul>}
          {doldaAntal > 0 && (
            <button
              type="button"
              onClick={onVisaDolda}
              className="h-11 inline-flex items-center gap-2 px-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
            >
              <Icon name="dok.dolj" size={20} />
              {visaDolda
                ? 'Dölj dokumenten du har dolt igen'
                : `Visa ${doldaAntal} dokument du har dolt`}
            </button>
          )}
        </section>
      )}
    </div>
  )
}

/** Grupprubrik med ikon i gruppens färg, antal och en förklarande rad (följer Visa hjälptexter) */
function Sektion({ id, ikon, farg, rubrik, antal, children }: { id: string; ikon: IconName; farg: string; rubrik: string; antal: number; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Icon name={ikon} size={24} className={`mt-0.5 flex-shrink-0 ${farg}`} />
      <HjalpText
        id={id}
        rubrik={rubrik}
        className="flex-1 min-w-0 [&_h2]:text-[17px]"
        hoger={<span className="font-mono text-sm text-slate-400">{antal}</span>}
      >
        {children}
      </HjalpText>
    </div>
  )
}

export default DokumentLista
