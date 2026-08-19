// src/components/admin/customers/record/UnitsSection.tsx
// Enheter-fliken: listar familjens enheter med adress, kundnummer (eller "via HK"),
// antal avtal, antal ärenden och årsvärde. Klick navigerar till enhetens egen
// record-sida. Den enhet som just visas markeras med grön kant.

import { useNavigate } from 'react-router-dom'
import { ChevronRight, MapPin } from 'lucide-react'
import {
  contractAnnualValue,
  customerRowName,
  formatKr,
  isEndedContract,
  type RecordContract,
  type RecordCustomer,
} from '../../../../hooks/useCustomerRecord'

interface Props {
  root: RecordCustomer
  units: RecordCustomer[]
  contracts: RecordContract[]
  caseCounts: Record<string, number>
  /** T.ex. "/admin/befintliga-kunder" — record-sidan för en enhet blir `${basePath}/<id>` */
  basePath: string
  /** Id för raden som visas just nu (markeras i listan) */
  currentCustomerId: string
}

export default function UnitsSection({ root, units, contracts, caseCounts, basePath, currentCustomerId }: Props) {
  const navigate = useNavigate()

  if (units.length === 0) {
    return <p className="text-sm text-slate-500">Inga enheter — kunden är en enskild kundrad.</p>
  }

  return (
    <ul className="divide-y divide-slate-800">
      {units.map((unit) => {
        const unitContracts = contracts.filter((c) => c.customer_id === unit.id)
        const activeContracts = unitContracts.filter((c) => !isEndedContract(c))
        const annual = activeContracts.reduce((sum, c) => sum + contractAnnualValue(c), 0)
        const cases = caseCounts[unit.id] ?? 0
        const isCurrent = unit.id === currentCustomerId

        return (
          <li key={unit.id}>
            <button
              onClick={() => navigate(`${basePath}/${unit.id}`)}
              className={`w-full text-left px-3 py-2.5 flex items-center gap-3 group hover:bg-slate-900/60 transition-colors ${
                isCurrent ? 'border-l-2 border-[#20c58f] bg-slate-900/40' : 'border-l-2 border-transparent'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-slate-100 truncate">{customerRowName(unit)}</span>
                  {isCurrent && <span className="text-[10px] uppercase tracking-wide text-[#20c58f] shrink-0">Visas nu</span>}
                </div>
                {unit.contact_address && (
                  <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5 min-w-0">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">{unit.contact_address}</span>
                  </div>
                )}
              </div>

              <div className="flex items-baseline gap-4 text-xs text-slate-400 shrink-0">
                {unit.customer_number != null ? (
                  <span className="font-mono">#{unit.customer_number}</span>
                ) : (
                  <span className="text-slate-500">
                    via HK{root.customer_number != null && <span className="font-mono"> #{root.customer_number}</span>}
                  </span>
                )}
                <span className="tabular-nums">{unitContracts.length} avtal</span>
                <span className="tabular-nums">{cases} ärenden</span>
                <span className="tabular-nums text-slate-200 w-24 text-right">
                  {annual > 0 ? `${formatKr(annual)}/år` : '–'}
                </span>
              </div>

              <ChevronRight className="w-4 h-4 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
