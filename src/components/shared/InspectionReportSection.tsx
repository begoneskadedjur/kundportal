// src/components/shared/InspectionReportSection.tsx
// Kontrollrapport direkt i ärendemodalen (EditContractCaseModal, fliken Utförande).
// Visas bara när ärendet har en avslutad inspektionssession (station_inspection_sessions.case_id).
// Nedladdning (PDF/Excel) och e-postutskick återanvänder inspectionReportService - samma
// rapport som kunden hämtar under Kontrollrapporter i kundportalen.
import { useEffect, useState } from 'react'
import { ClipboardCheck, Download, FileSpreadsheet, Send, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import Button from '../ui/Button'
import CaseModalSection from './CaseModalSection'
import { getInspectionSessionByCaseId } from '../../services/inspectionSessionService'
import {
  generateInspectionPDF,
  generateInspectionExcel,
  sendInspectionReportEmail
} from '../../services/inspectionReportService'
import type { InspectionSessionWithRelations } from '../../types/inspectionSession'

interface InspectionReportSectionProps {
  caseId: string
  caseNumber?: string
  /** Används om kundkortet saknar kontakt-e-post */
  fallbackEmail?: string
  fallbackContactName?: string
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function formatSessionDate(value: string | null | undefined): string {
  if (!value) return ''
  // Lokal svensk tid, ÅÅÅÅ-MM-DD
  return new Date(value).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' })
}

export default function InspectionReportSection({
  caseId,
  caseNumber,
  fallbackEmail,
  fallbackContactName
}: InspectionReportSectionProps) {
  const [session, setSession] = useState<InspectionSessionWithRelations | null>(null)
  const [downloading, setDownloading] = useState<'pdf' | 'excel' | null>(null)
  const [showSendForm, setShowSendForm] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [recipient, setRecipient] = useState('')

  useEffect(() => {
    let cancelled = false
    setSession(null)
    getInspectionSessionByCaseId(caseId).then(result => {
      if (!cancelled) setSession(result)
    })
    return () => { cancelled = true }
  }, [caseId])

  const customerEmail = session?.customer?.contact_email || fallbackEmail || ''
  const contactName = session?.customer?.contact_person || fallbackContactName || ''

  // Förifyll mottagaren när sessionen laddats (användaren kan ändra fritt efteråt)
  useEffect(() => {
    setRecipient(customerEmail)
  }, [customerEmail])

  if (!session || session.status !== 'completed') return null

  const handleDownload = async (type: 'pdf' | 'excel') => {
    setDownloading(type)
    try {
      if (type === 'pdf') await generateInspectionPDF(session.id)
      else await generateInspectionExcel(session.id)
      toast.success(type === 'pdf' ? 'PDF nedladdad' : 'Excel nedladdad')
    } catch (error) {
      console.error('Kontrollrapport kunde inte skapas:', error)
      toast.error(error instanceof Error && error.message ? error.message : 'Kunde inte skapa rapporten')
    } finally {
      setDownloading(null)
    }
  }

  const trimmedRecipient = recipient.trim()
  const recipientValid = EMAIL_REGEX.test(trimmedRecipient)

  const handleSend = async () => {
    if (!recipientValid) return
    setSending(true)
    try {
      const { sentTo } = await sendInspectionReportEmail(session.id, {
        to: trimmedRecipient,
        // Hälsningsfrasen används bara när mottagaren är kundens egen kontaktadress
        recipientName: trimmedRecipient.toLowerCase() === customerEmail.toLowerCase() ? contactName : '',
        caseNumber
      })
      toast.success(`Kontrollrapporten skickad till ${sentTo}`)
      setShowSendForm(false)
      setConfirming(false)
    } catch (error) {
      console.error('Kontrollrapport kunde inte skickas:', error)
      toast.error(error instanceof Error && error.message ? error.message : 'Kunde inte skicka rapporten', { duration: 8000 })
      setConfirming(false)
    } finally {
      setSending(false)
    }
  }

  const busy = downloading !== null || sending
  const completedDate = formatSessionDate(session.completed_at || session.created_at)

  return (
    <CaseModalSection icon={ClipboardCheck} iconClassName="text-[#20c58f]" title="Kontrollrapport">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex items-center gap-1.5 text-sm text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-[#20c58f]" />
            Kontrollrunda avslutad{completedDate ? ` ${completedDate}` : ''}
            {session.technician?.name ? <span className="text-slate-500">· {session.technician.name}</span> : null}
          </span>
          <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleDownload('pdf')}
              loading={downloading === 'pdf'}
              disabled={busy}
              className="gap-1.5 text-xs px-2.5 py-1"
            >
              {downloading !== 'pdf' && <Download className="w-3.5 h-3.5" />}
              PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleDownload('excel')}
              loading={downloading === 'excel'}
              disabled={busy}
              className="gap-1.5 text-xs px-2.5 py-1"
            >
              {downloading !== 'excel' && <FileSpreadsheet className="w-3.5 h-3.5" />}
              Excel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => { setShowSendForm(v => !v); setConfirming(false) }}
              disabled={busy}
              className="gap-1.5 text-xs px-2.5 py-1"
            >
              <Send className="w-3.5 h-3.5" />
              Skicka till kund
            </Button>
          </div>
        </div>

        {downloading === 'pdf' && (
          <p className="text-xs text-slate-500">PDF:en skapas med karta och planritningar, det kan ta upp till en halv minut.</p>
        )}

        {showSendForm && (
          <div className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl space-y-2">
            <label htmlFor="inspection-report-recipient" className="block text-xs font-medium text-slate-400">
              Mottagare
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  id="inspection-report-recipient"
                  type="email"
                  value={recipient}
                  onChange={(e) => { setRecipient(e.target.value); setConfirming(false) }}
                  placeholder="namn@foretag.se"
                  disabled={sending}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
                />
              </div>
              {!confirming && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => setConfirming(true)}
                  disabled={!recipientValid || sending}
                  className="gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  Skicka
                </Button>
              )}
            </div>
            {!customerEmail && (
              <p className="text-xs text-amber-400">Kunden saknar kontakt-e-post i kundregistret, ange mottagare manuellt.</p>
            )}
            {recipient && !recipientValid && (
              <p className="text-xs text-red-400">Ange en giltig e-postadress.</p>
            )}

            {confirming && (
              <div className="pt-2 border-t border-slate-700/50 flex flex-col sm:flex-row sm:items-center gap-2">
                <p className="text-sm text-slate-300 flex-1">
                  Skicka kontrollrapporten som PDF till <span className="font-medium text-white">{trimmedRecipient}</span>?
                </p>
                <div className="flex items-center gap-1.5">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={sending}>
                    Avbryt
                  </Button>
                  <Button type="button" variant="primary" size="sm" onClick={handleSend} loading={sending}>
                    Bekräfta och skicka
                  </Button>
                </div>
              </div>
            )}
            <p className="text-xs text-slate-500">
              Rapporten skickas från noreply@begone.se med svar till info@begone.se. Bilagor över 8 MB skickas inte.
            </p>
          </div>
        )}
      </div>
    </CaseModalSection>
  )
}
