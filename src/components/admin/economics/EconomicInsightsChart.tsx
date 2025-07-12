// 📁 src/components/admin/economics/EconomicInsightsChart.tsx - FIXAD JSX STRUKTUR
import React, { useState, useEffect, useMemo } from 'react'
import { TrendingUp, Award, Bug, Building2, Eye, Calendar, User, DollarSign, Phone, Mail, MapPin, X } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { formatCurrency } from '../../../utils/formatters'

// Moderna komponenter
import ModernCard from '../../ui/ModernCard'
import { CombinedNavigation } from '../../ui/ModernNavigation'

// 🎯 Interfaces
interface TopCase {
  id: string
  case_number?: string
  title?: string
  type: 'private' | 'business'
  pris: number
  completed_date: string
  primary_assignee_name: string
  primary_assignee_email?: string
  skadedjur: string
  address?: any
  description?: string
  kontaktperson?: string
  telefon_kontaktperson?: string
  e_post_kontaktperson?: string
  org_nr?: string
  bestallare?: string
}

interface TopSkadedjur {
  type: string
  total_revenue: number
  case_count: number
  avg_price: number
  recent_cases: Array<{
    id: string
    pris: number
    completed_date: string
    technician: string
  }>
}

interface PotentialContract {
  customer_identifier: string
  contact_person: string
  phone?: string
  email?: string
  org_nr?: string
  case_count: number
  total_revenue: number
  avg_case_value: number
  latest_case_date: string
  case_details: Array<{
    id: string
    pris: number
    completed_date: string
    skadedjur: string
  }>
}

interface InsightsData {
  topCases: TopCase[]
  topSkadedjur: TopSkadedjur[]
  potentialContracts: PotentialContract[]
}

interface CaseDetailsModalProps {
  case_: TopCase | null
  isOpen: boolean
  onClose: () => void
}

