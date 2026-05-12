// src/components/admin/technicians/RevisitModal.tsx
// Modal för att boka återbesök — tvåstegsflöde: välj datum → välj ledig tid

import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Calendar,
  Bug,
  FileText,
  Clock,
  ChevronDown,
  ChevronUp,
  User,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'
import DatePicker from 'react-datepicker'
import { registerLocale } from 'react-datepicker'
import sv from 'date-fns/locale/sv'
import { format, addMinutes, isSameDay } from 'date-fns'
import Button from '../../ui/Button'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { toSwedishISOString } from '../../../utils/dateHelpers'
import toast from 'react-hot-toast'
import "react-datepicker/dist/react-datepicker.css"

registerLocale('sv', sv)

interface TechnicianCase {
  id: string
  case_type: 'private' | 'business' | 'contract'
  title: string
  description?: string
  status: string
  case_price?: number
  kontaktperson?: string
  telefon_kontaktperson?: string
  e_post_kontaktperson?: string
  skadedjur?: string
  adress?: any
  start_date?: string | null
  due_date?: string | null
  rapport?: string
  parent_case_id?: string | null
  primary_assignee_id?: string | null
  primary_assignee_name?: string | null
}

interface RevisitHistoryEntry {
  id: string
  update_type: string
  previous_value: string
  new_value: string
  updated_by_name: string
  created_at: string
}

interface TimeSlot {
  start: Date
  end: Date
  hasConflict: boolean
}

interface RevisitModalProps {
  caseData: TechnicianCase
  onSuccess: (updatedCase: TechnicianCase) => void
  onClose: () => void
}

const formatAddress = (address: any): string => {
  if (!address) return '-'
  if (typeof address === 'object' && address.formatted_address) return address.formatted_address
  if (typeof address === 'string') {
    try {
      const p = JSON.parse(address)
      return p.formatted_address || address
    } catch (e) {
      return address
    }
  }
  return '-'
}

async function fetchBookingsForTechnician(techId: string, date: Date) {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0)
  const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)
  const fromISO = dayStart.toISOString()
  const toISO = dayEnd.toISOString()

  const [{ data: pc }, { data: bc }, { data: cc }, { data: is }] = await Promise.all([
    supabase.from('private_cases').select('start_date, due_date')
      .or(`primary_assignee_id.eq.${techId},secondary_assignee_id.eq.${techId},tertiary_assignee_id.eq.${techId}`)
      .gte('start_date', fromISO).lte('start_date', toISO)
      .not('status', 'in', '(Avslutat,Borttaget)'),
    supabase.from('business_cases').select('start_date, due_date')
      .or(`primary_assignee_id.eq.${techId},secondary_assignee_id.eq.${techId},tertiary_assignee_id.eq.${techId}`)
      .gte('start_date', fromISO).lte('start_date', toISO)
      .not('status', 'in', '(Avslutat,Borttaget)'),
    supabase.from('cases').select('scheduled_start, scheduled_end')
      .or(`primary_technician_id.eq.${techId},secondary_technician_id.eq.${techId},tertiary_technician_id.eq.${techId}`)
      .gte('scheduled_start', fromISO).lte('scheduled_start', toISO)
      .neq('status', 'Avslutat'),
    supabase.from('station_inspection_sessions').select('scheduled_at, scheduled_end')
      .eq('technician_id', techId)
      .gte('scheduled_at', fromISO).lte('scheduled_at', toISO)
      .in('status', ['scheduled', 'in_progress'])
  ])

  const bookings: { start: Date; end: Date }[] = []
  pc?.forEach(c => { if (c.start_date && c.due_date) bookings.push({ start: new Date(c.start_date), end: new Date(c.due_date) }) })
  bc?.forEach(c => { if (c.start_date && c.due_date) bookings.push({ start: new Date(c.start_date), end: new Date(c.due_date) }) })
  cc?.forEach(c => { if (c.scheduled_start && c.scheduled_end) bookings.push({ start: new Date(c.scheduled_start), end: new Date(c.scheduled_end) }) })
  is?.forEach(s => { if (s.scheduled_at && s.scheduled_end) bookings.push({ start: new Date(s.scheduled_at), end: new Date(s.scheduled_end) }) })
  return bookings
}

function generateTimeSlots(date: Date, durationMinutes: number, bookings: { start: Date; end: Date }[]): TimeSlot[] {
  const slots: TimeSlot[] = []
  const slotStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 7, 0)
  const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 17, 0)

  let current = new Date(slotStart)
  while (current < dayEnd) {
    const end = addMinutes(current, durationMinutes)
    if (end > dayEnd) break
    const hasConflict = bookings.some(b => current < b.end && end > b.start)
    slots.push({ start: new Date(current), end, hasConflict })
    current = addMinutes(current, 30)
  }
  return slots
}

