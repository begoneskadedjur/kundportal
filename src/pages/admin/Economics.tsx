import { useState, useEffect } from 'react'
import { ArrowLeft, TrendingUp, DollarSign, Calendar, Target, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import ManageSpendCard from '../../components/admin/ManageSpendCard'
import { economicStatisticsService, UpsellOpportunity, TechnicianPerformance, MonthlyGrowthAnalysis, ARRProjection } from '../../services/economicStatisticsService'
import { customerService } from '../../services/customerService'
import { caseService } from '../../services/caseService'
import toast from 'react-hot-toast'

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
    const types: { [key: string]: string } = { 'brf': 'BRF', 'restaurant': 'Restaurang', 'hotel': 'Hotell', 'fastighetsägare': 'Fastighetsägare', 'boendeverksamhet': 'Boendeverksamhet', 'livsmedelsbutik': 'Livsmedelsbutik', 'hästgård': 'Hästgård', 'såverk': 'Såverk', 'fastighetsförvaltning': 'Fastighetsförvaltning', 'livsmedelsindustri': 'Livsmedelsindustri', 'samfällighet': 'Samfällighet', 'annat': 'Annat' }
    return types[value] || value
  }
  const formatCurrency = (amount: number): string => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(amount)
  const formatMonth = (date: Date): string => date.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })
  const navigateMonth = (direction: 'prev' | 'next') => {
    setSelectedMonth(prev => { const newDate = new Date(prev); newDate.setMonth(newDate.getMonth() + (direction === 'prev' ? -1 : 1)); return newDate })
  }
  const handleSpendUpdate = () => { fetchAllData() }

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
                  <p className="text-slate-400 text-sm">MRR</p>
                  <p className="text-2xl font-bold text-white">{formatCurrency(yearlyData.totalRevenue / 12)}</p>
                </div>
                <Calendar className="w-8 h-8 text-purple-500" />
              </div>
            </Card>
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Intäkt (år)</p>
                  <p className="text-2xl font-bold text-white">{formatCurrency(yearlyData.totalRevenue + yearlyData.totalCaseRevenue)}</p>
                </div>
                <Target className="w-8 h-8 text-yellow-500" />
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card>
              <h3 className="text-lg font-semibold text-white mb-4">Månadens Tillväxt-analys (MRR)</h3>
              {monthlyGrowth ? (
                <div className="space-y-3">
                  <div className="flex justify-between"><span className="text-slate-400">Start MRR</span><span className="text-white">{formatCurrency(monthlyGrowth.startMRR)}</span></div>
                  <div className="flex justify-between"><span className="text-green-400">+ Nytt MRR</span><span className="text-green-400">{formatCurrency(monthlyGrowth.newMRR)}</span></div>
                  <div className="flex justify-between"><span className="text-red-400">- Förlorat MRR</span><span className="text-red-400">{formatCurrency(monthlyGrowth.churnedMRR)}</span></div>
                  <hr className="border-slate-700" />
                  <div className="flex justify-between font-semibold"><span className="text-white">Nettoförändring</span><span className={monthlyGrowth.netChangeMRR >= 0 ? "text-green-400" : "text-red-400"}>{monthlyGrowth.netChangeMRR >= 0 ? '+' : ''}{formatCurrency(monthlyGrowth.netChangeMRR)}</span></div>
                </div>
              ) : <p className="text-slate-500">Laddar tillväxtdata...</p>}
            </Card>
            <Card>
              <div className="flex items-center mb-4"><Target className="w-5 h-5 text-yellow-500 mr-2" /><h3 className="text-lg font-semibold text-white">Upsell-möjligheter</h3></div>
              <div className="space-y-4">
                {upsellData.length > 0 ? upsellData.map(opp => (
                  <div key={opp.customerId}>
                    <div className="flex justify-between items-center"><span className="text-slate-300">{opp.companyName}</span><span className="text-blue-400">Ärenden (6mån): {formatCurrency(opp.caseRevenueLast6Months)}</span></div>
                    <p className="text-sm text-slate-400">Avtal: {formatCurrency(opp.annualPremium)}</p>
                  </div>
                )) : <p className="text-slate-500 text-sm">Inga tydliga upsell-möjligheter hittades.</p>}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <h3 className="text-lg font-semibold text-white mb-4">Segmentanalys {currentYear}</h3>
              <div className="space-y-3">
                {segmentData.length > 0 ? segmentData.map((segment, index) => (
                  <div key={index} className="flex justify-between">
                    <span className="text-slate-400">{segment.businessType} ({segment.customers})</span>
                    <span className="text-white">{formatCurrency(segment.revenue)}</span>
                  </div>
                )) : <p className="text-slate-500">Ingen segmentdata tillgänglig.</p>}
              </div>
            </Card>
            <Card>
              <h3 className="text-lg font-semibold text-white mb-4">Framtida ARR</h3>
              <div className="space-y-4">
                {arrProjections.map((proj, index) => {
                  const prevProj = index > 0 ? arrProjections[index-1] : null;
                  const change = prevProj ? ((proj.projectedARR - prevProj.projectedARR) / prevProj.projectedARR) * 100 : 0;
                  const isPositive = change >= 0;
                  return (
                    <div key={proj.year} className="bg-slate-800 p-3 rounded-lg">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-white font-medium">{proj.year}</span>
                        <span className="text-white font-bold">{formatCurrency(proj.projectedARR)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <div className={`flex items-center ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                          {index > 0 && <><TrendingUp className={`w-3 h-3 mr-1 ${!isPositive && 'rotate-180'}`} />{isPositive ? '+' : ''}{change.toFixed(1)}%</>}
                        </div>
                        <span className="text-slate-400">{proj.activeContracts} avtal</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>
        </div>

        {/* MÅNADSANALYS */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Månadsanalys</h2>
            <div className="flex items-center gap-4">
              <Button variant="secondary" size="sm" onClick={() => navigateMonth('prev')}><ChevronLeft className="w-4 h-4" /> Föregående månad</Button>
              <span className="text-white font-medium">{formatMonth(selectedMonth)}</span>
              <Button variant="secondary" size="sm" onClick={() => navigateMonth('next')}>Nästa månad <ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
          <Card className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-4">Prestanda & Intäkter ({formatMonth(selectedMonth)})</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left text-slate-400 pb-2">Tekniker</th>
                    <th className="text-right text-slate-400 pb-2">Avtalsintäkt (MRR)</th>
                    <th className="text-right text-slate-400 pb-2">Ärende-intäkt</th>
                    <th className="text-right text-slate-400 pb-2">Total Intäkt</th>
                  </tr>
                </thead>
                <tbody>
                  {technicianPerformance.length > 0 ? technicianPerformance.map(tech => (
                    <tr key={tech.name}>
                      <td className="py-2 text-white">{tech.name}</td>
                      <td className="py-2 text-right text-green-400">{formatCurrency(tech.contractRevenue)} ({tech.contractCount})</td>
                      <td className="py-2 text-right text-blue-400">{formatCurrency(tech.caseRevenue)} ({tech.caseCount})</td>
                      <td className="py-2 text-right text-white font-semibold">{formatCurrency(tech.totalRevenue)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} className="text-center py-4 text-slate-500">Ingen data för denna månad.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
          <Card className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-4">Enhetsekonomi & Lönsamhet (År)</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <div><p className="text-slate-400 text-sm">CAC</p><p className="text-2xl font-bold text-white">{formatCurrency(yearlyData.cac)}</p></div>
              <div><p className="text-slate-400 text-sm">LTV</p><p className="text-2xl font-bold text-yellow-400">{formatCurrency(yearlyData.ltv)}</p></div>
              <div><p className="text-slate-400 text-sm">LTV / CAC</p><p className="text-2xl font-bold text-yellow-400">{yearlyData.cac > 0 ? (yearlyData.ltv / yearlyData.cac).toFixed(1) : '∞'}x</p></div>
              <div><p className="text-slate-400 text-sm">Återbetalningstid</p><p className="text-2xl font-bold text-white">{yearlyData.avgCustomerValue > 0 && yearlyData.cac > 0 ? (yearlyData.cac / (yearlyData.avgCustomerValue / 12)).toFixed(1) : '0.0'} mån</p></div>
              <div><p className="text-slate-400 text-sm">ROI</p><p className="text-2xl font-bold text-green-400">{isFinite(yearlyData.roi) ? yearlyData.roi.toFixed(0) : '∞'}%</p></div>
            </div>
          </Card>
          <ManageSpendCard selectedMonth={selectedMonth} onDataChange={handleSpendUpdate} />
        </div>
      </main>
    </div>
  )
}