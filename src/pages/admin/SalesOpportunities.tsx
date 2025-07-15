// 📁 src/pages/admin/SalesOpportunities.tsx - FÖRSÄLJNINGSMÖJLIGHETER SIDA
import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../utils/formatters'
import { 
  ArrowLeft, 
  RefreshCw, 
  Building2, 
  TrendingUp, 
  Users, 
  Phone, 
  Mail,
  Calendar,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Award,
  Eye
} from 'lucide-react'

import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { ModernCard } from '../../components/ui/ModernCard'

// 🎯 Interfaces
interface PotentialContract {
  org_nr: string
  contact_person: string
  company_name?: string
  phone?: string
  email?: string
  case_count: number
  total_revenue: number
  avg_revenue: number
  latest_case_date: string
  case_details: Array<{
    id: string
    title?: string
    pris: number
    completed_date: string
    technician: string
    type: 'private' | 'business'
  }>
}

interface CaseDetailsModalProps {
  case_: PotentialContract | null
  isOpen: boolean
  onClose: () => void
}

// Modal för att visa ärendedetaljer
const CaseDetailsModal: React.FC<CaseDetailsModalProps> = ({ case_, isOpen, onClose }) => {
  if (!isOpen || !case_) return null

  const totalWithTax = case_.case_details.reduce((sum, detail) => {
    const amount = detail.type === 'business' ? detail.pris * 1.25 : detail.pris
    return sum + amount
  }, 0)

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">{case_.company_name || case_.contact_person}</h2>
                <p className="text-sm text-slate-400">{case_.case_count} ärenden • {formatCurrency(totalWithTax)} totalt</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Kontaktinformation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-4">
              <h3 className="font-semibold text-white mb-3">Kontaktinformation</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-300">{case_.contact_person}</span>
                </div>
                {case_.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <a href={`tel:${case_.phone}`} className="text-blue-400 hover:text-blue-300">
                      {case_.phone}
                    </a>
                  </div>
                )}
                {case_.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <a href={`mailto:${case_.email}`} className="text-blue-400 hover:text-blue-300">
                      {case_.email}
                    </a>
                  </div>
                )}
                {case_.org_nr && (
                  <div className="flex items-center gap-3">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-300">{case_.org_nr}</span>
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold text-white mb-3">Försäljningsanalys</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">Antal ärenden</span>
                  <span className="text-white font-medium">{case_.case_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Genomsnittsvärde</span>
                  <span className="text-white font-medium">{formatCurrency(case_.avg_revenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total omsättning</span>
                  <span className="text-green-400 font-bold">{formatCurrency(totalWithTax)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Senaste ärende</span>
                  <span className="text-white font-medium">
                    {new Date(case_.latest_case_date).toLocaleDateString('sv-SE')}
                  </span>
                </div>
              </div>
            </Card>
          </div>

          {/* Ärendehistorik */}
          <Card className="p-4">
            <h3 className="font-semibold text-white mb-4">Ärendehistorik</h3>
            <div className="space-y-2">
              {case_.case_details.map((detail, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{detail.title || `Ärende ${index + 1}`}</span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        detail.type === 'business' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                      }`}>
                        {detail.type === 'business' ? 'Företag' : 'Privat'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">
                      {detail.technician} • {new Date(detail.completed_date).toLocaleDateString('sv-SE')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-medium">{formatCurrency(detail.pris)}</p>
                    {detail.type === 'business' && (
                      <p className="text-xs text-slate-400">+ {formatCurrency(detail.pris * 0.25)} moms</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

const SalesOpportunities: React.FC = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [potentialContracts, setPotentialContracts] = useState<PotentialContract[]>([])
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [selectedPeriod, setSelectedPeriod] = useState<string>('3m')
  const [selectedCase, setSelectedCase] = useState<PotentialContract | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Period options
  const periodOptions = [
    { key: '1m', label: '1 månad', shortLabel: '1M' },
    { key: '3m', label: '3 månader', shortLabel: '3M' },
    { key: '6m', label: '6 månader', shortLabel: '6M' },
    { key: '12m', label: '12 månader', shortLabel: '12M' }
  ]

  useEffect(() => {
    // Sätt aktuell månad som default
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonth(currentMonth)
  }, [])

  useEffect(() => {
    if (selectedMonth) {
      fetchSalesOpportunities()
    }
  }, [selectedMonth, selectedPeriod])

  const fetchSalesOpportunities = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Beräkna datumperiod
      const selectedDate = new Date(selectedMonth + '-01')
      const endDate = new Date(selectedDate)
      endDate.setMonth(endDate.getMonth() + 1)
      
      const periodMonths = parseInt(selectedPeriod.replace('m', ''))
      const startDate = new Date(selectedDate)
      startDate.setMonth(startDate.getMonth() - periodMonths)

      const startDateString = startDate.toISOString().split('T')[0]
      const endDateString = endDate.toISOString().split('T')[0]

      console.log(`🔄 Fetching sales opportunities for ${startDateString} to ${endDateString}`)

      // Hämta alla avslutade ärenden från BeGone
      const [privateResult, businessResult] = await Promise.all([
        supabase
          .from('private_cases')
          .select(`
            id, case_number, title, pris, completed_date, 
            primary_assignee_name, skadedjur, adress, description, 
            kontaktperson, telefon_kontaktperson, e_post_kontaktperson, personnummer
          `)
          .eq('status', 'Avslutat')
          .gte('completed_date', startDateString)
          .lt('completed_date', endDateString)
          .not('completed_date', 'is', null)
          .not('pris', 'is', null),
        
        supabase
          .from('business_cases')
          .select(`
            id, case_number, title, pris, completed_date, 
            primary_assignee_name, skadedjur, adress, description,
            kontaktperson, telefon_kontaktperson, e_post_kontaktperson, org_nr
          `)
          .eq('status', 'Avslutat')
          .gte('completed_date', startDateString)
          .lt('completed_date', endDateString)
          .not('completed_date', 'is', null)
          .not('pris', 'is', null)
      ])

      if (privateResult.error) throw privateResult.error
      if (businessResult.error) throw businessResult.error

      // Kombinera data
      const allCases = [
        ...(privateResult.data || []).map(c => ({ ...c, type: 'private' as const })),
        ...(businessResult.data || []).map(c => ({ ...c, type: 'business' as const }))
      ]

      // Gruppera efter org_nr för företag (bara business_cases har org_nr)
      const orgNrStats: { [key: string]: { 
        count: number; 
        revenue: number; 
        contact_person: string;
        phone?: string;
        email?: string;
        company_name?: string;
        cases: any[];
        latest_date: string;
      } } = {}

      // Bara business_cases för försäljningsmöjligheter
      const businessCases = allCases.filter(c => c.type === 'business' && c.org_nr)

      businessCases.forEach(case_ => {
        const orgNr = case_.org_nr
        if (!orgNrStats[orgNr]) {
          orgNrStats[orgNr] = {
            count: 0,
            revenue: 0,
            contact_person: case_.kontaktperson || 'Okänd',
            phone: case_.telefon_kontaktperson,
            email: case_.e_post_kontaktperson,
            company_name: case_.title || case_.kontaktperson || 'Okänt företag',
            cases: [],
            latest_date: case_.completed_date
          }
        }
        
        orgNrStats[orgNr].count++
        orgNrStats[orgNr].revenue += case_.pris
        orgNrStats[orgNr].cases.push({
          id: case_.id,
          title: case_.title,
          pris: case_.pris,
          completed_date: case_.completed_date,
          technician: case_.primary_assignee_name || 'Ej tilldelad',
          type: case_.type
        })
        
        // Uppdatera senaste datum
        if (case_.completed_date > orgNrStats[orgNr].latest_date) {
          orgNrStats[orgNr].latest_date = case_.completed_date
        }
      })

      // Skapa potential contracts (bara företag med 2+ ärenden)
      const potentialContractsData = Object.entries(orgNrStats)
        .filter(([_, stats]) => stats.count >= 2) // Minst 2 ärenden
        .map(([orgNr, stats]) => ({
          org_nr: orgNr,
          contact_person: stats.contact_person,
          company_name: stats.company_name,
          phone: stats.phone,
          email: stats.email,
          case_count: stats.count,
          total_revenue: stats.revenue,
          avg_revenue: stats.revenue / stats.count,
          latest_case_date: stats.latest_date,
          case_details: stats.cases.sort((a, b) => 
            new Date(b.completed_date).getTime() - new Date(a.completed_date).getTime()
          )
        }))
        .sort((a, b) => b.case_count - a.case_count)

      setPotentialContracts(potentialContractsData)
      console.log(`🏢 Found ${potentialContractsData.length} sales opportunities`)

    } catch (err) {
      console.error('❌ Error fetching sales opportunities:', err)
      setError(err instanceof Error ? err.message : 'Ett okänt fel uppstod')
    } finally {
      setLoading(false)
    }
  }

  // Navigation functions
  const canGoPrevious = () => true
  const canGoNext = () => {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return selectedMonth < currentMonth
  }

  const goToPreviousMonth = () => {
    const date = new Date(selectedMonth + '-01')
    date.setMonth(date.getMonth() - 1)
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonth(newMonth)
  }

  const goToNextMonth = () => {
    const date = new Date(selectedMonth + '-01')
    date.setMonth(date.getMonth() + 1)
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonth(newMonth)
  }

  const formatSelectedMonth = (monthStr: string) => {
    const date = new Date(monthStr + '-01')
    return date.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })
  }

  const handleCaseClick = (contract: PotentialContract) => {
    setSelectedCase(contract)
    setIsModalOpen(true)
  }

  // Beräkna sammanfattning
  const summary = useMemo(() => {
    const totalCompanies = potentialContracts.length
    const totalRevenue = potentialContracts.reduce((sum, c) => sum + c.total_revenue, 0)
    const totalCases = potentialContracts.reduce((sum, c) => sum + c.case_count, 0)
    const highPriority = potentialContracts.filter(c => c.case_count >= 5).length
    
    return { totalCompanies, totalRevenue, totalCases, highPriority }
  }, [potentialContracts])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900/50 border-b border-slate-800 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => navigate('/admin/dashboard')} 
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> 
                Tillbaka
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-green-500" />
                  Försäljningsmöjligheter
                </h1>
                <p className="text-slate-400 text-sm">
                  Identifiera potentiella avtalskunder baserat på återkommande BeGone-ärenden
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                onClick={fetchSalesOpportunities} 
                disabled={loading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Uppdatera
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span className="text-red-400">{error}</span>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between mb-8">
          {/* Period selector */}
          <div className="flex gap-2">
            {periodOptions.map(period => (
              <button
                key={period.key}
                onClick={() => setSelectedPeriod(period.key)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedPeriod === period.key
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {period.shortLabel}
              </button>
            ))}
          </div>

          {/* Month navigation */}
          <div className="flex items-center gap-4">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={goToPreviousMonth}
              disabled={!canGoPrevious()}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="text-center">
              <p className="text-white font-medium">{formatSelectedMonth(selectedMonth)}</p>
              <p className="text-xs text-slate-400">
                {periodOptions.find(p => p.key === selectedPeriod)?.label} bakåt
              </p>
            </div>
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={goToNextMonth}
              disabled={!canGoNext()}
              className="flex items-center gap-2"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <Building2 className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-sm text-slate-400">Potentiella Kunder</p>
                <p className="text-2xl font-bold text-white">{summary.totalCompanies}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-sm text-slate-400">Total Omsättning</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(summary.totalRevenue * 1.25)}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <Award className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-sm text-slate-400">Totala Ärenden</p>
                <p className="text-2xl font-bold text-white">{summary.totalCases}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <div>
                <p className="text-sm text-slate-400">Hög Prioritet</p>
                <p className="text-2xl font-bold text-white">{summary.highPriority}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Sales Opportunities List */}
        <ModernCard>
          <ModernCard.Header>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-green-500" />
              <h2 className="text-lg font-semibold text-white">Försäljningsmöjligheter</h2>
            </div>
          </ModernCard.Header>
          <ModernCard.Content>
            {potentialContracts.length > 0 ? (
              <div className="space-y-4">
                {potentialContracts.map((contract) => (
                  <div
                    key={contract.org_nr}
                    className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-800/80 transition-colors cursor-pointer"
                    onClick={() => handleCaseClick(contract)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-6 h-6 text-green-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-white">{contract.company_name || contract.contact_person}</h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              contract.case_count >= 5 ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                              contract.case_count >= 3 ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                              'bg-green-500/10 text-green-400 border border-green-500/20'
                            }`}>
                              {contract.case_count >= 5 ? 'Hög prioritet' :
                               contract.case_count >= 3 ? 'Medel prioritet' : 'Låg prioritet'}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                            <span>{contract.case_count} ärenden</span>
                            <span>∅ {formatCurrency(contract.avg_revenue)}</span>
                            <span>Senast: {new Date(contract.latest_case_date).toLocaleDateString('sv-SE')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-400">
                          {formatCurrency(contract.total_revenue * 1.25)}
                        </div>
                        <div className="text-sm text-slate-400">+ 25% moms</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Inga försäljningsmöjligheter för vald period</p>
                <p className="text-sm mt-2">Prova att välja en längre tidsperiod</p>
              </div>
            )}
          </ModernCard.Content>
        </ModernCard>
      </main>

      {/* Case Details Modal */}
      <CaseDetailsModal
        case_={selectedCase}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  )
}

export default SalesOpportunities