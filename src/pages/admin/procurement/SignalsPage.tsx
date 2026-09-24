// src/pages/admin/procurement/SignalsPage.tsx
// Signaler (planens avsnitt 3 och 9.6): framförhållning ur upphandlingsplaner,
// planerade poster i annonsdatabaserna, RFI, förhandsannonser och
// avtalsklockan. Status går att ändra per signal. Under listan ligger
// signalkällorna.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ExternalLink } from 'lucide-react'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import Select from '../../../components/ui/Select'
import { ProcurementService } from '../../../services/procurementService'
import {
  RELIABILITY_LABEL,
  SIGNAL_TYPE_LABEL,
  type ProcurementReliability,
  type ProcurementSignal,
  type ProcurementSignalType,
} from '../../../types/procurement'
import { EmptyState, Section, StatusDot } from '../../../components/admin/procurement/ui'
import { fmtDate, fmtNum, tableCls, type Tone } from '../../../components/admin/procurement/uiFormat'
import { SignalSourcesSection } from '../../../components/admin/procurement/settings/SignalSourcesSection'

type SignalStatus = ProcurementSignal['status']

const STATUS_LABEL: Record<SignalStatus, string> = {
  new: 'Ny',
  watching: 'Bevakas',
  converted: 'Blev upphandling',
  dismissed: 'Avfärdad',
}

const STATUS_OPTIONS = (Object.keys(STATUS_LABEL) as SignalStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))

const RELIABILITY_TONE: Record<ProcurementReliability, Tone> = { high: 'good', medium: 'warn', low: 'muted' }

const SOURCE_LABEL: Record<string, string> = {
  mercell: 'Mercell',
  ted: 'TED',
  kommers: 'Kommers',
  signal_source: 'Signalkälla',
  contract_clock: 'Avtalsklockan',
  manual: 'Manuell',
}

type ListFilter = 'open' | 'all' | SignalStatus

const LIST_OPTIONS: Array<{ value: ListFilter; label: string }> = [
  { value: 'open', label: 'Nya och bevakade' },
  { value: 'all', label: 'Alla signaler' },
  ...STATUS_OPTIONS,
]

const TYPE_OPTIONS = [
  { value: 'all', label: 'Alla typer' },
  ...(Object.keys(SIGNAL_TYPE_LABEL) as ProcurementSignalType[]).map((t) => ({ value: t, label: SIGNAL_TYPE_LABEL[t] })),
]

export default function SignalsPage() {
  const [loading, setLoading] = useState(true)
  const [signals, setSignals] = useState<ProcurementSignal[]>([])
  const [filter, setFilter] = useState<ListFilter>('open')
  const [type, setType] = useState<string>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const statuses: SignalStatus[] = filter === 'open' ? ['new', 'watching'] : filter === 'all' ? ['new', 'watching', 'converted', 'dismissed'] : [filter]
      setSignals(await ProcurementService.listSignals(statuses))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte hämta signaler')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  const rows = useMemo(() => signals.filter((s) => type === 'all' || s.signal_type === type), [signals, type])

  const setStatus = async (s: ProcurementSignal, status: SignalStatus) => {
    try {
      await ProcurementService.updateSignal(s.id, { status })
      setSignals((prev) => prev.map((x) => (x.id === s.id ? { ...x, status } : x)))
      toast.success(`Signalen: ${STATUS_LABEL[status]}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte spara signalen')
    }
  }

  return (
    <div className="space-y-8">
      <Section
        title="Signaler"
        hint="Tidiga tecken på kommande upphandlingar i fallande tillförlitlighet: avtalsklockan, planerade poster, upphandlingsplaner och förhandsannonser."
        action={<span className="text-xs text-slate-500 tabular-nums">{fmtNum(rows.length)} st</span>}
      >
        <div className="flex flex-wrap gap-3 px-3 py-3 border-b border-slate-800">
          <div className="w-52"><Select options={LIST_OPTIONS} value={filter} onChange={(v) => setFilter(v as ListFilter)} /></div>
          <div className="w-52"><Select options={TYPE_OPTIONS} value={type} onChange={setType} /></div>
        </div>
        {loading ? (
          <div className="py-10 flex justify-center"><LoadingSpinner /></div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="Inga signaler"
            hint="Signaler skapas av Mercell-synken (UpcomingTenders, RFI, förhandsannonser), TED och det dagliga jobbet som läser signalkällorna."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className={tableCls.table}>
              <thead className={tableCls.thead}>
                <tr>
                  <th className={tableCls.th}>Typ</th>
                  <th className={tableCls.th}>Köpare och text</th>
                  <th className={tableCls.th}>Förväntat</th>
                  <th className={tableCls.th}>Tillförlitlighet</th>
                  <th className={tableCls.th}>Källa</th>
                  <th className={tableCls.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className={tableCls.tr}>
                    <td className={`${tableCls.td} whitespace-nowrap`}>{SIGNAL_TYPE_LABEL[s.signal_type] ?? s.signal_type}</td>
                    <td className={tableCls.td}>
                      <div className="min-w-[220px] max-w-[420px]">
                        {s.buyer_id ? (
                          <Link to={`/admin/upphandlingar/kopare/${s.buyer_id}`} className="text-slate-200 hover:text-[#20c58f] hover:underline">
                            {s.buyer_name ?? 'Köpare'}
                          </Link>
                        ) : (
                          <span className="text-slate-200">{s.buyer_name ?? 'Okänd köpare'}</span>
                        )}
                        <div className="text-[12px] text-slate-400 whitespace-pre-line line-clamp-3" title={s.text}>{s.text}</div>
                        {s.notice_id && (
                          <Link to={`/admin/upphandlingar/${s.notice_id}`} className="text-[11px] text-[#20c58f] hover:underline">Öppna upphandlingen</Link>
                        )}
                        <div className="text-[10.5px] text-slate-600 mt-0.5">Upptäckt {fmtDate(s.created_at)}</div>
                      </div>
                    </td>
                    <td className={`${tableCls.td} whitespace-nowrap`}>{s.expected_quarter?.replace('-', ' ') ?? '–'}</td>
                    <td className={tableCls.td}>
                      <StatusDot tone={RELIABILITY_TONE[s.reliability] ?? 'neutral'}>{RELIABILITY_LABEL[s.reliability] ?? s.reliability}</StatusDot>
                    </td>
                    <td className={`${tableCls.td} whitespace-nowrap`}>
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-[#20c58f]">
                          {SOURCE_LABEL[s.source] ?? s.source}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        SOURCE_LABEL[s.source] ?? s.source
                      )}
                    </td>
                    <td className={tableCls.td}>
                      <div className="w-40">
                        <Select options={STATUS_OPTIONS} value={s.status} onChange={(v) => void setStatus(s, v as SignalStatus)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <SignalSourcesSection />
    </div>
  )
}
