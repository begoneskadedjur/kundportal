// src/components/shared/avtalsKund/AvtalsKundVal.tsx
// "Befintlig kund" överst i steget Motpart i Skapa avtal eller offert (3.100.0).
// Sök på namn, org.nr eller kundnummer (samma sökning som leadsflödets
// koppling, src/shared/kundSok.ts), förslag när org.nr skrivs in, och för
// organisationer: vilken kundrad avtalet läggs på och vilka enheter det omfattar.
// Guiden äger kopplingen och fyller i fälten; komponenten visar och väljer.

import { useEffect, useState } from 'react'
import { Icon } from '../../icons/Icon'
import { AvtalsKundService, type AvtalsKund } from '../../../services/avtalsKundService'
import {
  avtalspartRad, harEnhetsval, kopplingsText, radNamn, type KundKoppling,
} from '../../../utils/avtalsKundFalt'

const KORT = 'bg-slate-900 border border-slate-700 rounded-2xl shadow-[0_1px_2px_rgba(15,31,46,0.04),0_10px_28px_rgba(15,31,46,0.06)]'
const SOK_RUTA = 'flex items-center gap-2.5 min-h-[48px] px-3.5 rounded-[10px] border border-slate-600 bg-slate-800/60 transition-shadow focus-within:border-[#20c58f] focus-within:ring-4 focus-within:ring-[#20c58f]/15'
const VAL_KNAPP = 'min-h-[44px] px-3.5 rounded-[10px] text-sm font-bold transition-colors'

function radInfo(r: AvtalsKund): string {
  return [
    r.customer_number != null ? `kundnr ${r.customer_number}` : null,
    r.organization_number,
    r.parent_customer_id ? 'enhet' : r.site_type === 'huvudkontor' ? 'huvudkontor' : null,
    r.contact_address,
  ].filter(Boolean).join(' · ')
}

