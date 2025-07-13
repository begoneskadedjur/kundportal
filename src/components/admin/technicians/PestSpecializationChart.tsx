// 📁 src/components/admin/technicians/PestSpecializationChart.tsx - FIXAD VERSION
import React, { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Bug, Target, Filter, TrendingUp, AlertTriangle } from 'lucide-react'
import Card from '../../ui/Card'
import Button from '../../ui/Button'
import { usePestSpecialization } from '../../../hooks/useTechnicianDashboard'
import { formatCurrency } from '../../../utils/formatters'

const PestSpecializationChart: React.FC = () => {
  const { data: pestData, loading, error } = usePestSpecialization()
  const [selectedTechnician, setSelectedTechnician] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'overview' | 'technician'>('overview')

  console.log('🐛 PestSpecializationChart render:', { pestData, loading, error })

  // Loading state
  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Bug className="w-6 h-6 text-purple-500" />
          <div>
            <h2 className="text-lg font-semibold text-white">Skadedjurs Specialiseringar</h2>
            <p className="text-sm text-slate-400">Laddar specialiseringsdata...</p>
          </div>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
        </div>
      </Card>
    )
  }

  // Error state
  if (error) {
    console.error('🐛 PestSpecializationChart error:', error)
    return (
      <Card className="p-6 bg-red-500/10 border-red-500/20">
        <div className="flex items-center gap-3 mb-6">
          <AlertTriangle className="w-6 h-6 text-red-500" />
          <div>
            <h2 className="text-lg font-semibold text-white">Skadedjurs Specialiseringar</h2>
            <p className="text-sm text-slate-400">Fel vid laddning: {error}</p>
          </div>
        </div>
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-red-400">Ett fel uppstod vid laddning av specialiseringsdata.</p>
          <p className="text-slate-400 text-sm mt-1">Kontrollera konsolen för mer information.</p>
        </div>
      </Card>
    )
  }

  // Empty state
  if (!pestData || !Array.isArray(pestData) || pestData.length === 0) {
    console.log('🐛 PestSpecializationChart: No data available')
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Bug className="w-6 h-6 text-slate-500" />
          <div>
            <h2 className="text-lg font-semibold text-white">Skadedjurs Specialiseringar</h2>
            <p className="text-sm text-slate-400">Ingen specialiseringsdata tillgänglig</p>
          </div>
        </div>
        <div className="h-80 flex items-center justify-center text-slate-400">
          <div className="text-center">
            <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Ingen skadedjursdata tillgänglig</p>
            <p className="text-sm mt-2">Data kommer att visas när tekniker har arbetat med ärenden</p>
          </div>
        </div>
      </Card>
    )
  }

  // 🔥 FIXAD processedData - Borttagen från useMemo för att undvika oändlig loop
  const processData = () => {
    try {
      console.log('🐛 Processing pest data:', pestData)
      
      // Säker extraktion av unika tekniker
      const uniqueTechnicians: string[] = []
      pestData.forEach(p => {
        if (p?.technician_name && !uniqueTechnicians.includes(p.technician_name)) {
          uniqueTechnicians.push(p.technician_name)
        }
      })
      
      console.log('🐛 Unique technicians:', uniqueTechnicians)
      
      // Aggregera skadedjur per typ (totalt över alla tekniker och källor)
      const pestTypeMap = new Map<string, { cases: number, revenue: number, technicians: Set<string> }>()
      
      pestData.forEach(item => {
        try {
          if (!item || !item.pest_type || !item.technician_name) return
          
          if (!pestTypeMap.has(item.pest_type)) {
            pestTypeMap.set(item.pest_type, { cases: 0, revenue: 0, technicians: new Set() })
          }
          const pest = pestTypeMap.get(item.pest_type)!
          pest.cases += item.case_count || 0
          pest.revenue += item.total_revenue || 0
          pest.technicians.add(item.technician_name)
        } catch (itemError) {
          console.error('🐛 Error processing pest item:', itemError, item)
        }
      })

      const pestOverview = Array.from(pestTypeMap.entries()).map(([type, data]) => ({
        pest_type: type,
        total_cases: data.cases,
        total_revenue: data.revenue,
        avg_case_value: data.cases > 0 ? data.revenue / data.cases : 0,
        technician_count: data.technicians.size
      })).sort((a, b) => b.total_revenue - a.total_revenue)

      console.log('🐛 Processed pest overview:', pestOverview)

      return {
        uniqueTechnicians,
        pestOverview,
        technicianData: selectedTechnician 
          ? pestData.filter(p => p?.technician_name === selectedTechnician)
          : []
      }
    } catch (processError) {
      console.error('🐛 Error in processData:', processError)
      return {
        uniqueTechnicians: [],
        pestOverview: [],
        technicianData: []
      }
    }
  }

  // 🔥 Anropa processData direkt istället för useMemo
  const processedData = processData()

  // Färger för pie chart
  const colors = [
    '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', 
    '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1',
    '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4'
  ]

  const CustomTooltip = ({ active, payload }: any) => {
    try {
      if (active && payload && payload.length) {
        const data = payload[0].payload
        return (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
            <p className="text-white font-medium">{data.pest_type || 'Okänt'}</p>
            <p className="text-slate-300 text-sm">Ärenden: {data.total_cases || 0}</p>
            <p className="text-slate-300 text-sm">Intäkt: {formatCurrency(data.total_revenue || 0)}</p>
            <p className="text-slate-300 text-sm">Genomsnitt: {formatCurrency(data.avg_case_value || 0)}</p>
            <p className="text-slate-300 text-sm">Tekniker: {data.technician_count || 0}</p>
          </div>
        )
      }
      return null
    } catch (tooltipError) {
      console.error('🐛 Tooltip error:', tooltipError)
      return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Header och kontroller */}
      <Card className="p-6 bg-gradient-to-br from-purple-600/10 to-pink-600/10 border-purple-500/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Bug className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Skadedjurs Specialiseringar</h2>
              <p className="text-sm text-slate-400">Expertområden och intäktsfördelning per skadedjurstyp</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={viewMode === 'overview' ? "default" : "secondary"}
              onClick={() => {
                setViewMode('overview')
                setSelectedTechnician(null)
              }}
            >
              Översikt
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'technician' ? "default" : "secondary"}
              onClick={() => setViewMode('technician')}
            >
              Per Tekniker
            </Button>
          </div>
        </div>

        {/* Tekniker-väljare för per tekniker vy */}
        {viewMode === 'technician' && (
          <div className="mb-4">
            <p className="text-sm text-slate-400 mb-2">Välj tekniker:</p>
            <div className="flex flex-wrap gap-2">
              {processedData.uniqueTechnicians.map(techName => (
                <Button
                  key={techName}
                  size="sm"
                  variant={selectedTechnician === techName ? "default" : "secondary"}
                  onClick={() => setSelectedTechnician(techName)}
                  className="text-xs"
                >
                  {techName}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Statistik för vald vy */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="text-center p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
            <p className="text-purple-400 font-bold text-sm">
              {viewMode === 'overview' 
                ? processedData.pestOverview.length 
                : processedData.technicianData.length
              }
            </p>
            <p className="text-purple-300 text-xs">Skadedjurstyper</p>
          </div>
          <div className="text-center p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-blue-400 font-bold text-sm">
              {viewMode === 'overview'
                ? processedData.pestOverview.reduce((sum, p) => sum + (p.total_cases || 0), 0)
                : processedData.technicianData.reduce((sum, p) => sum + (p.case_count || 0), 0)
              }
            </p>
            <p className="text-blue-300 text-xs">Totala ärenden</p>
          </div>
          <div className="text-center p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-green-400 font-bold text-sm">
              {formatCurrency(
                viewMode === 'overview'
                  ? processedData.pestOverview.reduce((sum, p) => sum + (p.total_revenue || 0), 0)
                  : processedData.technicianData.reduce((sum, p) => sum + (p.total_revenue || 0), 0)
              )}
            </p>
            <p className="text-green-300 text-xs">Total intäkt</p>
          </div>
          <div className="text-center p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
            <p className="text-orange-400 font-bold text-sm">
              {processedData.uniqueTechnicians.length}
            </p>
            <p className="text-orange-300 text-xs">Aktiva tekniker</p>
          </div>
        </div>
      </Card>

      {/* Översikt - Pie Chart och Bar Chart */}
      {viewMode === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart - Intäktsfördelning */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Intäktsfördelning per Skadedjur</h3>
            {processedData.pestOverview.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={processedData.pestOverview.slice(0, 10)} // Top 10
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="total_revenue"
                      nameKey="pest_type"
                    >
                      {processedData.pestOverview.slice(0, 10).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <Bug className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Ingen data för pie chart</p>
                </div>
              </div>
            )}
          </Card>

          {/* Bar Chart - Genomsnittspriser */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Genomsnittspris per Ärende</h3>
            {processedData.pestOverview.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={processedData.pestOverview.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="pest_type" 
                      stroke="#9ca3af"
                      fontSize={12}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      stroke="#9ca3af"
                      fontSize={12}
                      tickFormatter={(value) => formatCurrency(value).replace(' kr', 'k')}
                    />
                    <Tooltip 
                      formatter={(value) => [formatCurrency(Number(value)), 'Genomsnittspris']}
                      labelStyle={{ color: '#ffffff' }}
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                    />
                    <Bar 
                      dataKey="avg_case_value" 
                      fill="#8b5cf6" 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <Bug className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Ingen data för bar chart</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Per Tekniker vy */}
      {viewMode === 'technician' && selectedTechnician && (
        <div className="space-y-6">
          {/* Tekniker specialisering */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              {selectedTechnician} - Skadedjurs Specialiseringar
            </h3>
            
            {processedData.technicianData.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {processedData.technicianData
                  .sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0))
                  .map((item, index) => (
                    <div 
                      key={`${item.pest_type}-${item.source}-${index}`}
                      className="p-4 bg-slate-800/50 rounded-lg border border-slate-700"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-white">{item.pest_type || 'Okänt'}</h4>
                        <span className={`text-xs px-2 py-1 rounded ${
                          item.source === 'private' ? 'bg-purple-500/20 text-purple-400' :
                          item.source === 'business' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-green-500/20 text-green-400'
                        }`}>
                          {item.source === 'private' ? 'Privatperson' :
                           item.source === 'business' ? 'Företag' : 'Avtalskund'}
                        </span>
                      </div>
                      
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Ärenden:</span>
                          <span className="text-white">{item.case_count || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Total intäkt:</span>
                          <span className="text-white">{formatCurrency(item.total_revenue || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Genomsnitt:</span>
                          <span className="text-white">{formatCurrency(item.avg_case_value || 0)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <Bug className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Ingen skadedjursdata för {selectedTechnician}</p>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Per Tekniker vy men ingen tekniker vald */}
      {viewMode === 'technician' && !selectedTechnician && (
        <Card className="p-6">
          <div className="text-center py-8 text-slate-400">
            <Filter className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Välj en tekniker ovan för att se deras specialiseringar</p>
          </div>
        </Card>
      )}

      {/* Insights */}
      <Card className="p-6 bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-slate-400" />
          Specialiserings Insights
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div>
            <h4 className="text-slate-300 font-medium mb-2">🏆 Mest Lönsam Skadedjur</h4>
            <p className="text-slate-400">
              {processedData.pestOverview.length > 0 
                ? `${processedData.pestOverview[0].pest_type}: ${formatCurrency(processedData.pestOverview[0].avg_case_value)}/ärende`
                : 'Ingen data tillgänglig'
              }
            </p>
          </div>
          
          <div>
            <h4 className="text-slate-300 font-medium mb-2">📊 Mest Vanlig</h4>
            <p className="text-slate-400">
              {(() => {
                const mostCommon = processedData.pestOverview.reduce((max, curr) => 
                  (curr.total_cases || 0) > (max?.total_cases || 0) ? curr : max, processedData.pestOverview[0])
                return mostCommon 
                  ? `${mostCommon.pest_type}: ${mostCommon.total_cases} ärenden`
                  : 'Ingen data tillgänglig'
              })()}
            </p>
          </div>
          
          <div>
            <h4 className="text-slate-300 font-medium mb-2">🎯 Specialist-Rekommendation</h4>
            <p className="text-slate-400">
              {(() => {
                // Hitta skadedjur med få tekniker men hög intäkt
                const specialized = processedData.pestOverview.filter(p => 
                  (p.technician_count || 0) <= 2 && (p.total_revenue || 0) > 50000)
                return specialized.length > 0
                  ? `Utbilda fler inom ${specialized[0].pest_type}`
                  : 'Bra spridning av kompetens'
              })()}
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default PestSpecializationChart