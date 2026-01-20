// src/components/customer/CustomerEquipmentView.tsx - Premium kundanpassad utrustningsvy
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin,
  Shield,
  Calendar,
  Box,
  Target,
  Crosshair,
  ChevronDown,
  ChevronUp,
  FileDown,
  RefreshCw,
  Image as ImageIcon,
  MessageSquare,
  Filter,
  Map,
  List,
  Sparkles,
  Home,
  Building2
} from 'lucide-react'
import { EquipmentService } from '../../services/equipmentService'
import { FloorPlanService } from '../../services/floorPlanService'
import {
  EquipmentPlacementWithRelations,
  EquipmentType,
  EquipmentStatus,
  EQUIPMENT_TYPE_CONFIG,
  EQUIPMENT_STATUS_CONFIG,
  getEquipmentTypeLabel,
  getEquipmentStatusLabel
} from '../../types/database'
import { EquipmentMap } from '../shared/equipment/EquipmentMap'
import { EquipmentDetailSheet } from '../shared/equipment/EquipmentDetailSheet'
import { CustomerIndoorEquipmentView } from './CustomerIndoorEquipmentView'
import LoadingSpinner from '../shared/LoadingSpinner'
import { generateEquipmentPdf } from '../../utils/equipmentPdfGenerator'
import toast from 'react-hot-toast'

interface CustomerEquipmentViewProps {
  customerId: string
  companyName: string
}

// Ikon-komponent baserat pa utrustningstyp
function EquipmentTypeIcon({ type, className = "w-5 h-5" }: { type: string; className?: string }) {
  switch (type) {
    case 'mechanical_trap':
      return <Crosshair className={className} />
    case 'concrete_station':
      return <Box className={className} />
    case 'bait_station':
      return <Target className={className} />
    default:
      return <Box className={className} />
  }
}

// Hjälpfunktion för att hämta typkonfiguration med fallback för dynamiska typer
function getTypeConfig(equipmentType: string) {
  const legacyConfig = EQUIPMENT_TYPE_CONFIG[equipmentType]
  if (legacyConfig) {
    return {
      color: legacyConfig.color,
      label: legacyConfig.label
    }
  }
  // Dynamisk typ - använd grå som standardfärg
  return {
    color: '#6b7280',
    label: equipmentType || 'Okänd typ'
  }
}

