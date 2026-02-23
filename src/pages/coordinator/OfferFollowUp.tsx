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

  const [sortBy, setSortBy] = useState<FollowUpSortBy>('oldest')
  const [statusFilter, setStatusFilter] = useState<FollowUpStatusFilter>('all')
  const [selectedTechnician, setSelectedTechnician] = useState<string | null>(null)

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)

      const [offersData, kpisData, statsData] = await Promise.all([
        OfferFollowUpService.getFollowUpOffers(technicianEmail),
        OfferFollowUpService.getKPIs(),
        isCoordinator ? OfferFollowUpService.getTechnicianStats() : Promise.resolve([]),
      ])

      setOffers(offersData)
      setKpis(kpisData)
      setTechStats(statsData)
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
    <div className="space-y-6">
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
            <div className="text-[10px] text-slate-500">{formatKr(kpis.total_pending_value)} i pipeline</div>
          </div>

          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className={`w-3.5 h-3.5 ${kpis.total_overdue > 0 ? 'text-red-400' : 'text-slate-500'}`} />
              <span className="text-xs text-slate-400">Förfallna</span>
            </div>
            <div className={`text-lg font-bold ${kpis.total_overdue > 0 ? 'text-red-400' : 'text-white'}`}>
              {kpis.total_overdue}
            </div>
            <div className="text-[10px] text-slate-500">{formatKr(kpis.total_overdue_value)} i risk</div>
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
      />
    </div>
  )
}
