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
  ChevronDown,
  ChevronRight,
  Wrench,
  Lightbulb,
  User
} from 'lucide-react'
import Button from '../../../components/ui/Button'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import AssessmentScaleBar from '../../../components/shared/AssessmentScaleBar'
import CaseJourneyTimeline from '../../../components/customer/CaseJourneyTimeline'
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
  traffic_light_color: TrafficLightColor
  work_report: string | null
  recommendations: string | null
  status: string | null
  technician_name: string | null
}

interface FilterState {
  searchTerm: string
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
    case 0: return 'Ingen'
    case 1: return 'Låg'
    case 2: return 'Måttlig'
    case 3: return 'Hög'
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

function getBorderColor(color: TrafficLightColor): string {
  switch (color) {
    case 'red': return 'border-l-red-500'
    case 'yellow': return 'border-l-yellow-500'
    case 'green': return 'border-l-green-500'
    case 'gray': return 'border-l-slate-600'
  }
}

function getLevelBadgeClass(level: number, type: 'pest' | 'problem'): string {
  const isHigh = type === 'pest' ? level >= 3 : level >= 4
  const isMid = type === 'pest' ? level === 2 : level === 3
  if (isHigh) return 'bg-red-500/20 text-red-400 border border-red-500/30'
  if (isMid) return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
  return 'bg-green-500/20 text-green-400 border border-green-500/30'
}

function formatRelativeDate(dateStr: string): string {
  const then = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - then.getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Idag'
  if (days === 1) return 'Igår'
  return `${days} dagar sedan`
}

export default function TrafficLightOverview() {
  const [items, setItems] = useState<TrafficLightItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null)
  const [hoveredCaseId, setHoveredCaseId] = useState<string | null>(null)
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
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
        .select('id, case_number, title, pest_level, problem_rating, assessment_date, assessed_by, pest_level_trend, pest_type, customer_id, work_report, recommendations, status, customer:customers(company_name, contact_address), technician:technicians!cases_primary_technician_id_fkey(name)')
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
        customer_name: c.customer?.company_name || 'Okänd kund',
        address: c.customer?.contact_address || null,
        traffic_light_color: calculateColor(c.pest_level, c.problem_rating),
        work_report: c.work_report || null,
        recommendations: c.recommendations || null,
        status: c.status || null,
        technician_name: c.technician?.name || null
      }))

      setItems(mapped)
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
      ['Kund', 'Adress', 'Status', 'Skadedjursnivå', 'Problembedömning', 'Skadedjur', 'Trend', 'Senaste bedömning', 'Bedömd av', 'Tekniker'],
      ...filteredItems.map(item => [
        item.customer_name,
        item.address || '-',
        getColorLabel(item.traffic_light_color),
        item.pest_level !== null ? `${item.pest_level} - ${getPestLevelLabel(item.pest_level)}` : '-',
        item.problem_rating !== null ? `${item.problem_rating} - ${getProblemRatingLabel(item.problem_rating)}` : '-',
        item.pest_type || '-',
        item.pest_level_trend || '-',
        item.assessment_date ? new Date(item.assessment_date).toLocaleDateString('sv-SE') : '-',
        item.assessed_by || '-',
        item.technician_name || '-'
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `trafikljus-oversikt-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const toggleExpand = (caseId: string) => {
    setExpandedCaseId(prev => prev === caseId ? null : caseId)
  }

  // Filtrera
  const filteredItems = items.filter(item => {
    if (filters.searchTerm) {
      const search = filters.searchTerm.toLowerCase()
      if (!item.customer_name.toLowerCase().includes(search) &&
          !item.case_number.toLowerCase().includes(search) &&
          !(item.pest_type || '').toLowerCase().includes(search) &&
          !(item.technician_name || '').toLowerCase().includes(search)) {
        return false
      }
    }
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

  const getStatusIcon = (color: TrafficLightColor, size: 'sm' | 'md' = 'md') => {
    const cls = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'
    switch (color) {
      case 'red': return <XCircle className={`${cls} text-red-400`} />
      case 'yellow': return <AlertTriangle className={`${cls} text-yellow-400`} />
      case 'green': return <CheckCircle className={`${cls} text-green-400`} />
      default: return <Minus className={`${cls} text-slate-400`} />
    }
  }

  const getTrendIcon = (trend: string | null) => {
    switch (trend) {
      case 'improving': return <TrendingDown className="w-4 h-4 text-green-400" title="Förbättring" />
      case 'worsening': return <TrendingUp className="w-4 h-4 text-red-400" title="Försämring" />
      default: return <Minus className="w-4 h-4 text-slate-500" title="Stabil" />
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

  const quickFilters = [
    { key: 'all' as const, label: `Alla (${stats.total})`, icon: null, activeClass: 'bg-[#20c58f]/20 border-[#20c58f]/50 text-[#20c58f]' },
    { key: 'red' as const, label: `${stats.red} kritiska`, icon: XCircle, activeClass: 'bg-red-500/30 border-red-400 text-red-400', iconClass: 'text-red-400' },
    { key: 'yellow' as const, label: `${stats.yellow} varningar`, icon: AlertTriangle, activeClass: 'bg-yellow-500/30 border-yellow-400 text-yellow-400', iconClass: 'text-yellow-400' },
    { key: 'green' as const, label: `${stats.green} ok`, icon: CheckCircle, activeClass: 'bg-green-500/30 border-green-400 text-green-400', iconClass: 'text-green-400' },
  ]

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

      {/* Kritisk-alert */}
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

      {/* Filter: Sök + Snabbfilter-chips */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={filters.searchTerm}
            onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
            placeholder="Sök kund, ärendenummer, skadedjur..."
            className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {quickFilters.map(({ key, label, icon: Icon, activeClass, iconClass }) => {
            const isActive = filters.status === key
            return (
              <button
                key={key}
                onClick={() => setFilters({ ...filters, status: key })}
                className={`px-2.5 py-1 text-xs border rounded-lg flex items-center gap-1.5 transition-colors ${
                  isActive
                    ? activeClass
                    : 'border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                {Icon && <Icon className={`w-3 h-3 ${isActive ? '' : iconClass || 'text-slate-400'}`} />}
                {label}
              </button>
            )
          })}
        </div>

        <div className="text-xs text-slate-500">
          Visar {filteredItems.length} av {items.length}
        </div>
      </div>

      {/* Tabell */}
      {filteredItems.length === 0 ? (
        <div className="bg-slate-800/30 border border-slate-700 rounded-xl py-12">
          <div className="text-center">
            <AlertCircle className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-white mb-1">Inga bedömningar hittades</h3>
            <p className="text-slate-400 text-sm">
              {filters.searchTerm || filters.status !== 'all'
                ? 'Prova att ändra dina filter eller sökord.'
                : 'Inga ärenden har bedömts med trafikljussystemet än.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="border border-slate-700 rounded-lg overflow-hidden">
          {/* Tabellheader */}
          <div className="bg-slate-800/50">
            <div className="grid grid-cols-12 gap-3 px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
              <div className="col-span-1 text-center">Status</div>
              <div className="col-span-2">Kund</div>
              <div className="col-span-1">Skadedjur</div>
              <div className="col-span-2 text-center">Nivå</div>
              <div className="col-span-2 text-center">Bedömning</div>
              <div className="col-span-1 text-center">Trend</div>
              <div className="col-span-1">Tekniker</div>
              <div className="col-span-2">Bedömd</div>
            </div>
          </div>

          {/* Tabellrader */}
          <div className="bg-slate-900/30">
            {filteredItems.map((item, index) => {
              const isExpanded = expandedCaseId === item.case_id
              const isHovered = hoveredCaseId === item.case_id

              return (
                <div key={item.case_id}>
                  {/* Datarad */}
                  <div
                    className={`
                      grid grid-cols-12 gap-3 px-4 py-2.5 items-center
                      border-l-4 ${getBorderColor(item.traffic_light_color)}
                      ${index > 0 ? 'border-t border-slate-700/50' : ''}
                      ${isHovered ? 'bg-slate-800/30' : ''}
                      ${isExpanded ? 'bg-slate-800/20' : ''}
                      transition-all duration-200 cursor-pointer
                    `}
                    onClick={() => toggleExpand(item.case_id)}
                    onMouseEnter={() => setHoveredCaseId(item.case_id)}
                    onMouseLeave={() => setHoveredCaseId(null)}
                  >
                    {/* STATUS */}
                    <div className="col-span-1 flex justify-center">
                      {getStatusIcon(item.traffic_light_color, 'sm')}
                    </div>

                    {/* KUND */}
                    <div className="col-span-2">
                      <div className="flex items-center gap-2">
                        {isExpanded
                          ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        }
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-white text-sm truncate">{item.customer_name}</div>
                          <div className="text-xs text-slate-400">#{item.case_number}</div>
                        </div>
                      </div>
                    </div>

                    {/* SKADEDJUR */}
                    <div className="col-span-1 text-sm text-slate-300 truncate">
                      {item.pest_type || <span className="text-slate-500">-</span>}
                    </div>

                    {/* NIVÅ (pest_level) */}
                    <div className="col-span-2 text-center">
                      {item.pest_level !== null ? (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${getLevelBadgeClass(item.pest_level, 'pest')}`}>
                          {item.pest_level} - {getPestLevelLabel(item.pest_level)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">-</span>
                      )}
                    </div>

                    {/* BEDÖMNING (problem_rating) */}
                    <div className="col-span-2 text-center">
                      {item.problem_rating !== null ? (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${getLevelBadgeClass(item.problem_rating, 'problem')}`}>
                          {item.problem_rating} - {getProblemRatingLabel(item.problem_rating)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">-</span>
                      )}
                    </div>

                    {/* TREND */}
                    <div className="col-span-1 flex justify-center">
                      {getTrendIcon(item.pest_level_trend)}
                    </div>

                    {/* TEKNIKER */}
                    <div className="col-span-1 text-sm text-slate-300 truncate">
                      {item.technician_name || <span className="text-slate-500">-</span>}
                    </div>

                    {/* BEDÖMD */}
                    <div className="col-span-2">
                      {item.assessment_date ? (
                        <div>
                          <div className="text-sm text-white">
                            {new Date(item.assessment_date).toLocaleDateString('sv-SE')}
                          </div>
                          <div className="text-xs text-slate-400">
                            {formatRelativeDate(item.assessment_date)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">-</span>
                      )}
                    </div>
                  </div>

                  {/* Expanderad rad */}
                  {isExpanded && (
                    <div className="bg-slate-900/50 border-t border-slate-700 px-4 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Vänster: Bedömningsskalor + rekommendationer */}
                        <div className="space-y-3">
                          {item.pest_level !== null && (
                            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                              <AssessmentScaleBar
                                type="pest"
                                value={item.pest_level}
                                size="sm"
                                showLabels={true}
                                showTitle={true}
                              />
                            </div>
                          )}

                          {item.problem_rating !== null && (
                            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                              <AssessmentScaleBar
                                type="problem"
                                value={item.problem_rating}
                                size="sm"
                                showLabels={true}
                                showTitle={true}
                              />
                            </div>
                          )}

                          {item.recommendations && (
                            <div className="p-3 bg-amber-500/10 border-l-4 border-amber-500 rounded-r-lg">
                              <h4 className="text-sm font-semibold text-amber-400 flex items-center gap-1.5 mb-1">
                                <Lightbulb className="w-4 h-4" />
                                Rekommendationer
                              </h4>
                              <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">
                                {item.recommendations}
                              </p>
                            </div>
                          )}

                          {item.work_report && (
                            <div className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl">
                              <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-1.5 mb-1">
                                <Wrench className="w-4 h-4" />
                                Arbetsrapport
                              </h4>
                              <p className="text-sm text-slate-200 whitespace-pre-wrap">
                                {item.work_report}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Höger: Tidslinje + metadata */}
                        <div className="space-y-3">
                          <CaseJourneyTimeline
                            caseId={item.case_id}
                            currentPestLevel={item.pest_level}
                            currentProblemRating={item.problem_rating}
                            assessmentDate={item.assessment_date}
                            assessedBy={item.assessed_by}
                            defaultExpanded={true}
                          />

                          <div className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl">
                            <h4 className="text-sm font-semibold text-slate-300 mb-2">Ärendeinformation</h4>
                            <div className="space-y-1.5 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-400">Ärende:</span>
                                <span className="text-white">{item.title}</span>
                              </div>
                              {item.address && (
                                <div className="flex items-center gap-2 text-slate-400">
                                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span className="text-slate-300">{item.address}</span>
                                </div>
                              )}
                              {item.status && (
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-400">Status:</span>
                                  <span className="text-white">{item.status}</span>
                                </div>
                              )}
                              {item.technician_name && (
                                <div className="flex items-center gap-2">
                                  <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                  <span className="text-slate-400">Tekniker:</span>
                                  <span className="text-white">{item.technician_name}</span>
                                </div>
                              )}
                              {item.assessed_by && (
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-400">Bedömd av:</span>
                                  <span className="text-white">{item.assessed_by}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
