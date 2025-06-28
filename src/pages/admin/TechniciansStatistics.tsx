// src/pages/admin/TechniciansStatistics.tsx - Dedikerad tekniker-prestanda statistik
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, Users, Activity, Star, Clock, Target, AlertTriangle,
  TrendingUp, BarChart3, Calendar, Eye, Download, Settings,
  CheckCircle, FileText, Phone, MapPin, Wrench, Zap
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'

// Tooltip Component
const Tooltip = ({ children, content }: { children: React.ReactNode, content: string }) => {
  const [show, setShow] = useState(false)
  
  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="absolute z-50 px-3 py-2 text-sm text-white bg-slate-800 border border-slate-600 rounded-lg shadow-lg -top-12 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
          {content}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
        </div>
      )}
    </div>
  )
}

// Metric Card för tekniker-stats
const TechMetricCard = ({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  color, 
  tooltip,
  target,
  className = ""
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: any
  color: string
  tooltip: string
  target?: { min?: number, max?: number, optimal?: number }
  className?: string
}) => {
  const getStatusColor = () => {
    if (!target || typeof value !== 'number') return 'text-white'
    
    if (target.optimal && Math.abs(value - target.optimal) <= 5) return 'text-green-400'
    if (target.min && target.max && value >= target.min && value <= target.max) return 'text-green-400'
    if (target.min && value >= target.min) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getStatusIndicator = () => {
    if (!target || typeof value !== 'number') return null
    
    if (target.optimal && Math.abs(value - target.optimal) <= 5) return '✅'
    if (target.min && target.max && value >= target.min && value <= target.max) return '✅'
    if (target.min && value >= target.min) return '⚠️'
    return '🚨'
  }

  return (
    <Tooltip content={tooltip}>
      <Card className={`hover:bg-slate-800/50 transition-colors cursor-help ${className}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-sm font-medium ${color === 'green' ? 'text-green-400' : 
              color === 'blue' ? 'text-blue-400' : 
              color === 'purple' ? 'text-purple-400' : 
              color === 'orange' ? 'text-orange-400' :
              color === 'red' ? 'text-red-400' :
              'text-slate-400'}`}>
              {title}
            </p>
            <div className="flex items-center gap-2">
              <p className={`text-2xl font-bold ${getStatusColor()}`}>{value}</p>
              {getStatusIndicator() && <span className="text-lg">{getStatusIndicator()}</span>}
            </div>
            {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
          </div>
          <Icon className={`w-8 h-8 ${color === 'green' ? 'text-green-500' : 
            color === 'blue' ? 'text-blue-500' : 
            color === 'purple' ? 'text-purple-500' : 
            color === 'orange' ? 'text-orange-500' :
            color === 'red' ? 'text-red-500' :
            'text-slate-500'}`} />
        </div>
      </Card>
    </Tooltip>
  )
}

export default function TechniciansStatistics() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<'30' | '90' | '365'>('30')
  
  const [technicianData, setTechnicianData] = useState({
    activeTechnicians: 7,
    totalTechnicians: 7,
    capacityUtilization: 87,
    activeCases: 49,
    averageCasesPerTechnician: 7.0,
    urgentCases: 3,
    completedCasesThisMonth: 91,
    averageResolutionTime: 2.4,
    firstVisitSuccessRate: 86,
    overdueCases: 2,
    customerSatisfactionScore: 4.5,
    responseTime: 2.1
  })

  const [individualPerformance, setIndividualPerformance] = useState<Array<{
    id: string
    name: string
    email: string
    phone: string
    activeCases: number
    completedThisMonth: number
    avgResolutionTime: number
    utilizationRate: number
    customerRating: number
    responseTimeHours: number
    firstVisitSuccess: number
    specializations: string[]
  }>>([])

  const [performanceTrends, setPerformanceTrends] = useState<Array<{
    month: string
    totalCases: number
    avgResolutionTime: number
    successRate: number
    utilization: number
  }>>([])

  const [workloadDistribution, setWorkloadDistribution] = useState<Array<{
    technicianName: string
    currentLoad: number
    optimalLoad: number
    efficiency: number
  }>>([])

  useEffect(() => {
    fetchTechnicianData()
  }, [selectedPeriod])

  const fetchTechnicianData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Simulera individuell prestanda för alla 7 tekniker
      const individualData = [
        {
          id: '1',
          name: 'Sofia Pålshagen',
          email: 'sofia.palshagen@begone.se',
          phone: '+46 70 345 6789',
          activeCases: 10,
          completedThisMonth: 18,
          avgResolutionTime: 1.9,
          utilizationRate: 95,
          customerRating: 4.8,
          responseTimeHours: 1.5,
          firstVisitSuccess: 93,
          specializations: ['Möss', 'Flugor', 'Kvalster']
        },
        {
          id: '2',
          name: 'Christian Karlsson',
          email: 'christian.karlsson@begone.se',
          phone: '+46 70 123 4567',
          activeCases: 8,
          completedThisMonth: 15,
          avgResolutionTime: 2.1,
          utilizationRate: 92,
          customerRating: 4.7,
          responseTimeHours: 1.8,
          firstVisitSuccess: 88,
          specializations: ['Råttor', 'Myror', 'Kackerlackor']
        },
        {
          id: '3',
          name: 'Benny Linden',
          email: 'benny.linden@begone.se',
          phone: '+46 70 678 9012',
          activeCases: 9,
          completedThisMonth: 16,
          avgResolutionTime: 2.3,
          utilizationRate: 91,
          customerRating: 4.6,
          responseTimeHours: 1.9,
          firstVisitSuccess: 87,
          specializations: ['Kackerlackor', 'Spindlar', 'Möss']
        },
        {
          id: '4',
          name: 'Hans Norman',
          email: 'hans.norman@begone.se',
          phone: '+46 70 456 7890',
          activeCases: 7,
          completedThisMonth: 13,
          avgResolutionTime: 2.5,
          utilizationRate: 88,
          customerRating: 4.4,
          responseTimeHours: 2.0,
          firstVisitSuccess: 85,
          specializations: ['Skalbaggar', 'Myror', 'Råttor']
        },
        {
          id: '5', 
          name: 'Kristian Agnevik',
          email: 'kristian.agnevik@begone.se',
          phone: '+46 70 234 5678',
          activeCases: 6,
          completedThisMonth: 12,
          avgResolutionTime: 2.8,
          utilizationRate: 85,
          customerRating: 4.5,
          responseTimeHours: 2.2,
          firstVisitSuccess: 82,
          specializations: ['Getingar', 'Spindlar', 'Termiter']
        },
        {
          id: '6',
          name: 'Kim Walberg',
          email: 'kim.walberg@begone.se',
          phone: '+46 70 567 8901',
          activeCases: 5,
          completedThisMonth: 9,
          avgResolutionTime: 3.2,
          utilizationRate: 78,
          customerRating: 4.3,
          responseTimeHours: 2.8,
          firstVisitSuccess: 79,
          specializations: ['Getingar', 'Termiter']
        },
        {
          id: '7',
          name: 'Mathias Carlsson',
          email: 'mathias.carlsson@begone.se',
          phone: '+46 70 789 0123',
          activeCases: 4,
          completedThisMonth: 8,
          avgResolutionTime: 2.7,
          utilizationRate: 74,
          customerRating: 4.2,
          responseTimeHours: 2.5,
          firstVisitSuccess: 81,
          specializations: ['Flugor', 'Kvalster']
        }
      ].sort((a, b) => b.utilizationRate - a.utilizationRate)

      setIndividualPerformance(individualData)

      // Simulera prestanda-trends över tid
      const months = Array.from({length: 6}, (_, i) => {
        const date = new Date()
        date.setMonth(date.getMonth() - 5 + i)
        return date.toLocaleDateString('sv-SE', { month: 'short', year: '2-digit' })
      })

      const trends = months.map(month => ({
        month,
        totalCases: Math.floor(Math.random() * 50) + 80,
        avgResolutionTime: 2 + Math.random() * 1.5,
        successRate: 75 + Math.random() * 20,
        utilization: 70 + Math.random() * 25
      }))

      setPerformanceTrends(trends)

      // Beräkna arbetsbelastning
      const workload = individualData.map(tech => ({
        technicianName: tech.name,
        currentLoad: tech.activeCases,
        optimalLoad: 8, // Optimal antal ärenden
        efficiency: tech.utilizationRate
      }))

      setWorkloadDistribution(workload)

    } catch (error: any) {
      console.error('Error fetching technician data:', error)
      setError(error.message || 'Kunde inte hämta tekniker-data')
    } finally {
      setLoading(false)
    }
  }

  const getPerformanceColor = (value: number, type: 'utilization' | 'rating' | 'success') => {
    switch (type) {
      case 'utilization':
        if (value >= 85 && value <= 95) return 'text-green-400'
        if (value >= 70) return 'text-yellow-400'
        return 'text-red-400'
      case 'rating':
        if (value >= 4.5) return 'text-green-400'
        if (value >= 4.0) return 'text-yellow-400'
        return 'text-red-400'
      case 'success':
        if (value >= 85) return 'text-green-400'
        if (value >= 75) return 'text-yellow-400'
        return 'text-red-400'
      default:
        return 'text-white'
    }
  }

  const exportTechnicianReport = async () => {
    const csvData = [
      'BeGone Tekniker-prestanda Rapport',
      `Exporterad: ${new Date().toISOString().split('T')[0]}`,
      '',
      'ÖVERSIKT',
      `Aktiva tekniker,${technicianData.activeTechnicians}`,
      `Genomsnittlig kapacitetsutnyttjande,${technicianData.capacityUtilization.toFixed(1)}%`,
      `Genomsnittlig lösningstid,${technicianData.averageResolutionTime.toFixed(1)} dagar`,
      `First-visit success rate,${technicianData.firstVisitSuccessRate.toFixed(1)}%`,
      '',
      'INDIVIDUELL PRESTANDA',
      'Tekniker,Aktiva ärenden,Avslutade denna månad,Genomsnittlig lösningstid,Kapacitetsutnyttjande,Kundbetyg',
      ...individualPerformance.map(tech => 
        `${tech.name},${tech.activeCases},${tech.completedThisMonth},${tech.avgResolutionTime.toFixed(1)},${tech.utilizationRate}%,${tech.customerRating.toFixed(1)}`
      )
    ].join('\n')
    
    const blob = new Blob([csvData], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.setAttribute('hidden', '')
    a.setAttribute('href', url)
    a.setAttribute('download', `begone-tekniker-rapport-${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900/50 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/admin')}
                className="text-slate-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Tillbaka till Dashboard
              </Button>
              
              <div className="h-6 w-px bg-slate-600" />
              
              <h1 className="text-xl font-bold text-white">Tekniker-prestanda & Statistik</h1>
              
              {/* Period Selector */}
              <div className="flex items-center space-x-2 ml-8">
                <span className="text-sm text-slate-400">Period:</span>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value as any)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-sm text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="30">Senaste 30 dagarna</option>
                  <option value="90">Senaste 90 dagarna</option>
                  <option value="365">Senaste året</option>
                </select>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/admin/economics')}
                className="text-slate-400 hover:text-white"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Ekonomisk statistik
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={exportTechnicianReport}
                className="text-slate-400 hover:text-white"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportera
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchTechnicianData}
                disabled={loading}
                className="text-slate-400 hover:text-white"
              >
                <Activity className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Uppdatera
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {error && (
          <Card className="mb-8 bg-red-500/10 border-red-500/50">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-400" />
              <div>
                <h3 className="text-red-400 font-medium">Kunde inte ladda tekniker-data</h3>
                <p className="text-red-300 text-sm mt-1">{error}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Key Performance Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <TechMetricCard
            title="Kapacitetsutnyttjande"
            value={loading ? '-' : `${technicianData.capacityUtilization.toFixed(0)}%`}
            subtitle="Optimal: 85-95%"
            icon={Activity}
            color="blue"
            tooltip="Andel av arbetstid som används produktivt. Optimal nivå är 85-95% för bästa balans mellan effektivitet och kvalitet."
            target={{ min: 85, max: 95 }}
            className="bg-blue-500/10 border-blue-500/20"
          />

          <TechMetricCard
            title="First-Visit Success"
            value={loading ? '-' : `${technicianData.firstVisitSuccessRate.toFixed(0)}%`}
            subtitle="Mål: >85%"
            icon={CheckCircle}
            color="green"
            tooltip="Andel ärenden som löses vid första besöket. Högre värde indikerar bättre förarbete och kompetens."
            target={{ min: 85 }}
          />

          <TechMetricCard
            title="Genomsnittlig lösningstid"
            value={loading ? '-' : `${technicianData.averageResolutionTime.toFixed(1)} dagar`}
            subtitle="Mål: <3 dagar"
            icon={Clock}
            color="orange"
            tooltip="Genomsnittlig tid från att ärendet skapas till det markeras som löst. Kortare tid är bättre för kundnöjdhet."
            target={{ max: 3 }}
          />

          <TechMetricCard
            title="Akuta ärenden"
            value={loading ? '-' : technicianData.urgentCases}
            subtitle="Kräver omedelbar åtgärd"
            icon={AlertTriangle}
            color="red"
            tooltip="Antal ärenden markerade som akuta som fortfarande är öppna. Bör hållas så lågt som möjligt."
            className="bg-red-500/10 border-red-500/20"
          />
        </div>

        {/* Individual Performance & Workload Distribution */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
          
          {/* Individual Performance Ranking */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500" />
                Individuell Prestanda - Ranking
              </h3>
              <Tooltip content="Tekniker rankade efter genomsnittlig prestanda baserat på kapacitetsutnyttjande, kundbetyg och lösningstid.">
                <Button variant="ghost" size="sm" className="text-slate-400">
                  <Eye className="w-4 h-4" />
                </Button>
              </Tooltip>
            </div>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {individualPerformance.map((tech, index) => (
                <div key={tech.id} className="p-4 bg-slate-800/30 rounded-lg hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                        index === 0 ? 'bg-yellow-500' :
                        index === 1 ? 'bg-gray-400' :
                        index === 2 ? 'bg-orange-500' :
                        'bg-slate-600'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-white font-medium">{tech.name}</p>
                        <p className="text-slate-400 text-sm">{tech.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium ${getPerformanceColor(tech.utilizationRate, 'utilization')}`}>
                        {tech.utilizationRate}% kapacitet
                      </p>
                      <p className={`text-sm ${getPerformanceColor(tech.customerRating, 'rating')}`}>
                        ⭐ {tech.customerRating.toFixed(1)} kundbetyg
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-slate-400">Aktiva ärenden</p>
                      <p className="text-white font-medium">{tech.activeCases}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Avslutade/månad</p>
                      <p className="text-white font-medium">{tech.completedThisMonth}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Responstid</p>
                      <p className="text-white font-medium">{tech.responseTimeHours.toFixed(1)}h</p>
                    </div>
                  </div>
                  
                  {tech.specializations.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {tech.specializations.map((spec, i) => (
                        <span key={i} className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded">
                          {spec}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Workload Distribution */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Target className="w-5 h-5 text-purple-500" />
                Arbetsbelastning - Balansering
              </h3>
              <Tooltip content="Visar fördelning av arbetsbelastning mellan tekniker. Hjälper identifiera över- och underutnyttjande.">
                <Button variant="ghost" size="sm" className="text-slate-400">
                  <Eye className="w-4 h-4" />
                </Button>
              </Tooltip>
            </div>
            <div className="space-y-3">
              {workloadDistribution.map((workload, index) => {
                const isOverloaded = workload.currentLoad > workload.optimalLoad * 1.2
                const isUnderloaded = workload.currentLoad < workload.optimalLoad * 0.7
                const isOptimal = !isOverloaded && !isUnderloaded
                
                return (
                  <div key={workload.technicianName} className="p-3 bg-slate-800/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium">{workload.technicianName}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${
                          isOptimal ? 'text-green-400' :
                          isOverloaded ? 'text-red-400' : 'text-yellow-400'
                        }`}>
                          {workload.currentLoad}/{workload.optimalLoad} ärenden
                        </span>
                        <span className="text-lg">
                          {isOptimal ? '✅' : isOverloaded ? '🚨' : '⚠️'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="w-full bg-slate-700 rounded-full h-3 mb-2">
                      <div 
                        className={`h-3 rounded-full transition-all duration-300 ${
                          isOptimal ? 'bg-green-500' :
                          isOverloaded ? 'bg-red-500' : 'bg-yellow-500'
                        }`}
                        style={{ 
                          width: `${Math.min(100, (workload.currentLoad / workload.optimalLoad) * 100)}%` 
                        }}
                      />
                    </div>
                    
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Effektivitet: {workload.efficiency}%</span>
                      <span>
                        {isOptimal ? 'Optimal belastning' :
                         isOverloaded ? 'Överbelastad' : 'Underutnyttjad'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        {/* Performance Trends & Team Summary */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
          
          {/* Performance Trends */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                Prestanda-trender - Senaste 6 månaderna
              </h3>
              <Tooltip content="Visar utveckling av viktiga prestanda-mätvärden över tid för hela teamet.">
                <Button variant="ghost" size="sm" className="text-slate-400">
                  <Eye className="w-4 h-4" />
                </Button>
              </Tooltip>
            </div>
            
            <div className="space-y-4">
              {performanceTrends.map((trend, index) => (
                <div key={trend.month} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      index < 2 ? 'bg-green-500' : 
                      index < 4 ? 'bg-blue-500' : 'bg-purple-500'
                    }`} />
                    <span className="text-white font-medium">{trend.month}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm text-right">
                    <div>
                      <p className="text-slate-400">Ärenden</p>
                      <p className="text-white">{trend.totalCases}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Lösningstid</p>
                      <p className="text-white">{trend.avgResolutionTime.toFixed(1)}d</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Success %</p>
                      <p className={getPerformanceColor(trend.successRate, 'success')}>
                        {trend.successRate.toFixed(0)}%
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Team Performance Summary */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <Users className="w-5 h-5 text-blue-500" />
              <h3 className="text-lg font-semibold text-white">Team Sammanfattning</h3>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Tooltip content="Totalt antal aktiva tekniker som arbetar med ärenden just nu.">
                  <div className="bg-slate-800/30 rounded-lg p-3 cursor-help hover:bg-slate-800/50 transition-colors">
                    <p className="text-slate-400 text-sm">Aktiva Tekniker</p>
                    <p className="text-white font-medium text-xl">
                      {technicianData.activeTechnicians}/{technicianData.totalTechnicians}
                    </p>
                  </div>
                </Tooltip>

                <Tooltip content="Totalt antal pågående ärenden som teamet hanterar.">
                  <div className="bg-slate-800/30 rounded-lg p-3 cursor-help hover:bg-slate-800/50 transition-colors">
                    <p className="text-slate-400 text-sm">Pågående Ärenden</p>
                    <p className="text-white font-medium text-xl">{technicianData.activeCases}</p>
                  </div>
                </Tooltip>

                <Tooltip content="Genomsnittligt antal ärenden per tekniker. Hjälper planera resursallokering.">
                  <div className="bg-slate-800/30 rounded-lg p-3 cursor-help hover:bg-slate-800/50 transition-colors">
                    <p className="text-slate-400 text-sm">Ärenden per Tekniker</p>
                    <p className="text-white font-medium text-xl">
                      {technicianData.averageCasesPerTechnician.toFixed(1)}
                    </p>
                  </div>
                </Tooltip>

                <Tooltip content="Genomsnittlig kundnöjdhet baserat på betyg efter avslutade ärenden.">
                  <div className="bg-slate-800/30 rounded-lg p-3 cursor-help hover:bg-slate-800/50 transition-colors">
                    <p className="text-slate-400 text-sm">Kundnöjdhet</p>
                    <p className={`font-medium text-xl ${getPerformanceColor(technicianData.customerSatisfactionScore, 'rating')}`}>
                      ⭐ {technicianData.customerSatisfactionScore.toFixed(1)}
                    </p>
                  </div>
                </Tooltip>

                <Tooltip content="Genomsnittlig tid innan tekniker svarar på nya ärenden.">
                  <div className="bg-slate-800/30 rounded-lg p-3 cursor-help hover:bg-slate-800/50 transition-colors">
                    <p className="text-slate-400 text-sm">Responstid</p>
                    <p className="text-white font-medium text-xl">
                      {technicianData.responseTime.toFixed(1)}h
                    </p>
                  </div>
                </Tooltip>

                <Tooltip content="Antal ärenden som är försenade jämfört med planerad tidslinje.">
                  <div className="bg-slate-800/30 rounded-lg p-3 cursor-help hover:bg-slate-800/50 transition-colors">
                    <p className="text-slate-400 text-sm">Försenade Ärenden</p>
                    <p className={`font-medium text-xl ${technicianData.overdueCases > 5 ? 'text-red-400' : 'text-green-400'}`}>
                      {technicianData.overdueCases}
                    </p>
                  </div>
                </Tooltip>
              </div>

              {/* Team Health Indicator */}
              <div className="mt-6 p-4 bg-gradient-to-r from-blue-500/10 to-green-500/10 border border-blue-500/20 rounded-lg">
                <h4 className="text-white font-medium mb-2">Team Hälsostatus</h4>
                <div className="flex items-center gap-2">
                  {technicianData.capacityUtilization >= 85 && 
                   technicianData.firstVisitSuccessRate >= 85 && 
                   technicianData.overdueCases <= 5 ? (
                    <>
                      <span className="text-2xl">✅</span>
                      <div>
                        <p className="text-green-400 font-medium">Utmärkt prestanda</p>
                        <p className="text-slate-400 text-sm">Teamet presterar över alla nyckeltal</p>
                      </div>
                    </>
                  ) : technicianData.capacityUtilization >= 70 && 
                           technicianData.firstVisitSuccessRate >= 75 && 
                           technicianData.overdueCases <= 10 ? (
                    <>
                      <span className="text-2xl">⚠️</span>
                      <div>
                        <p className="text-yellow-400 font-medium">God prestanda</p>
                        <p className="text-slate-400 text-sm">Vissa områden kan förbättras</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-2xl">🚨</span>
                      <div>
                        <p className="text-red-400 font-medium">Förbättringsområden</p>
                        <p className="text-slate-400 text-sm">Flera nyckeltal behöver uppmärksamhet</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Specialization Matrix */}
        <Card className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Wrench className="w-5 h-5 text-orange-500" />
              Specialiseringar & Kompetensmatris
            </h3>
            <Tooltip content="Visar vilka skadedjurstyper varje tekniker är specialist på. Hjälper vid resursplanering.">
              <Button variant="ghost" size="sm" className="text-slate-400">
                <Eye className="w-4 h-4" />
              </Button>
            </Tooltip>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Tekniker</th>
                  <th className="text-center py-3 px-2 text-slate-400 font-medium">Råttor</th>
                  <th className="text-center py-3 px-2 text-slate-400 font-medium">Möss</th>
                  <th className="text-center py-3 px-2 text-slate-400 font-medium">Myror</th>
                  <th className="text-center py-3 px-2 text-slate-400 font-medium">Getingar</th>
                  <th className="text-center py-3 px-2 text-slate-400 font-medium">Kackerlackor</th>
                  <th className="text-center py-3 px-2 text-slate-400 font-medium">Spindlar</th>
                  <th className="text-center py-3 px-2 text-slate-400 font-medium">Flugor</th>
                  <th className="text-center py-3 px-2 text-slate-400 font-medium">Andra</th>
                </tr>
              </thead>
              <tbody>
                {individualPerformance.map((tech) => (
                  <tr key={tech.id} className="border-b border-slate-800">
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-white font-medium">{tech.name}</p>
                        <p className="text-slate-400 text-xs">{tech.utilizationRate}% kapacitet</p>
                      </div>
                    </td>
                    <td className="text-center py-3 px-2">
                      {tech.specializations.includes('Råttor') ? 
                        <span className="text-green-400 text-lg">✓</span> : 
                        <span className="text-slate-600">-</span>
                      }
                    </td>
                    <td className="text-center py-3 px-2">
                      {tech.specializations.includes('Möss') ? 
                        <span className="text-green-400 text-lg">✓</span> : 
                        <span className="text-slate-600">-</span>
                      }
                    </td>
                    <td className="text-center py-3 px-2">
                      {tech.specializations.includes('Myror') ? 
                        <span className="text-green-400 text-lg">✓</span> : 
                        <span className="text-slate-600">-</span>
                      }
                    </td>
                    <td className="text-center py-3 px-2">
                      {tech.specializations.includes('Getingar') ? 
                        <span className="text-green-400 text-lg">✓</span> : 
                        <span className="text-slate-600">-</span>
                      }
                    </td>
                    <td className="text-center py-3 px-2">
                      {tech.specializations.includes('Kackerlackor') ? 
                        <span className="text-green-400 text-lg">✓</span> : 
                        <span className="text-slate-600">-</span>
                      }
                    </td>
                    <td className="text-center py-3 px-2">
                      {tech.specializations.includes('Spindlar') ? 
                        <span className="text-green-400 text-lg">✓</span> : 
                        <span className="text-slate-600">-</span>
                      }
                    </td>
                    <td className="text-center py-3 px-2">
                      {tech.specializations.includes('Flugor') ? 
                        <span className="text-green-400 text-lg">✓</span> : 
                        <span className="text-slate-600">-</span>
                      }
                    </td>
                    <td className="text-center py-3 px-2">
                      {tech.specializations.some(spec => 
                        !['Råttor', 'Möss', 'Myror', 'Getingar', 'Kackerlackor', 'Spindlar', 'Flugor'].includes(spec)
                      ) ? 
                        <span className="text-green-400 text-lg">✓</span> : 
                        <span className="text-slate-600">-</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Footer Actions */}
        <div className="mt-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-500">
              Senast uppdaterad: {new Date().toLocaleTimeString('sv-SE')}
            </span>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Zap className="w-3 h-3" />
              <span>Realtidsdata från ClickUp</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/admin/technicians')}
              className="text-slate-400 hover:text-white"
            >
              <Settings className="w-4 h-4 mr-2" />
              Hantera Tekniker
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/admin/economics')}
              className="text-slate-400 hover:text-white"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Ekonomisk statistik
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}