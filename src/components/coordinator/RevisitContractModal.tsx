// src/components/coordinator/RevisitContractModal.tsx
// Modal för att boka återbesök för kontraktsärenden (avtalskunder)

import React, { useState, useEffect } from 'react'
import {
  X,
  Calendar,
  MapPin,
  Bug,
  User,
  FileText,
  Clock,
  ChevronDown,
  ChevronUp,
  Receipt
} from 'lucide-react'
import DatePicker from 'react-datepicker'
import { registerLocale } from 'react-datepicker'
import sv from 'date-fns/locale/sv'
import { format } from 'date-fns'
import Button from '../ui/Button'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { toLocalISOStringWithOffset } from '../../utils/dateHelpers'
import { ContractBillingService } from '../../services/contractBillingService'
import { CaseBillingService } from '../../services/caseBillingService'
import toast from 'react-hot-toast'
import "react-datepicker/dist/react-datepicker.css"

registerLocale('sv', sv)

interface ContractCase {
  id: string
  case_number?: string
  title: string
  description?: string
  status: string
  price?: number
  contact_person?: string
  contact_phone?: string
  contact_email?: string
  pest_type?: string
  address?: string
  scheduled_start?: Date | string | null
  scheduled_end?: Date | string | null
  work_report?: string | null
  time_spent_minutes?: number | null
  materials_used?: string | null
  pest_level?: number | null
  problem_rating?: number | null
  recommendations?: string | null
  assessment_date?: string | null
  assessed_by?: string | null
  primary_technician_id?: string | null
  primary_technician_name?: string | null
  customer_id?: string | null
}

interface PendingBillingItem {
  id: string
  description: string
  quantity: number
  item_type: string
}

interface RevisitHistoryEntry {
  id: string
  update_type: string
  previous_value: string
  new_value: string
  updated_by_name: string
  created_at: string
}

interface RevisitContractModalProps {
  caseData: ContractCase
  onSuccess: (updatedCase: ContractCase) => void
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

// Hjälpfunktion för att konvertera till Date
const toDate = (value: Date | string | null | undefined): Date | null => {
  if (!value) return null
  if (value instanceof Date) return value
  return new Date(value)
}

export default function RevisitContractModal({ caseData, onSuccess, onClose }: RevisitContractModalProps) {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)

  // Datum state
  const [startDate, setStartDate] = useState<Date | null>(
    toDate(caseData.scheduled_start) || new Date()
  )
  const [endDate, setEndDate] = useState<Date | null>(
    toDate(caseData.scheduled_end)
  )

  // Anteckning
  const [revisitNote, setRevisitNote] = useState('')

  // Delfakturering
  const [pendingBillingItems, setPendingBillingItems] = useState<PendingBillingItem[]>([])
  const [invoiceNow, setInvoiceNow] = useState(false)

  // Historik
  const [revisitHistory, setRevisitHistory] = useState<RevisitHistoryEntry[]>([])
  const [showFullHistory, setShowFullHistory] = useState(false)

  // Hämta pending billing items vid mount
  useEffect(() => {
    async function fetchPendingItems() {
      try {
        const { data } = await supabase
          .from('case_billing_items')
          .select('id, description, quantity, item_type')
          .eq('case_id', caseData.id)
          .eq('status', 'pending')
          .eq('item_type', 'service')
        setPendingBillingItems(data || [])
      } catch (e) {
        console.error('[RevisitContractModal] Failed to fetch pending billing items:', e)
      }
    }
    fetchPendingItems()
  }, [caseData.id])

  // Funktion för att hämta återbesökshistorik
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

