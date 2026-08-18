// src/components/coordinator/follow-up/BookInModal.tsx
// "Boka in" för signerade dokument: skapar utförande-/etableringsärendet
// förifyllt från dokumentet, länkar det via contracts.booked_case_id och
// sätter koordinatorstatus till Inbokad. Avtal → cases (avtalskund),
// offerter → private_cases/business_cases.
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, CalendarPlus, Loader2, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../../lib/supabase'
import { CaseNumberService } from '../../../services/caseNumberService'
import { CasePipelineService } from '../../../services/casePipelineService'
import type { FollowUpOffer } from '../../../services/offerFollowUpService'

interface BookInModalProps {
  offer: FollowUpOffer
  userId?: string
  onClose: () => void
  onDone: () => void
}

export default function BookInModal({ offer, userId, onClose, onDone }: BookInModalProps) {
  const navigate = useNavigate()
  const isContract = offer.type === 'contract'
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [offerKind, setOfferKind] = useState<'business' | 'private'>('business')
  const [customerName, setCustomerName] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setTitle(`${offer.company_name || offer.contact_person || 'Kund'} – utförande`)
    setDescription('')
    if (offer.customer_id) {
      supabase.from('customers').select('company_name').eq('id', offer.customer_id).single()
        .then(({ data }) => setCustomerName(data?.company_name || null))
    } else {
      setCustomerName(null)
    }
  }, [offer.id])

  const missingCustomer = isContract && !offer.customer_id

  const handleCreate = async (openSchedule: boolean) => {
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      const caseNumber = await CaseNumberService.generateUniqueCaseNumber()
      let bookedCaseId: string

      if (isContract) {
        // Avtalskund-ärende i cases-tabellen (kunden skapas av webhooken vid signering)
        const { data, error } = await supabase
          .from('cases')
          .insert([{
            customer_id: offer.customer_id,
            title: title.trim(),
            description: description.trim() || `Utförande enligt signerat avtal ${offer.quote_reference_number || offer.oneflow_contract_id}`,
            status: 'Öppen',
            priority: 'normal',
            case_number: caseNumber,
            contact_person: offer.contact_person,
            contact_email: offer.contact_email,
            contact_phone: offer.contact_phone,
          }])
          .select('id')
          .single()
        if (error) throw error
        bookedCaseId = data.id
      } else {
        // Engångsoffert → private_cases/business_cases (samma tabeller som övriga engångsärenden)
        const table = offerKind === 'business' ? 'business_cases' : 'private_cases'
        const row: Record<string, unknown> = {
          title: title.trim(),
          status: 'Öppen',
          case_number: caseNumber,
          kontaktperson: offer.contact_person,
          e_post_kontaktperson: offer.contact_email,
          telefon_kontaktperson: offer.contact_phone,
          description: description.trim() || `Utförande enligt signerad offert ${offer.quote_reference_number || offer.oneflow_contract_id}`,
          oneflow_contract_id: offer.oneflow_contract_id,
        }
        if (offerKind === 'business' && offer.company_name) row.bestallare = offer.company_name
        const { data, error } = await supabase.from(table).insert([row]).select('id').single()
        if (error) throw error
        bookedCaseId = data.id
      }

      // Länka dokumentet till utförande-ärendet + markera Inbokad
      await supabase.from('contracts').update({ booked_case_id: bookedCaseId }).eq('id', offer.id)
      await CasePipelineService.updateOfferStatus(offer.id, 'booked', userId ?? null)

      toast.success(`Ärende ${caseNumber} skapat`)
      onDone()
      if (openSchedule) navigate('/koordinator/schema')
    } catch (err) {
      console.error('BookIn:', err)
      toast.error('Kunde inte skapa ärendet')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <CalendarPlus className="w-4 h-4 text-[#20c58f]" />
            <h2 className="text-sm font-semibold text-white">Boka in · {offer.company_name || offer.contact_person}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Kundstatus */}
          <div className="flex items-center gap-1.5 text-xs">
            {offer.customer_id ? (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-[#20c58f]" />
                <span className="text-slate-300">Kund: {customerName || 'registrerad'}</span>
              </>
            ) : isContract ? (
              <span className="text-amber-400">Ingen kund kopplad ännu — registrera kunden först</span>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Ärendetyp:</span>
                <div className="flex bg-slate-800/50 rounded-lg p-0.5">
                  {(['business', 'private'] as const).map(k => (
                    <button
                      key={k}
                      onClick={() => setOfferKind(k)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                        offerKind === k ? 'bg-[#20c58f] text-[#fff]' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {k === 'business' ? 'Företag' : 'Privatperson'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Ärendetitel</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Beskrivning (valfritt)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder={`Utförande enligt ${isContract ? 'signerat avtal' : 'signerad offert'}…`}
              className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs placeholder-slate-500 resize-none focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
            />
          </div>
          <p className="text-[11px] text-slate-500">
            Ärendet skapas utan tid och dyker upp bland obokade i schemat. Dokumentet länkas och markeras som Inbokad.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-slate-700">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors">
            Avbryt
          </button>
          <button
            onClick={() => handleCreate(false)}
            disabled={saving || !title.trim() || missingCustomer}
            className="px-3 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg transition-colors disabled:opacity-40"
          >
            Skapa ärende
          </button>
          <button
            onClick={() => handleCreate(true)}
            disabled={saving || !title.trim() || missingCustomer}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#20c58f] hover:bg-[#1aaa7a] text-[#fff] rounded-lg transition-colors disabled:opacity-40"
          >
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            Skapa & öppna schemat
          </button>
        </div>
      </div>
    </div>
  )
}