export default function RevisitModal({ caseData, onSuccess, onClose }: RevisitModalProps) {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [loadingSlots, setLoadingSlots] = useState(false)

  // Steg 1: välj datum
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [durationMinutes, setDurationMinutes] = useState(60)

  // Steg 2: välj tid
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [step, setStep] = useState<1 | 2>(1)

  // Anteckning
  const [revisitNote, setRevisitNote] = useState('')

  // Historik
  const [revisitHistory, setRevisitHistory] = useState<RevisitHistoryEntry[]>([])
  const [showFullHistory, setShowFullHistory] = useState(false)

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data } = await supabase
          .from('case_updates_log')
          .select('*')
          .eq('case_id', caseData.id)
          .eq('update_type', 'revisit_scheduled')
          .order('created_at', { ascending: false })
        setRevisitHistory(data || [])
      } catch (e) {
        console.error('Error fetching revisit history:', e)
      } finally {
        setLoadingHistory(false)
      }
    }
    fetchHistory()
  }, [caseData.id])

  const handleDateConfirm = useCallback(async () => {
    if (!selectedDate || !caseData.primary_assignee_id) return
    setLoadingSlots(true)
    try {
      const bookings = await fetchBookingsForTechnician(caseData.primary_assignee_id, selectedDate)
      const generatedSlots = generateTimeSlots(selectedDate, durationMinutes, bookings)
      setSlots(generatedSlots)
      setSelectedSlot(null)
      setStep(2)
    } catch (e) {
      toast.error('Kunde inte hämta schema')
    } finally {
      setLoadingSlots(false)
    }
  }, [selectedDate, durationMinutes, caseData.primary_assignee_id])

  const handleScheduleRevisit = async () => {
    if (!selectedSlot || !profile) return
    setLoading(true)
    try {
      const tableName = caseData.case_type === 'private'
        ? 'private_cases'
        : caseData.case_type === 'business'
          ? 'business_cases'
          : 'cases'

      const newStartDate = toSwedishISOString(selectedSlot.start)
      const newDueDate = toSwedishISOString(selectedSlot.end)

      const { data: updatedCase, error } = await supabase
        .from(tableName)
        .update({ start_date: newStartDate, due_date: newDueDate, status: 'Återbesök' })
        .eq('id', caseData.id)
        .select()
        .single()

      if (error) throw error

      const { error: logError } = await supabase
        .from('case_updates_log')
        .insert({
          case_id: caseData.id,
          case_type: caseData.case_type,
          update_type: 'revisit_scheduled',
          previous_value: JSON.stringify({ start_date: caseData.start_date, due_date: caseData.due_date }),
          new_value: JSON.stringify({ start_date: newStartDate, due_date: newDueDate, note: revisitNote }),
          updated_by_id: profile.id,
          updated_by_name: profile.full_name || profile.display_name || 'Okänd'
        })
      if (logError) console.error('[RevisitModal] Failed to log revisit:', logError)

      toast.success('Återbesök bokat!')
      onSuccess({ ...caseData, ...updatedCase, case_type: caseData.case_type })
    } catch (error: any) {
      console.error('Error scheduling revisit:', error)
      toast.error(`Kunde inte boka återbesök: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const freeSlots = slots.filter(s => !s.hasConflict)
  const busySlots = slots.filter(s => s.hasConflict)

  const modalContent = (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex flex-col justify-end sm:justify-center sm:items-center sm:p-4 pointer-events-auto">
      <div className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto bg-slate-900 border-t border-slate-700 sm:border sm:rounded-xl shadow-2xl rounded-t-2xl">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-500/20 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Boka återbesök</h2>
              <p className="text-sm text-slate-400">
                {step === 1 ? 'Välj datum och längd' : `Välj tid — ${selectedDate ? format(selectedDate, 'EEEE d MMMM', { locale: sv }) : ''}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Ärendeinfo */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <p className="text-white font-medium truncate">{caseData.title}</p>
                {caseData.skadedjur && (
                  <p className="text-slate-400 text-sm flex items-center gap-1.5">
                    <Bug className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    {caseData.skadedjur}
                  </p>
                )}
                {caseData.adress && (
                  <p className="text-slate-400 text-sm truncate">{formatAddress(caseData.adress)}</p>
                )}
              </div>
              {caseData.primary_assignee_name && (
                <div className="flex items-center gap-1.5 text-sm text-slate-400 shrink-0">
                  <User className="w-3.5 h-3.5" />
                  {caseData.primary_assignee_name}
                </div>
              )}
            </div>
          </div>

          {/* Steg-indikatorer */}
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 text-sm font-medium ${step === 1 ? 'text-teal-400' : 'text-slate-500'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 1 ? 'bg-teal-500 text-white' : 'bg-slate-700 text-slate-400'}`}>1</span>
              Välj datum
            </div>
            <div className="flex-1 h-px bg-slate-700" />
            <div className={`flex items-center gap-2 text-sm font-medium ${step === 2 ? 'text-teal-400' : 'text-slate-500'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 2 ? 'bg-teal-500 text-white' : 'bg-slate-700 text-slate-400'}`}>2</span>
              Välj tid
            </div>
          </div>

          {/* STEG 1: Datum + längd */}
          {step === 1 && (
            <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Datum för återbesök</label>
                <DatePicker
                  selected={selectedDate}
                  onChange={(date) => setSelectedDate(date)}
                  dateFormat="EEEE d MMMM yyyy"
                  locale="sv"
                  minDate={new Date()}
                  filterDate={(date) => date.getDay() !== 0 && date.getDay() !== 6}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20"
                  placeholderText="Välj datum"
                  inline
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Besökslängd</label>
                <div className="flex gap-2 flex-wrap">
                  {[30, 60, 90, 120].map(min => (
                    <button
                      key={min}
                      type="button"
                      onClick={() => setDurationMinutes(min)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        durationMinutes === min
                          ? 'bg-teal-500 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {min < 60 ? `${min} min` : `${min / 60} tim`}
                    </button>
                  ))}
                </div>
              </div>

              {!caseData.primary_assignee_id && (
                <div className="flex items-center gap-2 text-amber-400 text-sm bg-amber-400/10 border border-amber-400/20 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Ingen tekniker kopplad — schemaförslag ej tillgängligt
                </div>
              )}
            </div>
          )}

          {/* STEG 2: Välj tid */}
          {step === 2 && (
            <div className="space-y-3">
              {loadingSlots ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
                </div>
              ) : (
                <>
                  {freeSlots.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2 text-amber-400" />
                      <p>Inga lediga tider detta datum.</p>
                      <p className="text-sm mt-1">Välj ett annat datum.</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-slate-400 mb-3">
                        {freeSlots.length} lediga tider · {busySlots.length} uppbokade
                      </p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {slots.map((slot, i) => (
                          <button
                            key={i}
                            type="button"
                            disabled={slot.hasConflict}
                            onClick={() => setSelectedSlot(slot)}
                            className={`px-2 py-2 rounded-lg text-sm font-medium transition-colors text-center ${
                              slot.hasConflict
                                ? 'bg-slate-800/40 text-slate-600 cursor-not-allowed line-through'
                                : selectedSlot && isSameDay(selectedSlot.start, slot.start) && selectedSlot.start.getTime() === slot.start.getTime()
                                  ? 'bg-teal-500 text-white ring-2 ring-teal-400/50'
                                  : 'bg-slate-700/60 text-slate-200 hover:bg-teal-500/20 hover:text-teal-300 border border-slate-600/50'
                            }`}
                          >
                            {format(slot.start, 'HH:mm')}
                            <span className="block text-xs opacity-70">–{format(slot.end, 'HH:mm')}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedSlot && (
                    <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg p-3 flex items-center gap-2 text-sm text-teal-300">
                      <CheckCircle className="w-4 h-4 shrink-0" />
                      Vald tid: {format(selectedSlot.start, 'HH:mm')} – {format(selectedSlot.end, 'HH:mm')}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Anteckning (valfritt)</label>
                    <textarea
                      value={revisitNote}
                      onChange={(e) => setRevisitNote(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 resize-none"
                      placeholder="T.ex. kontrollera betesintag"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Historik */}
          {!loadingHistory && revisitHistory.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
              <button
                onClick={() => setShowFullHistory(!showFullHistory)}
                className="w-full flex items-center justify-between text-sm font-semibold text-slate-300 uppercase tracking-wider"
              >
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  Tidigare återbesök ({revisitHistory.length})
                </span>
                {showFullHistory ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              {showFullHistory && (
                <div className="mt-3 space-y-2">
                  {revisitHistory.map((entry) => {
                    let newValue: any = {}
                    try { newValue = JSON.parse(entry.new_value) } catch (e) {}
                    return (
                      <div key={entry.id} className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/30">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-slate-400 text-xs">{format(new Date(entry.created_at), 'd MMM yyyy HH:mm', { locale: sv })}</span>
                          <span className="text-slate-500 text-xs">av {entry.updated_by_name}</span>
                        </div>
                        {newValue.start_date && (
                          <p className="text-sm text-white">Bokat till: {format(new Date(newValue.start_date), 'd MMM yyyy HH:mm', { locale: sv })}</p>
                        )}
                        {newValue.note && <p className="text-sm text-slate-400 mt-1 italic">"{newValue.note}"</p>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 px-6 py-4 flex items-center justify-between gap-3">
          <div>
            {step === 2 && (
              <button
                type="button"
                onClick={() => { setStep(1); setSelectedSlot(null) }}
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                ← Byt datum
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={onClose} disabled={loading}>Avbryt</Button>
            {step === 1 ? (
              <Button
                variant="primary"
                onClick={handleDateConfirm}
                loading={loadingSlots}
                disabled={!selectedDate || loadingSlots}
                className="bg-teal-600 hover:bg-teal-500"
              >
                Visa lediga tider →
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleScheduleRevisit}
                loading={loading}
                disabled={!selectedSlot || loading}
                className="bg-teal-600 hover:bg-teal-500"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Boka återbesök
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  const portalRoot = document.getElementById('modal-root') || document.body
  return createPortal(modalContent, portalRoot)
}