  // Ladda återbesökshistorik vid mount
  useEffect(() => {
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
      const newScheduledStart = toLocalISOStringWithOffset(startDate)
      const newScheduledEnd = endDate ? toLocalISOStringWithOffset(endDate) : newScheduledStart

      // 0. Spara snapshot av nuvarande besök om det finns besöksdata
      const hasVisitData = caseData.work_report || caseData.time_spent_minutes ||
                           caseData.pest_level != null || caseData.materials_used

      if (hasVisitData) {
        // Räkna befintliga besök för att sätta visit_number
        const { count: existingCount } = await supabase
          .from('visits')
          .select('id', { count: 'exact', head: true })
          .eq('case_id', caseData.id)

        const visitNumber = (existingCount ?? 0) + 1

        const { error: visitError } = await supabase.from('visits').insert({
          case_id: caseData.id,
          visit_date: (caseData.scheduled_start as string) ?? new Date().toISOString(),
          technician_id: caseData.primary_technician_id ?? null,
          technician_name: caseData.primary_technician_name ?? null,
          work_performed: caseData.work_report ?? null,
          recommendations: caseData.recommendations ?? null,
          findings: caseData.pest_level != null ? `Skadedjursnivå: ${caseData.pest_level}` : null,
          time_spent_minutes: caseData.time_spent_minutes ?? null,
          materials_used: caseData.materials_used ?? null,
          pest_level: caseData.pest_level ?? null,
          problem_rating: caseData.problem_rating ?? null,
          visit_number: visitNumber,
          status: caseData.status ?? null,
        })
        if (visitError) console.error('[RevisitContractModal] Failed to save visit snapshot:', visitError)

        // Stämpla billing-items utan visit_number med detta besöks visit_number
        const { error: billingError } = await supabase
          .from('case_billing_items')
          .update({ visit_number: visitNumber })
          .eq('case_id', caseData.id)
          .is('visit_number', null)
        if (billingError) console.error('[RevisitContractModal] Failed to stamp billing items:', billingError)

        // Delfakturering: kopiera service-items till contract_billing_items och markera som billed
        if (invoiceNow && caseData.customer_id && pendingBillingItems.length > 0) {
          try {
            const adhocResult = await ContractBillingService.createAdHocItemsFromCase(
              caseData.id,
              caseData.customer_id,
              new Date()
            )
            if (adhocResult.invoiceError) {
              toast.error(`Raderna sparades men fakturan kunde inte skapas: ${adhocResult.invoiceError}. Kontakta admin.`, { duration: 10000 })
            } else {
              toast.success(`${pendingBillingItems.length} artikel(er) skickade till fakturering.`)
            }
          } catch (e: any) {
            console.error('[RevisitContractModal] Delfakturering misslyckades:', e)
            toast.error(`Delfakturering misslyckades: ${e.message}`)
          }
        }
      }

      // 1. Uppdatera ärendet med nya datum + nollställ besöksdata
      const { data: updatedCase, error } = await supabase
        .from('cases')
        .update({
          scheduled_start: newScheduledStart,
          scheduled_end: newScheduledEnd,
          status: 'Återbesök',
          work_report: null,
          time_spent_minutes: null,
          materials_used: null,
          pest_level: null,
          problem_rating: null,
          recommendations: null,
          assessment_date: null,
          assessed_by: null,
        })
        .eq('id', caseData.id)
        .select()
        .single()

      if (error) throw error

      // 2. Logga återbesöket i case_updates_log
      const { error: logError } = await supabase
        .from('case_updates_log')
        .insert({
          case_id: caseData.id,
          case_table: 'cases',
          updated_by: profile.id,
          field_changes: {
            scheduled_start: { old: caseData.scheduled_start, new: newScheduledStart },
            scheduled_end: { old: caseData.scheduled_end, new: newScheduledEnd },
            status: { old: caseData.status, new: 'Återbesök' }
          },
          user_role: 'technician',
          case_type: 'contract',
          update_type: 'revisit_scheduled',
          previous_value: JSON.stringify({
            scheduled_start: caseData.scheduled_start,
            scheduled_end: caseData.scheduled_end
          }),
          new_value: JSON.stringify({
            scheduled_start: newScheduledStart,
            scheduled_end: newScheduledEnd,
            note: revisitNote
          }),
          updated_by_id: profile.id,
          updated_by_name: profile.full_name || profile.display_name || 'Okänd'
        })
      if (logError) console.error('[RevisitContractModal] Failed to log revisit:', logError)

      toast.success('Återbesök bokat! Du kan boka fler återbesök.')

      // Refresha historiken så den nya bokningen visas
      await fetchHistory()

      // Rensa anteckningsfältet för nästa bokning
      setRevisitNote('')

      // Uppdatera startdatum till det nya bokade datumet
      setStartDate(new Date(newScheduledStart))
      setEndDate(null)

      // Expandera historiken så användaren ser den nya bokningen
      setShowFullHistory(true)

      // Meddela parent-komponenten om uppdateringen
      onSuccess({
        ...caseData,
        ...updatedCase
      })
    } catch (error: any) {
      console.error('Error scheduling revisit:', error)
      toast.error(`Kunde inte boka återbesök: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const modalContent = (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10001] flex items-center justify-center p-4">
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
                <span className="text-white font-medium">
                  {caseData.case_number ? `#${caseData.case_number} - ` : ''}{caseData.title}
                </span>
              </div>

              {caseData.contact_person && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Kontaktperson:</span>
                  <span className="text-white">{caseData.contact_person}</span>
                </div>
              )}

              {caseData.address && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Adress:</span>
                  <span className="text-white text-right max-w-[60%]">{formatAddress(caseData.address)}</span>
                </div>
              )}

              {caseData.pest_type && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Skadedjur:</span>
                  <span className="text-white flex items-center gap-2">
                    <Bug className="w-4 h-4 text-orange-400" />
                    {caseData.pest_type}
                  </span>
                </div>
              )}

