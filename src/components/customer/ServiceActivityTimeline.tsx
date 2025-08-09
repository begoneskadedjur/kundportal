// src/components/customer/ServiceActivityTimeline.tsx - Service Activity Timeline
import React, { useState, useEffect } from 'react'
import { Clock, CheckCircle, AlertCircle, Calendar, Filter, ChevronDown, Eye, Info, Wrench, XCircle } from 'lucide-react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Case, serviceTypeConfig } from '../../types/cases'
import { STATUS_CONFIG, ClickUpStatus, getStatusColor } from '../../types/database'
import ServiceRequestStatus from './ServiceRequestStatus'
import LoadingSpinner from '../shared/LoadingSpinner'
import toast from 'react-hot-toast'

interface ServiceActivityTimelineProps {
  customerId: string
}

const ServiceActivityTimeline: React.FC<ServiceActivityTimelineProps> = ({ customerId }) => {
  const { profile } = useAuth()
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | ClickUpStatus>('all')
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [expandedCase, setExpandedCase] = useState<string | null>(null)

  // Fetch cases from database
  useEffect(() => {
    if (profile?.customer_id) {
      fetchCases()
      
      // Set up real-time subscription
      const subscription = supabase
        .channel('cases-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'cases',
            filter: `customer_id=eq.${profile.customer_id}`
          },
          () => {
            fetchCases() // Refetch on any change
          }
        )
        .subscribe()

      return () => {
        subscription.unsubscribe()
      }
    }
  }, [profile?.customer_id])

  const fetchCases = async () => {
    if (!profile?.customer_id) return

    try {
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .eq('customer_id', profile.customer_id)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      setCases(data || [])
    } catch (error: any) {
      console.error('Error fetching cases:', error)
      toast.error('Kunde inte hämta ärenden')
    } finally {
      setLoading(false)
    }
  }

  const filteredCases = filter === 'all' 
    ? cases 
    : cases.filter(c => c.status === filter)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusCounts = () => {
    const counts: Record<string, number> = {
      all: cases.length,
      'Öppen': 0,
      'Bokad': 0,
      'Bokat': 0,
      'Pågående': 0,
      'Avslutat': 0,
      'Stängt - slasklogg': 0
    }
    
    cases.forEach(c => {
      counts[c.status] = (counts[c.status] || 0) + 1
    })
    
    return counts
  }

  const counts = getStatusCounts()

  const filterOptions: Array<{ value: 'all' | ClickUpStatus, label: string }> = [
    { value: 'all', label: 'Alla ärenden' },
    { value: 'Öppen', label: 'Väntar på svar' },
    { value: 'Bokad', label: 'Schemalagda' },
    { value: 'Pågående', label: 'Pågående' },
    { value: 'Avslutat', label: 'Slutförda' },
    { value: 'Stängt - slasklogg', label: 'Stängda' }
  ]

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-slate-800 to-slate-800/50 border-slate-700 p-6">
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      </Card>
    )
  }

  return (
    <Card className="bg-gradient-to-br from-slate-800 to-slate-800/50 border-slate-700">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Servicehistorik</h3>
              <p className="text-sm text-slate-400">Era serviceärenden och förfrågningar</p>
            </div>
          </div>

          {/* Filter Dropdown */}
          <div className="relative">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Filter</span>
              <ChevronDown className="w-3 h-3" />
            </Button>

            {showFilterDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10">
                {filterOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setFilter(option.value)
                      setShowFilterDropdown(false)
                    }}
                    className={`
                      w-full px-4 py-2 text-left text-sm hover:bg-slate-700 transition-colors
                      ${filter === option.value ? 'bg-slate-700/50 text-white' : 'text-slate-300'}
                      ${option.value !== 'all' ? 'border-t border-slate-700/50' : ''}
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <span>{option.label}</span>
                      <span className="text-xs text-slate-500">{counts[option.value]}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Priority Notice for Requested Cases */}
        {counts['Öppen'] > 0 && filter === 'all' && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-400 font-medium">
                  {counts['Öppen']} förfrågan{counts['Öppen'] > 1 ? 'ar' : ''} väntar på svar
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Vi återkommer inom 24 timmar med förslag på tid
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          {filteredCases.length > 0 && (
            <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-blue-500/50 via-slate-700 to-transparent"></div>
          )}

          {/* Cases */}
          <div className="space-y-6">
            {filteredCases.map((caseItem, index) => {
              const isExpanded = expandedCase === caseItem.id
              
              // Get status config from database types
              const status = caseItem.status as ClickUpStatus
              const statusColor = getStatusColor(status)
              const config = {
                bgColor: `bg-[${statusColor}]/10`,
                borderColor: `border-[${statusColor}]/20`,
                textColor: `text-[${statusColor}]`
              }
              const serviceType = caseItem.service_type ? serviceTypeConfig[caseItem.service_type] : null
              
              return (
                <div key={caseItem.id} className="relative flex gap-4 group">
                  {/* Timeline dot */}
                  <div className={`
                    relative z-10 w-12 h-12 rounded-full flex items-center justify-center
                    ${config.bgColor} ${config.borderColor} ${config.textColor} border transition-all duration-300
                    group-hover:scale-110
                  `}>
                    {status === 'Öppen' && <Clock className="w-5 h-5" />}
                    {(status === 'Bokad' || status === 'Bokat') && <Calendar className="w-5 h-5" />}
                    {status === 'Pågående' && <Wrench className="w-5 h-5" />}
                    {status === 'Avslutat' && <CheckCircle className="w-5 h-5" />}
                    {status === 'Stängt - slasklogg' && <XCircle className="w-5 h-5" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-6">
                    <div className="bg-slate-900/30 rounded-lg p-4 border border-slate-700/50 hover:border-slate-600 transition-all">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h4 className="text-white font-medium">{caseItem.title}</h4>
                            <span className="text-xs text-slate-500 font-mono">#{caseItem.case_number}</span>
                          </div>
                          <p className="text-xs text-slate-500">{formatDate(caseItem.created_at)}</p>
                        </div>
                        <ServiceRequestStatus 
                          status={status}
                          size="sm"
                          scheduledDate={caseItem.scheduled_start}
                          technicianName={caseItem.primary_technician_name}
                        />
                      </div>

                      {/* Service Type & Priority */}
                      <div className="flex items-center gap-3 mb-3">
                        {serviceType && (
                          <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400">
                            {serviceType.label}
                          </span>
                        )}
                        {caseItem.priority === 'urgent' && (
                          <span className="text-xs bg-red-500/10 text-red-400 px-2 py-1 rounded">
                            Brådskande
                          </span>
                        )}
                        {caseItem.pest_type && (
                          <span className="text-xs bg-purple-500/10 text-purple-400 px-2 py-1 rounded">
                            {caseItem.pest_type}
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-sm text-slate-300 mb-3 line-clamp-2">
                        {caseItem.description}
                      </p>

                      {/* Expand/Collapse Button */}
                      <button
                        onClick={() => setExpandedCase(isExpanded ? null : caseItem.id)}
                        className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        <span>{isExpanded ? 'Dölj detaljer' : 'Visa detaljer'}</span>
                      </button>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-3">
                          {/* Work Report */}
                          {caseItem.work_report && (
                            <div>
                              <h5 className="text-xs font-medium text-slate-400 mb-1">Arbetsrapport</h5>
                              <p className="text-sm text-slate-300 bg-slate-800/50 p-3 rounded">
                                {caseItem.work_report}
                              </p>
                            </div>
                          )}

                          {/* Materials/Products Used - Safety Information */}
                          {caseItem.materials_used && (
                            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                              <div className="flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                <div>
                                  <h5 className="text-xs font-medium text-amber-400 mb-1">Använda preparat & säkerhetsinformation</h5>
                                  <p className="text-sm text-slate-300 whitespace-pre-wrap">
                                    {caseItem.materials_used}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Recommendations */}
                          {caseItem.recommendations && (
                            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                              <div className="flex items-start gap-2">
                                <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                                <div>
                                  <h5 className="text-xs font-medium text-blue-400 mb-1">Rekommendationer</h5>
                                  <p className="text-sm text-slate-300">
                                    {caseItem.recommendations}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Technician Info */}
                          {caseItem.primary_technician_name && (
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                              <div className="w-6 h-6 bg-slate-700 rounded-full flex items-center justify-center">
                                <span className="text-[10px] text-slate-300 font-medium">
                                  {caseItem.primary_technician_name.split(' ').map(n => n[0]).join('')}
                                </span>
                              </div>
                              <span>Tekniker: {caseItem.primary_technician_name}</span>
                              {caseItem.completed_date && (
                                <>
                                  <div className="w-1 h-1 bg-slate-600 rounded-full"></div>
                                  <span>Slutfört: {formatDate(caseItem.completed_date)}</span>
                                </>
                              )}
                            </div>
                          )}

                          {/* Price (if visible to customer) */}
                          {caseItem.price && caseItem.status === 'completed' && (
                            <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
                              <span className="text-sm text-slate-400">Kostnad</span>
                              <span className="text-sm font-medium text-white">
                                {caseItem.price.toLocaleString('sv-SE')} kr
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Empty State */}
          {filteredCases.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-700/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-slate-600" />
              </div>
              <p className="text-slate-400">
                {filter === 'all' 
                  ? 'Inga serviceärenden än'
                  : `Inga ${filterOptions.find(o => o.value === filter)?.label.toLowerCase()}`}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Skapa en serviceförfrågan för att komma igång
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

export default ServiceActivityTimeline