// src/components/admin/customers/record/RecordHeader.tsx
// Sidhuvud för kundsidan — inga kort, bara textrader:
//   Namn                                   [Redigera i listan ↗]
//   #3558 ✓ Fortnox · Org.nr … · Multisite · 5 enheter · Säljare: …
//   83 628 kr/år över 2 avtal · Nästa: avtalet löper ut 28 feb 2029

import { Fragment } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, CornerLeftUp, ExternalLink } from 'lucide-react'
import {
  customerRowName,
  formatDateSv,
  formatKr,
  type RecordCustomer,
} from '../../../../hooks/useCustomerRecord'
import type { RecordTimelineEvent } from './ContractTimelineList'

interface Props {
  /** Raden som visas (org eller enhet) */
  customer: RecordCustomer
  root: RecordCustomer
  unitsCount: number
  /** Summa av familjens aktiva avtals annual_value */
  familyAnnualValue: number
  activeContractsCount: number
  /** T.ex. "1 på organisationen, 4 på enheterna" — null för icke-multisite */
  contractDistribution?: string | null
  nextEvent: RecordTimelineEvent | null
  /** T.ex. "/admin/befintliga-kunder" */
  basePath: string
}

function FortnoxStatus({ customer, root }: { customer: RecordCustomer; root: RecordCustomer }) {
  const isUnit = !!customer.parent_customer_id

  // Enhet utan eget kundnummer → faktureras via huvudkontoret
  if (isUnit && customer.customer_number == null) {
    return (
      <span className="flex items-center gap-1 text-slate-400">
        <CornerLeftUp className="w-3 h-3" />
        faktureras via HK{root.customer_number != null && <span className="font-mono"> #{root.customer_number}</span>}
      </span>
    )
  }

  if (customer.customer_number == null) {
    return <span className="text-red-400">Kundnummer saknas</span>
  }

  return (
    <span className="flex items-center gap-2">
      <span className="font-mono text-slate-300">#{customer.customer_number}</span>
      {customer.fortnox_verified_at ? (
        <span className="flex items-center gap-1 text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-[#20c58f]" aria-hidden />
          Fortnox
        </span>
      ) : (
        <span className="flex items-center gap-1 text-amber-400">
          <AlertTriangle className="w-3 h-3" />
          Ej verifierad mot Fortnox
        </span>
      )}
    </span>
  )
}

export default function RecordHeader({
  customer,
  root,
  unitsCount,
  familyAnnualValue,
  activeContractsCount,
  contractDistribution,
  nextEvent,
  basePath,
}: Props) {
  const navigate = useNavigate()
  const isUnit = !!customer.parent_customer_id
  const orgNumber = customer.organization_number ?? root.organization_number
  const isMultisite = root.is_multisite || unitsCount > 0

  const metaSegments: React.ReactNode[] = []
  metaSegments.push(<FortnoxStatus key="fortnox" customer={customer} root={root} />)
  if (orgNumber) metaSegments.push(<span key="orgnr">Org.nr {orgNumber}</span>)
  if (isMultisite) {
    metaSegments.push(<span key="multisite">Multisite</span>)
    metaSegments.push(
      <span key="units" className="tabular-nums">
        {unitsCount} {unitsCount === 1 ? 'enhet' : 'enheter'}
      </span>
    )
  }
  const salesPerson = customer.sales_person ?? root.sales_person
  if (salesPerson) metaSegments.push(<span key="sales">Säljare: {salesPerson}</span>)

  return (
    <header>
      {/* Enhetsvy: länk upp till org-radens sida */}
      {isUnit && (
        <Link
          to={`${basePath}/${root.id}`}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#20c58f] transition-colors mb-1"
        >
          <CornerLeftUp className="w-3 h-3" />
          {root.company_name}
        </Link>
      )}

      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-100 truncate">
          {customerRowName(customer)}
          {isUnit && <span className="text-slate-500 text-lg font-normal ml-2">enhet</span>}
        </h1>
        <button
          onClick={() => navigate(basePath)}
          className="flex items-center gap-1.5 shrink-0 mt-1 text-xs text-slate-400 hover:text-[#20c58f] transition-colors"
        >
          Redigera i listan
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>

      {/* Metarad */}
      <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-1.5 text-xs text-slate-400">
        {metaSegments.map((segment, i) => (
          <Fragment key={i}>
            {i > 0 && <span className="text-slate-700">·</span>}
            {segment}
          </Fragment>
        ))}
      </div>

      {/* Värde + nästa händelse */}
      <div className="mt-1.5 text-sm text-slate-300 tabular-nums">
        {familyAnnualValue > 0 ? (
          <span>
            {formatKr(familyAnnualValue)}/år över {activeContractsCount} avtal
            {contractDistribution ? ` (${contractDistribution})` : ''}
          </span>
        ) : (
          <span className="text-slate-500">
            {activeContractsCount > 0
              ? `${activeContractsCount} avtal utan fast årsvärde${contractDistribution ? ` (${contractDistribution})` : ''}`
              : 'Inga aktiva avtal'}
          </span>
        )}
        {nextEvent && (
          <span className="text-slate-400">
            {' '}· Nästa: {nextEvent.title.toLowerCase()} {formatDateSv(nextEvent.date)}
          </span>
        )}
      </div>
    </header>
  )
}
