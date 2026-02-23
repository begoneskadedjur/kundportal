// src/pages/coordinator/OfferFollowUp.tsx — Offertuppföljning: systematisk uppföljning av osignerade offerter
import { useState, useEffect, useMemo } from 'react'
import {
  FileSignature, Loader2, RefreshCw,
  Clock, AlertTriangle, TrendingUp, Banknote,
  Users,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { OfferFollowUpService } from '../../services/offerFollowUpService'
import { FollowUpTable } from '../../components/coordinator/follow-up/FollowUpTable'
import { TechnicianCards } from '../../components/coordinator/follow-up/TechnicianCards'
import type {
  FollowUpOffer, FollowUpKPIs, TechnicianOfferStats,
  FollowUpSortBy, FollowUpStatusFilter,
} from '../../services/offerFollowUpService'

function formatKr(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} mkr`
  if (value >= 1_000) return `${Math.round(value / 1_000)} tkr`
  return `${value} kr`
}

export default function OfferFollowUp() {
  const { profile } = useAuth()
  const isCoordinator = profile?.role === 'koordinator' || profile?.role === 'admin'
  const technicianEmail = isCoordinator ? undefined : profile?.technicians?.email

  const [offers, setOffers] = useState<FollowUpOffer[]>([])
  const [kpis, setKpis] = useState<FollowUpKPIs | null>(null)
  const [techStats, setTechStats] = useState<TechnicianOfferStats[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [sortBy, setSortBy] = useState<FollowUpSortBy>('priority')
  const [statusFilter, setStatusFilter] = useState<FollowUpStatusFilter>('all')
  const [selectedTechnician, setSelectedTechnician] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)

      const data = await OfferFollowUpService.getDashboardData(technicianEmail)

      setOffers(data.offers)
      setKpis(data.kpis)
      setTechStats(data.techStats)
    } catch (err) {
      console.error('OfferFollowUp fetch error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchData() }, [technicianEmail])

  // Filtrera på vald tekniker
  const filteredOffers = useMemo(() => {
    if (!selectedTechnician) return offers
    return offers.filter(o =>
      o.technician_name && techStats.find(t =>
        t.technician_email === selectedTechnician && t.technician_name === o.technician_name
      )
    )
  }, [offers, selectedTechnician, techStats])

  // Sender-email för kommentarer
  const senderEmail = profile?.technicians?.email || undefined

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[#20c58f]" />
        <span className="ml-2 text-slate-400">Laddar offertuppföljning...</span>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileSignature className="w-6 h-6 text-[#20c58f]" />
          <div>
            <h1 className="text-xl font-bold text-white">Offertuppföljning</h1>
            <p className="text-xs text-slate-500">
              {isCoordinator ? 'Alla offerter & avtal — följ upp osignerade' : 'Dina offerter & avtal'}
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-xs text-slate-300 hover:text-white hover:border-slate-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Uppdatera
        </button>
      </div>

      {/* KPI-summary */}
      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs text-slate-400">Pågående</span>
            </div>
            <div className="text-lg font-bold text-white">{kpis.total_pending}</div>
            <div className="text-[10px] text-slate-500">
              {kpis.at_risk_pending > 0
                ? <span className="text-amber-400 font-medium">{kpis.at_risk_pending} snart förfallna</span>
                : `${formatKr(kpis.total_pending_value)} i pipeline`
              }
            </div>
          </div>

          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className={`w-3.5 h-3.5 ${kpis.total_overdue > 0 ? 'text-red-400' : 'text-slate-500'}`} />
              <span className="text-xs text-slate-400">Förfallna</span>
            </div>
            <div className={`text-lg font-bold ${kpis.total_overdue > 0 ? 'text-red-400' : 'text-white'}`}>
              {kpis.total_overdue}
            </div>
            <div className="text-[10px] text-slate-500">
              {kpis.recently_overdue > 0
                ? <span className="text-red-400 font-medium">{kpis.recently_overdue} nya denna vecka</span>
                : `${formatKr(kpis.total_overdue_value)} i risk`
              }
            </div>
          </div>

          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xs text-slate-400">Signeringsgrad</span>
            </div>
            <div className="text-lg font-bold text-white">{kpis.sign_rate}%</div>
            <div className="text-[10px] text-slate-500">av totalt hanterade</div>
          </div>

          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
            <div className="flex items-center gap-1.5 mb-1">
              <Banknote className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs text-slate-400">Snitt dagar</span>
            </div>
            <div className="text-lg font-bold text-white">{kpis.avg_days_to_sign}</div>
            <div className="text-[10px] text-slate-500">till signering</div>
          </div>
        </div>
      )}

      {/* Action-banner */}
      {kpis && (kpis.recently_overdue > 0 || kpis.at_risk_pending > 0) && (
        <div className="p-3 bg-gradient-to-r from-red-500/10 to-amber-500/10 border border-red-500/20 rounded-xl">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-white">Offerter som kräver åtgärd</p>
              <div className="flex items-center gap-4 mt-1">
                {kpis.recently_overdue > 0 && (
                  <span className="text-xs text-red-400">
                    {kpis.recently_overdue} nyligen förfallna
                  </span>
                )}
                {kpis.at_risk_pending > 0 && (
                  <span className="text-xs text-amber-400">
                    {kpis.at_risk_pending} närmar sig deadline
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                setSortBy('priority')
                setStatusFilter('all')
                setSelectedTechnician(null)
              }}
              className="px-3 py-1.5 bg-[#20c58f] hover:bg-[#1bb07f] text-white text-xs font-medium rounded-lg transition-colors flex-shrink-0"
            >
              Visa prioriterade
            </button>
          </div>
        </div>
      )}

      {/* Tekniker-kort (bara koordinator) */}
      {isCoordinator && techStats.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-300">Per tekniker</span>
            {selectedTechnician && (
              <button
                onClick={() => setSelectedTechnician(null)}
                className="ml-2 text-[10px] text-[#20c58f] hover:underline"
              >
                Visa alla
              </button>
            )}
          </div>
          <TechnicianCards
            stats={techStats}
            selectedTechnician={selectedTechnician}
            onSelect={setSelectedTechnician}
          />
        </div>
      )}

      {/* Uppföljningstabell */}
      <FollowUpTable
        offers={filteredOffers}
        sortBy={sortBy}
        statusFilter={statusFilter}
        onSortChange={setSortBy}
        onStatusFilterChange={setStatusFilter}
        isCoordinator={isCoordinator}
        senderEmail={senderEmail}
        showArchived={showArchived}
        onToggleArchived={() => setShowArchived(!showArchived)}
      />
    </div>
  )
}
