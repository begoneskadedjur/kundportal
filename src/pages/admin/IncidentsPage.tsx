// src/pages/admin/IncidentsPage.tsx
// Fristående sida för att rapportera och hantera tillbud, olyckor och avvikelser.
// Insyn styrs av RLS: mottagare (incident_recipients) ser incidenter av sina typer,
// övriga ser bara incidenter de rapporterat eller är berörda i.

import { useState, useEffect, useCallback, useRef } from 'react'
import { AlertTriangle, Search, RefreshCw, Calendar, Plus, X, Clock, User, Briefcase, ExternalLink, ChevronRight } from 'lucide-react'
import { supabase, getAuthHeaders } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'
import Select from '../../components/ui/Select'
import type { CaseIncident, IncidentType, IncidentStatus } from '../../types/caseIncidents'
import { INCIDENT_TYPE_CONFIG, INCIDENT_STATUS_CONFIG, ALL_INCIDENT_TYPES } from '../../types/caseIncidents'
import { IncidentRecipientService } from '../../services/incidentRecipientService'
import DatePicker from 'react-datepicker'
import { registerLocale } from 'react-datepicker'
import sv from 'date-fns/locale/sv'
import '../../styles/DatePickerDarkTheme.css'

registerLocale('sv', sv)

interface SimpleEmployee { id: string; name: string }
interface CaseSearchResult { id: string; title: string; case_number: string | null; case_type: 'private' | 'business' }

