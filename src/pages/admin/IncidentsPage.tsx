// src/pages/admin/IncidentsPage.tsx
// Admin-sida för att visa alla tillbud & avvikelser

import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, Search, RefreshCw, Calendar, User, Filter } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import type { CaseIncident, IncidentType } from '../../types/caseIncidents'
import { INCIDENT_TYPE_CONFIG } from '../../types/caseIncidents'

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<CaseIncident[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<'all' | IncidentType>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const fetchIncidents = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('case_incidents')
        .select('*')
        .order('occurred_at', { ascending: false })

      if (typeFilter !== 'all') {
        query = query.eq('type', typeFilter)
      }
      if (dateFrom) {
        query = query.gte('occurred_at', dateFrom)
      }
      if (dateTo) {
        query = query.lte('occurred_at', dateTo + 'T23:59:59')
      }

      const { data, error } = await query

      if (error) throw error
      setIncidents(data || [])
    } catch (err) {
      console.error('Error fetching incidents:', err)
      toast.error('Kunde inte ladda tillbud/avvikelser')
    } finally {
      setLoading(false)
    }
  }, [typeFilter, dateFrom, dateTo])

  useEffect(() => {
    fetchIncidents()
  }, [fetchIncidents])

  // Filtrerade incidenter baserat på sökterm
  const filteredIncidents = searchTerm
    ? incidents.filter(i =>
        i.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (i.technician_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.reported_by_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : incidents

  // Statistik
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const totalTillbud = incidents.filter(i => i.type === 'tillbud').length
  const totalAvvikelse = incidents.filter(i => i.type === 'avvikelse').length
  const last30Days = incidents.filter(i => new Date(i.occurred_at) >= thirtyDaysAgo).length

  return (
    <div className="space-y-4">
      {/* Statistik-kort */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-medium text-amber-400 uppercase">Tillbud</span>
          </div>
          <span className="text-2xl font-bold text-white">{totalTillbud}</span>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-xs font-medium text-red-400 uppercase">Avvikelser</span>
          </div>
          <span className="text-2xl font-bold text-white">{totalAvvikelse}</span>
        </div>
        <div className="bg-slate-700/30 border border-slate-700 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-400 uppercase">Senaste 30 dagar</span>
          </div>
          <span className="text-2xl font-bold text-white">{last30Days}</span>
        </div>
      </div>

      {/* Filter-rad */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Sök beskrivning, tekniker..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-[#20c58f] w-56"
          />
        </div>

        <div className="w-px h-6 bg-slate-700" />

        {(['all', 'tillbud', 'avvikelse'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-2.5 py-1.5 text-sm rounded-lg border transition-colors ${
              typeFilter === t
                ? t === 'tillbud' ? 'bg-amber-500/20 text-amber-400 border-amber-500'
                  : t === 'avvikelse' ? 'bg-red-500/20 text-red-400 border-red-500'
                  : 'bg-[#20c58f]/20 text-[#20c58f] border-[#20c58f]'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600'
            }`}
          >
            {t === 'all' ? 'Alla' : INCIDENT_TYPE_CONFIG[t].label}
          </button>
        ))}

        <div className="w-px h-6 bg-slate-700" />

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-2.5 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-[#20c58f]"
        />
        <span className="text-slate-500 text-sm">—</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-2.5 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-[#20c58f]"
        />

        <div className="flex-1" />

        <button
          onClick={fetchIncidents}
          disabled={loading}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          title="Uppdatera"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tabell */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-5 h-5 text-slate-400 animate-spin" />
            <span className="ml-2 text-sm text-slate-400">Laddar...</span>
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Inga tillbud eller avvikelser hittades</p>
          </div>
        ) : (
          <div className="max-h-[calc(100vh-380px)] overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/80 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase">Typ</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase">Beskrivning</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase">Ärende</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase">Tekniker</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase">Rapporterad av</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase">Datum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filteredIncidents.map(incident => {
                  const config = INCIDENT_TYPE_CONFIG[incident.type as IncidentType]
                  return (
                    <tr key={incident.id} className="hover:bg-slate-700/30">
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${config.bgColor} ${config.color}`}>
                          {config.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-white max-w-md">
                        <p className="truncate">{incident.description}</p>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs text-slate-400 font-mono">{incident.case_id.slice(0, 8)}...</span>
                        <span className={`ml-1 px-1 py-0.5 text-xs rounded ${
                          incident.case_type === 'private' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                        }`}>
                          {incident.case_type === 'private' ? 'Privat' : incident.case_type === 'business' ? 'Företag' : 'Avtal'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {incident.technician_name || '-'}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {incident.reported_by_name}
                      </td>
                      <td className="px-3 py-2 text-slate-400 text-xs whitespace-nowrap">
                        {new Date(incident.occurred_at).toLocaleDateString('sv-SE')}{' '}
                        {new Date(incident.occurred_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {filteredIncidents.length > 0 && (
          <div className="px-3 py-2 bg-slate-900/50 border-t border-slate-700 text-sm text-slate-400">
            {filteredIncidents.length} poster
          </div>
        )}
      </div>
    </div>
  )
}
