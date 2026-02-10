// src/components/admin/leads/analytics/LeadGeographicDistribution.tsx - Geographic Distribution Analysis

import React, { useState, useEffect } from 'react'
import { 
  MapPin,
  BarChart3,
  TrendingUp,
  Users,
  Target,
  Award,
  Search
} from 'lucide-react'
import { 
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'

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

interface RegionData {
  region: string
  totalLeads: number
  convertedLeads: number
  conversionRate: number
  totalValue: number
  avgDealSize: number
  topCity?: string
}

interface LeadGeographicDistributionProps {
  data: AnalyticsData
}

const LeadGeographicDistribution: React.FC<LeadGeographicDistributionProps> = ({ data }) => {
  const [regionData, setRegionData] = useState<RegionData[]>([])
  const [viewMode, setViewMode] = useState<'regions' | 'cities'>('regions')
  const [sortBy, setSortBy] = useState<'leads' | 'conversion' | 'value'>('leads')

  useEffect(() => {
    processGeographicData()
  }, [data, viewMode])

  const processGeographicData = () => {
    const { leads } = data
    
    if (viewMode === 'regions') {
      // Group leads by region (simplified - in real implementation, you'd use proper geographic data)
      const regionMap = new Map<string, RegionData>()

      leads.forEach(lead => {
        // Extract region from address or use placeholder logic
        const region = extractRegion(lead.address || lead.city || 'Okänd region')
        
        if (!regionMap.has(region)) {
          regionMap.set(region, {
            region,
            totalLeads: 0,
            convertedLeads: 0,
            conversionRate: 0,
            totalValue: 0,
            avgDealSize: 0,
            topCity: extractCity(lead.address || lead.city || '')
          })
        }

        const regionStats = regionMap.get(region)!
        regionStats.totalLeads++
        
        if (lead.status === 'green_deal') {
          regionStats.convertedLeads++
        }
        
        if (lead.estimated_value && lead.status !== 'red_lost') {
          regionStats.totalValue += lead.estimated_value
        }
      })

      // Calculate derived metrics
      const processedRegions = Array.from(regionMap.values()).map(region => ({
        ...region,
        conversionRate: region.totalLeads > 0 ? (region.convertedLeads / region.totalLeads) * 100 : 0,
        avgDealSize: region.convertedLeads > 0 ? region.totalValue / region.convertedLeads : 0
      }))

      setRegionData(processedRegions.filter(region => region.totalLeads > 0))
    }
  }

  // Helper function to extract region from address (simplified)
  const extractRegion = (address: string): string => {
    if (!address || address === 'Okänd region') return 'Okänd region'
    
    // Swedish regions mapping (simplified)
    const regionKeywords = {
      'Stockholm': ['stockholm', 'södermalm', 'östermalm', 'vasastan', 'gamla stan'],
      'Göteborg': ['göteborg', 'gothenburg', 'mölndal', 'partille', 'lerum'],
      'Malmö': ['malmö', 'lund', 'helsingborg', 'landskrona', 'trelleborg'],
      'Uppsala': ['uppsala', 'enköping', 'håbo'],
      'Västerås': ['västerås', 'hallstahammar', 'surahammar'],
      'Örebro': ['örebro', 'kumla', 'hallsberg'],
      'Linköping': ['linköping', 'norrköping', 'motala'],
      'Helsingborg': ['helsingborg', 'höganäs', 'bjuv'],
      'Jönköping': ['jönköping', 'huskvarna', 'gränna'],
      'Norrköping': ['norrköping', 'söderköping', 'valdemarsvik']
    }

    const lowerAddress = address.toLowerCase()
    
    for (const [region, keywords] of Object.entries(regionKeywords)) {
      if (keywords.some(keyword => lowerAddress.includes(keyword))) {
        return region
      }
    }
    
    return 'Övriga regioner'
  }

  const extractCity = (address: string): string => {
    if (!address) return 'Okänd stad'
    // Simple extraction - in real implementation, use proper address parsing
    const parts = address.split(',')
    return parts[0]?.trim() || 'Okänd stad'
  }

  const sortedRegionData = [...regionData].sort((a, b) => {
    switch (sortBy) {
      case 'leads':
        return b.totalLeads - a.totalLeads
      case 'conversion':
        return b.conversionRate - a.conversionRate
      case 'value':
        return b.totalValue - a.totalValue
      default:
        return b.totalLeads - a.totalLeads
    }
  })

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      notation: 'compact'
    }).format(value)
  }

  const getRegionColor = (index: number): string => {
    const colors = ['#3b82f6', '#22c55e', '#f97316', '#eab308', '#8b5cf6', '#ef4444', '#06b6d4', '#f59e0b']
    return colors[index % colors.length]
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-slate-800 border border-slate-700 p-4 rounded-lg shadow-lg">
          <p className="text-white font-medium mb-2">{label}</p>
          <div className="space-y-1">
            <p className="text-slate-300">Leads: {data.totalLeads}</p>
            <p className="text-slate-300">Konverterade: {data.convertedLeads}</p>
            <p className="text-slate-300">Konvertering: {data.conversionRate.toFixed(1)}%</p>
            <p className="text-slate-300">Värde: {formatCurrency(data.totalValue)}</p>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-1.5 mb-2">
          <MapPin className="w-4 h-4 text-blue-400" />
          Geografisk fördelning
        </h3>
        
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={viewMode === 'regions' ? 'default' : 'outline'}
              onClick={() => setViewMode('regions')}
              className={viewMode === 'regions' ? 'bg-[#20c58f]' : 'border-slate-600 text-slate-300'}
            >
              Regioner
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'cities' ? 'default' : 'outline'}
              onClick={() => setViewMode('cities')}
              className={viewMode === 'cities' ? 'bg-[#20c58f]' : 'border-slate-600 text-slate-300'}
              disabled
            >
              Städer (kommer snart)
            </Button>
          </div>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'leads' | 'conversion' | 'value')}
            className="bg-slate-800 border border-slate-700 text-white px-3 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
          >
            <option value="leads">Sortera efter antal leads</option>
            <option value="conversion">Sortera efter konvertering</option>
            <option value="value">Sortera efter värde</option>
          </select>
        </div>
      </div>

      {regionData.length === 0 ? (
        <div className="text-center py-4">
          <MapPin className="w-8 h-8 text-slate-500 mx-auto mb-2" />
          <p className="text-slate-400">Ingen geografisk data tillgänglig</p>
          <p className="text-slate-500 text-sm mt-2">
            Kontrollera att leads har adressinformation
          </p>
        </div>
      ) : (
        <>
          {/* Chart */}
          <div className="h-48 mb-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sortedRegionData.slice(0, 8)} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  type="number"
                  stroke="#94a3b8"
                  fontSize={12}
                />
                <YAxis 
                  type="category"
                  dataKey="region" 
                  stroke="#94a3b8"
                  fontSize={12}
                  width={80}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey={sortBy === 'leads' ? 'totalLeads' : sortBy === 'conversion' ? 'conversionRate' : 'totalValue'}
                  radius={[0, 4, 4, 0]}
                >
                  {sortedRegionData.slice(0, 8).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getRegionColor(index)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Region Details Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-2 text-sm font-medium text-slate-300">
                    Region
                  </th>
                  <th className="text-center py-3 px-2 text-sm font-medium text-slate-300">
                    Leads
                  </th>
                  <th className="text-center py-3 px-2 text-sm font-medium text-slate-300">
                    Konverterade
                  </th>
                  <th className="text-center py-3 px-2 text-sm font-medium text-slate-300">
                    Konv. %
                  </th>
                  <th className="text-center py-3 px-2 text-sm font-medium text-slate-300">
                    Värde
                  </th>
                  <th className="text-center py-3 px-2 text-sm font-medium text-slate-300">
                    Snitt/Affär
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {sortedRegionData.map((region, index) => (
                  <tr 
                    key={region.region}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: getRegionColor(index) }}
                        />
                        <div>
                          <div className="text-sm font-medium text-white">{region.region}</div>
                          {region.topCity && (
                            <div className="text-xs text-slate-400">{region.topCity}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-center py-3 px-2">
                      <span className="text-white font-medium">{region.totalLeads}</span>
                    </td>
                    <td className="text-center py-3 px-2">
                      <span className="text-green-400 font-medium">{region.convertedLeads}</span>
                    </td>
                    <td className="text-center py-3 px-2">
                      <div className="flex items-center justify-center gap-2">
                        <span className={`font-bold ${
                          region.conversionRate >= 25 ? 'text-green-400' :
                          region.conversionRate >= 15 ? 'text-yellow-400' :
                          region.conversionRate >= 5 ? 'text-blue-400' :
                          'text-slate-400'
                        }`}>
                          {region.conversionRate.toFixed(1)}%
                        </span>
                        {region.conversionRate >= 20 && <TrendingUp className="w-3 h-3 text-green-400" />}
                      </div>
                    </td>
                    <td className="text-center py-3 px-2">
                      <span className="text-white font-mono text-sm">
                        {formatCurrency(region.totalValue)}
                      </span>
                    </td>
                    <td className="text-center py-3 px-2">
                      <span className="text-slate-300 font-mono text-sm">
                        {region.avgDealSize > 0 ? formatCurrency(region.avgDealSize) : '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary Stats */}
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="text-center p-3 bg-slate-700/30 rounded-lg">
              <div className="text-lg font-bold text-white">
                {regionData.length}
              </div>
              <div className="text-sm text-slate-400">Aktiva regioner</div>
            </div>
            
            <div className="text-center p-3 bg-slate-700/30 rounded-lg">
              <div className="text-lg font-bold text-white">
                {sortedRegionData[0]?.region || 'N/A'}
              </div>
              <div className="text-sm text-slate-400">Ledande region</div>
            </div>
            
            <div className="text-center p-3 bg-slate-700/30 rounded-lg">
              <div className="text-lg font-bold text-white">
                {regionData.length > 0 ? 
                  (regionData.reduce((sum, region) => sum + region.conversionRate, 0) / regionData.length).toFixed(1) : 0
                }%
              </div>
              <div className="text-sm text-slate-400">Genomsnittlig konvertering</div>
            </div>
          </div>

          {/* Insights */}
          <div className="mt-3 p-3 bg-slate-700/30 rounded-lg border border-slate-700">
            <h4 className="text-white font-medium mb-2 flex items-center gap-2">
              <Award className="w-4 h-4 text-blue-400" />
              Geografiska insikter
            </h4>
            <div className="space-y-2">
              {sortedRegionData[0] && (
                <p className="text-slate-300 text-sm">
                  • {sortedRegionData[0].region} leder med {sortedRegionData[0].totalLeads} leads och {sortedRegionData[0].conversionRate.toFixed(1)}% konvertering
                </p>
              )}
              
              {regionData.filter(r => r.conversionRate >= 25).length > 0 && (
                <p className="text-slate-300 text-sm">
                  • {regionData.filter(r => r.conversionRate >= 25).length} regioner har över 25% konvertering - fokusområden för expansion
                </p>
              )}
              
              <p className="text-slate-300 text-sm">
                • Överväg att allokera mer resurser till regioner med hög konvertering men få leads
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default LeadGeographicDistribution