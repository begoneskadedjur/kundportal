// src/components/admin/sales-pipeline/PipelineExpandedRow.tsx
// Expanderad rad för pipeline-tabell — visar tjänster + interna artiklar
// (via samma OfferItemsSection som används i Dokumentsignering) +
// en knapp som navigerar till Dokumentsignering för djupare hantering.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink, FileSignature } from 'lucide-react'
import OfferItemsSection from '../../coordinator/follow-up/OfferItemsSection'
import { OfferFollowUpService } from '../../../services/offerFollowUpService'
import type { CaseBillingItemWithRelations } from '../../../types/caseBilling'

interface PipelineExpandedRowProps {
  contractId: string
  basePath: string // '/admin' | '/koordinator' | '/saljare'
}

export default function PipelineExpandedRow({ contractId, basePath }: PipelineExpandedRowProps) {
  const navigate = useNavigate()
  const [services, setServices] = useState<CaseBillingItemWithRelations[]>([])
  const [articles, setArticles] = useState<CaseBillingItemWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    OfferFollowUpService.getContractItems(contractId)
      .then(({ services: s, articles: a }) => {
        if (cancelled) return
        setServices(s)
        setArticles(a)
      })
      .catch(err => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Okänt fel')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [contractId])

  // Marginalpåverkan
  const external = services.reduce(
    (s, it) => s + (Number(it.total_price) || 0),
    0
  )
  const internal = articles.reduce(
    (s, it) => s + (Number(it.total_price) || 0),
    0
  )
  const net = external - internal
  const marginPct = external > 0 ? Math.round((net / external) * 100) : null
  const internalPct = external > 0 ? Math.min((internal / external) * 100, 100) : 0
  const netPct = external > 0 ? Math.max((net / external) * 100, 0) : 0
  const marginColor =
    marginPct === null
      ? 'text-slate-400'
      : marginPct >= 40
        ? 'text-green-400'
        : marginPct >= 20
          ? 'text-amber-400'
          : 'text-red-400'

  return (
    <div className="space-y-3">
      <OfferItemsSection
        services={services}
        articles={articles}
        loading={loading}
        error={error}
      />

      {!loading && external > 0 && (
        <div className="p-3 bg-slate-800/30 border border-slate-700/50 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-slate-300">Marginalpåverkan</div>
            <div className={`text-sm font-bold tabular-nums ${marginColor}`}>
              {marginPct !== null ? `${marginPct}%` : '—'}
            </div>
          </div>
          <div className="flex h-4 rounded-md overflow-hidden border border-slate-700/50">
            <div
              className="bg-red-500/60 flex items-center justify-center text-[9px] text-red-100"
              style={{ width: `${internalPct}%` }}
              title={`Inköpskostnad: ${internal.toLocaleString('sv-SE')} kr`}
            >
              {internalPct > 12 ? `${Math.round(internalPct)}%` : ''}
            </div>
            <div
              className="bg-green-500/60 flex items-center justify-center text-[9px] text-green-100"
              style={{ width: `${netPct}%` }}
              title={`Nettomarginal: ${net.toLocaleString('sv-SE')} kr`}
            >
              {netPct > 12 ? `${Math.round(netPct)}%` : ''}
            </div>
          </div>
          <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-500">
            <span>
              <span className="inline-block w-2 h-2 rounded-full bg-red-500/60 mr-1" />
              Inköp {internal.toLocaleString('sv-SE')} kr
            </span>
            <span>Pris {external.toLocaleString('sv-SE')} kr</span>
            <span>
              Netto {net.toLocaleString('sv-SE')} kr
              <span className="inline-block w-2 h-2 rounded-full bg-green-500/60 ml-1" />
            </span>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() =>
            navigate(`${basePath}/dokumentsignering?highlight=${contractId}`)
          }
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#20c58f] hover:text-white bg-[#20c58f]/10 hover:bg-[#20c58f]/20 border border-[#20c58f]/30 rounded-lg transition-colors"
        >
          <FileSignature className="w-3.5 h-3.5" />
          Öppna i Dokumentsignering
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}
