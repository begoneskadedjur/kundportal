import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import {
  AlertCircle,
  MapPin,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Bug
} from 'lucide-react'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'

// --- Lokala typer ---

type TrafficLightColor = 'green' | 'yellow' | 'red' | 'gray'

interface TrafficLightItem {
  case_id: string
  case_number: string
  title: string
  pest_level: number | null
  problem_rating: number | null
  assessment_date: string | null
  assessed_by: string | null
  pest_level_trend: string | null
  pest_type: string | null
  customer_name: string
  address: string | null
  region: string | null
  traffic_light_color: TrafficLightColor
}

interface FilterState {
  searchTerm: string
  region: string
  status: TrafficLightColor | 'all'
}

// --- Hjälpfunktioner ---

function calculateColor(pestLevel: number | null, problemRating: number | null): TrafficLightColor {
  if (pestLevel === null && problemRating === null) return 'gray'
  if ((pestLevel !== null && pestLevel >= 3) || (problemRating !== null && problemRating >= 4)) return 'red'
  if ((pestLevel !== null && pestLevel === 2) || (problemRating !== null && problemRating === 3)) return 'yellow'
  return 'green'
}

function getPestLevelLabel(level: number): string {
  switch (level) {
    case 0: return 'Ingen förekomst'
    case 1: return 'Låg nivå'
    case 2: return 'Måttlig nivå'
    case 3: return 'Hög nivå'
    default: return 'Okänd'
  }
}

function getProblemRatingLabel(rating: number): string {
  switch (rating) {
    case 1: return 'Utmärkt'
    case 2: return 'Bra'
    case 3: return 'Acceptabel'
    case 4: return 'Allvarligt'
    case 5: return 'Kritisk'
    default: return 'Okänd'
  }
}

function getColorLabel(color: TrafficLightColor): string {
  switch (color) {
    case 'red': return 'Kritisk'
    case 'yellow': return 'Varning'
    case 'green': return 'OK'
    case 'gray': return 'Ej bedömd'
  }
}

