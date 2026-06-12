import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { isCompletedStatus } from '../../types/database'

interface ServiceExcellenceDashboardProps {
  customer: {
    id: string
    annual_value: number | null
    contract_type: string | null
    contract_start_date: string | null
  }
}

const ServiceExcellenceDashboard: React.FC<ServiceExcellenceDashboardProps> = ({ customer }) => {
  const [activeCasesCount, setActiveCasesCount] = useState<number>(0)
  const [completedInspectionsCount, setCompletedInspectionsCount] = useState<number>(0)
  const [totalInspectionsCount, setTotalInspectionsCount] = useState<number>(0)
  const [nextInspection, setNextInspection] = useState<string | null>(null)
  const [nextVisit, setNextVisit] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: casesData, error: casesError } = await supabase
          .from('cases')
          .select('id, status, scheduled_start, scheduled_end, service_type')
          .eq('customer_id', customer.id)

        if (casesError) throw casesError

        const SCHEDULED_TYPES = ['inspection', 'routine', 'establishment']
        const activeCount = casesData?.filter(caseItem =>
          !isCompletedStatus(caseItem.status) &&
          !SCHEDULED_TYPES.includes(caseItem.service_type ?? '')
        ).length || 0
        setActiveCasesCount(activeCount)

        const totalInspections = casesData?.filter(c => c.service_type === 'inspection').length || 0
        setTotalInspectionsCount(totalInspections)

        const upcomingInspections = casesData
          ?.filter(caseItem => caseItem.scheduled_start && caseItem.service_type === 'inspection')
          ?.map(caseItem => ({
            start: new Date(caseItem.scheduled_start!),
            end: caseItem.scheduled_end ? new Date(caseItem.scheduled_end) : null
          }))
          ?.filter(visit => visit.start > new Date())
          ?.sort((a, b) => a.start.getTime() - b.start.getTime())

        if (upcomingInspections && upcomingInspections.length > 0) {
          const d = upcomingInspections[0]
          setNextInspection(JSON.stringify({ start: d.start.toISOString(), end: d.end?.toISOString() || null }))
        } else {
          setNextInspection(null)
        }

        const upcomingVisits = casesData
          ?.filter(caseItem => caseItem.scheduled_start && caseItem.service_type !== 'inspection')
          ?.map(caseItem => ({
            start: new Date(caseItem.scheduled_start!),
            end: caseItem.scheduled_end ? new Date(caseItem.scheduled_end) : null
          }))
          ?.filter(visit => visit.start > new Date())
          ?.sort((a, b) => a.start.getTime() - b.start.getTime())

        if (upcomingVisits && upcomingVisits.length > 0) {
          const d = upcomingVisits[0]
          setNextVisit(JSON.stringify({ start: d.start.toISOString(), end: d.end?.toISOString() || null }))
        } else {
          setNextVisit(null)
        }

        const inspectionCaseIds = casesData?.filter(c => c.service_type === 'inspection').map(c => c.id) || []
        const { data: inspSessions, error: sessError } = await supabase
          .from('station_inspection_sessions')
          .select(`
            id,
            status,
            case:cases!inner(customer_id)
          `)
          .eq('status', 'completed')
          .eq('cases.customer_id', customer.id)

        if (!sessError && inspSessions) {
          setCompletedInspectionsCount(inspSessions.length)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        setActiveCasesCount(0)
        setCompletedInspectionsCount(0)
        setNextInspection(null)
        setNextVisit(null)
      }
    }

    fetchData()
  }, [customer.id])

  const formatNextDate = (dateString: string | null): { value: string; sub: string } => {
    if (!dateString) return { value: 'Ej schemalagt', sub: '' }
    try {
      const { start, end } = JSON.parse(dateString)
      const startDate = new Date(start)
      const endDate = end ? new Date(end) : null
      const now = new Date()
      const diffDays = Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      const startTime = startDate.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
      const endTime = endDate?.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
      const timeRange = endTime ? `${startTime}–${endTime}` : startTime
      const dateStr = startDate.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })

      if (diffDays === 0) return { value: 'Idag', sub: timeRange }
      if (diffDays === 1) return { value: 'Imorgon', sub: timeRange }
      return { value: dateStr, sub: timeRange }
    } catch {
      return { value: 'Ej schemalagt', sub: '' }
    }
  }

  const nextInspDisplay = formatNextDate(nextInspection)
  const nextVisitDisplay = formatNextDate(nextVisit)

  const cells = [
    {
      label: 'Genomförda servicebesök',
      value: completedInspectionsCount,
      sub: `${completedInspectionsCount}/${totalInspectionsCount} schemalagda`
    },
    {
      label: 'Nästa servicebesök',
      value: nextInspDisplay.value,
      sub: nextInspDisplay.sub
    },
    {
      label: 'Ärenden utöver avtal',
      value: activeCasesCount,
      sub: activeCasesCount === 1 ? 'aktivt ärende' : 'aktiva ärenden'
    },
    {
      label: 'Nästa besök utöver avtal',
      value: nextVisitDisplay.value,
      sub: nextVisitDisplay.sub
    }
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 bg-slate-800/50 border border-slate-700 rounded-xl divide-y divide-slate-700 lg:divide-y-0 lg:divide-x divide-slate-700">
      {cells.map((cell, i) => (
        <div key={i} className="px-5 py-4">
          <p className="text-xs text-slate-500 mb-1">{cell.label}</p>
          <p className="text-2xl font-semibold text-white font-mono leading-tight">
            {cell.value}
          </p>
          {cell.sub && (
            <p className="text-xs text-slate-500 mt-0.5">{cell.sub}</p>
          )}
        </div>
      ))}
    </div>
  )
}

export default ServiceExcellenceDashboard
