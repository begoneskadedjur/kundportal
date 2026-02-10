// src/components/admin/leads/analytics/LeadRevenueAnalytics.tsx - Revenue Analytics Panel

import React, { useState } from 'react'
import { 
  DollarSign,
  TrendingUp,
  Calendar,
  Target,
  AlertTriangle,
  CheckCircle,
  Clock,
  PieChart
} from 'lucide-react'
import { 
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Cell,
  Pie,
  Legend,
  BarChart,
  Bar
} from 'recharts'

import Card from '../../../ui/Card'
import Button from '../../../ui/Button'

interface AnalyticsData {
  leads: any[]
  totalLeads: number
  conversionRate: number
  totalPipelineValue: number
  avgLeadScore: number
  leadsByStatus: Record<string, number>
  leadsBySource: Record<string, number>
  leadsByMonth: Record<string, number>
  teamPerformance: Record<string, any>
  geographicData: Record<string, number>
  revenueByMonth: Record<string, number>
}

interface LeadRevenueAnalyticsProps {
  data: AnalyticsData
}

const LeadRevenueAnalytics: React.FC<LeadRevenueAnalyticsProps> = ({ data }) => {
  const [activeView, setActiveView] = useState<'forecast' | 'breakdown' | 'monthly'>('forecast')
  
  const { leads, totalPipelineValue, revenueByMonth, leadsByStatus } = data

  // Calculate revenue metrics
  const calculateRevenueMetrics = () => {
    const hotLeadsValue = leads
      .filter(lead => lead.status === 'orange_hot' && lead.estimated_value)
      .reduce((sum, lead) => sum + (lead.estimated_value || 0), 0)

    const warmLeadsValue = leads
      .filter(lead => lead.status === 'yellow_warm' && lead.estimated_value)
      .reduce((sum, lead) => sum + (lead.estimated_value || 0), 0)

    const wonDealsValue = leads
      .filter(lead => lead.status === 'green_deal' && lead.estimated_value)
      .reduce((sum, lead) => sum + (lead.estimated_value || 0), 0)

    const coldLeadsValue = leads
      .filter(lead => lead.status === 'blue_cold' && lead.estimated_value)
      .reduce((sum, lead) => sum + (lead.estimated_value || 0), 0)

    // Calculate weighted forecast based on lead status probability
    const probabilityWeights = {
      'orange_hot': 0.7,
      'yellow_warm': 0.4,
      'blue_cold': 0.15,
      'green_deal': 1.0
    }

    const weightedForecast = leads
      .filter(lead => lead.status !== 'red_lost' && lead.estimated_value)
      .reduce((sum, lead) => {
        const weight = probabilityWeights[lead.status as keyof typeof probabilityWeights] || 0
        return sum + ((lead.estimated_value || 0) * weight)
      }, 0)

    return {
      hotLeadsValue,
      warmLeadsValue,
      coldLeadsValue,
      wonDealsValue,
      weightedForecast
    }
  }

  const metrics = calculateRevenueMetrics()

  // Prepare data for monthly revenue chart
  const monthlyData = Object.entries(revenueByMonth)
    .sort(([a], [b]) => new Date(a + ' 1').getTime() - new Date(b + ' 1').getTime())
    .map(([month, revenue]) => ({
      month,
      revenue,
      leads: data.leadsByMonth[month] || 0,
      avgDealSize: data.leadsByMonth[month] ? revenue / data.leadsByMonth[month] : 0
    }))

  // Revenue breakdown by status
  const revenueBreakdown = [
    {
      status: 'Vunna Affärer',
      value: metrics.wonDealsValue,
      color: '#22c55e',
      percentage: totalPipelineValue > 0 ? (metrics.wonDealsValue / totalPipelineValue * 100) : 0
    },
    {
      status: 'Heta Leads',
      value: metrics.hotLeadsValue,
      color: '#f97316',
      percentage: totalPipelineValue > 0 ? (metrics.hotLeadsValue / totalPipelineValue * 100) : 0
    },
    {
      status: 'Ljumna Leads',
      value: metrics.warmLeadsValue,
      color: '#eab308',
      percentage: totalPipelineValue > 0 ? (metrics.warmLeadsValue / totalPipelineValue * 100) : 0
    },
    {
      status: 'Kalla Leads',
      value: metrics.coldLeadsValue,
      color: '#3b82f6',
      percentage: totalPipelineValue > 0 ? (metrics.coldLeadsValue / totalPipelineValue * 100) : 0
    }
  ].filter(item => item.value > 0)

  // Calculate next quarter forecast (simplified)
  const nextQuarterForecast = metrics.weightedForecast * 0.8 // Assuming 80% of current pipeline will close

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatCompactCurrency = (value: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      notation: 'compact'
    }).format(value)
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-lg">
          <p className="text-white font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-slate-300" style={{ color: entry.color }}>
              {entry.name}: {entry.name === 'Intäkter' ? formatCompactCurrency(entry.value) : entry.value}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <Card className="backdrop-blur-sm bg-slate-800/70 border-slate-700/50 p-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-white flex items-center gap-3 mb-4">
          <DollarSign className="w-6 h-6 text-yellow-400" />
          Intäktsanalys
        </h3>
        
        {/* View Selector */}
        <div className="flex gap-2 mb-4">
          <Button
            size="sm"
            variant={activeView === 'forecast' ? 'default' : 'outline'}
            onClick={() => setActiveView('forecast')}
            className={activeView === 'forecast' ? 'bg-[#20c58f]' : 'border-slate-600 text-slate-300'}
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            Prognos
          </Button>
          <Button
            size="sm"
            variant={activeView === 'breakdown' ? 'default' : 'outline'}
            onClick={() => setActiveView('breakdown')}
            className={activeView === 'breakdown' ? 'bg-[#20c58f]' : 'border-slate-600 text-slate-300'}
          >
            <PieChart className="w-4 h-4 mr-2" />
            Fördelning
          </Button>
          <Button
            size="sm"
            variant={activeView === 'monthly' ? 'default' : 'outline'}
            onClick={() => setActiveView('monthly')}
            className={activeView === 'monthly' ? 'bg-[#20c58f]' : 'border-slate-600 text-slate-300'}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Månadsvis
          </Button>
        </div>
      </div>

      {/* Revenue Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <Target className="w-5 h-5 text-green-400" />
            <span className="text-slate-300 text-sm">Aktuell Pipeline</span>
          </div>
          <div className="text-xl font-bold text-white">
            {formatCompactCurrency(totalPipelineValue)}
          </div>
          <p className="text-xs text-slate-400 mt-1">Totalt potential</p>
        </div>

        <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            <span className="text-slate-300 text-sm">Viktad Prognos</span>
          </div>
          <div className="text-xl font-bold text-white">
            {formatCompactCurrency(metrics.weightedForecast)}
          </div>
          <p className="text-xs text-slate-400 mt-1">Förväntad intäkt</p>
        </div>

        <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-5 h-5 text-yellow-400" />
            <span className="text-slate-300 text-sm">Vunna Affärer</span>
          </div>
          <div className="text-xl font-bold text-white">
            {formatCompactCurrency(metrics.wonDealsValue)}
          </div>
          <p className="text-xs text-slate-400 mt-1">Realiserat värde</p>
        </div>
      </div>

      <div className="min-h-80">
        {activeView === 'forecast' && (
          <div className="space-y-4">
            <div className="mb-4">
              <p className="text-slate-400">Pipeline-prognos och sannolikhetsanalys</p>
            </div>
            
            <div className="space-y-3">
              {/* Hot Leads */}
              <div className="flex items-center justify-between p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-400" />
                  <div>
                    <div className="text-white font-medium">Heta Leads (70% sannolikhet)</div>
                    <div className="text-slate-400 text-sm">{leadsByStatus['orange_hot'] || 0} leads</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white font-bold">{formatCurrency(metrics.hotLeadsValue)}</div>
                  <div className="text-orange-400 text-sm">≈ {formatCurrency(metrics.hotLeadsValue * 0.7)}</div>
                </div>
              </div>

              {/* Warm Leads */}
              <div className="flex items-center justify-between p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-yellow-400" />
                  <div>
                    <div className="text-white font-medium">Ljumna Leads (40% sannolikhet)</div>
                    <div className="text-slate-400 text-sm">{leadsByStatus['yellow_warm'] || 0} leads</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white font-bold">{formatCurrency(metrics.warmLeadsValue)}</div>
                  <div className="text-yellow-400 text-sm">≈ {formatCurrency(metrics.warmLeadsValue * 0.4)}</div>
                </div>
              </div>

              {/* Cold Leads */}
              <div className="flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Target className="w-5 h-5 text-blue-400" />
                  <div>
                    <div className="text-white font-medium">Kalla Leads (15% sannolikhet)</div>
                    <div className="text-slate-400 text-sm">{leadsByStatus['blue_cold'] || 0} leads</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white font-bold">{formatCurrency(metrics.coldLeadsValue)}</div>
                  <div className="text-blue-400 text-sm">≈ {formatCurrency(metrics.coldLeadsValue * 0.15)}</div>
                </div>
              </div>

              {/* Forecast Summary */}
              <div className="border-t border-slate-700 pt-3 mt-4">
                <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-6 h-6 text-green-400" />
                    <div>
                      <div className="text-white font-semibold text-lg">Nästa kvartal (prognos)</div>
                      <div className="text-slate-400 text-sm">Baserat på viktad sannolikhet</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-400">
                      {formatCompactCurrency(nextQuarterForecast)}
                    </div>
                    <div className="text-slate-400 text-sm">Förväntad omsättning</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeView === 'breakdown' && (
          <div>
            <div className="mb-4">
              <p className="text-slate-400">Pipeline-värde fördelat per status</p>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={revenueBreakdown}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  nameKey="status"
                  label={({ status, percentage }) => `${status}: ${percentage.toFixed(1)}%`}
                  labelLine={false}
                >
                  {revenueBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), 'Värde']}
                  labelFormatter={(label) => label}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  wrapperStyle={{ color: '#94a3b8' }}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeView === 'monthly' && (
          <div>
            <div className="mb-4">
              <p className="text-slate-400">Månadsvis intäktsutveckling</p>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  dataKey="month" 
                  stroke="#94a3b8"
                  fontSize={12}
                />
                <YAxis 
                  stroke="#94a3b8"
                  fontSize={12}
                  tickFormatter={formatCompactCurrency}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#22c55e"
                  fillOpacity={1}
                  fill="url(#revenueGradient)"
                  strokeWidth={2}
                  name="Intäkter"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Insights - Separated with clear border and spacing */}
      <div className="mt-8 p-4 bg-slate-700/30 rounded-lg border border-slate-700 clear-both">
        <h4 className="text-white font-medium mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-yellow-400" />
          Insikter
        </h4>
        
        {activeView === 'forecast' && (
          <div className="space-y-2">
            <p className="text-slate-300 text-sm">
              • Fokusera på de {leadsByStatus['orange_hot'] || 0} heta leads - högsta sannolikhet för konvertering
            </p>
            <p className="text-slate-300 text-sm">
              • Utveckla strategier för att värma upp {leadsByStatus['blue_cold'] || 0} kalla leads
            </p>
            <p className="text-slate-300 text-sm">
              • Förväntad kvartalsintäkt: {formatCurrency(nextQuarterForecast)} baserat på nuvarande pipeline
            </p>
          </div>
        )}
        
        {activeView === 'breakdown' && (
          <p className="text-slate-300 text-sm">
            Pipeline-fördelningen visar var värdet är koncentrerat. Hög koncentration i heta leads indikerar en sund försäljningsprocess.
          </p>
        )}
        
        {activeView === 'monthly' && (
          <p className="text-slate-300 text-sm">
            Månadsvis trend visar säsongsvariationer och tillväxtmönster. Använd för att planera resurser och sätta mål.
          </p>
        )}
      </div>
    </Card>
  )
}

export default LeadRevenueAnalytics