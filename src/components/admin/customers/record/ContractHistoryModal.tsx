// src/components/admin/customers/record/ContractHistoryModal.tsx
// Avtalets fullständiga historik, öppnas från Avtalskartan: tidslinje
// (premietrappa, tillägg, omfattningsändringar, fakturor) och ärenden/besök,
// filtrerbart per enhet. Ren läsvy — all data kommer från useCustomerRecord.

import { useEffect, useMemo, useState } from 'react'
import { Briefcase, Clock } from 'lucide-react'
import Modal from '../../../ui/Modal'
import {
  contractDisplayName,
  contractEffectiveAnnualValue,
  customerRowName,
  formatDateSv,
  formatKr,
  type RecordAddition,
  type RecordBillingItem,
  type RecordCase,
  type RecordContract,
  type RecordContractSite,
  type RecordCustomer,
  type RecordPremiumEvent,
} from '../../../../hooks/useCustomerRecord'
import ContractTimelineList, { buildSingleContractTimeline } from './ContractTimelineList'
import { isCompletedStatus, type ClickUpStatus } from '../../../../types/database'

export type HistoryTab = 'tidslinje' | 'arenden'

interface Props {
  /** null = stängd */
  contract: RecordContract | null
  initialTab?: HistoryTab
  initialUnitFilter?: string
  onClose: () => void
  additions: RecordAddition[]
  billingItems: RecordBillingItem[]
  premiumEvents: RecordPremiumEvent[]
  contractSites: RecordContractSite[]
  cases: RecordCase[]
  customerById: Map<string, RecordCustomer>
  /** Kundrader avtalet gäller: ägaren + enheter i omfattningen */
  coveredCustomerIds: string[]
}

type CaseState = 'done' | 'booked' | 'open'

function caseState(c: RecordCase): CaseState {
  if (c.completed_date || isCompletedStatus(c.status as ClickUpStatus)) return 'done'
  if (c.scheduled_date) return 'booked'
  return 'open'
}

const CASE_STATE_META: Record<CaseState, { label: string; cls: string }> = {
  done: { label: 'Utfört', cls: 'text-slate-400 border-slate-700' },
  booked: { label: 'Bokat', cls: 'text-sky-400 border-sky-400/40 bg-sky-400/10' },
  open: { label: 'Pågående', cls: 'text-amber-400 border-amber-400/40 bg-amber-400/10' },
}

export default function ContractHistoryModal({
  contract,
  initialTab = 'tidslinje',
  initialUnitFilter = '',
  onClose,
  additions,
  billingItems,
  premiumEvents,
  contractSites,
  cases,
  customerById,
  coveredCustomerIds,
}: Props) {
  const [tab, setTab] = useState<HistoryTab>(initialTab)
  const [unitFilter, setUnitFilter] = useState(initialUnitFilter)

  // Nollställ flikval när ett annat avtal öppnas
  useEffect(() => {
    setTab(initialTab)
    setUnitFilter(initialUnitFilter)
  }, [contract?.id, initialTab, initialUnitFilter])

  const nameById = useMemo(
    () => new Map(Array.from(customerById.entries()).map(([id, c]) => [id, customerRowName(c)])),
    [customerById]
  )

  const timelineEvents = useMemo(() => {
    if (!contract) return []
    return buildSingleContractTimeline(contract, additions, billingItems, premiumEvents, contractSites, nameById)
  }, [contract, additions, billingItems, premiumEvents, contractSites, nameById])

  const contractCases = useMemo(() => {
    if (!contract) return []
    const covered = new Set(coveredCustomerIds)
    return cases
      .filter((c) => c.contract_id === contract.id || (c.customer_id && covered.has(c.customer_id)))
      .filter((c) => !unitFilter || c.customer_id === unitFilter)
  }, [contract, cases, coveredCustomerIds, unitFilter])

  if (!contract) return null

  const annual = contractEffectiveAnnualValue(contract, premiumEvents)
  const doneCount = contractCases.filter((c) => caseState(c) === 'done').length
  const openCount = contractCases.filter((c) => caseState(c) !== 'done').length

  const tabs: { id: HistoryTab; label: string; icon: React.ReactNode }[] = [
    { id: 'tidslinje', label: 'Tidslinje', icon: <Clock className="w-3.5 h-3.5" /> },
    { id: 'arenden', label: `Ärenden & besök (${contractCases.length})`, icon: <Briefcase className="w-3.5 h-3.5" /> },
  ]

  return (
    <Modal
      isOpen
      onClose={onClose}
      usePortal
      size="lg"
      title={contractDisplayName(contract)}
      subtitle={annual > 0 ? `${formatKr(annual)}/år · historik och uppföljning` : 'Historik och uppföljning'}
    >
      <div className="p-4">
        <div className="flex items-center gap-2 flex-wrap mb-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                tab === t.id ? 'bg-[#20c58f] text-[#fff]' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
          <select
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            className="ml-auto bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
            aria-label="Filtrera på enhet"
          >
            <option value="">Hela avtalet</option>
            {coveredCustomerIds.map((id) => (
              <option key={id} value={id}>
                {nameById.get(id) ?? 'Enhet'}
              </option>
            ))}
          </select>
        </div>

        <div hidden={tab !== 'tidslinje'}>
          <ContractTimelineList events={timelineEvents} emptyText="Inga händelser för avtalet ännu." />
        </div>

        <div hidden={tab !== 'arenden'}>
          {contractCases.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-3">
              <span className="text-xs px-2.5 py-1 rounded-lg border border-[#20c58f]/40 bg-[#20c58f]/10 text-[#20c58f]">
                {doneCount} utförda
              </span>
              {openCount > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-lg border border-amber-400/40 bg-amber-400/10 text-amber-400">
                  {openCount} öppna/bokade
                </span>
              )}
            </div>
          )}
          <div className="space-y-2">
            {contractCases.map((c) => {
              const state = caseState(c)
              const meta = CASE_STATE_META[state]
              const date = c.completed_date ?? c.scheduled_date ?? c.created_at
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl border border-slate-700/50 bg-slate-800/20 text-sm"
                >
                  <span className="text-xs text-slate-500 tabular-nums w-20 shrink-0">{formatDateSv(date)}</span>
                  <span className="w-32 shrink-0 font-medium text-slate-300 truncate">
                    {c.customer_id ? (nameById.get(c.customer_id) ?? '–') : '–'}
                  </span>
                  <span className="flex-1 text-slate-200 truncate">{c.title}</span>
                  {c.assigned_technician_name && (
                    <span className="text-xs text-slate-500 truncate hidden sm:block max-w-28">
                      {c.assigned_technician_name}
                    </span>
                  )}
                  {c.price != null && c.price > 0 && (
                    <span className="text-xs text-slate-300 tabular-nums shrink-0">{formatKr(Number(c.price))}</span>
                  )}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${meta.cls}`}>
                    {meta.label}
                  </span>
                </div>
              )
            })}
            {contractCases.length === 0 && (
              <p className="text-sm text-slate-500 py-4 text-center">
                Inga ärenden {unitFilter ? 'för den valda enheten' : 'kopplade till avtalet'} ännu.
              </p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
