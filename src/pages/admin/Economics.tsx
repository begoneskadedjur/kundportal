// src/pages/admin/Economics.tsx - FIXAD VERSION för att lösa ReferenceError
import { useState, useEffect } from 'react'
import { ArrowLeft, TrendingUp, DollarSign, Calendar, Target, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import ManageSpendCard from '../../components/admin/ManageSpendCard'
import { customerService } from '../../services/customerService'
import { caseService } from '../../services/caseService'
import toast from 'react-hot-toast'

// LOKAL IMPORT: Importera endast typer, inte service-instansen
import type { 
  UpsellOpportunity, 
  TechnicianPerformance, 
  MonthlyGrowthAnalysis, 
  ARRProjection 
} from '../../services/economicStatisticsService'

// Typer för att hålla all dynamisk data
type EconomicData = {
  totalRevenue: number
  totalCaseRevenue: number
  totalSpend: number
  newCustomers: number
  cac: number
  ltv: number
  roi: number
  avgCustomerValue: number
}

export default function Economics() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(() => new Date())
  
  // State för all data som visas på sidan
  const [yearlyData, setYearlyData] = useState<EconomicData>({
    totalRevenue: 0, totalCaseRevenue: 0, totalSpend: 0, newCustomers: 0,
    cac: 0, ltv: 0, roi: 0, avgCustomerValue: 0
  })
  const [segmentData, setSegmentData] = useState<Array<{ businessType: string; customers: number; revenue: number }>>([])
  const [upsellData, setUpsellData] = useState<UpsellOpportunity[]>([])
  const [technicianPerformance, setTechnicianPerformance] = useState<TechnicianPerformance[]>([])
  const [monthlyGrowth, setMonthlyGrowth] = useState<MonthlyGrowthAnalysis | null>(null)
  const [arrProjections, setArrProjections] = useState<ARRProjection[]>([])

  // Funktion för att hämta all data vid sidladdning eller årsbyte
  const fetchAllData = async () => {
    setLoading(true)
    try {
      // DYNAMISK IMPORT: Importera service när den behövs, inte vid filens laddning
      const { economicStatisticsService } = await import('../../services/economicStatisticsService')
      
      const [customers, cases, yearSpendData] = await Promise.all([
        customerService.getCustomers(),
        caseService.getCases(),
        economicStatisticsService.getYearlySpend(currentYear)
      ])

      const activeCustomers = customers.filter(c => c.is_active)
      
      // ÅRLIGA BERÄKNINGAR
      const totalRevenue = activeCustomers.reduce((sum, c) => sum + (c.annual_premium || 0), 0)
      const totalCaseRevenue = cases.filter(c => c.completed_date && new Date(c.completed_date).getFullYear() === currentYear).reduce((sum, c) => sum + (c.price || 0), 0)
      const totalSpend = yearSpendData.reduce((sum, month) => sum + month.spend, 0)
      const newCustomersThisYear = activeCustomers.filter(c => c.created_at && new Date(c.created_at).getFullYear() === currentYear).length
      const cac = newCustomersThisYear > 0 ? totalSpend / newCustomersThisYear : 0
      const avgAnnualPremium = activeCustomers.length > 0 ? totalRevenue / activeCustomers.length : 0
      const avgContractLength = activeCustomers.reduce((sum, c) => sum + (c.contract_length_months || 12), 0) / (activeCustomers.length || 1)
      const ltv = avgAnnualPremium * (avgContractLength / 12)
      const roi = totalSpend > 0 ? (((totalRevenue + totalCaseRevenue) - totalSpend) / totalSpend) * 100 : (totalRevenue + totalCaseRevenue > 0 ? Infinity : 0)

      setYearlyData({ totalRevenue, totalCaseRevenue, totalSpend, newCustomers: newCustomersThisYear, cac, ltv, roi, avgCustomerValue: avgAnnualPremium })

      // HÄMTA ÖVRIGA STATISTIK-OBJEKT
      const [upsellOpportunities, monthlyGrowthAnalysis, projections, businessSegments] = await Promise.all([
        economicStatisticsService.getUpsellOpportunities(customers, cases, 5),
        economicStatisticsService.getMonthlyGrowthAnalysis(customers),
        economicStatisticsService.getARRProjections(customers),
        economicStatisticsService.getARRByBusinessType(customers, cases)
      ])

      setUpsellData(upsellOpportunities)
      setMonthlyGrowth(monthlyGrowthAnalysis)
      setArrProjections(projections)
      setSegmentData(businessSegments.map(s => ({ businessType: getBusinessTypeLabel(s.business_type), customers: s.customer_count, revenue: s.arr })))

      await fetchMonthlyPerformance()

    } catch (error) {
      console.error('Error fetching yearly data:', error)
      toast.error('Kunde inte hämta årsdata')
    } finally {
      setLoading(false)
    }
  }

  // Funktion för att bara hämta månadsspecifik data (prestanda)
  const fetchMonthlyPerformance = async () => {
    try {
      // DYNAMISK IMPORT: Även här för konsistens
      const { economicStatisticsService } = await import('../../services/economicStatisticsService')
      const performanceStats = await economicStatisticsService.getPerformanceStatsForMonth(selectedMonth)
      setTechnicianPerformance(performanceStats.byTechnician)
    } catch (error) {
      console.error('Error fetching monthly performance data:', error)
      toast.error('Kunde inte hämta månadsdata')
    }
  }
  
  // Körs en gång vid start, och när `currentYear` ändras
  useEffect(() => {
    fetchAllData()
  }, [currentYear])

  // Körs bara när `selectedMonth` ändras (för att byta tekniker-vyn)
  useEffect(() => {
    if (!loading) { // Undvik att köra vid första sidladdningen
      fetchMonthlyPerformance()
    }
  }, [selectedMonth])

  // HJÄLPFUNKTIONER
  const getBusinessTypeLabel = (value: string): string => {
    const types: { [key: string]: string } = { 
      'brf': 'BRF', 'restaurant': 'Restaurang', 'hotel': 'Hotell', 
      'fastighetsägare': 'Fastighetsägare', 'boendeverksamhet': 'Boendeverksamhet', 
      'livsmedelsbutik': 'Livsmedelsbutik', 'hästgård': 'Hästgård', 'såverk': 'Såverk', 
      'fastighetsförvaltning': 'Fastighetsförvaltning', 'livsmedelsindustri': 'Livsmedelsindustri', 
      'samfällighet': 'Samfällighet', 'annat': 'Annat' 
    }
    return types[value] || value
  }
  
  const formatCurrency = (amount: number): string => 
    new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(amount)
  
  const formatMonth = (date: Date): string => 
    date.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })
  
  const navigateMonth = (direction: 'prev' | 'next') => {
    setSelectedMonth(prev => { 
      const newDate = new Date(prev)
      newDate.setMonth(newDate.getMonth() + (direction === 'prev' ? -1 : 1))
      return newDate 
    })
  }
  
  const handleSpendUpdate = () => { 
    fetchAllData() 
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Laddar ekonomisk data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="bg-slate-900/50 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="secondary" size="sm" onClick={() => navigate('/admin/dashboard')} className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" /> Tillbaka
              </Button>
              <h1 className="text-2xl font-bold text-white">Ekonomisk Översikt</h1>
            </div>
            <Button onClick={fetchAllData} disabled={loading}>Uppdatera</Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* ÅRSÖVERSIKT */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold text-white mb-6">Årsöversikt {currentYear}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">ARR (Årlig)</p>
                  <p className="text-2xl font-bold text-green-400">{formatCurrency(yearlyData.totalRevenue)}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
            </Card>
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Ärende-intäkter (år)</p>
                  <p className="text-2xl font-bold text-blue-400">{formatCurrency(yearlyData.totalCaseRevenue)}</p>
                </div>
                <DollarSign className="w-8 h-8 text-blue-500" />
              </div>
            </Card>
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Marknadsföring (år)</p>
                  <p className="text-2xl font-bold text-red-400">{formatCurrency(yearlyData.totalSpend)}</p>
                </div>
                <Target className="w-8 h-8 text-red-500" />
              </div>
            </Card>
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Nya kunder (år)</p>
                  <p className="text-2xl font-bold text-purple-400">{yearlyData.newCustomers}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-purple-500" />
              </div>
            </Card>
          </div>

          {/* KPI CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <div>
                <p className="text-slate-400 text-sm">CAC (Cost per Acquisition)</p>
                <p className="text-xl font-bold text-white">{formatCurrency(yearlyData.cac)}</p>
              </div>
            </Card>
            <Card>
              <div>
                <p className="text-slate-400 text-sm">LTV (Lifetime Value)</p>
                <p className="text-xl font-bold text-white">{formatCurrency(yearlyData.ltv)}</p>
              </div>
            </Card>
            <Card>
              <div>
                <p className="text-slate-400 text-sm">ROI (%)</p>
                <p className={`text-xl font-bold ${yearlyData.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {yearlyData.roi === Infinity ? '∞' : `${yearlyData.roi.toFixed(1)}%`}
                </p>
              </div>
            </Card>
            <Card>
              <div>
                <p className="text-slate-400 text-sm">Genomsnittligt kundvärde</p>
                <p className="text-xl font-bold text-white">{formatCurrency(yearlyData.avgCustomerValue)}</p>
              </div>
            </Card>
          </div>
        </div>

        {/* MÅNADSÖVERSIKT - TEKNIKER PRESTANDA */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Tekniker-prestanda</h2>
            <div className="flex items-center gap-4">
              <Button variant="secondary" size="sm" onClick={() => navigateMonth('prev')}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-slate-300 min-w-[140px] text-center">{formatMonth(selectedMonth)}</span>
              <Button variant="secondary" size="sm" onClick={() => navigateMonth('next')}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {technicianPerformance.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {technicianPerformance.map((tech, index) => (
                <Card key={index}>
                  <div className="space-y-3">
                    <h3 className="font-semibold text-white">{tech.name}</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Kontraktsintäkter:</span>
                        <span className="text-green-400">{formatCurrency(tech.contractRevenue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Ärendeintäkter:</span>
                        <span className="text-blue-400">{formatCurrency(tech.caseRevenue)}</span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span className="text-slate-300">Totalt:</span>
                        <span className="text-white">{formatCurrency(tech.totalRevenue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Kontrakt/Ärenden:</span>
                        <span className="text-slate-300">{tech.contractCount}/{tech.caseCount}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <p className="text-slate-400 text-center py-8">Ingen tekniker-data tillgänglig för denna månad</p>
            </Card>
          )}
        </div>

        {/* MARKNADSFÖRING & SPEND */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold text-white mb-6">Marknadsföring & Utgifter</h2>
          <ManageSpendCard onUpdate={handleSpendUpdate} />
        </div>

        {/* AFFÄRSSEGMENT */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold text-white mb-6">Intäkter per Verksamhetstyp</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {segmentData.map((segment, index) => (
              <Card key={index}>
                <div className="space-y-2">
                  <h3 className="font-semibold text-white">{segment.businessType}</h3>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Kunder:</span>
                    <span className="text-white">{segment.customers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">ARR:</span>
                    <span className="text-green-400">{formatCurrency(segment.revenue)}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* TILLVÄXTANALYS */}
        {monthlyGrowth && (
          <div className="mb-12">
            <h2 className="text-xl font-semibold text-white mb-6">Månatlig Tillväxtanalys</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
              <Card>
                <div>
                  <p className="text-slate-400 text-sm">Start MRR</p>
                  <p className="text-xl font-bold text-white">{formatCurrency(monthlyGrowth.startMRR)}</p>
                </div>
              </Card>
              <Card>
                <div>
                  <p className="text-slate-400 text-sm">Ny MRR</p>
                  <p className="text-xl font-bold text-green-400">+{formatCurrency(monthlyGrowth.newMRR)}</p>
                </div>
              </Card>
              <Card>
                <div>
                  <p className="text-slate-400 text-sm">Churned MRR</p>
                  <p className="text-xl font-bold text-red-400">-{formatCurrency(monthlyGrowth.churnedMRR)}</p>
                </div>
              </Card>
              <Card>
                <div>
                  <p className="text-slate-400 text-sm">Netto Förändring</p>
                  <p className={`text-xl font-bold ${monthlyGrowth.netChangeMRR >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {monthlyGrowth.netChangeMRR >= 0 ? '+' : ''}{formatCurrency(monthlyGrowth.netChangeMRR)}
                  </p>
                </div>
              </Card>
              <Card>
                <div>
                  <p className="text-slate-400 text-sm">Nuvarande MRR</p>
                  <p className="text-xl font-bold text-white">{formatCurrency(monthlyGrowth.endMRR)}</p>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* UPSELL MÖJLIGHETER */}
        {upsellData.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-semibold text-white mb-6">Upsell-möjligheter</h2>
            <div className="space-y-4">
              {upsellData.map((opportunity, index) => (
                <Card key={index}>
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-white">{opportunity.companyName}</h3>
                      <p className="text-slate-400 text-sm">
                        Årspremie: {formatCurrency(opportunity.annualPremium)} | 
                        Ärendeintäkter (6 mån): {formatCurrency(opportunity.caseRevenueLast6Months)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-yellow-400">
                        {(opportunity.caseToArrRatio * 100).toFixed(1)}%
                      </p>
                      <p className="text-xs text-slate-400">Case/ARR ratio</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ARR PROJEKTIONER */}
        {arrProjections.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-semibold text-white mb-6">ARR Projektioner</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {arrProjections.map((projection, index) => (
                <Card key={index}>
                  <div className="text-center">
                    <p className="text-slate-400 text-sm">{projection.year}</p>
                    <p className="text-lg font-bold text-white">{formatCurrency(projection.projectedARR)}</p>
                    <p className="text-xs text-slate-500">{projection.activeContracts} kontrakt</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}