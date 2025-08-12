import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { 
  TrafficLightStatus,
  TrafficLightColor,
  getTrafficLightLabel,
  getPestLevelLabel,
  getProblemRatingLabel 
} from '../../../types/multisite'
import {
  AlertCircle,
  Building2,
  MapPin,
  Filter,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react'
import { PageHeader } from '../../../components/shared'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import toast from 'react-hot-toast'

interface FilterState {
  searchTerm: string
  organization: string
  region: string
  status: TrafficLightColor | 'all'
}

export default function TrafficLightOverview() {
  const [trafficLights, setTrafficLights] = useState<TrafficLightStatus[]>([])
  const [organizations, setOrganizations] = useState<any[]>([])
  const [regions, setRegions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    organization: 'all',
    region: 'all',
    status: 'all'
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch traffic light data from view
      const { data: lights, error: lightsError } = await supabase
        .from('traffic_light_overview')
        .select('*')
        .order('traffic_light_color')
        .order('customer_name')

      if (lightsError) throw lightsError

      setTrafficLights(lights || [])

      // Fetch organizations
      const { data: orgs, error: orgsError } = await supabase
        .from('multisite_organizations')
        .select('id, name')
        .eq('is_active', true)
        .order('name')

      if (orgsError) throw orgsError
      setOrganizations(orgs || [])

      // Extract unique regions
      const uniqueRegions = [...new Set(
        (lights || [])
          .map(l => l.region)
          .filter(Boolean)
      )].sort()
      setRegions(uniqueRegions)

    } catch (error) {
      console.error('Error fetching traffic light data:', error)
      toast.error('Kunde inte hämta trafikljusdata')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
    toast.success('Data uppdaterad')
  }

  const handleExport = () => {
    const csvContent = [
      ['Kund', 'Anläggning', 'Region', 'Status', 'Skadedjursnivå', 'Problembedömning', 'Trend', 'Senaste bedömning'],
      ...filteredLights.map(light => [
        light.customer_name,
        light.site_name || '-',
        light.region || '-',
        getTrafficLightLabel(light.traffic_light_color),
        light.pest_level !== null ? getPestLevelLabel(light.pest_level) : '-',
        light.problem_rating !== null ? getProblemRatingLabel(light.problem_rating) : '-',
        light.pest_level_trend || '-',
        light.assessment_date ? new Date(light.assessment_date).toLocaleDateString('sv-SE') : '-'
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `trafikljus-oversikt-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  // Filter traffic lights
  const filteredLights = trafficLights.filter(light => {
    if (filters.searchTerm && !light.customer_name.toLowerCase().includes(filters.searchTerm.toLowerCase()) &&
        !light.site_name?.toLowerCase().includes(filters.searchTerm.toLowerCase())) {
      return false
    }
    if (filters.region !== 'all' && light.region !== filters.region) {
      return false
    }
    if (filters.status !== 'all' && light.traffic_light_color !== filters.status) {
      return false
    }
    return true
  })

  // Calculate statistics
  const stats = {
    total: filteredLights.length,
    red: filteredLights.filter(l => l.traffic_light_color === 'red').length,
    yellow: filteredLights.filter(l => l.traffic_light_color === 'yellow').length,
    green: filteredLights.filter(l => l.traffic_light_color === 'green').length,
    gray: filteredLights.filter(l => l.traffic_light_color === 'gray').length
  }

  const getStatusIcon = (color: TrafficLightColor) => {
    switch (color) {
      case 'red':
        return <XCircle className="w-5 h-5 text-red-400" />
      case 'yellow':
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />
      case 'green':
        return <CheckCircle className="w-5 h-5 text-green-400" />
      default:
        return <Minus className="w-5 h-5 text-slate-400" />
    }
  }

  const getStatusBg = (color: TrafficLightColor) => {
    switch (color) {
      case 'red':
        return 'bg-red-500/20 border-red-500/30'
      case 'yellow':
        return 'bg-yellow-500/20 border-yellow-500/30'
      case 'green':
        return 'bg-green-500/20 border-green-500/30'
      default:
        return 'bg-slate-700/50 border-slate-600'
    }
  }

  const getTrendIcon = (trend: string | null) => {
    switch (trend) {
      case 'improving':
        return <TrendingDown className="w-4 h-4 text-green-400" />
      case 'worsening':
        return <TrendingUp className="w-4 h-4 text-red-400" />
      default:
        return <Minus className="w-4 h-4 text-slate-400" />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
      <div className="max-w-7xl mx-auto">
        <PageHeader
          title="Trafikljusöversikt"
          description="Kvalitetsövervakning för alla anläggningar"
          icon={AlertCircle}
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card className="p-4">
            <div className="text-sm text-slate-400 mb-1">Totalt</div>
            <div className="text-2xl font-bold text-white">{stats.total}</div>
          </Card>
          <Card className={`p-4 ${stats.red > 0 ? 'border-red-500/50' : ''}`}>
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="w-4 h-4 text-red-400" />
              <span className="text-sm text-slate-400">Kritisk</span>
            </div>
            <div className="text-2xl font-bold text-red-400">{stats.red}</div>
          </Card>
          <Card className={`p-4 ${stats.yellow > 0 ? 'border-yellow-500/50' : ''}`}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-slate-400">Varning</span>
            </div>
            <div className="text-2xl font-bold text-yellow-400">{stats.yellow}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-sm text-slate-400">OK</span>
            </div>
            <div className="text-2xl font-bold text-green-400">{stats.green}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Minus className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400">Ej bedömd</span>
            </div>
            <div className="text-2xl font-bold text-slate-400">{stats.gray}</div>
          </Card>
        </div>

        {/* Filters and Actions */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                value={filters.searchTerm}
                onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                placeholder="Sök kund eller anläggning..."
                className="pl-10"
              />
            </div>
          </div>
          
          <select
            value={filters.region}
            onChange={(e) => setFilters({ ...filters, region: e.target.value })}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
          >
            <option value="all">Alla regioner</option>
            {regions.map(region => (
              <option key={region} value={region}>{region}</option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value as TrafficLightColor | 'all' })}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
          >
            <option value="all">Alla statusar</option>
            <option value="red">Kritisk</option>
            <option value="yellow">Varning</option>
            <option value="green">OK</option>
            <option value="gray">Ej bedömd</option>
          </select>

          <Button
            onClick={handleRefresh}
            variant="secondary"
            className="flex items-center gap-2"
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Uppdatera
          </Button>

          <Button
            onClick={handleExport}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Exportera CSV
          </Button>
        </div>

        {/* Traffic Light Grid */}
        {filteredLights.length === 0 ? (
          <Card className="p-12 text-center">
            <AlertCircle className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              Inga bedömningar hittades
            </h3>
            <p className="text-slate-400">
              {filters.searchTerm || filters.region !== 'all' || filters.status !== 'all'
                ? 'Prova att ändra dina filter'
                : 'Inga ärenden har bedömts med trafikljussystemet än'}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLights.map(light => (
              <Card
                key={light.case_id}
                className={`p-4 border ${getStatusBg(light.traffic_light_color)}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3">
                    {getStatusIcon(light.traffic_light_color)}
                    <div>
                      <h4 className="font-semibold text-white">
                        {light.customer_name}
                      </h4>
                      {light.site_name && (
                        <div className="flex items-center gap-1 text-sm text-slate-400 mt-1">
                          <MapPin className="w-3 h-3" />
                          <span>{light.site_name}</span>
                        </div>
                      )}
                      {light.region && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          Region: {light.region}
                        </div>
                      )}
                    </div>
                  </div>
                  {light.pest_level_trend && (
                    <div className="flex items-center gap-1" title={`Trend: ${light.pest_level_trend}`}>
                      {getTrendIcon(light.pest_level_trend)}
                    </div>
                  )}
                </div>

                {/* Assessment Details */}
                <div className="space-y-2 text-sm">
                  {light.pest_level !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Skadedjursnivå:</span>
                      <span className="text-white font-medium">
                        {light.pest_level} - {getPestLevelLabel(light.pest_level)}
                      </span>
                    </div>
                  )}
                  {light.problem_rating !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Problembedömning:</span>
                      <span className="text-white font-medium">
                        {light.problem_rating} - {getProblemRatingLabel(light.problem_rating)}
                      </span>
                    </div>
                  )}
                  {light.assessment_date && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Senaste bedömning:</span>
                      <span className="text-white">
                        {new Date(light.assessment_date).toLocaleDateString('sv-SE')}
                      </span>
                    </div>
                  )}
                  {light.assessed_by && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Bedömd av:</span>
                      <span className="text-white">{light.assessed_by}</span>
                    </div>
                  )}
                </div>

                {/* Status Badge */}
                <div className="mt-3 pt-3 border-t border-slate-700">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                    light.traffic_light_color === 'red' ? 'bg-red-500/20 text-red-300' :
                    light.traffic_light_color === 'yellow' ? 'bg-yellow-500/20 text-yellow-300' :
                    light.traffic_light_color === 'green' ? 'bg-green-500/20 text-green-300' :
                    'bg-slate-700/50 text-slate-300'
                  }`}>
                    {getTrafficLightLabel(light.traffic_light_color)}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}