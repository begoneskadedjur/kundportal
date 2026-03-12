// src/pages/admin/IncidentsPage.tsx
// Fristående sida för att rapportera och visa tillbud & avvikelser

import { useState, useEffect, useCallback, useRef } from 'react'
import { AlertTriangle, Search, RefreshCw, Calendar, Lock, Plus, X, Clock, User, Briefcase } from 'lucide-react'
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

interface SimpleEmployee { id: string; name: string }
interface CaseSearchResult { id: string; title: string; case_number: string | null; case_type: 'private' | 'business' }

export default function IncidentsPage() {
  const { profile, isTechnician, isAdmin, isKoordinator } = useAuth()
  const isRecipient = profile?.incident_recipient === true
  const technicianId = profile?.technician_id || null

  const [incidents, setIncidents] = useState<CaseIncident[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<'all' | IncidentType>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFrom, setDateFrom] = useState<Date | null>(null)
  const [dateTo, setDateTo] = useState<Date | null>(null)

  // Anställda
  const [employees, setEmployees] = useState<SimpleEmployee[]>([])

  // Formulär
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formType, setFormType] = useState<IncidentType>('tillbud')
  const [formDescription, setFormDescription] = useState('')
  const [selectedEmployees, setSelectedEmployees] = useState<SimpleEmployee[]>([])
  const [addEmployeeId, setAddEmployeeId] = useState('')

  // Ärendesökning
  const [caseQuery, setCaseQuery] = useState('')
  const [caseResults, setCaseResults] = useState<CaseSearchResult[]>([])
  const [caseSearching, setCaseSearching] = useState(false)
  const [selectedCase, setSelectedCase] = useState<CaseSearchResult | null>(null)
  const [showCaseDropdown, setShowCaseDropdown] = useState(false)
  const caseSearchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Hämta anställda
  useEffect(() => {
    supabase.from('technicians').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => {
        if (data) setEmployees(data)
      })
  }, [])

  // Auto-förval för tekniker
  useEffect(() => {
    if (showForm && isTechnician && technicianId && employees.length > 0 && selectedEmployees.length === 0) {
      const me = employees.find(e => e.id === technicianId)
      if (me) setSelectedEmployees([me])
    }
  }, [showForm, isTechnician, technicianId, employees, selectedEmployees.length])

  // Stäng ärendesök-dropdown vid klick utanför
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (caseSearchRef.current && !caseSearchRef.current.contains(e.target as Node)) {
        setShowCaseDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Ärendesökning med debounce
  const searchCases = useCallback(async (query: string) => {
    if (query.length < 2) { setCaseResults([]); return }
    setCaseSearching(true)
    try {
      const results: CaseSearchResult[] = []
      for (const table of ['private_cases', 'business_cases'] as const) {
        let q = supabase.from(table)
          .select('id, title, case_number')
          .or(`title.ilike.%${query}%,case_number.ilike.%${query}%`)
          .limit(5)

        // Tekniker: bara egna ärenden
        if (isTechnician && technicianId) {
          q = q.or(`primary_assignee_id.eq.${technicianId},secondary_assignee_id.eq.${technicianId},tertiary_assignee_id.eq.${technicianId}`)
        }

        const { data } = await q
        if (data) {
          results.push(...data.map(c => ({
            ...c,
            case_type: (table === 'private_cases' ? 'private' : 'business') as 'private' | 'business'
          })))
        }
      }
      setCaseResults(results.slice(0, 10))
    } catch {
      setCaseResults([])
    } finally {
      setCaseSearching(false)
    }
  }, [isTechnician, technicianId])

  const handleCaseQueryChange = (value: string) => {
    setCaseQuery(value)
    setShowCaseDropdown(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchCases(value), 300)
  }

  const fetchIncidents = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('case_incidents')
        .select('*, incident_employees(*)')
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

      let result = data || []

      // Tekniker utan incident_recipient: visa bara incidenter de är berörda i
      if (isTechnician && !isRecipient && technicianId) {
        result = result.filter(i =>
          i.technician_id === technicianId ||
          (i.incident_employees || []).some((e: { technician_id: string }) => e.technician_id === technicianId)
        )
      }

      setIncidents(result)
    } catch (err) {
      console.error('Error fetching incidents:', err)
      toast.error('Kunde inte ladda tillbud/avvikelser')
    } finally {
      setLoading(false)
    }
  }, [typeFilter, dateFrom, dateTo, isTechnician, isRecipient, technicianId])

  useEffect(() => {
    fetchIncidents()
  }, [fetchIncidents])

  // Kan denna person se detaljer i en specifik incident?
  const canSeeDetails = (incident: CaseIncident) => {
    if (isRecipient) return true
    if (!technicianId) return false
    if (incident.technician_id === technicianId) return true
    return (incident.incident_employees || []).some(e => e.technician_id === technicianId)
  }

  const resetForm = () => {
    setShowForm(false)
    setFormType('tillbud')
    setFormDescription('')
    setSelectedEmployees([])
    setAddEmployeeId('')
    setCaseQuery('')
    setCaseResults([])
    setSelectedCase(null)
  }

  const handleSubmit = async () => {
    if (!formDescription.trim()) {
      toast.error('Beskrivning krävs')
      return
    }
    if (selectedEmployees.length === 0) {
      toast.error('Minst en berörd anställd krävs')
      return
    }

    setSaving(true)
    try {
      const primaryEmployee = selectedEmployees[0]

      const { data: inserted, error } = await supabase
        .from('case_incidents')
        .insert({
          type: formType,
          description: formDescription.trim(),
          occurred_at: new Date().toISOString(),
          reported_by_id: profile?.id || null,
          reported_by_name: profile?.full_name || profile?.email || 'Okänd',
          technician_id: primaryEmployee.id,
          technician_name: primaryEmployee.name,
          case_id: selectedCase?.id || null,
          case_type: selectedCase?.case_type || null
        })
        .select('id')
        .single()

      if (error) throw error

      // Insert alla berörda anställda i kopplingstabell
      if (inserted?.id) {
        const employeeRows = selectedEmployees.map(e => ({
          incident_id: inserted.id,
          technician_id: e.id,
          technician_name: e.name
        }))
        await supabase.from('incident_employees').insert(employeeRows)
      }

      // Skicka notis till alla incidentmottagare
      try {
        const { data: recipients } = await supabase
          .from('profiles')
          .select('id, display_name')
          .eq('incident_recipient', true)

        if (recipients?.length) {
          const typeLabel = INCIDENT_TYPE_CONFIG[formType].label
          const notifications = recipients
            .filter(r => r.id !== profile?.id)
            .map(r => ({
              recipient_id: r.id,
              case_id: selectedCase?.id || null,
              case_type: selectedCase?.case_type || null,
              title: `Ny ${typeLabel.toLowerCase()}`,
              preview: formDescription.trim().slice(0, 200),
              sender_name: profile?.full_name || profile?.email || 'Okänd',
              sender_id: profile?.id || null,
              is_read: false,
              source_comment_id: null,
              case_title: selectedEmployees.map(e => e.name).join(', ')
            }))

          if (notifications.length > 0) {
            await supabase.from('notifications').insert(notifications)
          }
        }
      } catch (notifErr) {
        console.error('Error sending incident notifications:', notifErr)
      }

      toast.success(`${INCIDENT_TYPE_CONFIG[formType].label} rapporterad`)
      resetForm()
      fetchIncidents()
    } catch (err) {
      console.error('Error creating incident:', err)
      toast.error('Kunde inte spara')
    } finally {
      setSaving(false)
    }
  }

  const addEmployee = () => {
    if (!addEmployeeId) return
    const emp = employees.find(e => e.id === addEmployeeId)
    if (emp && !selectedEmployees.some(e => e.id === emp.id)) {
      setSelectedEmployees(prev => [...prev, emp])
    }
    setAddEmployeeId('')
  }

  const removeEmployee = (id: string) => {
    // Tekniker kan inte ta bort sig själva
    if (isTechnician && id === technicianId) return
    setSelectedEmployees(prev => prev.filter(e => e.id !== id))
  }

  // Filtrerade incidenter baserat på sökterm
  const filteredIncidents = searchTerm
    ? incidents.filter(i =>
        i.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (i.technician_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.reported_by_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (i.incident_employees || []).some(e => e.technician_name.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : incidents

  // Statistik
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const totalTillbud = incidents.filter(i => i.type === 'tillbud').length
  const totalAvvikelse = incidents.filter(i => i.type === 'avvikelse').length
  const last30Days = incidents.filter(i => new Date(i.occurred_at) >= thirtyDaysAgo).length

  // Tillgängliga anställda att lägga till (exkludera redan valda)
  const availableEmployees = employees.filter(e => !selectedEmployees.some(s => s.id === e.id))

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
            <p className="text-slate-400 text-sm">Rapportera och granska tillbud och avvikelser</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#20c58f] hover:bg-[#1bb07f] rounded-lg text-sm text-white font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nytt tillbud / avvikelse
          </button>
          <button
            onClick={fetchIncidents}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Uppdatera
          </button>
        </div>
      </div>

      {/* Rapporteringsformulär */}
      {showForm && (
        <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Rapportera tillbud / avvikelse
            </h2>
            <button onClick={resetForm} className="p-1 text-slate-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Typ-väljare */}
          <div className="flex gap-2">
            {(Object.keys(INCIDENT_TYPE_CONFIG) as IncidentType[]).map(type => {
              const config = INCIDENT_TYPE_CONFIG[type]
              const isSelected = formType === type
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormType(type)}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                    isSelected
                      ? `${config.bgColor} ${config.color} ${config.borderColor}`
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  {config.label}
                </button>
              )
            })}
          </div>

          <p className="text-xs text-slate-500">
            {INCIDENT_TYPE_CONFIG[formType].description}
          </p>

          {/* Beskrivning */}
          <textarea
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            rows={3}
            placeholder="Beskriv händelsen..."
            className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#20c58f] transition-colors resize-none placeholder-slate-500"
          />

          {/* Berörda anställda */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">
              <User className="w-3 h-3 inline mr-1" />
              Berörda anställda <span className="text-red-400">*</span>
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {selectedEmployees.map(emp => (
                <span key={emp.id} className="flex items-center gap-1 px-2 py-1 bg-slate-700/50 border border-slate-600 rounded-md text-xs text-white">
                  {emp.name}
                  {!(isTechnician && emp.id === technicianId) && (
                    <button onClick={() => removeEmployee(emp.id)} className="text-slate-400 hover:text-red-400 ml-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
            {availableEmployees.length > 0 && (
              <div className="flex gap-2">
                <select
                  value={addEmployeeId}
                  onChange={(e) => setAddEmployeeId(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#20c58f]"
                >
                  <option value="">Lägg till anställd...</option>
                  {availableEmployees.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addEmployee}
                  disabled={!addEmployeeId}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-sm text-white transition-colors disabled:opacity-30"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Ärendekoppling */}
          <div ref={caseSearchRef} className="relative">
            <label className="text-xs font-medium text-slate-400 mb-1 block">
              <Briefcase className="w-3 h-3 inline mr-1" />
              Koppla till ärende <span className="text-slate-600">(valfritt)</span>
            </label>
            {selectedCase ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-white">
                <span className="flex-1 truncate">
                  <span className="text-slate-400 font-mono">{selectedCase.case_number || selectedCase.id.slice(0, 8)}</span>
                  {' — '}
                  {selectedCase.title}
                </span>
                <button onClick={() => setSelectedCase(null)} className="text-slate-400 hover:text-red-400 flex-shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    value={caseQuery}
                    onChange={(e) => handleCaseQueryChange(e.target.value)}
                    onFocus={() => caseQuery.length >= 2 && setShowCaseDropdown(true)}
                    placeholder={isTechnician ? 'Sök bland dina ärenden...' : 'Sök ärende (titel eller nummer)...'}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#20c58f] placeholder-slate-500"
                  />
                  {caseSearching && <RefreshCw className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 animate-spin" />}
                </div>
                {showCaseDropdown && caseResults.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-48 overflow-auto">
                    {caseResults.map(c => (
                      <button
                        key={`${c.case_type}-${c.id}`}
                        type="button"
                        onClick={() => { setSelectedCase(c); setShowCaseDropdown(false); setCaseQuery('') }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-700/50 transition-colors border-b border-slate-700/50 last:border-b-0"
                      >
                        <span className="text-slate-400 font-mono text-xs">{c.case_number || c.id.slice(0, 8)}</span>
                        <span className={`ml-1.5 px-1 py-0.5 text-xs rounded ${c.case_type === 'private' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                          {c.case_type === 'private' ? 'Privat' : 'Företag'}
                        </span>
                        <p className="text-white truncate">{c.title}</p>
                      </button>
                    ))}
                  </div>
                )}
                {showCaseDropdown && caseQuery.length >= 2 && !caseSearching && caseResults.length === 0 && (
                  <div className="absolute z-20 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl px-3 py-2 text-sm text-slate-500">
                    Inga ärenden hittades
                  </div>
                )}
              </>
            )}
          </div>

          {/* Auto-ifyllda fält */}
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date().toLocaleDateString('sv-SE')} {new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              Rapportör: {profile?.full_name || profile?.email || 'Okänd'}
            </span>
          </div>

          {/* Knappar */}
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-700/50">
            <button
              type="button"
              onClick={resetForm}
              className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Avbryt
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || !formDescription.trim() || selectedEmployees.length === 0}
              className="flex items-center gap-2 px-4 py-1.5 bg-[#20c58f] hover:bg-[#1bb07f] rounded-lg text-sm text-white font-medium transition-colors disabled:opacity-50"
            >
              {saving && <RefreshCw className="w-3 h-3 animate-spin" />}
              Spara
            </button>
          </div>
        </div>
      )}

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
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Sök beskrivning, anställd..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-2 text-sm bg-slate-900/50 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-[#20c58f] w-56"
            />
          </div>

          <div className="w-px h-7 bg-slate-700" />

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
            <p className="text-xs text-slate-500 mt-1">Klicka &quot;Nytt tillbud / avvikelse&quot; för att rapportera</p>
          </div>
        ) : (
          <div className="max-h-[calc(100vh-480px)] overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/80 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Typ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Beskrivning</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Berörda</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Rapporterad av</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Datum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filteredIncidents.map(incident => {
                  const config = INCIDENT_TYPE_CONFIG[incident.type as IncidentType]
                  const visible = canSeeDetails(incident)
                  const employeeNames = (incident.incident_employees || []).map(e => e.technician_name).join(', ')
                  return (
                    <tr key={incident.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${config.bgColor} ${config.color}`}>
                          {config.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-md">
                        {visible ? (
                          <p className="truncate text-white">{incident.description}</p>
                        ) : (
                          <p className="truncate text-slate-600 italic flex items-center gap-1.5">
                            <Lock className="w-3 h-3 flex-shrink-0" />
                            Konfidentiell — kontakta incidentansvarig
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {visible ? (employeeNames || incident.technician_name || '-') : <span className="text-slate-600">•••</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {visible ? incident.reported_by_name : <span className="text-slate-600">•••</span>}
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
      {!isRecipient && !isTechnician && incidents.length > 0 && (
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
