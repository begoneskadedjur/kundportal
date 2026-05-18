// src/components/coordinator/EstablishmentCaseModal.tsx
// Modal för etablering-ärenden (service_type='establishment')
// Visar kundinformation, schemaläggning, avtalsinnehåll (vad som ska placeras ut)
// och knapp "Gå till utplacering" som navigerar till /technician/equipment

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { X, MapPin, User, Phone, Mail, Calendar, Clock, Package, Building } from 'lucide-react'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import { CustomerContractArticleService } from '../../services/customerContractArticleService'
import type { CustomerContractArticleWithArticle } from '../../types/articles'

interface EstablishmentCaseModalProps {
  isOpen: boolean
  onClose: () => void
  caseData: any
}

export default function EstablishmentCaseModal({
  isOpen,
  onClose,
  caseData,
}: EstablishmentCaseModalProps) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [customerData, setCustomerData] = useState<any>(null)
  const [articles, setArticles] = useState<CustomerContractArticleWithArticle[]>([])
  const [loading, setLoading] = useState(false)

  const isTechnician = profile?.role === 'technician'

  useEffect(() => {
    if (!isOpen || !caseData?.customer_id) return

    const customerId = caseData.customer_id

    setLoading(true)
    Promise.all([
      supabase.from('customers').select('*').eq('id', customerId).single(),
      CustomerContractArticleService.getArticles(customerId),
    ])
      .then(([customerResult, articleRows]) => {
        if (!customerResult.error) setCustomerData(customerResult.data)
        setArticles(articleRows)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [isOpen, caseData?.customer_id])

  if (!caseData) return null

  const formatDate = (iso?: string | null) => {
    if (!iso) return '–'
    return new Date(iso).toLocaleString('sv-SE', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const scheduledStart = caseData.scheduled_start || caseData.start_date
  const scheduledEnd = caseData.scheduled_end || caseData.due_date

  const handleGoToEquipment = () => {
    navigate(`/technician/equipment?customer=${caseData.customer_id}`)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="flex flex-col" style={{ maxHeight: '85vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-lime-500/20 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-4 h-4 text-lime-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                Etablering {caseData.case_number ? `— ${caseData.case_number}` : ''}
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-lime-700/50 text-lime-100 border border-lime-600/50">
                {caseData.status || 'Bokad'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">

          {/* Kundinformation */}
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
            <div className="flex items-center gap-1.5 mb-2">
              <Building className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-white">Kund</span>
            </div>
            {loading ? (
              <p className="text-sm text-slate-400">Laddar...</p>
            ) : (
              <div className="space-y-1.5 text-sm">
                <p className="font-medium text-white">{customerData?.company_name || '–'}</p>
                {(caseData.contact_person || customerData?.contact_person) && (
                  <div className="flex items-center gap-2 text-slate-300">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span>{caseData.contact_person || customerData?.contact_person}</span>
                  </div>
                )}
                {(caseData.contact_phone || customerData?.contact_phone) && (
                  <div className="flex items-center gap-2 text-slate-300">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <span>{caseData.contact_phone || customerData?.contact_phone}</span>
                  </div>
                )}
                {(caseData.contact_email || customerData?.contact_email) && (
                  <div className="flex items-center gap-2 text-slate-300">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    <span>{caseData.contact_email || customerData?.contact_email}</span>
                  </div>
                )}
                {(caseData.address?.formatted_address || customerData?.contact_address) && (
                  <div className="flex items-center gap-2 text-slate-300">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    <span>{caseData.address?.formatted_address || customerData?.contact_address}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Schemaläggning */}
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
            <div className="flex items-center gap-1.5 mb-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-white">Schemaläggning</span>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2 text-slate-300">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>{formatDate(scheduledStart)}{scheduledEnd ? ` – ${formatDate(scheduledEnd)}` : ''}</span>
              </div>
              {caseData.primary_technician_name && (
                <div className="flex items-center gap-2 text-slate-300">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>{caseData.primary_technician_name}</span>
                </div>
              )}
              {caseData.secondary_technician_name && (
                <div className="flex items-center gap-2 text-slate-300">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>{caseData.secondary_technician_name} (extra)</span>
                </div>
              )}
            </div>
          </div>

          {/* Avtalsinnehåll — vad som ska placeras ut */}
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
            <div className="flex items-center gap-1.5 mb-2">
              <Package className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-white">Vad ska placeras ut</span>
            </div>
            {loading ? (
              <p className="text-sm text-slate-400">Laddar...</p>
            ) : articles.length === 0 ? (
              <p className="text-sm text-slate-500 py-2">Inga avtalsartiklar registrerade för denna kund.</p>
            ) : (
              <div className="space-y-1.5">
                {articles.map((art) => (
                  <div key={art.id} className="flex items-center justify-between px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                    <span className="text-sm text-white">{art.article?.name || art.article_id}</span>
                    <span className="text-sm font-medium text-lime-300 ml-4 flex-shrink-0">× {art.quantity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Beskrivning */}
          {caseData.description && (
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
              <p className="text-xs font-medium text-slate-400 mb-1">Anteckningar</p>
              <p className="text-sm text-slate-300 whitespace-pre-wrap">{caseData.description}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-slate-700/50">
          <Button variant="ghost" size="sm" onClick={onClose}>Stäng</Button>
          {isTechnician && (
            <Button variant="primary" size="sm" onClick={handleGoToEquipment} className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Gå till utplacering
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