// 🔍 Modal för ärendedetaljer
const CaseDetailsModal: React.FC<CaseDetailsModalProps> = ({ case_, isOpen, onClose }) => {
  if (!isOpen || !case_) return null

  const formatAddress = (address: any) => {
    if (!address) return 'Ingen adress angiven'
    if (typeof address === 'string') return address
    if (typeof address === 'object') {
      return `${address.street || ''} ${address.city || ''}`.trim() || 'Ingen adress angiven'
    }
    return 'Ingen adress angiven'
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              case_.type === 'private' ? 'bg-purple-500/20' : 'bg-blue-500/20'
            }`}>
              {case_.type === 'private' ? (
                <User className="w-5 h-5 text-purple-500" />
              ) : (
                <Building2 className="w-5 h-5 text-blue-500" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {case_.case_number || case_.title || `Ärende ${case_.id.slice(0, 8)}`}
              </h2>
              <p className="text-sm text-slate-400">
                {case_.type === 'private' ? 'Privatperson' : 'Företag'} • {formatCurrency(case_.pris)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Innehåll */}
        <div className="p-6 space-y-6">
          {/* Grundläggande info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Ärendeinfo
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Slutfört:</span>
                  <span className="text-white">
                    {new Date(case_.completed_date).toLocaleDateString('sv-SE')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Skadedjur:</span>
                  <span className="text-white">{case_.skadedjur || 'Ej angivet'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Pris:</span>
                  <span className="text-green-400 font-semibold">{formatCurrency(case_.pris)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <User className="w-4 h-4" />
                Tekniker
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Namn:</span>
                  <span className="text-white">{case_.primary_assignee_name || 'Ej tilldelad'}</span>
                </div>
                {case_.primary_assignee_email && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Email:</span>
                    <span className="text-white">{case_.primary_assignee_email}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Kundinfo */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              {case_.type === 'private' ? <User className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
              Kunduppgifter
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {case_.kontaktperson && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Kontaktperson:</span>
                  <span className="text-white">{case_.kontaktperson}</span>
                </div>
              )}
              {case_.telefon_kontaktperson && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Telefon:</span>
                  <span className="text-white">{case_.telefon_kontaktperson}</span>
                </div>
              )}
              {case_.e_post_kontaktperson && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Email:</span>
                  <span className="text-white">{case_.e_post_kontaktperson}</span>
                </div>
              )}
              {case_.org_nr && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Org.nr:</span>
                  <span className="text-white">{case_.org_nr}</span>
                </div>
              )}
              {case_.bestallare && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Beställare:</span>
                  <span className="text-white">{case_.bestallare}</span>
                </div>
              )}
            </div>
          </div>

          {/* Adress */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Adress
            </h3>
            <p className="text-sm text-white bg-slate-800/50 p-3 rounded-lg">
              {formatAddress(case_.address)}
            </p>
          </div>

          {/* Beskrivning */}
          {case_.description && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-300">Beskrivning</h3>
              <p className="text-sm text-white bg-slate-800/50 p-3 rounded-lg">
                {case_.description}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const EconomicInsightsChart: React.FC = () => {
  // State
  const [data, setData] = useState<InsightsData>({
    topCases: [],
    topSkadedjur: [],
    potentialContracts: []
  })
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  
  const [selectedPeriod, setSelectedPeriod] = useState<'1m' | '3m' | '6m' | '12m'>('6m')
  const [activeView, setActiveView] = useState<'cases' | 'skadedjur' | 'contracts'>('cases')
  
  // Modal state
  const [selectedCase, setSelectedCase] = useState<TopCase | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Period options
  const periodOptions = [
    { key: '1m', label: '1 månad', shortLabel: '1M' },
    { key: '3m', label: '3 månader', shortLabel: '3M' },
    { key: '6m', label: '6 månader', shortLabel: '6M' },
    { key: '12m', label: '12 månader', shortLabel: '12M' }
  ]

  // View tabs - UPPDATERAD med "Försäljningsmöjligheter"
  const viewOptions = [
    { key: 'cases', label: 'Topp Ärenden', icon: Award, color: 'text-yellow-500' },
    { key: 'skadedjur', label: 'Skadedjur', icon: Bug, color: 'text-red-500' },
    { key: 'contracts', label: 'Försäljningsmöjligheter', icon: Building2, color: 'text-green-500' }
  ]

  useEffect(() => {
    fetchInsightsData()
  }, [])

  // 🔄 Hämta insights data
  const fetchInsightsData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('🔄 Fetching insights data...')
      
      const twelveMonthsAgo = new Date()
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
      const dateString = twelveMonthsAgo.toISOString().split('T')[0]

      // Hämta alla avslutade ärenden från BeGone
      const [privateResult, businessResult] = await Promise.all([
        supabase
          .from('private_cases')
          .select(`
            id, case_number, title, pris, completed_date, 
            primary_assignee_name, primary_assignee_email,
            skadedjur, adress, description, kontaktperson,
            telefon_kontaktperson, e_post_kontaktperson
          `)
          .eq('status', 'Avslutat')
          .gte('completed_date', dateString)
          .not('completed_date', 'is', null)
          .not('pris', 'is', null)
          .order('pris', { ascending: false }),
        
        supabase
          .from('business_cases')
          .select(`
            id, case_number, title, pris, completed_date,
            primary_assignee_name, primary_assignee_email,
            skadedjur, adress, description, kontaktperson,
            telefon_kontaktperson, e_post_kontaktperson,
            org_nr, bestallare
          `)
          .eq('status', 'Avslutat')
          .gte('completed_date', dateString)
          .not('completed_date', 'is', null)
          .not('pris', 'is', null)
          .order('pris', { ascending: false })
      ])

      if (privateResult.error) throw new Error(`Private cases: ${privateResult.error.message}`)
      if (businessResult.error) throw new Error(`Business cases: ${businessResult.error.message}`)

      const allCases = [
        ...(privateResult.data || []).map(case_ => ({ ...case_, type: 'private' as const })),
        ...(businessResult.data || []).map(case_ => ({ ...case_, type: 'business' as const }))
      ]

      console.log(`📊 Loaded ${allCases.length} total cases for insights analysis`)

      // Processa data
      const insights = processInsightsData(allCases)
      setData(insights)
      
      console.log('✅ Insights data processed successfully')
      
    } catch (err) {
      console.error('❌ fetchInsightsData error:', err)
      setError(err instanceof Error ? err.message : 'Fel vid hämtning av insights data')
    } finally {
      setLoading(false)
    }
  }

  // 📊 Processa insights data
  const processInsightsData = (allCases: any[]): InsightsData => {
    // 1. TOP CASES - sortera efter pris
    const topCases = allCases
      .filter(case_ => case_.pris > 0)
      .sort((a, b) => b.pris - a.pris)
      .slice(0, 10)
      .map(case_ => ({
        id: case_.id,
        case_number: case_.case_number,
        title: case_.title,
        type: case_.type,
        pris: case_.pris,
        completed_date: case_.completed_date,
        primary_assignee_name: case_.primary_assignee_name || 'Ej tilldelad',
        primary_assignee_email: case_.primary_assignee_email,
        skadedjur: case_.skadedjur || 'Okänt',
        address: case_.adress,
        description: case_.description,
        kontaktperson: case_.kontaktperson,
        telefon_kontaktperson: case_.telefon_kontaktperson,
        e_post_kontaktperson: case_.e_post_kontaktperson,
        org_nr: case_.org_nr,
        bestallare: case_.bestallare
      }))

    // 2. TOP SKADEDJUR - gruppera efter skadedjur och summera intäkter
    const skadedjurStats: { [key: string]: { revenue: number; cases: any[]; count: number } } = {}
    
    allCases.forEach(case_ => {
      const skadedjur = case_.skadedjur || 'Okänt'
      if (!skadedjurStats[skadedjur]) {
        skadedjurStats[skadedjur] = { revenue: 0, cases: [], count: 0 }
      }
      skadedjurStats[skadedjur].revenue += case_.pris
      skadedjurStats[skadedjur].count++
      skadedjurStats[skadedjur].cases.push({
        id: case_.id,
        pris: case_.pris,
        completed_date: case_.completed_date,
        technician: case_.primary_assignee_name || 'Ej tilldelad'
      })
    })

    const topSkadedjur = Object.entries(skadedjurStats)
      .map(([type, stats]) => ({
        type,
        total_revenue: stats.revenue,
        case_count: stats.count,
        avg_price: stats.count > 0 ? stats.revenue / stats.count : 0,
        recent_cases: stats.cases
          .sort((a, b) => new Date(b.completed_date).getTime() - new Date(a.completed_date).getTime())
          .slice(0, 5)
      }))
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, 10)

    // 3. POTENTIAL CONTRACTS - använd org_nr för korrekt företagsidentifiering
    const businessCustomers: { [key: string]: { 
      cases: any[]; 
      contact_person: string; 
      phone?: string; 
      email?: string; 
      org_nr: string;
      company_name?: string;
    } } = {}
    
    allCases
      .filter(case_ => case_.type === 'business' && case_.org_nr)
      .forEach(case_ => {
        const orgNr = case_.org_nr
        if (!orgNr) return
        
        if (!businessCustomers[orgNr]) {
          businessCustomers[orgNr] = {
            cases: [],
            contact_person: case_.kontaktperson || case_.bestallare || 'Okänd kontakt',
            phone: case_.telefon_kontaktperson,
            email: case_.e_post_kontaktperson,
            org_nr: orgNr,
            company_name: case_.bestallare || case_.kontaktperson
          }
        }
        
        businessCustomers[orgNr].cases.push({
          id: case_.id,
          pris: case_.pris,
          completed_date: case_.completed_date,
          skadedjur: case_.skadedjur || 'Okänt'
        })
      })

    const potentialContracts = Object.entries(businessCustomers)
      .filter(([_, customer]) => customer.cases.length >= 2) // Minst 2 ärenden
      .map(([orgNr, customer]) => {
        const totalRevenue = customer.cases.reduce((sum, case_) => sum + case_.pris, 0)
        const latestCase = customer.cases.sort((a, b) => 
          new Date(b.completed_date).getTime() - new Date(a.completed_date).getTime()
        )[0]
        
        return {
          customer_identifier: `${customer.company_name} (${orgNr})`,
          contact_person: customer.contact_person,
          phone: customer.phone,
          email: customer.email,
          org_nr: orgNr,
          case_count: customer.cases.length,
          total_revenue: totalRevenue,
          avg_case_value: totalRevenue / customer.cases.length,
          latest_case_date: latestCase.completed_date,
          case_details: customer.cases.sort((a, b) => 
            new Date(b.completed_date).getTime() - new Date(a.completed_date).getTime()
          )
        }
      })
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, 15)

    return {
      topCases,
      topSkadedjur,
      potentialContracts
    }
  }

  // 🎯 Filtrerad data baserat på period - FIXAD FILTERLOGIK
  const getFilteredData = useMemo(() => {
    console.log(`🔍 Filtering data for period: ${selectedPeriod}, month: ${selectedMonth}`)
    
    // Bestäm datumspan
    const selectedDate = new Date(selectedMonth + '-01')
    const endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0)
    
    let startDate: Date
    switch (selectedPeriod) {
      case '1m':
        startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
        break
      case '3m':
        startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 2, 1)
        break
      case '6m':
        startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 5, 1)
        break
      case '12m':
        startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 11, 1)
        break
    }

    console.log(`📅 Date range: ${startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)}`)

    const filterByDate = (dateString: string) => {
      const caseDate = new Date(dateString)
      return caseDate >= startDate && caseDate <= endDate
    }

    // Filtrera rådata baserat på period och skapa nya aggregeringar
    const filteredRawCases = [
      ...data.topCases.filter(case_ => filterByDate(case_.completed_date)),
      // Hämta även från andra cases som inte är i top 10 men inom period
    ]

    // 1. TOPP CASES - alltid från ALL rådata, filtrera och sortera om
    const allFilteredCases = data.topCases.filter(case_ => filterByDate(case_.completed_date))
    const topCasesForPeriod = allFilteredCases
      .sort((a, b) => b.pris - a.pris)
      .slice(0, 10)

    console.log(`📊 Top cases for period: ${topCasesForPeriod.length} (från ${allFilteredCases.length} filtrerade)`)

    // 2. SKADEDJUR - omberäkna från grunden för period
    const skadedjurStatsForPeriod: { [key: string]: { revenue: number; cases: any[]; count: number } } = {}
    
    allFilteredCases.forEach(case_ => {
      const skadedjur = case_.skadedjur || 'Okänt'
      if (!skadedjurStatsForPeriod[skadedjur]) {
        skadedjurStatsForPeriod[skadedjur] = { revenue: 0, cases: [], count: 0 }
      }
      skadedjurStatsForPeriod[skadedjur].revenue += case_.pris
      skadedjurStatsForPeriod[skadedjur].count++
      skadedjurStatsForPeriod[skadedjur].cases.push({
        id: case_.id,
        pris: case_.pris,
        completed_date: case_.completed_date,
        technician: case_.primary_assignee_name || 'Ej tilldelad'
      })
    })

    const topSkadedjurForPeriod = Object.entries(skadedjurStatsForPeriod)
      .map(([type, stats]) => ({
        type,
        total_revenue: stats.revenue,
        case_count: stats.count,
        avg_price: stats.count > 0 ? stats.revenue / stats.count : 0,
        recent_cases: stats.cases
          .sort((a, b) => new Date(b.completed_date).getTime() - new Date(a.completed_date).getTime())
          .slice(0, 5)
      }))
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, 10)

    console.log(`🐛 Skadedjur for period: ${topSkadedjurForPeriod.length}`)
    console.log('Top skadedjur:', topSkadedjurForPeriod.slice(0, 3).map(s => `${s.type}: ${s.total_revenue}kr`))

    // 3. FÖRSÄLJNINGSMÖJLIGHETER - omberäkna från grunden baserat på org_nr
    const businessCustomersForPeriod: { [key: string]: { 
      cases: any[]; 
      contact_person: string; 
      phone?: string; 
      email?: string; 
      org_nr: string;
      company_name?: string;
    } } = {}
    
    const businessCasesForPeriod = allFilteredCases.filter(case_ => case_.type === 'business' && case_.org_nr)
    
    businessCasesForPeriod.forEach(case_ => {
      const orgNr = case_.org_nr
      if (!orgNr) return
      
      if (!businessCustomersForPeriod[orgNr]) {
        businessCustomersForPeriod[orgNr] = {
          cases: [],
          contact_person: case_.kontaktperson || case_.bestallare || 'Okänd kontakt',
          phone: case_.telefon_kontaktperson,
          email: case_.e_post_kontaktperson,
          org_nr: orgNr,
          company_name: case_.bestallare || case_.kontaktperson
        }
      }
      
      businessCustomersForPeriod[orgNr].cases.push({
        id: case_.id,
        pris: case_.pris,
        completed_date: case_.completed_date,
        skadedjur: case_.skadedjur || 'Okänt'
      })
    })

    const potentialContractsForPeriod = Object.entries(businessCustomersForPeriod)
      .filter(([_, customer]) => customer.cases.length >= 2) // Minst 2 ärenden
      .map(([orgNr, customer]) => {
        const totalRevenue = customer.cases.reduce((sum, case_) => sum + case_.pris, 0)
        const latestCase = customer.cases.sort((a, b) => 
          new Date(b.completed_date).getTime() - new Date(a.completed_date).getTime()
        )[0]
        
        return {
          customer_identifier: `${customer.company_name} (${orgNr})`,
          contact_person: customer.contact_person,
          phone: customer.phone,
          email: customer.email,
          org_nr: orgNr,
          case_count: customer.cases.length,
          total_revenue: totalRevenue,
          avg_case_value: totalRevenue / customer.cases.length,
          latest_case_date: latestCase.completed_date,
          case_details: customer.cases.sort((a, b) => 
            new Date(b.completed_date).getTime() - new Date(a.completed_date).getTime()
          )
        }
      })
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, 15)

    console.log(`🏢 Försäljningsmöjligheter for period: ${potentialContractsForPeriod.length}`)

    return {
      topCases: topCasesForPeriod,
      topSkadedjur: topSkadedjurForPeriod,
      potentialContracts: potentialContractsForPeriod
    }
  }, [data, selectedMonth, selectedPeriod])

  // Navigation functions
  const canGoPrevious = () => {
    return true
  }

  const canGoNext = () => {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return selectedMonth < currentMonth
  }

  const isCurrentMonth = () => {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return selectedMonth === currentMonth
  }

  const goToCurrentMonth = () => {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonth(currentMonth)
  }

  const formatSelectedMonth = (monthStr: string) => {
    const date = new Date(monthStr + '-01')
    return date.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })
  }

  // Handle case click
  const handleCaseClick = (case_: TopCase) => {
    setSelectedCase(case_)
    setIsModalOpen(true)
  }

  // Loading state
  if (loading) {
    return (
      <ModernCard gradient="purple" glowing>
        <ModernCard.Header
          icon={TrendingUp}
          iconColor="text-purple-500"
          title="Ekonomiska Insights"
          subtitle="Laddar data..."
        />
        <ModernCard.Content>
          <div className="h-80 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
              <p className="text-slate-400 text-sm">Laddar insights data...</p>
            </div>
          </div>
        </ModernCard.Content>
      </ModernCard>
    )
  }

  // Error state
  if (error) {
    return (
      <ModernCard gradient="red" glowing>
        <ModernCard.Header
          icon={TrendingUp}
          iconColor="text-red-500"
          title="Ekonomiska Insights"
          subtitle="Fel vid laddning"
        />
        <ModernCard.Content>
          <div className="h-80 flex items-center justify-center text-red-400">
            <div className="text-center">
              <p className="mb-2">Fel vid laddning: {error}</p>
              <button
                onClick={fetchInsightsData}
                className="flex items-center gap-2 mx-auto px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Försök igen
              </button>
            </div>
          </div>
        </ModernCard.Content>
      </ModernCard>
    )
  }

  const filteredData = getFilteredData

  return (
    <div className="space-y-6">
      {/* Header med navigation och tabs */}
      <ModernCard gradient="purple" glowing>
        <div className="p-6">
          <div className="flex flex-col gap-4 mb-6">
            {/* Titel rad */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Ekonomiska Insights</h2>
                <p className="text-sm text-slate-400">Topp ärenden, skadedjur & avtalsmöjligheter</p>
              </div>
            </div>

            {/* Navigation och View Tabs */}
            <div className="flex flex-col sm:flex-row gap-3">
              <CombinedNavigation
                selectedMonth={selectedMonth}
                onMonthChange={setSelectedMonth}
                selectedPeriod={selectedPeriod}
                onPeriodChange={(period) => setSelectedPeriod(period as '1m' | '3m' | '6m' | '12m')}
                periods={periodOptions}
                canGoPrevious={canGoPrevious()}
                canGoNext={canGoNext()}
                onGoToCurrent={goToCurrentMonth}
                isCurrentMonth={isCurrentMonth()}
                compact
                className="flex-1"
              />
              
              {/* View tabs */}
              <div className="flex bg-slate-800/50 border border-slate-700/50 rounded-lg p-1">
                {viewOptions.map((view) => {
                  const IconComponent = view.icon
                  const isActive = activeView === view.key
                  return (
                    <button
                      key={view.key}
                      onClick={() => setActiveView(view.key as any)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-slate-700 text-white border border-slate-600 shadow-sm'
                          : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                      }`}
                    >
                      <IconComponent className={`w-3 h-3 ${isActive ? view.color : 'text-slate-500'}`} />
                      <span className="hidden sm:inline">{view.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Sammanfattning för period */}
          <div className="mb-6">
            <h3 className="text-sm text-slate-400 mb-4">
              {selectedPeriod === '1m' 
                ? `${formatSelectedMonth(selectedMonth)} - Insights översikt`
                : `${formatSelectedMonth(selectedMonth)} (${selectedPeriod.toUpperCase()} period) - Insights översikt`
              }
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-yellow-400 font-bold text-lg">{filteredData.topCases.length}</p>
                <p className="text-yellow-300 text-sm">Topp ärenden</p>
                <p className="text-xs text-slate-400 mt-1">
                  Högsta: {filteredData.topCases[0] ? formatCurrency(filteredData.topCases[0].pris) : 'N/A'}
                </p>
              </div>
              <div className="text-center p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-400 font-bold text-lg">{filteredData.topSkadedjur.length}</p>
                <p className="text-red-300 text-sm">Skadedjurstyper</p>
                <p className="text-xs text-slate-400 mt-1">
                  Mest lönsamt: {filteredData.topSkadedjur[0]?.type || 'N/A'}
                </p>
              </div>
              <div className="text-center p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-green-400 font-bold text-lg">{filteredData.potentialContracts.length}</p>
                <p className="text-green-300 text-sm">Försäljningsmöjligheter</p>
                <p className="text-xs text-slate-400 mt-1">
                  Totalt värde: {formatCurrency(filteredData.potentialContracts.reduce((sum, c) => sum + c.total_revenue, 0))}
                </p>
              </div>
            </div>
          </div>
        </div>
      </ModernCard>

      {/* Innehåll baserat på vald view */}
      {activeView === 'cases' && (
        <ModernCard>
          <ModernCard.Header
            icon={Award}
            iconColor="text-yellow-500"
            title="Topp 10 Högsta Ärenden"
            subtitle={`Sorterat efter intäkt för ${selectedPeriod.toUpperCase()} period`}
          />
          <ModernCard.Content>
            {filteredData.topCases.length > 0 ? (
              <div className="space-y-3">
                {filteredData.topCases.map((case_, index) => (
                  <div
                    key={case_.id}
                    onClick={() => handleCaseClick(case_)}
                    className="flex items-center justify-between p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg hover:bg-slate-700/50 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      {/* Ranking */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                        index === 0 ? 'bg-yellow-500' :
                        index === 1 ? 'bg-gray-400' :
                        index === 2 ? 'bg-amber-600' :
                        'bg-slate-600'
                      }`}>
                        {index + 1}
                      </div>
                      
                      {/* Case info */}
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          case_.type === 'private' ? 'bg-purple-500/20' : 'bg-blue-500/20'
                        }`}>
                          {case_.type === 'private' ? (
                            <User className="w-4 h-4 text-purple-500" />
                          ) : (
                            <Building2 className="w-4 h-4 text-blue-500" />
                          )}
                        </div>
                        <div>
                          <p className="text-white font-medium">
                            {case_.case_number || case_.title || `Ärende ${case_.id.slice(0, 8)}`}
                          </p>
                          <p className="text-sm text-slate-400">
                            {case_.skadedjur} • {case_.primary_assignee_name} • {new Date(case_.completed_date).toLocaleDateString('sv-SE')}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-green-400 font-bold text-lg">{formatCurrency(case_.pris)}</p>
                        <p className="text-xs text-slate-400">{case_.type === 'private' ? 'Privatperson' : 'Företag'}</p>
                      </div>
                      <Eye className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <Award className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Inga ärenden för vald period</p>
              </div>
            )}
          </ModernCard.Content>
        </ModernCard>
      )}

      {activeView === 'skadedjur' && (
        <ModernCard>
          <ModernCard.Header
            icon={Bug}
            iconColor="text-red-500"
            title="Mest Lönsamma Skadedjur"
            subtitle={`Sorterat efter total intäkt för ${selectedPeriod.toUpperCase()} period`}
          />
          <ModernCard.Content>
            {filteredData.topSkadedjur.length > 0 ? (
              <div className="space-y-3">
                {filteredData.topSkadedjur.map((skadedjur, index) => (
                  <div
                    key={skadedjur.type}
                    className="flex items-center justify-between p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      {/* Ranking */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                        index === 0 ? 'bg-red-500' :
                        index === 1 ? 'bg-orange-500' :
                        index === 2 ? 'bg-yellow-500' :
                        'bg-slate-600'
                      }`}>
                        {index + 1}
                      </div>
                      
                      {/* Skadedjur info */}
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center">
                          <Bug className="w-4 h-4 text-red-500" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{skadedjur.type}</p>
                          <p className="text-sm text-slate-400">
                            {skadedjur.case_count} ärenden • Snitt: {formatCurrency(skadedjur.avg_price)}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-green-400 font-bold text-lg">{formatCurrency(skadedjur.total_revenue)}</p>
                      <p className="text-xs text-slate-400">Total intäkt</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <Bug className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Inga skadedjur för vald period</p>
              </div>
            )}
          </ModernCard.Content>
        </ModernCard>
      )}

      {activeView === 'contracts' && (
        <ModernCard>
          <ModernCard.Header
            icon={Building2}
            iconColor="text-green-500"
            title="Försäljningsmöjligheter"
            subtitle={`Företag med flera ärenden - Potentiella avtalskunder för ${selectedPeriod.toUpperCase()} period`}
          />
          <ModernCard.Content>
            {filteredData.potentialContracts.length > 0 ? (
              <div className="space-y-3">
                {filteredData.potentialContracts.map((contract, index) => (
                  <div
                    key={contract.customer_identifier}
                    className="flex items-center justify-between p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      {/* Priority indicator */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                        contract.case_count >= 5 ? 'bg-red-500' :
                        contract.case_count >= 3 ? 'bg-yellow-500' :
                        'bg-green-500'
                      }`}>
                        {contract.case_count >= 5 ? '🔥' :
                         contract.case_count >= 3 ? '⚡' : '💡'}
                      </div>
                      
                      {/* Customer info */}
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-green-500" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{contract.contact_person}</p>
                          <div className="flex items-center gap-4 text-sm text-slate-400">
                            <span>{contract.case_count} ärenden</span>
                            {contract.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {contract.phone}
                              </span>
                            )}
                            {contract.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {contract.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-green-400 font-bold text-lg">{formatCurrency(contract.total_revenue)}</p>
                      <p className="text-xs text-slate-400">
                        Snitt: {formatCurrency(contract.avg_case_value)} • Senaste: {new Date(contract.latest_case_date).toLocaleDateString('sv-SE')}
                      </p>
                      <div className="mt-1">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          contract.case_count >= 5 ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                          contract.case_count >= 3 ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                          'bg-green-500/10 text-green-400 border border-green-500/20'
                        }`}>
                          {contract.case_count >= 5 ? 'Hög prioritet' :
                           contract.case_count >= 3 ? 'Medel prioritet' : 'Låg prioritet'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Inga försäljningsmöjligheter för vald period</p>
              </div>
            )}
          </ModernCard.Content>
        </ModernCard>
      )}

      {/* Case Details Modal */}
      <CaseDetailsModal
        case_={selectedCase}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  )
}

export default EconomicInsightsChart