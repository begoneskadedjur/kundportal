// src/components/customer/ServiceActivityTimeline.tsx - Service Activity Timeline
import React, { useState, useEffect } from 'react'
import { Clock, CheckCircle, Calendar, Filter, ChevronDown, ChevronRight, Eye, Info, Wrench, XCircle, FileText, Star, AlertCircle } from 'lucide-react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Case, serviceTypeConfig } from '../../types/cases'
import { STATUS_CONFIG, ClickUpStatus, getStatusColor } from '../../types/database'
import ServiceRequestStatus from './ServiceRequestStatus'
import LoadingSpinner from '../shared/LoadingSpinner'
import CaseDetailsModal from './CaseDetailsModal'
import toast from 'react-hot-toast'

interface ServiceActivityTimelineProps {
  customerId: string
}

// Interface for the component

const ServiceActivityTimeline: React.FC<ServiceActivityTimelineProps> = ({ customerId }) => {
  const { profile } = useAuth()
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | ClickUpStatus>('all')
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [selectedCase, setSelectedCase] = useState<Case | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

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
    { value: 'Offert skickad', label: 'Offert skickad' },
    { value: 'Offert signerad - boka in', label: 'Offert signerad' },
    { value: 'Återbesök 1', label: 'Pågående' },
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
              <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
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
          {/* Enhanced vertical line with glow effect */}
          {filteredCases.length > 0 && (
            <div className="absolute left-6 top-0 bottom-0 w-px">
              {/* Main timeline line */}
              <div className="w-full h-full bg-gradient-to-b from-purple-500/60 via-blue-500/40 via-slate-600/30 to-transparent"></div>
              {/* Glow effect */}
              <div className="absolute inset-0 w-px bg-gradient-to-b from-purple-500/20 via-blue-500/10 to-transparent blur-sm"></div>
            </div>
          )}

          {/* Cases */}
          <div className="space-y-6">
            {filteredCases.map((caseItem, index) => {
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
                  {/* Timeline dot with glass morphism */}
                  <div className={`
                    relative z-10 w-12 h-12 rounded-full flex items-center justify-center
                    bg-gradient-to-br from-slate-800/80 to-slate-900/90 backdrop-blur-sm
                    border border-purple-500/20 shadow-lg transition-all duration-300
                    group-hover:scale-110 group-hover:shadow-purple-500/20 group-hover:shadow-xl
                    ${config.textColor}
                  `}>
                    {/* Subtle glow effect */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500/5 to-transparent" />
                    
                    {/* Icon selection */}
                    {status === 'Öppen' && <Clock className="w-5 h-5 animate-pulse relative z-10" />}
                    {(status === 'Bokad' || status === 'Bokat') && <Calendar className="w-5 h-5 relative z-10" />}
                    {status === 'Offert skickad' && <FileText className="w-5 h-5 relative z-10" />}
                    {status === 'Offert signerad - boka in' && <Star className="w-5 h-5 text-purple-400 relative z-10" />}
                    {(status === 'Återbesök 1' || status === 'Återbesök 2' || 
                      status === 'Återbesök 3' || status === 'Återbesök 4' || 
                      status === 'Återbesök 5') && <Wrench className="w-5 h-5 text-blue-400 animate-pulse relative z-10" />}
                    {status === 'Privatperson - review' && <Eye className="w-5 h-5 relative z-10" />}
                    {status === 'Avslutat' && <CheckCircle className="w-5 h-5 text-green-400 relative z-10" />}
                    {status === 'Stängt - slasklogg' && <XCircle className="w-5 h-5 text-red-400 relative z-10" />}
                  </div>

                  {/* Content with glass morphism - Clickable card */}
                  <div className="flex-1 pb-6">
                    <div
                      onClick={() => {
                        setSelectedCase(caseItem)
                        setIsModalOpen(true)
                      }}
                      className="relative overflow-hidden rounded-xl transition-all duration-300 cursor-pointer group-hover:scale-[1.02]"
                    >
                      {/* Glass morphism background */}
                      <div className="absolute inset-0 bg-gradient-to-br from-slate-800/60 via-slate-900/70 to-slate-900/80 backdrop-blur-sm group-hover:from-slate-800/80 group-hover:via-slate-800/70 transition-all" />
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5" />

                      {/* Border glow */}
                      <div className="absolute inset-0 rounded-xl border border-purple-500/20 group-hover:border-purple-500/40 transition-colors" />
                      <div className="absolute inset-0 rounded-xl border border-white/5" />

                      {/* Content */}
                      <div className="relative z-10 p-4">
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
                      <p className="text-sm text-slate-300 line-clamp-2">
                        {caseItem.description}
                      </p>

                      {/* Arrow indicator - shows card is clickable */}
                      <div className="flex items-center justify-end mt-3 pt-3 border-t border-slate-700/30">
                        <span className="text-xs text-slate-500 group-hover:text-slate-300 transition-colors mr-2">
                          Visa detaljer
                        </span>
                        <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>
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

      {/* Case Details Modal */}
      {selectedCase && (
        <CaseDetailsModal
          caseId={selectedCase.id}
          clickupTaskId={selectedCase.clickup_task_id || ''}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setSelectedCase(null)
          }}
          fallbackData={{
            case_number: selectedCase.case_number,
            title: selectedCase.title,
            pest_type: selectedCase.pest_type,
            status: selectedCase.status,
            pest_level: selectedCase.pest_level,
            problem_rating: selectedCase.problem_rating,
            price: selectedCase.price,
            completed_date: selectedCase.completed_date,
            primary_technician_name: selectedCase.primary_technician_name,
            address: selectedCase.address,
            description: selectedCase.description,
            recommendations: selectedCase.recommendations,
            case_type: selectedCase.case_type,
            work_report: selectedCase.work_report,
            materials_used: selectedCase.materials_used,
            time_spent_minutes: selectedCase.time_spent_minutes,
            service_type: selectedCase.service_type,
            priority: selectedCase.priority,
            work_started_at: selectedCase.work_started_at,
            files: selectedCase.files
          }}
        />
      )}
    </Card>
  )
}

export default ServiceActivityTimeline