function TraffLista({ rader, onValj, upptagen }: { rader: AvtalsKund[]; onValj: (id: string) => void; upptagen: boolean }) {
  return (
    <ul className="flex flex-col gap-2">
      {rader.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            onClick={() => onValj(r.id)}
            disabled={upptagen}
            className="w-full min-h-[48px] flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800/30 hover:border-[#20c58f]/60 hover:bg-[#20c58f]/5 text-left transition-colors disabled:opacity-50"
          >
            <span className="min-w-0 flex flex-col">
              <span className="text-[15px] font-semibold text-white break-words">{r.company_name || radNamn(r)}</span>
              <span className="text-[13px] text-slate-400 break-words">{radInfo(r)}</span>
            </span>
            <span className="shrink-0 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-400">
              <Icon name="allman.plus" size={16} />
              Koppla
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Raden "Kopplad till X" med status. Används i Motpart, sammanfattningen och granskningen. */
export function KopplingsRad({ koppling, isContract, onKopplaBort, kompakt = false }: {
  koppling: KundKoppling
  isContract: boolean
  onKopplaBort?: () => void
  kompakt?: boolean
}) {
  const rad = avtalspartRad(koppling)
  const antal = koppling.levandeAvtal[rad.id]
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <div className="flex items-start justify-between gap-3">
        <span className={`flex gap-2.5 items-start min-w-0 ${kompakt ? 'text-sm' : 'text-[15px]'}`}>
          <span className="w-2 h-2 rounded-full mt-[7px] shrink-0 bg-[#20c58f]" />
          <span className="text-white break-words">Kopplad till {kopplingsText(koppling, isContract)}</span>
        </span>
        {onKopplaBort && (
          <button
            type="button"
            onClick={onKopplaBort}
            title="Koppla bort kunden"
            aria-label="Koppla bort kunden"
            className="shrink-0 w-11 h-11 -my-2 -mr-2 inline-flex items-center justify-center rounded-[10px] text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Icon name="allman.stang" size={20} />
          </button>
        )}
      </div>
      {antal != null && antal > 0 && (
        <span className={`flex gap-2.5 items-start ${kompakt ? 'text-[13px]' : 'text-sm'}`}>
          <span className="w-2 h-2 rounded-full mt-[6px] shrink-0 bg-amber-500" />
          <span className="text-slate-300">
            Kunden har redan {antal === 1 ? 'ett levande avtal' : `${antal} levande avtal`}.
            {!kompakt && ' Kontrollera att det är rätt kund och att det inte egentligen är ett tillägg eller en förnyelse.'}
          </span>
        </span>
      )}
    </div>
  )
}

interface Props {
  koppling: KundKoppling | null
  isContract: boolean
  /** Guidens partyType: varnar när kunden och mallen inte är samma sorts part (offert) */
  partyType: 'company' | 'individual'
  /** Förslag på org.nr från fältet nedan */
  forslag: AvtalsKund[]
  /** Förklaring när kopplingen släppts automatiskt */
  bortkoppladInfo: string | null
  kopplar: boolean
  onValj: (customerId: string) => void
  onKopplaBort: () => void
  onBytPart: (customerId: string) => void
  onOmfattning: (omfattning: 'alla' | 'valda', valda: string[]) => void
}

export default function AvtalsKundVal({
  koppling, isContract, partyType, forslag, bortkoppladInfo, kopplar,
  onValj, onKopplaBort, onBytPart, onOmfattning,
}: Props) {
  const [q, setQ] = useState('')
  const [sok, setSok] = useState<AvtalsKund[]>([])
  const [sokt, setSokt] = useState(false)

  useEffect(() => {
    const t = q.trim()
    if (t.length < 2) {
      setSok([])
      setSokt(false)
      return
    }
    let avbruten = false
    const timer = window.setTimeout(() => {
      AvtalsKundService.sok(t)
        .then((r) => { if (!avbruten) { setSok(r); setSokt(true) } })
        .catch(() => { if (!avbruten) { setSok([]); setSokt(true) } })
    }, 250)
    return () => { avbruten = true; window.clearTimeout(timer) }
  }, [q])

  const valj = (id: string) => {
    setQ('')
    onValj(id)
  }

  if (!koppling) {
    const visadeForslag = forslag
    const sokRader = sok.filter((s) => !visadeForslag.some((f) => f.id === s.id))
    return (
      <div className={`${KORT} px-6 py-6 sm:px-7 flex flex-col gap-4`}>
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 bg-[#20c58f]/10 text-emerald-300">
            <Icon name="allman.sok" size={20} />
          </span>
          <span className="flex flex-col">
            <span className="text-base font-bold text-white">Befintlig kund</span>
            <span className="text-[13px] text-slate-400">Sök i kundregistret, eller fyll i en ny kund nedan.</span>
          </span>
        </div>

        {bortkoppladInfo && (
          <p className="flex gap-2.5 items-start text-sm text-slate-300">
            <span className="w-2 h-2 rounded-full mt-[6px] shrink-0 bg-amber-500" />
            {bortkoppladInfo}
          </p>
        )}

        {visadeForslag.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-bold text-slate-300">Numret finns i kundregistret</span>
            <TraffLista rader={visadeForslag} onValj={valj} upptagen={kopplar} />
          </div>
        )}

        <label className="flex flex-col gap-[7px] text-[13px] font-bold text-slate-300">
          Sök kund
          <span className={SOK_RUTA}>
            <span className="text-slate-500 shrink-0 flex"><Icon name="allman.sok" size={16} /></span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Namn, org.nr eller kundnummer"
              className="flex-1 min-w-0 min-h-[46px] bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-[15px] font-normal text-white placeholder-slate-500"
            />
            {kopplar && <span className="text-slate-500 shrink-0 flex animate-spin"><Icon name="allman.laddar" size={16} /></span>}
          </span>
        </label>
        {sokRader.length > 0 && <TraffLista rader={sokRader} onValj={valj} upptagen={kopplar} />}
        {sokt && sok.length === 0 && <p className="text-[13px] text-slate-500">Ingen kund hittades. Fyll i en ny kund nedan.</p>}
      </div>
    )
  }

  const { org } = koppling
  const hk = org.huvudkontor
  const part = avtalspartRad(koppling)
  const enhetsval = harEnhetsval(koppling, isContract)
  const partRader: AvtalsKund[] = hk ? [hk, ...org.enheter] : [org.kund]
  const kanByta = partRader.length > 1
  const felPart = koppling.privat !== (partyType === 'individual')

  const kryssa = (id: string) => {
    const har = koppling.valdaEnheter.includes(id)
    const nya = har ? koppling.valdaEnheter.filter((v) => v !== id) : [...koppling.valdaEnheter, id]
    onOmfattning('valda', nya)
  }
  const allaValda = koppling.omfattning === 'alla'
  const bara = koppling.omfattning === 'valda' && hk && koppling.valdaEnheter.length === 1 && koppling.valdaEnheter[0] === hk.id

  return (
    <div className={`${KORT} px-6 py-6 sm:px-7 flex flex-col gap-4`}>
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 bg-[#20c58f]/10 text-emerald-300">
          <Icon name="allman.foretag" size={20} />
        </span>
        <span className="flex flex-col">
          <span className="text-base font-bold text-white">Befintlig kund</span>
          <span className="text-[13px] text-slate-400">Ändringar i fälten nedan gäller bara {isContract ? 'avtalet' : 'offerten'}. Kundkortet ändras inte.</span>
        </span>
      </div>

      <KopplingsRad koppling={koppling} isContract={isContract} onKopplaBort={onKopplaBort} />

      {felPart && (
        <p className="flex gap-2.5 items-start text-sm text-slate-300">
          <span className="w-2 h-2 rounded-full mt-[6px] shrink-0 bg-amber-500" />
          {koppling.privat ? 'Kunden är en privatperson men mallen gäller företag.' : 'Kunden är ett företag men mallen gäller privatpersoner.'}
        </p>
      )}

      {kanByta && (
        <label className="flex flex-col gap-[7px] text-[13px] font-bold text-slate-300">
          {isContract ? 'Avtalet läggs på' : 'Offerten gäller'}
          <select
            value={part.id}
            onChange={(e) => onBytPart(e.target.value)}
            className="w-full min-h-[48px] px-3.5 bg-slate-800/60 border border-slate-600 rounded-[10px] text-[15px] text-white focus:outline-none focus:border-[#20c58f] focus:ring-4 focus:ring-[#20c58f]/15"
          >
            {partRader.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id === hk?.id ? `Huvudkontoret, ${r.company_name ?? ''}` : `Enheten ${radNamn(r)}${r.billing_reference ? ` (${r.billing_reference})` : ''}`}
              </option>
            ))}
          </select>
          <span className="text-xs font-normal text-slate-400">
            {part.id === hk?.id
              ? (isContract ? 'Avtalet läggs på huvudkontoret och omfattar enheterna du väljer nedan.' : 'Offerten ställs till huvudkontoret.')
              : `Bara enheten blir avtalspart. Uppgifter som enheten saknar ärvs från huvudkontoret.`}
          </span>
        </label>
      )}

      {enhetsval && hk && (
        <div className="flex flex-col gap-3">
          <span className="text-[13px] font-bold text-slate-300">Vilka enheter omfattar avtalet?</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={allaValda}
              onClick={() => onOmfattning('alla', [])}
              className={`${VAL_KNAPP} ${allaValda ? 'bg-[#20c58f]/10 border-2 border-[#20c58f] text-emerald-300' : 'border border-slate-600 bg-slate-900 hover:bg-slate-800 text-white'}`}
            >
              Hela verksamheten
            </button>
            <button
              type="button"
              aria-pressed={!!bara}
              onClick={() => onOmfattning('valda', [hk.id])}
              className={`${VAL_KNAPP} ${bara ? 'bg-[#20c58f]/10 border-2 border-[#20c58f] text-emerald-300' : 'border border-slate-600 bg-slate-900 hover:bg-slate-800 text-white'}`}
            >
              Bara huvudkontoret
            </button>
          </div>
          {allaValda && (
            <p className="text-[13px] text-slate-400">Avtalet omfattar alla nuvarande och framtida enheter.</p>
          )}
          <ul className="flex flex-col gap-1.5" aria-label="Enheter">
            {[hk, ...org.enheter].map((r) => {
              const vald = allaValda || koppling.valdaEnheter.includes(r.id)
              const arHk = r.id === hk.id
              return (
                <li key={r.id}>
                  <label className={`flex items-start gap-3 px-3.5 py-2.5 rounded-xl border min-h-[48px] ${vald ? 'border-[#20c58f]/50 bg-[#20c58f]/5' : 'border-slate-700 bg-slate-800/20'} ${allaValda ? 'opacity-70' : 'cursor-pointer'}`}>
                    <input
                      type="checkbox"
                      checked={vald}
                      disabled={allaValda}
                      onChange={() => kryssa(r.id)}
                      className="mt-1 w-4 h-4 shrink-0 accent-[#20c58f]"
                    />
                    <span className="min-w-0 flex flex-col">
                      <span className="text-[15px] text-white break-words">
                        {arHk ? 'Huvudkontoret' : radNamn(r)}
                        {r.billing_reference && <span className="text-slate-400">, enhetskod {r.billing_reference}</span>}
                      </span>
                      <span className="text-[13px] text-slate-400 break-words">{r.contact_address || 'Adress saknas'}</span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
          {koppling.omfattning === null && (
            <p className="flex gap-2.5 items-start text-sm text-slate-300">
              <span className="w-2 h-2 rounded-full mt-[6px] shrink-0 bg-amber-500" />
              Välj hela verksamheten, bara huvudkontoret eller kryssa i enheterna.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