export default function TrafficLightOverview() {
  const [items, setItems] = useState<TrafficLightItem[]>([])
  const [regions, setRegions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    region: 'all',
    status: 'all'
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('cases')
        .select('id, case_number, title, pest_level, problem_rating, assessment_date, assessed_by, pest_level_trend, pest_type, customer_id, customers!inner(company_name, contact_address, region)')
        .or('pest_level.not.is.null,problem_rating.not.is.null')
        .order('assessment_date', { ascending: false })

      if (error) throw error

      const mapped: TrafficLightItem[] = (data || []).map((c: any) => ({
        case_id: c.id,
        case_number: c.case_number,
        title: c.title,
        pest_level: c.pest_level,
        problem_rating: c.problem_rating,
        assessment_date: c.assessment_date,
        assessed_by: c.assessed_by,
        pest_level_trend: c.pest_level_trend,
        pest_type: c.pest_type,
        customer_name: c.customers?.company_name || 'Okänd kund',
        address: c.customers?.contact_address || null,
        region: c.customers?.region || null,
        traffic_light_color: calculateColor(c.pest_level, c.problem_rating)
      }))

      setItems(mapped)

      const uniqueRegions = [...new Set(
        mapped.map(l => l.region).filter(Boolean) as string[]
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
      ['Kund', 'Adress', 'Region', 'Status', 'Skadedjursnivå', 'Problembedömning', 'Skadedjur', 'Trend', 'Senaste bedömning', 'Bedömd av'],
      ...filteredItems.map(item => [
        item.customer_name,
        item.address || '-',
        item.region || '-',
        getColorLabel(item.traffic_light_color),
        item.pest_level !== null ? `${item.pest_level} - ${getPestLevelLabel(item.pest_level)}` : '-',
        item.problem_rating !== null ? `${item.problem_rating} - ${getProblemRatingLabel(item.problem_rating)}` : '-',
        item.pest_type || '-',
        item.pest_level_trend || '-',
        item.assessment_date ? new Date(item.assessment_date).toLocaleDateString('sv-SE') : '-',
        item.assessed_by || '-'
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `trafikljus-oversikt-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  // Filtrera
  const filteredItems = items.filter(item => {
    if (filters.searchTerm) {
      const search = filters.searchTerm.toLowerCase()
      if (!item.customer_name.toLowerCase().includes(search) &&
          !item.case_number.toLowerCase().includes(search) &&
          !(item.pest_type || '').toLowerCase().includes(search)) {
        return false
      }
    }
    if (filters.region !== 'all' && item.region !== filters.region) return false
    if (filters.status !== 'all' && item.traffic_light_color !== filters.status) return false
    return true
  })

  // Statistik
  const stats = {
    total: items.length,
    red: items.filter(l => l.traffic_light_color === 'red').length,
    yellow: items.filter(l => l.traffic_light_color === 'yellow').length,
    green: items.filter(l => l.traffic_light_color === 'green').length,
    gray: items.filter(l => l.traffic_light_color === 'gray').length
  }

  const getStatusIcon = (color: TrafficLightColor) => {
    switch (color) {
      case 'red': return <XCircle className="w-5 h-5 text-red-400" />
      case 'yellow': return <AlertTriangle className="w-5 h-5 text-yellow-400" />
      case 'green': return <CheckCircle className="w-5 h-5 text-green-400" />
      default: return <Minus className="w-5 h-5 text-slate-400" />
    }
  }

  const getTrendIcon = (trend: string | null) => {
    switch (trend) {
      case 'improving': return <TrendingDown className="w-4 h-4 text-green-400" title="Förbättring" />
      case 'worsening': return <TrendingUp className="w-4 h-4 text-red-400" title="Försämring" />
      default: return <Minus className="w-4 h-4 text-slate-400" title="Stabil" />
    }
  }

  const statCards = [
    { label: 'Kritisk', value: stats.red, icon: XCircle, color: 'red' },
    { label: 'Varning', value: stats.yellow, icon: AlertTriangle, color: 'yellow' },
    { label: 'OK', value: stats.green, icon: CheckCircle, color: 'green' },
    { label: 'Ej bedömd', value: stats.gray, icon: Minus, color: 'slate' },
  ] as const

  const colorMap: Record<string, { icon: string; bg: string; text: string }> = {
    red: { icon: 'text-red-400', bg: 'bg-red-500/20', text: 'text-red-400' },
    yellow: { icon: 'text-yellow-400', bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
    green: { icon: 'text-green-400', bg: 'bg-green-500/20', text: 'text-green-400' },
    slate: { icon: 'text-slate-400', bg: 'bg-slate-500/20', text: 'text-slate-400' },
  }

  if (loading) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <LoadingSpinner />
            <p className="text-slate-400 mt-4">Laddar bedömningar...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#20c58f]/10">
            <AlertCircle className="w-6 h-6 text-[#20c58f]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Trafikljusöversikt</h1>
            <p className="text-sm text-slate-400">
              {filteredItems.length} av {stats.total} bedömningar
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Uppdatera
          </Button>
          <Button
            variant="secondary"
            onClick={handleExport}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Exportera CSV
          </Button>
        </div>
      </div>

      {/* Stat-kort */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => {
          const c = colorMap[color]
          return (
            <div key={label} className="bg-slate-800/50 rounded-2xl border border-slate-700/40 p-5 hover:border-slate-600 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-300">{label}</p>
                  <p className={`text-xl font-bold font-mono mt-1 ${c.text}`}>{value}</p>
                </div>
                <div className={`p-2 rounded-lg ${c.bg}`}>
                  <Icon className={`w-4 h-4 ${c.icon}`} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Kritisk-alert om det finns röda */}
      {stats.red > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-400" />
            <div>
              <h3 className="text-white font-medium text-sm">
                {stats.red} kritisk{stats.red > 1 ? 'a' : ''} bedömning{stats.red > 1 ? 'ar' : ''}
              </h3>
              <p className="text-slate-400 text-xs">
                Ärenden med hög skadedjursnivå eller allvarlig problembedömning som kräver uppmärksamhet.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              value={filters.searchTerm}
              onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
              placeholder="Sök kund, ärendenummer..."
              className="pl-10 bg-slate-800 border-slate-700"
            />
          </div>

          <select
            value={filters.region}
            onChange={(e) => setFilters({ ...filters, region: e.target.value })}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#20c58f] focus:border-transparent"
          >
            <option value="all">Alla regioner</option>
            {regions.map(region => (
              <option key={region} value={region}>{region}</option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value as TrafficLightColor | 'all' })}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#20c58f] focus:border-transparent"
          >
            <option value="all">Alla statusar</option>
            <option value="red">Kritisk</option>
            <option value="yellow">Varning</option>
            <option value="green">OK</option>
          </select>

          <div className="flex items-center text-slate-400 text-xs">
            {filteredItems.length} av {items.length} bedömningar
          </div>
        </div>

        {/* Filter summary */}
        {(filters.searchTerm || filters.region !== 'all' || filters.status !== 'all') && (
          <div className="mt-3 pt-3 border-t border-slate-700/50">
            <div className="flex flex-wrap gap-2">
              {filters.searchTerm && (
                <span className="inline-flex items-center px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">
                  Söker: "{filters.searchTerm}"
                </span>
              )}
              {filters.region !== 'all' && (
                <span className="inline-flex items-center px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                  Region: {filters.region}
                </span>
              )}
              {filters.status !== 'all' && (
                <span className="inline-flex items-center px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded">
                  Status: {getColorLabel(filters.status)}
                </span>
              )}
              <button
                onClick={() => setFilters({ searchTerm: '', region: 'all', status: 'all' })}
                className="text-slate-400 hover:text-white text-xs underline"
              >
                Rensa filter
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Grid */}
      {filteredItems.length === 0 ? (
        <div className="bg-slate-800/30 border border-slate-700 rounded-xl py-12">
          <div className="text-center">
            <AlertCircle className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-white mb-1">Inga bedömningar hittades</h3>
            <p className="text-slate-400 text-sm">
              {filters.searchTerm || filters.region !== 'all' || filters.status !== 'all'
                ? 'Prova att ändra dina filter eller sökord.'
                : 'Inga ärenden har bedömts med trafikljussystemet än.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map(item => (
            <div
              key={item.case_id}
              className="bg-slate-800/50 rounded-2xl border border-slate-700/40 p-5 hover:border-slate-600 transition-colors"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  {getStatusIcon(item.traffic_light_color)}
                  <div>
                    <h4 className="text-lg font-semibold text-white">{item.customer_name}</h4>
                    <p className="text-sm text-slate-400 mt-0.5">#{item.case_number}</p>
                    {item.address && (
                      <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                        <MapPin className="w-3 h-3" />
                        <span>{item.address}</span>
                      </div>
                    )}
                  </div>
                </div>
                {item.pest_level_trend && (
                  <div className="flex items-center gap-1">
                    {getTrendIcon(item.pest_level_trend)}
                  </div>
                )}
              </div>

              {/* Bedömningsdetaljer */}
              <div className="space-y-2 text-sm">
                {item.pest_level !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Skadedjursnivå:</span>
                    <span className="text-white font-medium">
                      {item.pest_level} - {getPestLevelLabel(item.pest_level)}
                    </span>
                  </div>
                )}
                {item.problem_rating !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Problembedömning:</span>
                    <span className="text-white font-medium">
                      {item.problem_rating} - {getProblemRatingLabel(item.problem_rating)}
                    </span>
                  </div>
                )}
                {item.pest_type && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Skadedjur:</span>
                    <span className="text-white flex items-center gap-1.5">
                      <Bug className="w-3.5 h-3.5 text-slate-400" />
                      {item.pest_type}
                    </span>
                  </div>
                )}
                {item.assessment_date && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Bedömd:</span>
                    <span className="text-white">
                      {new Date(item.assessment_date).toLocaleDateString('sv-SE')}
                    </span>
                  </div>
                )}
                {item.assessed_by && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Bedömd av:</span>
                    <span className="text-white">{item.assessed_by}</span>
                  </div>
                )}
              </div>

              {/* Status badge footer */}
              <div className="mt-4 pt-3 border-t border-slate-700 flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                  item.traffic_light_color === 'red' ? 'bg-red-500/20 text-red-400' :
                  item.traffic_light_color === 'yellow' ? 'bg-yellow-500/20 text-yellow-400' :
                  item.traffic_light_color === 'green' ? 'bg-green-500/20 text-green-400' :
                  'bg-slate-700/50 text-slate-400'
                }`}>
                  {getColorLabel(item.traffic_light_color)}
                </span>
                {item.region && (
                  <span className="text-xs text-slate-500">{item.region}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
