// src/components/coordinator/PendingRequestsPanel.tsx - Sidebar panel for pending service requests
import React, { useState } from 'react'
import { Clock, AlertTriangle, Calendar, ChevronDown, ChevronUp, Building2, User, Phone, Mail, AlertCircle, CheckCircle } from 'lucide-react'
import { usePendingCases } from '../../hooks/usePendingCases'
import { Case, serviceTypeConfig, priorityConfig } from '../../types/cases'
import ServiceRequestStatus from '../customer/ServiceRequestStatus'
import Button from '../ui/Button'
import LoadingSpinner from '../shared/LoadingSpinner'
import { formatDistanceToNow } from 'date-fns'
import { sv } from 'date-fns/locale'

interface PendingRequestsPanelProps {
  onScheduleClick: (caseItem: Case) => void
  className?: string
}

const PendingRequestsPanel: React.FC<PendingRequestsPanelProps> = ({ 
  onScheduleClick,
  className = ''
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

  if (loading) {
    return (
      <div className={`bg-slate-900 border-l border-slate-800 p-6 ${className}`}>
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-slate-900 border-l border-slate-800 p-6 ${className}`}>
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-slate-900 border-l border-slate-800 flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Väntande förfrågningar</h3>
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

        {/* Alert for old requests */}
        {oldRequestsCount > 0 && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
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
      </div>

      {/* Cases List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {pendingCases.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="text-slate-400">Inga väntande förfrågningar</p>
            <p className="text-sm text-slate-500 mt-1">Alla ärenden är hanterade</p>
          </div>
        ) : (
          pendingCases.map((caseItem) => {
            const isExpanded = expandedCase === caseItem.id
            const isOld = isOldRequest(caseItem.created_at)
            const serviceType = caseItem.service_type ? serviceTypeConfig[caseItem.service_type] : null
            
            return (
              <div
                key={caseItem.id}
                className={`
                  bg-slate-800 rounded-lg p-4 transition-all duration-200
                  hover:bg-slate-800/80 hover:scale-[1.02]
                  ${isOld ? 'border border-amber-500/30 shadow-amber-500/10 shadow-lg' : 'border border-slate-700'}
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

                {/* Expand/Collapse Button */}
                <button
                  onClick={() => setExpandedCase(isExpanded ? null : caseItem.id)}
                  className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors mb-3"
                >
                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  <span>{isExpanded ? 'Dölj' : 'Visa'} detaljer</span>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="pt-3 border-t border-slate-700 space-y-3">
                    {/* Description */}
                    {caseItem.description && (
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Beskrivning:</p>
                        <p className="text-sm text-slate-300">{caseItem.description}</p>
                      </div>
                    )}

                    {/* Contact Info */}
                    <div className="space-y-2">
                      <p className="text-xs text-slate-400">Kontaktuppgifter:</p>
                      {caseItem.contact_person && (
                        <div className="flex items-center gap-2 text-sm">
                          <User className="w-3 h-3 text-slate-500" />
                          <span className="text-slate-300">{caseItem.contact_person}</span>
                        </div>
                      )}
                      {caseItem.contact_email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-3 h-3 text-slate-500" />
                          <a href={`mailto:${caseItem.contact_email}`} className="text-blue-400 hover:text-blue-300">
                            {caseItem.contact_email}
                          </a>
                        </div>
                      )}
                      {caseItem.contact_phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-3 h-3 text-slate-500" />
                          <a href={`tel:${caseItem.contact_phone}`} className="text-blue-400 hover:text-blue-300">
                            {caseItem.contact_phone}
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Address */}
                    {caseItem.address?.formatted_address && (
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Adress:</p>
                        <p className="text-sm text-slate-300">{caseItem.address.formatted_address}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Button */}
                <Button
                  onClick={() => onScheduleClick(caseItem)}
                  className="w-full mt-3 bg-emerald-500 hover:bg-emerald-600 text-white"
                  size="sm"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Schemalägg
                </Button>
              </div>
            )
          })
        )}
      </div>

      {/* Footer Stats */}
      {pendingCases.length > 0 && (
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs text-slate-500">Normal</p>
              <p className="text-sm font-medium text-white">
                {pendingCases.filter(c => c.priority === 'normal').length}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Brådskande</p>
              <p className="text-sm font-medium text-red-400">
                {urgentCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Över 24h</p>
              <p className="text-sm font-medium text-amber-400">
                {oldRequestsCount}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PendingRequestsPanel