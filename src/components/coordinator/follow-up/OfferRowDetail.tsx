// src/components/coordinator/follow-up/OfferRowDetail.tsx
// Delad expand-panel för offerter — visar detaljer, tjänster/artiklar + kommunikation (intern/Oneflow).
// Används i FollowUpTable-kort och CasePipeline-tabellen.

import { useEffect, useRef, useState } from 'react'
import { Clock, ExternalLink, FileText, Mail, MessageSquare, Phone } from 'lucide-react'
import type { CaseBillingItemWithRelations } from '../../../types/caseBilling'
import { OfferFollowUpService } from '../../../services/offerFollowUpService'
import OfferItemsSection from './OfferItemsSection'
import { CommentThread } from './CommentThread'
import CommentSection from '../../communication/CommentSection'

export interface OfferRowDetailProps {
  offer: {
    id: string
    oneflow_contract_id?: string | null
    company_name?: string | null
    contact_person?: string | null
    contact_email?: string | null
    contact_phone?: string | null
    created_at: string
  }
  senderEmail?: string
}

type ItemsData = {
  services: CaseBillingItemWithRelations[]
  articles: CaseBillingItemWithRelations[]
} | null

export default function OfferRowDetail({ offer, senderEmail }: OfferRowDetailProps) {
  const [activeTab, setActiveTab] = useState<'internal' | 'external'>('internal')
  const [itemsData, setItemsData] = useState<ItemsData>(null)
  const [itemsLoading, setItemsLoading] = useState(false)
  const [itemsError, setItemsError] = useState<string | null>(null)
  const hasFetchedRef = useRef(false)

  useEffect(() => {
    if (hasFetchedRef.current) return
    hasFetchedRef.current = true
    let cancelled = false
    setItemsLoading(true)
    setItemsError(null)
    OfferFollowUpService.getContractItems(offer.id)
      .then(data => {
        if (!cancelled) setItemsData(data)
      })
      .catch(err => {
        if (!cancelled) {
          setItemsError(err instanceof Error ? err.message : 'Okänt fel')
          hasFetchedRef.current = false
        }
      })
      .finally(() => {
        if (!cancelled) setItemsLoading(false)
      })
    return () => { cancelled = true }
  }, [offer.id])

  return (
    <div className="p-3 bg-slate-800/20 border border-slate-700/30 border-t-0 rounded-b-xl space-y-3">
      {/* Detaljer */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {offer.contact_email && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Mail className="w-3 h-3" />
            <a href={`mailto:${offer.contact_email}`} className="hover:text-white transition-colors truncate">
              {offer.contact_email}
            </a>
          </div>
        )}
        {offer.contact_phone && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Phone className="w-3 h-3" />
            <a href={`tel:${offer.contact_phone}`} className="hover:text-white transition-colors">
              {offer.contact_phone}
            </a>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Clock className="w-3 h-3" />
          <span>Skickad {new Date(offer.created_at).toLocaleDateString('sv-SE')}</span>
        </div>
        {offer.oneflow_contract_id && (
          <div className="flex items-center gap-1.5 text-xs">
            <ExternalLink className="w-3 h-3 text-slate-400" />
            <a
              href={`https://app.oneflow.com/contracts/${offer.oneflow_contract_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#20c58f] hover:underline"
            >
              Öppna i Oneflow
            </a>
          </div>
        )}
      </div>

      {/* Innehåll i offerten: tjänster + interna artiklar */}
      <div className="pt-2 border-t border-slate-700/50">
        <div className="flex items-center gap-1.5 mb-2">
          <FileText className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-medium text-slate-300">Innehåll i offerten</span>
        </div>
        <OfferItemsSection
          services={itemsData?.services || []}
          articles={itemsData?.articles || []}
          loading={itemsLoading}
          error={itemsError}
        />
      </div>

      {/* Kommunikation — intern/extern flikar */}
      <div className="pt-2 border-t border-slate-700/50">
        <div className="flex items-center gap-1 mb-2">
          <button
            onClick={() => setActiveTab('internal')}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'internal'
                ? 'bg-[#20c58f] text-white'
                : 'bg-slate-800/50 text-slate-400 hover:text-slate-300 border border-slate-700/50'
            }`}
          >
            <MessageSquare className="w-3 h-3" />
            Intern
          </button>
          {offer.oneflow_contract_id && (
            <button
              onClick={() => setActiveTab('external')}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'external'
                  ? 'bg-[#20c58f] text-white'
                  : 'bg-slate-800/50 text-slate-400 hover:text-slate-300 border border-slate-700/50'
              }`}
            >
              <ExternalLink className="w-3 h-3" />
              Oneflow
            </button>
          )}
        </div>

        {activeTab === 'internal' ? (
          <CommentSection
            caseId={offer.id}
            caseType="contract"
            caseTitle={offer.company_name || offer.contact_person || ''}
            compact={true}
          />
        ) : offer.oneflow_contract_id ? (
          <CommentThread
            contractId={offer.oneflow_contract_id}
            senderEmail={senderEmail}
          />
        ) : null}
      </div>
    </div>
  )
}