export default function IncidentsPage() {
  const { user, profile, isTechnician } = useAuth()
  const technicianId = profile?.technician_id || null
  const reporterName = profile?.display_name || profile?.email || 'Okänd'

  const [recipientTypes, setRecipientTypes] = useState<Set<IncidentType>>(new Set())
  const isRecipient = recipientTypes.size > 0

  const [incidents, setIncidents] = useState<CaseIncident[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<'all' | IncidentType>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | IncidentStatus>('all')
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
  const [occurredAt, setOccurredAt] = useState<Date>(new Date())
  const [selectedEmployees, setSelectedEmployees] = useState<SimpleEmployee[]>([])
  const [addEmployeeId, setAddEmployeeId] = useState('')

  // Hanteringsmodal (mottagare)
  const [managingIncident, setManagingIncident] = useState<CaseIncident | null>(null)

  // Ärendesökning
  const [caseQuery, setCaseQuery] = useState('')
  const [caseResults, setCaseResults] = useState<CaseSearchResult[]>([])
  const [caseSearching, setCaseSearching] = useState(false)
  const [selectedCase, setSelectedCase] = useState<CaseSearchResult | null>(null)
  const [showCaseDropdown, setShowCaseDropdown] = useState(false)
  const caseSearchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Hämta egna mottagartyper
  useEffect(() => {
    if (!user?.id) return
    IncidentRecipientService.getRecipientTypes(user.id)
      .then(setRecipientTypes)
      .catch(() => setRecipientTypes(new Set()))
  }, [user?.id])

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
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }
      if (dateFrom) {
        query = query.gte('occurred_at', dateFrom.toISOString().split('T')[0])
      }
      if (dateTo) {
        query = query.lte('occurred_at', dateTo.toISOString().split('T')[0] + 'T23:59:59')
      }

      const { data, error } = await query

      if (error) throw error

      // RLS avgör vad som syns - nya (ohanterade) överst, därefter senaste först
      const statusOrder: Record<string, number> = { ny: 0, under_utredning: 1, atgardad: 2 }
      const sorted = (data || []).sort((a, b) => {
        const diff = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)
        if (diff !== 0) return diff
        return new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
      })

      setIncidents(sorted)
    } catch (err) {
      console.error('Error fetching incidents:', err)
      toast.error('Kunde inte ladda tillbud/avvikelser')
    } finally {
      setLoading(false)
    }
  }, [typeFilter, statusFilter, dateFrom, dateTo])

  useEffect(() => {
    fetchIncidents()
  }, [fetchIncidents])

  const resetForm = () => {
    setShowForm(false)
    setFormType('tillbud')
    setFormDescription('')
    setOccurredAt(new Date())
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
          occurred_at: occurredAt.toISOString(),
          reported_by_id: user?.id || null,
          reported_by_name: reporterName,
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

        // Notifiera mottagare av denna typ (in-app + e-post) - får inte blockera rapporten
        try {
          const headers = await getAuthHeaders()
          fetch('/api/notify-incident', {
            method: 'POST',
            headers,
            body: JSON.stringify({ incident_id: inserted.id })
          }).catch(err => console.error('Error notifying incident recipients:', err))
        } catch (notifErr) {
          console.error('Error preparing incident notification:', notifErr)
        }
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
  const countByType = (type: IncidentType) => incidents.filter(i => i.type === type).length
  const last30Days = incidents.filter(i => new Date(i.occurred_at) >= thirtyDaysAgo).length
  const toHandle = incidents.filter(i => i.status === 'ny' && recipientTypes.has(i.type)).length

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
            <p className="text-slate-400 text-sm">Oj eller aj? Rapportera direkt - stort som smått</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#20c58f] hover:bg-[#1bb07f] rounded-lg text-sm text-white font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Rapportera händelse
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
              Rapportera händelse
            </h2>
            <button onClick={resetForm} className="p-1 text-slate-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Typ-väljare: Oj / Aj / Avvikelse */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {ALL_INCIDENT_TYPES.map(type => {
              const config = INCIDENT_TYPE_CONFIG[type]
              const isSelected = formType === type
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormType(type)}
                  className={`text-left p-3 rounded-xl border transition-colors ${
                    isSelected
                      ? `${config.bgColor} ${config.borderColor}`
                      : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <span className={`block text-xl font-extrabold leading-none mb-1 ${isSelected ? config.color : 'text-slate-300'}`}>
                    {config.exclamation}
                  </span>
                  <span className={`block text-sm font-semibold mb-0.5 ${isSelected ? config.color : 'text-slate-300'}`}>
                    {config.label}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {config.description}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Anmälningsplikt vid olycka */}
          {formType === 'olycka' && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">
                Vid allvarlig olycka eller allvarligt tillbud ska arbetsgivaren utan dröjsmål anmäla till Arbetsmiljöverket.{' '}
                <a
                  href="https://anmalarbetsskada.se"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline inline-flex items-center gap-0.5 hover:text-red-200"
                >
                  anmalarbetsskada.se <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>
          )}

          {/* Beskrivning */}
          <textarea
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            rows={3}
            placeholder="Beskriv händelsen: vad hände, var och hur?"
            className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#20c58f] transition-colors resize-none placeholder-slate-500"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* När hände det? */}
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1 block">
                <Clock className="w-3 h-3 inline mr-1" />
                När inträffade händelsen?
              </label>
              <DatePicker
                selected={occurredAt}
                onChange={(date) => date && setOccurredAt(date)}
                showTimeSelect
                timeFormat="HH:mm"
                timeIntervals={15}
                dateFormat="yyyy-MM-dd HH:mm"
                locale="sv"
                maxDate={new Date()}
                className="w-full px-3 py-1.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#20c58f]"
              />
            </div>

            {/* Rapportör (auto) */}
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1 block">
                <User className="w-3 h-3 inline mr-1" />
                Rapportör
              </label>
              <div className="px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-slate-400">
                {reporterName}
              </div>
            </div>
          </div>

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
                <Select
                  value={addEmployeeId}
                  onChange={setAddEmployeeId}
                  placeholder="Lägg till anställd..."
                  options={[
                    { value: '', label: 'Lägg till anställd...' },
                    ...availableEmployees.map(e => ({ value: e.id, label: e.name }))
                  ]}
                  className="flex-1"
                />
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

          {/* Knappar */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-700/50">
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
              Skicka rapport
            </button>
          </div>
        </div>
      )}

      {/* Statistik-kort */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ALL_INCIDENT_TYPES.map(type => {
          const config = INCIDENT_TYPE_CONFIG[type]
          return (
            <div key={type} className={`${config.bgColor} border ${config.borderColor} rounded-xl p-4`}>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className={`w-4 h-4 ${config.color}`} />
                <span className={`text-xs font-medium ${config.color} uppercase tracking-wide`}>{config.label}</span>
              </div>
              <span className="text-2xl font-bold text-white">{countByType(type)}</span>
            </div>
          )
        })}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Senaste 30 dagar</span>
          </div>
          <span className="text-2xl font-bold text-white">{last30Days}</span>
        </div>
      </div>

      {/* Att hantera-banner för mottagare */}
      {isRecipient && toHandle > 0 && (
        <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-300 flex-1">
            <span className="font-semibold">{toHandle} {toHandle === 1 ? 'ny rapport' : 'nya rapporter'}</span> att hantera. Klicka på en rad för att utreda och åtgärda.
          </p>
          <button
            onClick={() => setStatusFilter('ny')}
            className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-xs font-medium transition-colors"
          >
            Visa nya
          </button>
        </div>
      )}

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

          {(['all', ...ALL_INCIDENT_TYPES] as const).map(t => {
            const isActive = typeFilter === t
            const activeColor = t === 'all'
              ? 'bg-[#20c58f]/20 text-[#20c58f]'
              : `${INCIDENT_TYPE_CONFIG[t].bgColor.replace('/10', '/20')} ${INCIDENT_TYPE_CONFIG[t].color}`
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

          <Select
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as 'all' | IncidentStatus)}
            options={[
              { value: 'all', label: 'Alla statusar' },
              { value: 'ny', label: 'Ny' },
              { value: 'under_utredning', label: 'Under utredning' },
              { value: 'atgardad', label: 'Åtgärdad' },
            ]}
            className="w-44"
          />

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
            <p className="text-sm font-medium">Inga rapporter att visa</p>
            <p className="text-xs text-slate-500 mt-1">Klicka &quot;Rapportera händelse&quot; för att rapportera oj, aj eller avvikelse</p>
          </div>
        ) : (
          <div className="max-h-[calc(100vh-480px)] overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/80 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Typ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Beskrivning</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Berörda</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Rapporterad av</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Datum</th>
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filteredIncidents.map(incident => {
                  const config = INCIDENT_TYPE_CONFIG[incident.type as IncidentType]
                  const statusConfig = INCIDENT_STATUS_CONFIG[incident.status as IncidentStatus] || INCIDENT_STATUS_CONFIG.ny
                  const canManage = recipientTypes.has(incident.type as IncidentType)
                  const employeeNames = (incident.incident_employees || []).map(e => e.technician_name).join(', ')
                  return (
                    <tr
                      key={incident.id}
                      onClick={() => canManage && setManagingIncident(incident)}
                      className={`transition-colors ${canManage ? 'cursor-pointer hover:bg-slate-700/30' : 'hover:bg-slate-700/10'}`}
                    >
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${config.bgColor} ${config.color}`}>
                          {config.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-md">
                        <p className="truncate text-white">{incident.description}</p>
                        {incident.action_taken && (
                          <p className="truncate text-xs text-slate-500 mt-0.5">Åtgärd: {incident.action_taken}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {employeeNames || incident.technician_name || '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {incident.reported_by_name}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                        {new Date(incident.occurred_at).toLocaleDateString('sv-SE')}{' '}
                        {new Date(incident.occurred_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-2 py-3 text-slate-600">
                        {canManage && <ChevronRight className="w-4 h-4" />}
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

      {/* Hanteringsmodal för mottagare */}
      {managingIncident && (
        <IncidentManageModal
          incident={managingIncident}
          handlerName={reporterName}
          onClose={() => setManagingIncident(null)}
          onSaved={() => {
            setManagingIncident(null)
            fetchIncidents()
          }}
        />
      )}
    </div>
  )
}

// Modal där mottagare sätter status och dokumenterar åtgärd
function IncidentManageModal({
  incident,
  handlerName,
  onClose,
  onSaved
}: {
  incident: CaseIncident
  handlerName: string
  onClose: () => void
  onSaved: () => void
}) {
  const [status, setStatus] = useState<IncidentStatus>(incident.status || 'ny')
  const [actionTaken, setActionTaken] = useState(incident.action_taken || '')
  const [saving, setSaving] = useState(false)

  const typeConfig = INCIDENT_TYPE_CONFIG[incident.type as IncidentType]
  const employeeNames = (incident.incident_employees || []).map(e => e.technician_name).join(', ')

  const handleSave = async () => {
    setSaving(true)
    try {
      const isHandled = status !== 'ny'
      const { error } = await supabase
        .from('case_incidents')
        .update({
          status,
          action_taken: actionTaken.trim() || null,
          handled_by_name: isHandled ? handlerName : null,
          handled_at: isHandled ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', incident.id)

      if (error) throw error
      toast.success('Rapporten uppdaterad')
      onSaved()
    } catch (err) {
      console.error('Error updating incident:', err)
      toast.error('Kunde inte spara')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${typeConfig.bgColor} ${typeConfig.color}`}>
              {typeConfig.label}
            </span>
            <h2 className="text-sm font-semibold text-white">Hantera rapport</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {/* Händelsen */}
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-2">
            <p className="text-sm text-white whitespace-pre-wrap">{incident.description}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(incident.occurred_at).toLocaleDateString('sv-SE')}{' '}
                {new Date(incident.occurred_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                Rapportör: {incident.reported_by_name}
              </span>
              {employeeNames && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  Berörda: {employeeNames}
                </span>
              )}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">Status</label>
            <div className="flex gap-2">
              {(Object.keys(INCIDENT_STATUS_CONFIG) as IncidentStatus[]).map(s => {
                const sc = INCIDENT_STATUS_CONFIG[s]
                const isSelected = status === s
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                      isSelected
                        ? `${sc.bgColor} ${sc.color} border-current`
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    {sc.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Åtgärd */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">
              Åtgärd / utredning
            </label>
            <textarea
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              rows={3}
              placeholder="Vad har gjorts eller ska göras för att det inte ska hända igen?"
              className="w-full px-3 py-1.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#20c58f] transition-colors resize-none placeholder-slate-500"
            />
          </div>

          {incident.handled_by_name && (
            <p className="text-xs text-slate-500">
              Senast hanterad av {incident.handled_by_name}
              {incident.handled_at && ` (${new Date(incident.handled_at).toLocaleDateString('sv-SE')})`}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
          >
            Avbryt
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-1.5 bg-[#20c58f] hover:bg-[#1bb07f] rounded-lg text-sm text-white font-medium transition-colors disabled:opacity-50"
          >
            {saving && <RefreshCw className="w-3 h-3 animate-spin" />}
            Spara
          </button>
        </div>
      </div>
    </div>
  )
}
