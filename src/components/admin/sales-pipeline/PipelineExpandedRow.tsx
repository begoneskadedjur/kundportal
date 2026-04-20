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

  return (
    <div className="space-y-3">
      <OfferItemsSection
        services={services}
        articles={articles}
        loading={loading}
        error={error}
      />

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
