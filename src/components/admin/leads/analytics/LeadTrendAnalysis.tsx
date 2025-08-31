// src/components/admin/leads/analytics/LeadTrendAnalysis.tsx - Trend Analysis with Charts

import React, { useState } from 'react'
import { 
  TrendingUp,
  Calendar,
  BarChart3,
  PieChart,
  LineChart
} from 'lucide-react'
import { 
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  PieChart as RechartsPieChart,
  Cell,
  Pie,
  Legend
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

interface LeadTrendAnalysisProps {
  data: AnalyticsData
}

const LeadTrendAnalysis: React.FC<LeadTrendAnalysisProps> = ({ data }) => {
  const [activeChart, setActiveChart] = useState<'volume' | 'sources' | 'status'>('volume')
  
  const { leadsByMonth, leadsBySource, leadsByStatus, revenueByMonth } = data

  // Prepare data for volume trend chart - ensure we have data
  const volumeTrendData = Object.entries(leadsByMonth)
    .sort(([a], [b]) => {
      // Improved date parsing for Swedish month format
      const dateA = new Date(a.includes(' ') ? a : `${a} 1`)
      const dateB = new Date(b.includes(' ') ? b : `${b} 1`)
      return dateA.getTime() - dateB.getTime()
    })
    .map(([month, count]) => ({
      month: month.length > 10 ? month.substring(0, 10) : month, // Truncate long month names
      leads: count || 0,
      revenue: revenueByMonth[month] || 0
    }))
    .filter(item => item.leads > 0 || item.revenue > 0) // Only show months with data

  // Prepare data for source performance - ensure we have data
  const sourceData = Object.entries(leadsBySource)
    .filter(([source, count]) => count > 0) // Filter out zero counts
    .map(([source, count]) => ({
      source: source.length > 15 ? source.substring(0, 15) + '...' : source || 'Okänd källa',
      fullSource: source || 'Okänd källa',
      count,
      percentage: data.totalLeads > 0 ? ((count / data.totalLeads) * 100).toFixed(1) : '0.0'
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8) // Top 8 sources

  // Prepare data for status distribution
  const statusData = Object.entries(leadsByStatus).map(([status, count]) => {
    let label = status
    let color = '#64748b'
    
    switch (status) {
      case 'blue_cold':
        label = 'Kalla'
        color = '#3b82f6'
        break
      case 'yellow_warm':
        label = 'Ljumna'
        color = '#eab308'
        break
      case 'orange_hot':
        label = 'Heta'
        color = '#f97316'
        break
      case 'green_deal':
        label = 'Affärer'
        color = '#22c55e'
        break
      case 'red_lost':
        label = 'Förlorade'
        color = '#ef4444'
        break
    }
    
    return {
      status: label,
      count,
      percentage: ((count / data.totalLeads) * 100).toFixed(1),
      color
    }
  }).filter(item => item.count > 0)

  const CHART_COLORS = ['#3b82f6', '#eab308', '#f97316', '#22c55e', '#ef4444', '#8b5cf6', '#06b6d4', '#f59e0b']

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-lg">
          <p className="text-white font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-slate-300" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      notation: 'compact'
    }).format(value)
  }

  return (
    <Card className="backdrop-blur-sm bg-slate-800/70 border-slate-700/50 p-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-white flex items-center gap-3 mb-4">
          <TrendingUp className="w-6 h-6 text-purple-400" />
          Trendanalys
        </h3>
        
        {/* Chart Type Selector */}
        <div className="flex gap-2 mb-4">
          <Button
            size="sm"
            variant={activeChart === 'volume' ? 'default' : 'outline'}
            onClick={() => setActiveChart('volume')}
            className={activeChart === 'volume' ? 'bg-purple-600' : 'border-slate-600 text-slate-300'}
          >
            <LineChart className="w-4 h-4 mr-2" />
            Volym över tid
          </Button>
          <Button
            size="sm"
            variant={activeChart === 'sources' ? 'default' : 'outline'}
            onClick={() => setActiveChart('sources')}
            className={activeChart === 'sources' ? 'bg-purple-600' : 'border-slate-600 text-slate-300'}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Källor
          </Button>
          <Button
            size="sm"
            variant={activeChart === 'status' ? 'default' : 'outline'}
            onClick={() => setActiveChart('status')}
            className={activeChart === 'status' ? 'bg-purple-600' : 'border-slate-600 text-slate-300'}
          >
            <PieChart className="w-4 h-4 mr-2" />
            Status
          </Button>
        </div>
      </div>

      <div className="h-96">
        {activeChart === 'volume' && (
          <div>
            <div className="mb-4">
              <p className="text-slate-400">Lead-volym och pipeline-värde över tid</p>
              {volumeTrendData.length === 0 && (
                <p className="text-slate-500 text-sm mt-2">Ingen data tillgänglig för vald tidsperiod</p>
              )}
            </div>
            {volumeTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart data={volumeTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis 
                    dataKey="month" 
                    stroke="#94a3b8"
                    fontSize={12}
                  />
                  <YAxis 
                    yAxisId="left"
                    stroke="#94a3b8"
                    fontSize={12}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    stroke="#94a3b8"
                    fontSize={12}
                    tickFormatter={formatCurrency}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="leads" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                    name="Leads"
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#22c55e" 
                    strokeWidth={3}
                    dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: '#22c55e', strokeWidth: 2 }}
                    name="Pipeline-värde"
                  />
                </RechartsLineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                <div className="text-center">
                  <LineChart className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Ingen data att visa för vald tidsperiod</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeChart === 'sources' && (
          <div>
            <div className="mb-4">
              <p className="text-slate-400">Topp lead-källor efter volym</p>
              {sourceData.length === 0 && (
                <p className="text-slate-500 text-sm mt-2">Ingen källdata tillgänglig</p>
              )}
            </div>
            {sourceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={sourceData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis 
                    type="number"
                    stroke="#94a3b8"
                    fontSize={12}
                  />
                  <YAxis 
                    type="category"
                    dataKey="source" 
                    stroke="#94a3b8"
                    fontSize={12}
                    width={100}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="count" 
                    fill="#3b82f6"
                    name="Antal leads"
                    radius={[0, 4, 4, 0]}
                  />
                </RechartsBarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                <div className="text-center">
                  <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Ingen källdata att visa</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeChart === 'status' && (
          <div>
            <div className="mb-4">
              <p className="text-slate-400">Fördelning av lead-status</p>
              {statusData.length === 0 && (
                <p className="text-slate-500 text-sm mt-2">Ingen statusdata tillgänglig</p>
              )}
            </div>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    dataKey="count"
                    nameKey="status"
                    label={({ status, percentage }) => `${status}: ${percentage}%`}
                    labelLine={false}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    wrapperStyle={{ color: '#94a3b8' }}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                <div className="text-center">
                  <PieChart className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Ingen statusdata att visa</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chart Insights */}
      <div className="mt-6 p-4 bg-slate-700/30 rounded-lg border border-slate-700">
        <h4 className="text-white font-medium mb-2 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-400" />
          Insikter
        </h4>
        
        {activeChart === 'volume' && (
          <p className="text-slate-300 text-sm">
            Analysen visar lead-volym och pipeline-värde över tid. Använd denna data för att identifiera säsongstrender och planera resurser.
          </p>
        )}
        
        {activeChart === 'sources' && (
          <p className="text-slate-300 text-sm">
            Fokusera på de mest effektiva lead-källorna och överväg att öka investeringen där ROI är högst.
          </p>
        )}
        
        {activeChart === 'status' && (
          <p className="text-slate-300 text-sm">
            Status-fördelningen visar var leads fastnar i processen. Hög andel "kalla" leads kan indikera behov av bättre kvalificering.
          </p>
        )}
      </div>
    </Card>
  )
}

export default LeadTrendAnalysis