const CustomerEquipmentView: React.FC<CustomerEquipmentViewProps> = ({
  customerId,
  companyName
}) => {
  // State
  const [equipment, setEquipment] = useState<EquipmentPlacementWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map')
  const [filterType, setFilterType] = useState<EquipmentType | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<EquipmentStatus | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentPlacementWithRelations | null>(null)
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false)

  // Equipment type toggle (outdoor/indoor)
  const [equipmentType, setEquipmentType] = useState<'outdoor' | 'indoor'>('outdoor')
  const [indoorStationCount, setIndoorStationCount] = useState(0)

  // Hamta utrustning
  const fetchEquipment = useCallback(async () => {
    try {
      setError(null)
      const data = await EquipmentService.getEquipmentByCustomer(customerId)
      setEquipment(data)
    } catch (err) {
      console.error('Fel vid hamtning av utrustning:', err)
      setError('Kunde inte hamta utrustningsdata. Forsok igen senare.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [customerId])

  useEffect(() => {
    fetchEquipment()
  }, [fetchEquipment])

  // Hämta antal inomhusstationer för kombinerad statistik
  useEffect(() => {
    const fetchIndoorCount = async () => {
      try {
        const floorPlans = await FloorPlanService.getFloorPlansByCustomer(customerId)
        const totalIndoor = floorPlans.reduce((sum, fp) => sum + (fp.station_count || 0), 0)
        setIndoorStationCount(totalIndoor)
      } catch (error) {
        console.error('Kunde inte hämta inomhusstationer:', error)
      }
    }
    fetchIndoorCount()
  }, [customerId])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchEquipment()
  }

  // Filtrerad utrustning
  const filteredEquipment = useMemo(() => {
    return equipment.filter(item => {
      if (filterType !== 'all' && item.equipment_type !== filterType) return false
      if (filterStatus !== 'all' && item.status !== filterStatus) return false
      return true
    })
  }, [equipment, filterType, filterStatus])

  // Statistik
  const stats = useMemo(() => ({
    total: equipment.length,
    active: equipment.filter(e => e.status === 'active').length,
    byType: {
      mechanical_trap: equipment.filter(e => e.equipment_type === 'mechanical_trap').length,
      concrete_station: equipment.filter(e => e.equipment_type === 'concrete_station').length,
      bait_station: equipment.filter(e => e.equipment_type === 'bait_station').length
    },
    recentlyPlaced: equipment.filter(e => {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      return new Date(e.placed_at) >= thirtyDaysAgo
    }).length
  }), [equipment])

  // Hantera klick pa markor i kartan
  const handleEquipmentClick = (item: EquipmentPlacementWithRelations) => {
    setSelectedEquipment(item)
    setIsDetailSheetOpen(true)
  }

  // Stang detail sheet
  const handleCloseDetailSheet = () => {
    setIsDetailSheetOpen(false)
    setTimeout(() => setSelectedEquipment(null), 300)
  }

  // Formatera datum for kund (utan exakt tid)
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('sv-SE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  // PDF-export med professionell BeGone-branding
  const [exporting, setExporting] = useState(false)

  const handleExportPDF = async () => {
    if (equipment.length === 0) {
      toast.error('Ingen utrustning att exportera')
      return
    }

    setExporting(true)
    try {
      await generateEquipmentPdf({
        customerName: companyName,
        equipment: filteredEquipment
      })
      toast.success('PDF exporterad!')
    } catch (error) {
      console.error('Fel vid PDF-export:', error)
      toast.error('Kunde inte exportera PDF')
    } finally {
      setExporting(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="text-white mt-4">Laddar er utrustningsoversikt...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Kunde inte ladda utrustning</h2>
          <p className="text-slate-400 mb-6">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4 inline mr-2" />
            Forsok igen
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900/95 to-emerald-900/10">
          <div className="absolute inset-0 opacity-50" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='grid' width='60' height='60' patternUnits='userSpaceOnUse'%3E%3Cpath d='M 60 0 L 0 0 0 60' fill='none' stroke='rgba(255,255,255,0.02)' stroke-width='1'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23grid)'/%3E%3C/svg%3E")`
          }}></div>
        </div>

        {/* Animated gradient orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>

        {/* Hero Content */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            {/* Left side - Title */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-white">
                    Er Utrustning
                  </h1>
                  <p className="text-slate-400">Oversikt over placerad skadedjursbekampning</p>
                </div>
              </div>

              {/* Company badge */}
              <div className="flex items-center gap-2 bg-slate-800/50 backdrop-blur px-4 py-2 rounded-lg border border-slate-700/50 w-fit">
                <Shield className="w-4 h-4 text-emerald-500" />
                <span className="text-slate-300 font-medium">{companyName}</span>
              </div>
            </div>

            {/* Right side - Stats (kombinerad utomhus + inomhus) */}
            <div className="flex flex-wrap gap-4">
              {/* Total equipment (utomhus + inomhus) */}
              <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-5 min-w-[140px]">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-slate-400 uppercase tracking-wide">Totalt</span>
                </div>
                <p className="text-3xl font-bold text-white">{stats.total + indoorStationCount}</p>
                <p className="text-sm text-slate-400">
                  {stats.total > 0 && indoorStationCount > 0 ? (
                    <span>{stats.total} ute + {indoorStationCount} inne</span>
                  ) : (
                    <span>enheter</span>
                  )}
                </p>
              </div>

              {/* Active equipment */}
              <div className="bg-emerald-500/10 backdrop-blur rounded-2xl border border-emerald-500/20 p-5 min-w-[140px]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-emerald-400 uppercase tracking-wide">Aktiva (ute)</span>
                </div>
                <p className="text-3xl font-bold text-emerald-400">{stats.active}</p>
                <p className="text-sm text-emerald-400/70">i drift</p>
              </div>

              {/* Recently placed */}
              {stats.recentlyPlaced > 0 && (
                <div className="bg-blue-500/10 backdrop-blur rounded-2xl border border-blue-500/20 p-5 min-w-[140px]">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-blue-400 uppercase tracking-wide">Senaste 30d</span>
                  </div>
                  <p className="text-3xl font-bold text-blue-400">{stats.recentlyPlaced}</p>
                  <p className="text-sm text-blue-400/70">nya</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {/* Equipment Type Toggle (Utomhus / Inomhus) */}
        <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-4 mb-6">
          <div className="flex items-center gap-2 bg-slate-900/50 rounded-xl p-1 w-fit">
            <button
              onClick={() => setEquipmentType('outdoor')}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all duration-200 ${
                equipmentType === 'outdoor'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <MapPin className="w-4 h-4" />
              Utomhus
              <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${
                equipmentType === 'outdoor' ? 'bg-emerald-600' : 'bg-slate-700'
              }`}>
                {stats.total}
              </span>
            </button>
            <button
              onClick={() => setEquipmentType('indoor')}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all duration-200 ${
                equipmentType === 'indoor'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Home className="w-4 h-4" />
              Inomhus
              <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${
                equipmentType === 'indoor' ? 'bg-emerald-600' : 'bg-slate-700'
              }`}>
                {indoorStationCount}
              </span>
            </button>
          </div>
        </div>

        {/* Indoor Equipment View */}
        {equipmentType === 'indoor' ? (
          <CustomerIndoorEquipmentView
            customerId={customerId}
            companyName={companyName}
          />
        ) : (
          <>
            {/* Controls Bar (för utomhus) */}
            <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-4 mb-6">
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                {/* View Toggle */}
                <div className="flex items-center gap-2 bg-slate-900/50 rounded-xl p-1">
                  <button
                    onClick={() => setViewMode('map')}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all duration-200 ${
                      viewMode === 'map'
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                    }`}
                  >
                    <Map className="w-4 h-4" />
                    Karta
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all duration-200 ${
                      viewMode === 'list'
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                    }`}
                  >
                    <List className="w-4 h-4" />
                    Lista
                  </button>
                </div>

                {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-400">Filter:</span>
              </div>

              {/* Type filter */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as EquipmentType | 'all')}
                className="px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
              >
                <option value="all">Alla typer</option>
                {Object.entries(EQUIPMENT_TYPE_CONFIG).map(([type, config]) => (
                  <option key={type} value={type}>
                    {config.label} ({stats.byType[type as EquipmentType]})
                  </option>
                ))}
              </select>

              {/* Status filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as EquipmentStatus | 'all')}
                className="px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
              >
                <option value="all">Alla statusar</option>
                {Object.entries(EQUIPMENT_STATUS_CONFIG).map(([status, config]) => (
                  <option key={status} value={status}>
                    {config.label}
                  </option>
                ))}
              </select>

              {/* Result count */}
              <span className="text-sm text-slate-500">
                {filteredEquipment.length} av {equipment.length}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Uppdatera
              </button>
              <button
                onClick={handleExportPDF}
                disabled={exporting || equipment.length === 0}
                className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4" />
                )}
                {exporting ? 'Exporterar...' : 'Exportera PDF'}
              </button>
            </div>
          </div>

          {/* Equipment type legend */}
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-slate-700/50">
            {Object.entries(EQUIPMENT_TYPE_CONFIG).map(([type, config]) => {
              const count = stats.byType[type as EquipmentType]
              return (
                <div key={type} className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: config.color }}
                  >
                    <EquipmentTypeIcon type={type as EquipmentType} className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{config.label}</p>
                    <p className="text-xs text-slate-400">{count} st</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Empty state */}
        {equipment.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-12 text-center"
          >
            <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
              <MapPin className="w-10 h-10 text-slate-500" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Ingen utrustning placerad</h3>
            <p className="text-slate-400 max-w-md mx-auto">
              Nar var tekniker placerar utrustning hos er kommer den att visas har med exakta positioner pa kartan.
            </p>
          </motion.div>
        ) : (
          <>
            {/* Map View */}
            {viewMode === 'map' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 overflow-hidden"
              >
                <EquipmentMap
                  equipment={filteredEquipment}
                  onEquipmentClick={handleEquipmentClick}
                  height="500px"
                  showControls={true}
                  readOnly={true}
                  enableClustering={filteredEquipment.length >= 5}
                  showNumbers={true}
                />
              </motion.div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
              <div className="space-y-4">
                <AnimatePresence>
                  {filteredEquipment.map((item, index) => {
                    const typeConfig = getTypeConfig(item.equipment_type)
                    const statusConfig = EQUIPMENT_STATUS_CONFIG[item.status] || {
                      bgColor: 'bg-slate-500/20',
                      borderColor: 'border-slate-500/30',
                      color: 'slate-400',
                      label: 'Okänd'
                    }
                    const isExpanded = expandedId === item.id

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 overflow-hidden hover:border-slate-600/50 transition-colors"
                      >
                        {/* Main row */}
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                          className="w-full p-5 flex items-center gap-4 text-left"
                        >
                          {/* Equipment type icon */}
                          <div
                            className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: typeConfig.color }}
                          >
                            <EquipmentTypeIcon type={item.equipment_type} className="w-7 h-7 text-white" />
                          </div>

                          {/* Info */}
                          <div className="flex-grow min-w-0">
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="text-lg font-semibold text-white">
                                {getEquipmentTypeLabel(item.equipment_type)}
                              </h3>
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} border ${statusConfig.borderColor}`}
                                style={{ color: statusConfig.color }}
                              >
                                {getEquipmentStatusLabel(item.status)}
                              </span>
                            </div>
                            <p className="text-sm text-slate-400">
                              Placerad {formatDate(item.placed_at)}
                            </p>
                          </div>

                          {/* Indicators */}
                          <div className="flex items-center gap-3 flex-shrink-0">
                            {item.photo_url && (
                              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                                <ImageIcon className="w-4 h-4 text-blue-400" />
                              </div>
                            )}
                            {item.comment && (
                              <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                                <MessageSquare className="w-4 h-4 text-purple-400" />
                              </div>
                            )}
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                              isExpanded ? 'bg-emerald-500/20' : 'bg-slate-700/50'
                            }`}>
                              {isExpanded ? (
                                <ChevronUp className="w-5 h-5 text-emerald-400" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-slate-400" />
                              )}
                            </div>
                          </div>
                        </button>

                        {/* Expanded content */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="border-t border-slate-700/50"
                            >
                              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Left column - Details */}
                                <div className="space-y-4">
                                  {/* Placement date */}
                                  <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                      <Calendar className="w-5 h-5 text-amber-400" />
                                    </div>
                                    <div>
                                      <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Placeringsdatum</p>
                                      <p className="text-white mt-0.5">{formatDate(item.placed_at)}</p>
                                    </div>
                                  </div>

                                  {/* Comment */}
                                  {item.comment && (
                                    <div className="flex items-start gap-3">
                                      <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <MessageSquare className="w-5 h-5 text-purple-400" />
                                      </div>
                                      <div>
                                        <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Teknikerns anteckning</p>
                                        <p className="text-slate-300 mt-0.5 whitespace-pre-wrap">{item.comment}</p>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Right column - Photo */}
                                {item.photo_url && (
                                  <div>
                                    <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Foto</p>
                                    <img
                                      src={item.photo_url}
                                      alt="Utrustningsfoto"
                                      className="w-full max-w-sm rounded-xl border border-slate-700/50 cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={() => handleEquipmentClick(item)}
                                    />
                                  </div>
                                )}
                              </div>

                              {/* Action button */}
                              <div className="px-5 pb-5">
                                <button
                                  onClick={() => handleEquipmentClick(item)}
                                  className="w-full md:w-auto px-6 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2"
                                >
                                  <MapPin className="w-4 h-4" />
                                  Visa pa karta
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            )}
          </>
        )}
          </>
        )}
      </div>

      {/* Equipment Detail Sheet - Customer-friendly version without technical details */}
      <EquipmentDetailSheet
        equipment={selectedEquipment}
        isOpen={isDetailSheetOpen}
        onClose={handleCloseDetailSheet}
        readOnly={true}
      />
    </div>
  )
}

export default CustomerEquipmentView
