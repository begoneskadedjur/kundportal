// src/components/organisation/OrganisationActiveCasesList.tsx - Active Cases List för organisationer
import React, { useState, useEffect } from 'react'
import { AlertTriangle, Calendar, Clock, CheckCircle, XCircle } from 'lucide-react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import { supabase } from '../../lib/supabase'
import { useMultisite } from '../../contexts/MultisiteContext'
import { Case } from '../../types/cases'
import LoadingSpinner from '../shared/LoadingSpinner'
import ServiceRequestStatus from '../customer/ServiceRequestStatus'
import { ClickUpStatus } from '../../types/database'
import toast from 'react-hot-toast'

interface OrganisationActiveCasesListProps {
  customerId?: string
  organizationId?: string
  siteIds?: string[]
}

const OrganisationActiveCasesList: React.FC<OrganisationActiveCasesListProps> = ({ 
  customerId,
  organizationId,
  siteIds 
}) => {
  const { organization } = useMultisite()
  const [activeCases, setActiveCases] = useState<Case[]>([])
  const [upcomingCases, setUpcomingCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCases()
    
    // Set up real-time subscription
    let subscription: any
    
    if (customerId) {
      subscription = supabase
        .channel('active-cases-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'cases',
            filter: `customer_id=eq.${customerId}`
          },
          () => {
            fetchCases()
          }
        )
        .subscribe()
    }

    return () => {
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [customerId, organizationId, organization, siteIds])

  const fetchCases = async () => {
    try {
      // Bygga base query
      let customerIds: string[] = []
      
      if (customerId) {
        // Om vi har en specifik customer_id, använd den
        customerIds = [customerId]
      } else if (siteIds && siteIds.length > 0) {
        // Om vi har site IDs, använd dem
        customerIds = siteIds
      } else if (organizationId || organization?.organization_id) {
        // Hämta alla customer_ids för organisationen
        const orgId = organizationId || organization?.organization_id
        const { data: orgSites, error: orgError } = await supabase
          .from('customers')
          .select('id')
          .eq('organization_id', orgId)
          .eq('is_multisite', true)
        
        if (orgError) throw orgError
        
        if (orgSites && orgSites.length > 0) {
          customerIds = orgSites.map(s => s.id)
        }
      }
      
      if (customerIds.length === 0) {
        setActiveCases([])
        setUpcomingCases([])
        setLoading(false)
        return
      }

      // Fetch active cases
      const { data: activeData, error: activeError } = await supabase
        .from('cases')
        .select('id, title, status, priority, scheduled_start, primary_technician_name')
        .in('customer_id', customerIds)
        .in('status', ['Öppen', 'Bokad', 'Bokat', 'Återbesök 1', 'Återbesök 2', 'Återbesök 3', 'Återbesök 4', 'Återbesök 5'] as ClickUpStatus[])
        .order('priority', { ascending: false })
        .limit(10)

      if (activeError && activeError.code !== '400') throw activeError

      // Fetch upcoming scheduled cases
      const { data: upcomingData, error: upcomingError } = await supabase
        .from('cases')
        .select('id, title, status, priority, scheduled_start, primary_technician_name')
        .in('customer_id', customerIds)
        .eq('status', 'Schemalagd' as ClickUpStatus)
        .gte('scheduled_start', new Date().toISOString())
        .order('scheduled_start', { ascending: true })
        .limit(5)

      if (upcomingError && upcomingError.code !== '400') throw upcomingError

      setActiveCases(activeData || [])
      setUpcomingCases(upcomingData || [])
    } catch (error: any) {
      console.error('Error fetching cases:', error)
      // Visa inte toast för 400-fel
      if (error.code !== '400') {
        toast.error('Kunde inte hämta aktiva ärenden')
      }
      setActiveCases([])
      setUpcomingCases([])
    } finally {
      setLoading(false)
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      case 'high':
        return <Clock className="w-4 h-4 text-amber-500" />
      default:
        return <Calendar className="w-4 h-4 text-slate-400" />
    }
  }

  const formatScheduledDate = (date: string | null) => {
    if (!date) return 'Ej schemalagt'
    
    const scheduled = new Date(date)
    const today = new Date()
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    if (scheduled.toDateString() === today.toDateString()) {
      return `Idag ${scheduled.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`
    } else if (scheduled.toDateString() === tomorrow.toDateString()) {
      return `Imorgon ${scheduled.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`
    } else {
      return scheduled.toLocaleDateString('sv-SE', { 
        day: 'numeric', 
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }

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
    <div className="space-y-6">
      {/* Active Cases */}
      <Card className="bg-gradient-to-br from-slate-800 to-slate-800/50 border-slate-700">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Aktiva ärenden</h3>
              <p className="text-sm text-slate-400">
                {organizationId || organization ? 'Organisationens pågående ärenden' : 'Ärenden som kräver åtgärd'}
              </p>
            </div>
          </div>

          {activeCases.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-slate-400">Inga aktiva ärenden just nu</p>
              <p className="text-sm text-slate-500 mt-1">Alla ärenden är hanterade</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeCases.map(caseItem => (
                <div key={caseItem.id} className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/50 hover:bg-slate-700/40 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-white">{caseItem.title}</h4>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-1">
                          {getPriorityIcon(caseItem.priority || 'normal')}
                          <span className="text-xs text-slate-400">
                            {caseItem.priority === 'urgent' ? 'Brådskande' : 
                             caseItem.priority === 'high' ? 'Hög prioritet' : 'Normal'}
                          </span>
                        </div>
                        {caseItem.primary_technician_name && (
                          <>
                            <div className="w-1 h-1 bg-slate-600 rounded-full"></div>
                            <span className="text-xs text-slate-400">{caseItem.primary_technician_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <ServiceRequestStatus 
                      status={caseItem.status as ClickUpStatus} 
                      size="sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Upcoming Scheduled */}
      {upcomingCases.length > 0 && (
        <Card className="bg-gradient-to-br from-slate-800 to-slate-800/50 border-slate-700">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Kommande besök</h3>
                <p className="text-sm text-slate-400">Schemalagda servicebesök</p>
              </div>
            </div>

            <div className="space-y-3">
              {upcomingCases.map(caseItem => (
                <div key={caseItem.id} className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/50">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-white">{caseItem.title}</h4>
                      <p className="text-sm text-blue-400 mt-1">
                        {formatScheduledDate(caseItem.scheduled_start)}
                      </p>
                      {caseItem.primary_technician_name && (
                        <p className="text-xs text-slate-500 mt-1">
                          Tekniker: {caseItem.primary_technician_name}
                        </p>
                      )}
                    </div>
                    <Calendar className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

export default OrganisationActiveCasesList