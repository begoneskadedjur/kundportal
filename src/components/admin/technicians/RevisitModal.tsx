// src/components/admin/technicians/RevisitModal.tsx
// Modal för att boka återbesök med fullständig ärendehistorik

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Calendar,
  MapPin,
  Bug,
  User,
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon
} from 'lucide-react'
import DatePicker from 'react-datepicker'
import { registerLocale } from 'react-datepicker'
import sv from 'date-fns/locale/sv'
import { format } from 'date-fns'
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
  // Följeärende-fält
  parent_case_id?: string | null
}

interface RevisitHistoryEntry {
  id: string
  update_type: string
  previous_value: string
  new_value: string
  updated_by_name: string
  created_at: string
}

interface RevisitModalProps {
  caseData: TechnicianCase
  onSuccess: (updatedCase: TechnicianCase) => void
  onClose: () => void
}

// Utility-funktion för att formatera adress
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

export default function RevisitModal({ caseData, onSuccess, onClose }: RevisitModalProps) {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)

  // Datum state
  const [startDate, setStartDate] = useState<Date | null>(
    caseData.start_date ? new Date(caseData.start_date) : new Date()
  )
  const [endDate, setEndDate] = useState<Date | null>(
    caseData.due_date ? new Date(caseData.due_date) : null
  )

  // Anteckning
  const [revisitNote, setRevisitNote] = useState('')

  // Historik
  const [revisitHistory, setRevisitHistory] = useState<RevisitHistoryEntry[]>([])
  const [showFullHistory, setShowFullHistory] = useState(false)

  // Ladda återbesökshistorik
  useEffect(() => {
    const fetchHistory = async () => {
      setLoadingHistory(true)
      try {
        const { data, error } = await supabase
          .from('case_updates_log')
          .select('*')
          .eq('case_id', caseData.id)
          .eq('update_type', 'revisit_scheduled')
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Error fetching revisit history:', error)
        } else {
          setRevisitHistory(data || [])
        }
      } catch (error) {
        console.error('Error fetching history:', error)
      } finally {
        setLoadingHistory(false)
      }
    }

    fetchHistory()
  }, [caseData.id])

  // Boka återbesök
  const handleScheduleRevisit = async () => {
    if (!startDate || !profile) {
      toast.error('Välj ett datum för återbesöket')
      return
    }

    setLoading(true)

    try {
      const tableName = caseData.case_type === 'private'
        ? 'private_cases'
        : caseData.case_type === 'business'
          ? 'business_cases'
          : 'cases'

      const newStartDate = toSwedishISOString(startDate)
      const newDueDate = endDate ? toSwedishISOString(endDate) : newStartDate

      // 1. Uppdatera ärendet med nya datum
      const { data: updatedCase, error } = await supabase
        .from(tableName)
        .update({
          start_date: newStartDate,
          due_date: newDueDate,
          status: 'Bokad',
        })
        .eq('id', caseData.id)
        .select()
        .single()

      if (error) throw error

      // 2. Logga återbesöket i case_updates_log
      await supabase
        .from('case_updates_log')
        .insert({
          case_id: caseData.id,
          case_type: caseData.case_type,
          update_type: 'revisit_scheduled',
          previous_value: JSON.stringify({
            start_date: caseData.start_date,
            due_date: caseData.due_date
          }),
          new_value: JSON.stringify({
            start_date: newStartDate,
            due_date: newDueDate,
            note: revisitNote
          }),
          updated_by_id: profile.id,
          updated_by_name: profile.full_name || profile.display_name || 'Okänd'
        })

      toast.success('Återbesök bokat!')
      onSuccess({
        ...caseData,
        ...updatedCase,
        case_type: caseData.case_type
      })
    } catch (error: any) {
      console.error('Error scheduling revisit:', error)
      toast.error(`Kunde inte boka återbesök: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const modalContent = (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-500/20 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Boka återbesök</h2>
              <p className="text-sm text-slate-400">Schemalägg uppföljning för detta ärende</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Ärendeöversikt */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              Ärendeöversikt
            </h3>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Ärende:</span>
                <span className="text-white font-medium">{caseData.title}</span>
              </div>

              {caseData.kontaktperson && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Kontaktperson:</span>
                  <span className="text-white">{caseData.kontaktperson}</span>
                </div>
              )}

              {caseData.adress && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Adress:</span>
                  <span className="text-white text-right max-w-[60%]">{formatAddress(caseData.adress)}</span>
                </div>
              )}

              {caseData.skadedjur && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Skadedjur:</span>
                  <span className="text-white flex items-center gap-2">
                    <Bug className="w-4 h-4 text-orange-400" />
                    {caseData.skadedjur}
                  </span>
                </div>
              )}

              {caseData.start_date && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Nuvarande datum:</span>
                  <span className="text-amber-400">
                    {format(new Date(caseData.start_date), 'd MMM yyyy HH:mm', { locale: sv })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Beskrivning / Rapport */}
          {(caseData.description || caseData.rapport) && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" />
                Tidigare åtgärder & anteckningar
              </h3>

              {caseData.description && (
                <div className="mb-3">
                  <p className="text-sm text-slate-400 mb-1">Beskrivning:</p>
                  <p className="text-white text-sm whitespace-pre-wrap bg-slate-800/50 p-3 rounded-lg">
                    {caseData.description}
                  </p>
                </div>
              )}

              {caseData.rapport && (
                <div>
                  <p className="text-sm text-slate-400 mb-1">Rapport:</p>
                  <p className="text-white text-sm whitespace-pre-wrap bg-slate-800/50 p-3 rounded-lg">
                    {caseData.rapport}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tidigare återbesök */}
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
                {showFullHistory ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {showFullHistory && (
                <div className="mt-3 space-y-2">
                  {revisitHistory.map((entry) => {
                    let newValue: any = {}
                    try {
                      newValue = JSON.parse(entry.new_value)
                    } catch (e) {}

                    return (
                      <div
                        key={entry.id}
                        className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/30"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-slate-400 text-xs">
                            {format(new Date(entry.created_at), 'd MMM yyyy HH:mm', { locale: sv })}
                          </span>
                          <span className="text-slate-500 text-xs">av {entry.updated_by_name}</span>
                        </div>
                        {newValue.start_date && (
                          <p className="text-sm text-white">
                            Bokat till: {format(new Date(newValue.start_date), 'd MMM yyyy HH:mm', { locale: sv })}
                          </p>
                        )}
                        {newValue.note && (
                          <p className="text-sm text-slate-400 mt-1 italic">"{newValue.note}"</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Datumväljare */}
          <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-teal-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-teal-400" />
              Boka nytt besöksdatum
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Start *
                </label>
                <DatePicker
                  selected={startDate}
                  onChange={(date) => setStartDate(date)}
                  showTimeSelect
                  timeFormat="HH:mm"
                  timeIntervals={15}
                  dateFormat="d MMM yyyy HH:mm"
                  locale="sv"
                  minDate={new Date()}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20"
                  placeholderText="Välj datum och tid"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Slut (valfritt)
                </label>
                <DatePicker
                  selected={endDate}
                  onChange={(date) => setEndDate(date)}
                  showTimeSelect
                  timeFormat="HH:mm"
                  timeIntervals={15}
                  dateFormat="d MMM yyyy HH:mm"
                  locale="sv"
                  minDate={startDate || new Date()}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20"
                  placeholderText="Välj sluttid"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Anteckning för återbesöket (valfritt)
              </label>
              <textarea
                value={revisitNote}
                onChange={(e) => setRevisitNote(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 resize-none"
                placeholder="T.ex. 'Uppföljning för att kontrollera betesintag och uppdatera trafikljusstatus'"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 px-6 py-4 flex items-center justify-end gap-3">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Avbryt
          </Button>
          <Button
            variant="primary"
            onClick={handleScheduleRevisit}
            loading={loading}
            disabled={!startDate || loading}
            className="bg-teal-600 hover:bg-teal-500"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Boka återbesök
          </Button>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
