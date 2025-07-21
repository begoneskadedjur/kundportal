// 📁 src/components/technicians/EditCaseModal.tsx

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { AlertCircle, CheckCircle, FileText, User, DollarSign } from 'lucide-react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Modal from '../ui/Modal'

// Återanvänd samma interface från TechnicianCases-sidan
interface TechnicianCase {
  id: string
  case_type: 'private' | 'business' | 'contract'
  title: string
  description?: string
  status: string
  priority?: string
  case_price?: number
  commission_amount?: number
  kontaktperson?: string
  telefon_kontaktperson?: string
  e_post_kontaktperson?: string
  skadedjur?: string
  org_nr?: string
  // Lägg till fler fält här vid behov
}

interface EditCaseModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (updatedCase: TechnicianCase) => void
  caseData: TechnicianCase | null
}

// Återanvänd statuslistan för konsekvens
const statusOrder = [
  'Öppen', 'Bokad', 'Offert skickad', 'Offert signerad - boka in',
  'Återbesök 1', 'Återbesök 2', 'Återbesök 3', 'Återbesök 4', 'Återbesök 5',
  'Privatperson - review', 'Stängt - slasklogg', 'Avslutat'
];

export default function EditCaseModal({ isOpen, onClose, onSuccess, caseData }: EditCaseModalProps) {
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Detta state håller all formulärdata
  const [formData, setFormData] = useState<Partial<TechnicianCase>>({})

  // Denna useEffect-hook fyller formuläret med data när modalen öppnas
  useEffect(() => {
    if (caseData) {
      setFormData({
        title: caseData.title || '',
        status: caseData.status || '',
        description: caseData.description || '',
        kontaktperson: caseData.kontaktperson || '',
        telefon_kontaktperson: caseData.telefon_kontaktperson || '',
        e_post_kontaktperson: caseData.e_post_kontaktperson || '',
        case_price: caseData.case_price || 0,
        commission_amount: caseData.commission_amount || 0,
        skadedjur: caseData.skadedjur || '',
        org_nr: caseData.org_nr || '',
      })
    }
  }, [caseData]) // Körs varje gång caseData ändras

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!caseData) return

    setLoading(true)
    setError(null)

    // Bestäm tabellnamn baserat på ärendetyp
    const tableName = 
        caseData.case_type === 'private' ? 'private_cases' 
      : caseData.case_type === 'business' ? 'business_cases' 
      : 'cases';

    try {
      // Använd Supabase .update() för att spara ändringarna
      const { error: updateError } = await supabase
        .from(tableName)
        .update({
            ...formData,
            pris: formData.case_price // Mappa om till databasens kolumnnamn
        })
        .eq('id', caseData.id)
        .single()

      if (updateError) {
        throw updateError
      }

      setSubmitted(true)
      
      // Stäng modal och kör onSuccess-callback efter en kort fördröjning
      setTimeout(() => {
        setSubmitted(false)
        onSuccess({ ...caseData, ...formData })
        onClose()
      }, 1500)

    } catch (error: any) {
      console.error('Error updating case:', error)
      setError(error.message || 'Ett fel uppstod vid uppdatering')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    // Hantera nummer-fält korrekt
    const finalValue = type === 'number' ? (value === '' ? null : parseFloat(value)) : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: finalValue,
    }))
  }

  // Om modalen inte har någon data, rendera ingenting
  if (!caseData) return null;

  // Success-vyn
  if (submitted) {
    return (
      <Modal isOpen={isOpen} onClose={() => {}} title="Sparat!" size="md" preventClose={true}>
        <div className="p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Ärendet har uppdaterats</h3>
        </div>
      </Modal>
    )
  }

  const footer = (
    <div className="flex gap-3 p-6 bg-slate-800/50">
      <Button type="button" variant="secondary" onClick={onClose} disabled={loading} className="flex-1">
        Avbryt
      </Button>
      <Button type="submit" form="edit-case-form" loading={loading} disabled={loading} className="flex-1">
        {loading ? 'Sparar...' : 'Spara ändringar'}
      </Button>
    </div>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Redigera ärende: ${caseData.title}`}
      subtitle={`Ärendenr: ${caseData.case_type.charAt(0).toUpperCase()}-${caseData.id.substring(0, 8)}`}
      size="xl"
      footer={footer}
      preventClose={loading}
    >
      <div className="p-6 max-h-[70vh] overflow-y-auto">
        <form id="edit-case-form" onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-500/20 p-4 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Ärendeinformation */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white flex items-center gap-2"><FileText className="w-5 h-5 text-blue-400" />Ärendeinformation</h3>
            <Input label="Titel *" name="title" value={formData.title || ''} onChange={handleChange} required />
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Beskrivning</label>
              <textarea name="description" value={formData.description || ''} onChange={handleChange} rows={4} className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
                <select name="status" value={formData.status || ''} onChange={handleChange} className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white">
                  {statusOrder.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <Input label="Skadedjur" name="skadedjur" value={formData.skadedjur || ''} onChange={handleChange} />
            </div>
          </div>

          {/* Kontaktinformation */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white flex items-center gap-2"><User className="w-5 h-5 text-green-400" />Kontaktinformation</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Kontaktperson" name="kontaktperson" value={formData.kontaktperson || ''} onChange={handleChange} />
                {caseData.case_type === 'business' && <Input label="Organisationsnummer" name="org_nr" value={formData.org_nr || ''} onChange={handleChange} />}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Telefon" name="telefon_kontaktperson" value={formData.telefon_kontaktperson || ''} onChange={handleChange} />
                <Input label="E-post" name="e_post_kontaktperson" type="email" value={formData.e_post_kontaktperson || ''} onChange={handleChange} />
            </div>
          </div>

          {/* Ekonomi */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white flex items-center gap-2"><DollarSign className="w-5 h-5 text-yellow-400" />Ekonomi</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Ärendepris (Pris)" name="case_price" type="number" value={formData.case_price || ''} onChange={handleChange} />
              <Input label="Provision" name="commission_amount" type="number" value={formData.commission_amount || ''} onChange={handleChange} />
            </div>
          </div>

        </form>
      </div>
    </Modal>
  )
}