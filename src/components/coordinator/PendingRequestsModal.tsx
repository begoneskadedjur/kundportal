// src/components/coordinator/PendingRequestsModal.tsx - Modal för väntande förfrågningar
import React, { useState } from 'react'
import { X, Calendar, AlertCircle, Clock, Building2, Phone, Mail, User, MapPin } from 'lucide-react'
import { usePendingCases } from '../../hooks/usePendingCases'
import { Case, serviceTypeConfig, priorityConfig } from '../../types/cases'
import Button from '../ui/Button'
import LoadingSpinner from '../shared/LoadingSpinner'
import Modal from '../ui/Modal'
import { formatDistanceToNow } from 'date-fns'
import { sv } from 'date-fns/locale'

interface PendingRequestsModalProps {
  isOpen: boolean
  onClose: () => void
  onScheduleClick: (caseItem: Case) => void
}

const PendingRequestsModal: React.FC<PendingRequestsModalProps> = ({ 
  isOpen,
  onClose,
  onScheduleClick
}) => {
  const { pendingCases, loading, error, urgentCount, oldRequestsCount, totalCount } = usePendingCases()
  const [expandedCase, setExpandedCase] = useState<string | null>(null)

  // Check if a request is old (>24h)
  const isOldRequest = (createdAt: string) => {
    const created = new Date(createdAt)
    const now = new Date()
    const hoursDiff = (now.getTime() - created.getTime()) / (1000 * 60 * 60)
    return hoursDiff > 24
  }

  // Format time since created
  const getTimeSince = (createdAt: string) => {
    try {
      return formatDistanceToNow(new Date(createdAt), { 
        addSuffix: true,
        locale: sv 
      })
    } catch {
      return 'Nyligen'
    }
  }

  const handleSchedule = (caseItem: Case) => {
    // Ensure we pass the complete case with customer data
    const caseWithCustomer = {
      ...caseItem,
      customer: (caseItem as any).customer || {
        company_name: (caseItem as any).customer_name,
        contact_person: (caseItem as any).customer_contact,
        contact_email: (caseItem as any).customer_email,
        contact_phone: (caseItem as any).customer_phone,
        organization_number: (caseItem as any).customer_org_number
      }
    }
    onScheduleClick(caseWithCustomer)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center justify-between">
          <span>Väntande förfrågningar</span>
          <div className="flex items-center gap-2">
            {urgentCount > 0 && (
              <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs font-medium rounded-full animate-pulse">
                {urgentCount} brådskande
              </span>
            )}
            <span className="px-2 py-1 bg-slate-700 text-slate-300 text-xs font-medium rounded-full">
              {totalCount} totalt
            </span>
          </div>
        </div>
      }
      size="lg"
    >
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-400">{error}</p>
          </div>
        ) : pendingCases.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">Inga väntande förfrågningar</p>
            <p className="text-sm text-slate-500 mt-1">Alla ärenden är hanterade</p>
          </div>
        ) : (
          <>
            {/* Alert for old requests */}
            {oldRequestsCount > 0 && (
              <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-amber-400 font-medium">
                      {oldRequestsCount} förfrågan{oldRequestsCount > 1 ? 'ar' : ''} över 24h gamla
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Dessa bör prioriteras för schemaläggning
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Cases List */}
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {pendingCases.map((caseItem) => {
                const isExpanded = expandedCase === caseItem.id
                const isOld = isOldRequest(caseItem.created_at)
                const serviceType = caseItem.service_type ? serviceTypeConfig[caseItem.service_type] : null
                
                return (
                  <div
                    key={caseItem.id}
                    className={`
                      bg-slate-800 rounded-lg p-4 transition-all duration-200
                      hover:bg-slate-800/80
                      ${isOld ? 'border border-amber-500/30' : 'border border-slate-700'}
                      ${caseItem.priority === 'urgent' ? 'ring-2 ring-red-500/30' : ''}
                    `}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Building2 className="w-4 h-4 text-slate-500" />
                          <span className="text-sm font-medium text-white">
                            {(caseItem as any).customer_name || 'Okänd kund'}
                          </span>
                          <span className="text-xs text-slate-500">#{caseItem.case_number}</span>
                        </div>
                        <h4 className="text-white font-medium">{caseItem.title}</h4>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-slate-400">
                            {getTimeSince(caseItem.created_at)}
                          </span>
                          {isOld && (
                            <span className="text-xs text-amber-400 font-medium">
                              Över 24h gammal
                            </span>
                          )}
                        </div>
                      </div>
                      {caseItem.priority === 'urgent' && (
                        <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs font-medium rounded animate-pulse">
                          Brådskande
                        </span>
                      )}
                    </div>

                    {/* Service Type & Pest Type */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      {serviceType && (
                        <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300">
                          {serviceType.label}
                        </span>
                      )}
                      {caseItem.pest_type && (
                        <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">
                          {caseItem.pest_type}
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    {caseItem.description && (
                      <p className="text-sm text-slate-300 mb-3 line-clamp-2">
                        {caseItem.description}
                      </p>
                    )}

                    {/* Contact & Address Info */}
                    <div className="flex flex-wrap gap-4 text-xs text-slate-400 mb-3">
                      {caseItem.contact_person && (
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          <span>{caseItem.contact_person}</span>
                        </div>
                      )}
                      {caseItem.contact_phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          <span>{caseItem.contact_phone}</span>
                        </div>
                      )}
                      {caseItem.contact_email && (
                        <div className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          <span>{caseItem.contact_email}</span>
                        </div>
                      )}
                    </div>

                    {caseItem.address?.formatted_address && (
                      <div className="flex items-start gap-1 text-xs text-slate-400 mb-3">
                        <MapPin className="w-3 h-3 mt-0.5" />
                        <span>{caseItem.address.formatted_address}</span>
                      </div>
                    )}

                    {/* Action Button */}
                    <Button
                      onClick={() => handleSchedule(caseItem)}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
                      size="sm"
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      Schemalägg
                    </Button>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

export default PendingRequestsModal