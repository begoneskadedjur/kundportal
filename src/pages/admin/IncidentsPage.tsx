// src/pages/admin/IncidentsPage.tsx
// Admin-sida för att visa alla tillbud & avvikelser

import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, Search, RefreshCw, Calendar, Lock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'
import type { CaseIncident, IncidentType } from '../../types/caseIncidents'
import { INCIDENT_TYPE_CONFIG } from '../../types/caseIncidents'
import DatePicker from 'react-datepicker'
import { registerLocale } from 'react-datepicker'
import sv from 'date-fns/locale/sv'
import '../../styles/DatePickerDarkTheme.css'

registerLocale('sv', sv)

export default function IncidentsPage() {
  const { profile } = useAuth()
  const isRecipient = profile?.incident_recipient === true
  const [incidents, setIncidents] = useState<CaseIncident[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<'all' | IncidentType>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFrom, setDateFrom] = useState<Date | null>(null)
  const [dateTo, setDateTo] = useState<Date | null>(null)

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
        query = query.gte('occurred_at', dateFrom.toISOString().split('T')[0])
      }
      if (dateTo) {
        query = query.lte('occurred_at', dateTo.toISOString().split('T')[0] + 'T23:59:59')
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
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Tillbud & Avvikelser</h1>
            <p className="text-slate-400 text-sm">Rapporterade tillbud och avvikelser från fältarbete</p>
          </div>
        </div>
        <button
          onClick={fetchIncidents}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Uppdatera
        </button>
      </div>

      {/* Statistik-kort */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-medium text-amber-400 uppercase tracking-wide">Tillbud</span>
          </div>
          <span className="text-2xl font-bold text-white">{totalTillbud}</span>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-xs font-medium text-red-400 uppercase tracking-wide">Avvikelser</span>
          </div>
          <span className="text-2xl font-bold text-white">{totalAvvikelse}</span>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Senaste 30 dagar</span>
          </div>
          <span className="text-2xl font-bold text-white">{last30Days}</span>
        </div>
      </div>

      {/* Filter-rad — bara för mottagare */}
      {isRecipient && (
        <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-800/50 rounded-lg">
          {/* Sök */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Sök beskrivning, tekniker..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-2 text-sm bg-slate-900/50 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-[#20c58f] w-56"
            />
          </div>

          <div className="w-px h-7 bg-slate-700" />

          {/* Typ-filter */}
          {(['all', 'tillbud', 'avvikelse'] as const).map(t => {
            const isActive = typeFilter === t
            const activeColor = t === 'tillbud'
              ? 'bg-amber-500/20 text-amber-400'
              : t === 'avvikelse'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-[#20c58f]/20 text-[#20c58f]'
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  isActive ? activeColor : 'bg-transparent text-slate-400 hover:bg-slate-700/50'
                }`}
              >
                <span>{t === 'all' ? 'Alla' : INCIDENT_TYPE_CONFIG[t].label}</span>
                <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${isActive ? 'bg-white/20' : 'bg-slate-700'}`}>
                  {t === 'all' ? incidents.length : incidents.filter(i => i.type === t).length}
                </span>
              </button>
            )
          })}

          <div className="w-px h-7 bg-slate-700" />

          {/* Datumväljare */}
          <div className="flex items-center gap-2">
            <DatePicker
              selected={dateFrom}
              onChange={(date) => setDateFrom(date)}
              dateFormat="yyyy-MM-dd"
              locale="sv"
              placeholderText="Från datum"
              isClearable
              className="px-3 py-2 text-sm bg-slate-900/50 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-[#20c58f] w-36"
            />
            <span className="text-slate-500 text-sm">—</span>
            <DatePicker
              selected={dateTo}
              onChange={(date) => setDateTo(date)}
              dateFormat="yyyy-MM-dd"
              locale="sv"
              placeholderText="Till datum"
              isClearable
              className="px-3 py-2 text-sm bg-slate-900/50 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-[#20c58f] w-36"
            />
          </div>
        </div>
      )}

      {/* Tabell */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-5 h-5 text-slate-400 animate-spin" />
            <span className="ml-2 text-sm text-slate-400">Laddar...</span>
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Inga tillbud eller avvikelser hittades</p>
            <p className="text-xs text-slate-500 mt-1">Tillbud och avvikelser rapporteras via ärenden</p>
          </div>
        ) : (
          <div className="max-h-[calc(100vh-480px)] overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/80 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Typ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Beskrivning</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Ärende</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Tekniker</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Rapporterad av</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Datum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filteredIncidents.map(incident => {
                  const config = INCIDENT_TYPE_CONFIG[incident.type as IncidentType]
                  return (
                    <tr key={incident.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${config.bgColor} ${config.color}`}>
                          {config.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-md">
                        {isRecipient ? (
                          <p className="truncate text-white">{incident.description}</p>
                        ) : (
                          <p className="truncate text-slate-600 italic flex items-center gap-1.5">
                            <Lock className="w-3 h-3 flex-shrink-0" />
                            Konfidentiell — kontakta incidentansvarig
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isRecipient ? (
                          <>
                            <span className="text-xs text-slate-400 font-mono">{incident.case_id.slice(0, 8)}...</span>
                            <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded ${
                              incident.case_type === 'private' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                            }`}>
                              {incident.case_type === 'private' ? 'Privat' : incident.case_type === 'business' ? 'Företag' : 'Avtal'}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-600">•••</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {isRecipient ? (incident.technician_name || '-') : <span className="text-slate-600">•••</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {isRecipient ? incident.reported_by_name : <span className="text-slate-600">•••</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
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
          <div className="px-4 py-2.5 bg-slate-900/50 border-t border-slate-700 text-sm text-slate-400">
            {filteredIncidents.length} poster
          </div>
        )}
      </div>

      {/* Info-banner för icke-mottagare */}
      {!isRecipient && incidents.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
          <Lock className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <p className="text-sm text-slate-500">
            Du har inte behörighet att se detaljer. Kontakta en incidentansvarig för mer information.
          </p>
        </div>
      )}
    </div>
  )
}
