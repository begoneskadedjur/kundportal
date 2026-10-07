// src/components/admin/webLeads/WebLeadsTabell.tsx
// Listan i Leads (Webb): tabell med fast rubrikrad från md och kortlista på mobil. Hela raden öppnar
// förfrågan; kryssrutan markerar för massåtgärder och radmenyn har Öppna, Ta och Arkivera/Återställ.
// Tangentbord på raderna: pil upp/ned flyttar, Enter öppnar, X eller mellanslag markerar.
// Status visas som platt text med statuspunkt (inga piller), datum som ÅÅÅÅ-MM-DD.

import { useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { ExternalLink, Inbox, UserPlus } from 'lucide-react'
import { KUNDGRUPP_LABEL, STATUS_CONFIG, kallaLabel, tjanstLabel, type StaffProfile, type WebInquiry } from '../../../types/webInquiry'
import { adressDelar, formatPostnummer } from '../../../shared/webLeadUppgifter'
import { formatSvTid } from './format'
import { KANAL_FARG, KANAL_LABEL, kanalFor, tjanstNyckel } from './leadKlassning'
import { KallaIcon, LeadIcon, TjanstIcon } from './WebLeadIcons'
import WebLeadRadMeny, { type RadMenyVal } from './WebLeadRadMeny'

interface Props {
  rader: WebInquiry[]
  laddar: boolean
  staff: StaffProfile[]
  minProfilId: string | null
  valda: Set<string>
  onVal: (id: string) => void
  onValAlla: (markera: boolean) => void
  onOppna: (id: string) => void
  onArkivera: (ids: string[], arkivera: boolean) => void
  onTa: (id: string) => void
  tomText: string
  harFilter: boolean
  onRensaFilter: () => void
}

const KRYSS = 'w-4 h-4 rounded border-slate-600 bg-slate-800 text-[#20c58f] focus:ring-[#20c58f] focus:ring-offset-0 cursor-pointer'

function ort(i: WebInquiry): string {
  return adressDelar(i).ort || i.city || formatPostnummer(i.postal_code)
}

function datumTid(iso: string): { datum: string; tid: string } {
  const [datum = '', tid = ''] = formatSvTid(iso).split(' ')
  return { datum, tid }
}

function Status({ i }: { i: WebInquiry }) {
  const s = STATUS_CONFIG[i.status]
  return (
    <div className="space-y-0.5">
      <span className={`flex items-center gap-1.5 ${s.text}`}>
        <span className={`w-2 h-2 rounded-full flex-none ${s.dot}`} />
        {s.label}
      </span>
      {i.akut && (
        <span className="flex items-center gap-1.5 text-red-400 text-xs">
          <span className="w-2 h-2 rounded-full bg-red-500 flex-none" />
          Akut
        </span>
      )}
      {i.archived_at && (
        <span className="flex items-center gap-1 text-slate-500 text-xs">
          <LeadIcon name="arkiv" className="w-3.5 h-3.5" />
          Arkiverad
        </span>
      )}
    </div>
  )
}

function Tjanst({ i }: { i: WebInquiry }) {
  const nyckel = tjanstNyckel(i.pest_type)
  const harBild = i.bilder.some((b) => b.uppladdad)
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <span className="w-8 h-8 rounded-lg grid place-items-center flex-none bg-slate-700/40 text-slate-200">
        <TjanstIcon name={nyckel} className="w-5 h-5" />
      </span>
      <div className="min-w-0">
        <span className="block text-slate-200 truncate">{tjanstLabel(i.pest_type)}</span>
        {(i.bokad_tjanst && i.bokad_tjanst !== tjanstLabel(i.pest_type)) || harBild ? (
          <span className="block text-xs text-slate-400 truncate">
            {i.bokad_tjanst && i.bokad_tjanst !== tjanstLabel(i.pest_type) ? `Bokad: ${i.bokad_tjanst}` : ''}
            {i.bokad_tjanst && i.bokad_tjanst !== tjanstLabel(i.pest_type) && harBild ? ' · ' : ''}
            {harBild ? 'Med bild' : ''}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function Kalla({ i }: { i: WebInquiry }) {
  const { kanal, detalj } = kanalFor(i)
  const ingang = kallaLabel(i)
  return (
    <div className="min-w-0" title={detalj ? `${KANAL_LABEL[kanal]}: ${detalj}` : KANAL_LABEL[kanal]}>
      <span className="flex items-center gap-1.5 text-slate-200">
        <KallaIcon name={kanal} className={`w-4 h-4 flex-none ${KANAL_FARG[kanal]}`} />
        <span className="truncate">{KANAL_LABEL[kanal]}</span>
      </span>
      <span className="flex items-center gap-1 text-xs text-slate-400 truncate">
        {i.kalla === 'artanalys' && <KallaIcon name="artanalys" className="w-3.5 h-3.5 flex-none" />}
        <span className="truncate">{ingang}</span>
      </span>
    </div>
  )
}

export default function WebLeadsTabell(p: Props) {
  const tbody = useRef<HTMLTableSectionElement>(null)
  const kort = useRef<HTMLUListElement>(null)

  const namnFor = (id: string | null) => {
    if (!id) return ''
    if (id === p.minProfilId) return 'Jag'
    const s = p.staff.find((x) => x.id === id)
    return s ? s.display_name || s.email : ''
  }

  const menyVal = (i: WebInquiry): RadMenyVal[] => [
    { label: 'Öppna', ikon: <ExternalLink className="w-4 h-4" />, onClick: () => p.onOppna(i.id) },
    ...(p.minProfilId && i.tilldelad_till !== p.minProfilId
      ? [{ label: 'Ta förfrågan', ikon: <UserPlus className="w-4 h-4" />, onClick: () => p.onTa(i.id) }]
      : []),
    i.archived_at
      ? { label: 'Återställ från arkivet', ikon: <LeadIcon name="aterstall" />, onClick: () => p.onArkivera([i.id], false) }
      : { label: 'Arkivera', ikon: <LeadIcon name="arkiv" />, onClick: () => p.onArkivera([i.id], true) },
  ]

  const tangent = (e: ReactKeyboardEvent<HTMLElement>, id: string, behallare: HTMLElement | null) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter') {
      e.preventDefault()
      p.onOppna(id)
    } else if (e.key === ' ' || e.key === 'x' || e.key === 'X') {
      e.preventDefault()
      p.onVal(id)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const rader = [...(behallare?.querySelectorAll<HTMLElement>('[data-rad]') ?? [])]
      const idx = rader.indexOf(e.currentTarget)
      rader[e.key === 'ArrowDown' ? Math.min(rader.length - 1, idx + 1) : Math.max(0, idx - 1)]?.focus()
    }
  }

  if (p.laddar && p.rader.length === 0) {
    return (
      <div className="bg-slate-800/30 border border-slate-700 rounded-xl divide-y divide-slate-700/50" aria-busy="true" aria-label="Hämtar förfrågningar">
        {Array.from({ length: 6 }).map((_, n) => (
          <div key={n} className="flex items-center gap-4 px-4 py-3.5 animate-pulse">
            <div className="w-4 h-4 rounded bg-slate-700/60" />
            <div className="w-20 h-3 rounded bg-slate-700/60" />
            <div className="w-8 h-8 rounded-lg bg-slate-700/40" />
            <div className="flex-1 space-y-2">
              <div className="w-1/3 h-3 rounded bg-slate-700/60" />
              <div className="w-1/5 h-2.5 rounded bg-slate-700/40" />
            </div>
            <div className="hidden md:block w-24 h-3 rounded bg-slate-700/50" />
            <div className="hidden md:block w-16 h-3 rounded bg-slate-700/50" />
          </div>
        ))}
      </div>
    )
  }

  if (p.rader.length === 0) {
    return (
      <div className="bg-slate-800/30 border border-slate-700 rounded-xl py-12 text-center">
        <Inbox className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <p className="text-sm text-slate-300">{p.tomText}</p>
        {p.harFilter && (
          <button
            type="button"
            onClick={p.onRensaFilter}
            className="mt-2 text-sm text-[#20c58f] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] rounded"
          >
            Rensa filter
          </button>
        )}
      </div>
    )
  }

  const allaValda = p.rader.every((i) => p.valda.has(i.id))
  const nagraValda = !allaValda && p.rader.some((i) => p.valda.has(i.id))

  return (
    <>
      {/* Tabell från md */}
      <div className="hidden md:block bg-slate-800/30 border border-slate-700 rounded-xl overflow-auto max-h-[calc(100dvh-260px)] min-h-[320px]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-900">
            <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
              <th className="pl-4 pr-2 py-2.5 w-8">
                <input
                  type="checkbox"
                  className={KRYSS}
                  checked={allaValda}
                  ref={(el) => {
                    if (el) el.indeterminate = nagraValda
                  }}
                  onChange={() => p.onValAlla(!allaValda)}
                  aria-label={allaValda ? 'Avmarkera alla' : 'Markera alla som visas'}
                />
              </th>
              <th className="px-3 py-2.5 font-medium whitespace-nowrap">Inkom</th>
              <th className="px-3 py-2.5 font-medium">Nummer</th>
              <th className="px-3 py-2.5 font-medium">Namn eller kund</th>
              <th className="px-3 py-2.5 font-medium">Tjänst</th>
              <th className="px-3 py-2.5 font-medium">Ort</th>
              <th className="px-3 py-2.5 font-medium">Kundgrupp</th>
              <th className="px-3 py-2.5 font-medium">Källa</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Ärende</th>
              <th className="px-3 py-2.5 font-medium">Tilldelad</th>
              <th className="pr-3 py-2.5 w-10"><span className="sr-only">Åtgärder</span></th>
            </tr>
          </thead>
          <tbody ref={tbody}>
            {p.rader.map((i) => {
              const vald = p.valda.has(i.id)
              const { datum, tid } = datumTid(i.created_at)
              return (
                <tr
                  key={i.id}
                  data-rad
                  tabIndex={0}
                  aria-selected={vald}
                  onClick={() => p.onOppna(i.id)}
                  onKeyDown={(e) => tangent(e, i.id, tbody.current)}
                  className={`border-b border-slate-700/50 last:border-0 cursor-pointer transition-colors focus:outline-none focus-visible:bg-slate-700/40 focus-visible:shadow-[inset_3px_0_0_#20c58f] ${
                    vald ? 'bg-[#20c58f]/10 hover:bg-[#20c58f]/15' : 'hover:bg-slate-700/30'
                  } ${i.archived_at ? 'opacity-55' : ''}`}
                >
                  <td className="pl-4 pr-2 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className={KRYSS}
                      checked={vald}
                      onChange={() => p.onVal(i.id)}
                      aria-label={`Markera ${i.referens}`}
                      tabIndex={-1}
                    />
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className="block font-mono text-xs text-slate-200">{datum}</span>
                    <span className="block font-mono text-xs text-slate-500">{tid}</span>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-400 whitespace-nowrap">{i.referens}</td>
                  <td className="px-3 py-3 max-w-[220px]">
                    <span className="block text-white font-medium truncate">{i.company_name || i.name}</span>
                    {i.company_name && <span className="block text-xs text-slate-400 truncate">{i.name}</span>}
                  </td>
                  <td className="px-3 py-3 max-w-[200px]"><Tjanst i={i} /></td>
                  <td className="px-3 py-3 text-slate-300 whitespace-nowrap">{ort(i)}</td>
                  <td className="px-3 py-3 text-slate-300 whitespace-nowrap">{KUNDGRUPP_LABEL[i.kundgrupp]}</td>
                  <td className="px-3 py-3 max-w-[190px]"><Kalla i={i} /></td>
                  <td className="px-3 py-3 whitespace-nowrap"><Status i={i} /></td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-300 whitespace-nowrap">{i.arende_nummer ?? ''}</td>
                  <td className="px-3 py-3 text-slate-300 whitespace-nowrap">{namnFor(i.tilldelad_till) || <span className="text-slate-500">Ingen</span>}</td>
                  <td className="pr-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <WebLeadRadMeny val={menyVal(i)} etikett={`Åtgärder för ${i.referens}`} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Kortlista på mobil */}
      <ul ref={kort} className="md:hidden space-y-2">
        {p.rader.map((i) => {
          const vald = p.valda.has(i.id)
          const s = STATUS_CONFIG[i.status]
          const { kanal } = kanalFor(i)
          return (
            <li
              key={i.id}
              data-rad
              tabIndex={0}
              onClick={() => p.onOppna(i.id)}
              onKeyDown={(e) => tangent(e, i.id, kort.current)}
              className={`p-3 border rounded-xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
                vald ? 'bg-[#20c58f]/10 border-[#20c58f]/40' : 'bg-slate-800/30 border-slate-700'
              } ${i.archived_at ? 'opacity-55' : ''}`}
            >
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-lg grid place-items-center flex-none bg-slate-700/40 text-slate-200">
                  <TjanstIcon name={tjanstNyckel(i.pest_type)} className="w-5 h-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-white font-medium truncate">{i.company_name || i.name}</span>
                    <span className={`flex items-center gap-1.5 text-sm flex-none ${s.text}`}>
                      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                      {s.label}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300 truncate">
                    {tjanstLabel(i.pest_type)}
                    {ort(i) ? ` · ${ort(i)}` : ''}
                    {` · ${KUNDGRUPP_LABEL[i.kundgrupp]}`}
                  </p>
                  <div className="flex items-center justify-between gap-2 mt-1 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <KallaIcon name={kanal} className={`w-3.5 h-3.5 flex-none ${KANAL_FARG[kanal]}`} />
                      <span className="truncate">{KANAL_LABEL[kanal]}</span>
                      {i.akut && <span className="flex items-center gap-1 text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Akut</span>}
                      {i.archived_at && <span className="text-slate-500">Arkiverad</span>}
                    </span>
                    <span className="font-mono flex-none">{formatSvTid(i.created_at)}</span>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1 flex-none" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className={`${KRYSS} mt-1`}
                    checked={vald}
                    onChange={() => p.onVal(i.id)}
                    aria-label={`Markera ${i.referens}`}
                  />
                  <WebLeadRadMeny val={menyVal(i)} etikett={`Åtgärder för ${i.referens}`} />
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}