              {caseData.scheduled_start && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Nuvarande datum:</span>
                  <span className="text-amber-400">
                    {format(toDate(caseData.scheduled_start)!, 'd MMM yyyy HH:mm', { locale: sv })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Beskrivning / Rapport */}
          {(caseData.description || caseData.work_report) && (
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

              {caseData.work_report && (
                <div>
                  <p className="text-sm text-slate-400 mb-1">Arbetsrapport:</p>
                  <p className="text-white text-sm whitespace-pre-wrap bg-slate-800/50 p-3 rounded-lg">
                    {caseData.work_report}
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
                        {newValue.scheduled_start && (
                          <p className="text-sm text-white">
                            Bokat till: {format(new Date(newValue.scheduled_start), 'd MMM yyyy HH:mm', { locale: sv })}
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

          {/* Delfakturering — visas om det finns pending service-artiklar */}
          {pendingBillingItems.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-slate-500" />
                Tillagda artiklar ({pendingBillingItems.length})
              </h3>
              <div className="space-y-1.5 mb-4">
                {pendingBillingItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">{item.description}</span>
                    {item.quantity !== 1 && (
                      <span className="text-slate-500 text-xs ml-2">× {item.quantity}</span>
                    )}
                  </div>
                ))}
              </div>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={invoiceNow}
                    onChange={(e) => setInvoiceNow(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 rounded border-2 transition-all duration-200 flex items-center justify-center ${
                    invoiceNow ? 'bg-[#20c58f] border-[#20c58f]' : 'border-slate-500 group-hover:border-[#20c58f]'
                  }`}>
                    {invoiceNow && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                  Delfakturera dessa artiklar nu
                </span>
              </label>
              {invoiceNow && (
                <p className="text-xs text-slate-500 mt-2 ml-8">
                  Artiklarna skickas till fakturering och rensas från ärendet. Nya artiklar kan läggas till vid nästa besök.
                </p>
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

  // Returnera direkt utan createPortal - komponenten renderas redan utanför Modal
  // och z-[10001] säkerställer att den visas ovanpå
  return modalContent
}
