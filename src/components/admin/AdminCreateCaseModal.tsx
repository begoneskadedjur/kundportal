// src/components/admin/AdminCreateCaseModal.tsx - Uppdaterad med tekniker-integration
import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle, Bug, MapPin, Phone, FileText, User } from 'lucide-react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Modal from '../ui/Modal'
import TechnicianDropdown from './TechnicianDropdown'

interface Customer {
  id: string
  company_name: string
  contact_person: string
  email: string
  phone: string
}

interface AdminCreateCaseModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  customer: Customer
}

export default function AdminCreateCaseModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  customer
}: AdminCreateCaseModalProps) {
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'normal',
    pest_type: '',
    case_type: '',
    address: '',
    phone: customer.phone || '',
    assigned_technician_email: '' // Ny fält för tekniker-tilldelning
  })

  const priorityOptions = [
    { value: 'low', label: 'Låg', color: 'text-green-400' },
    { value: 'normal', label: 'Normal', color: 'text-yellow-400' },
    { value: 'high', label: 'Hög', color: 'text-orange-400' },
    { value: 'urgent', label: 'Akut', color: 'text-red-400' }
  ]

  const pestTypes = [
    'Myror', 'Råttor', 'Möss', 'Kackerlackor', 'Flugor', 'Getingar', 
    'Spindlar', 'Kvalster', 'Skalbaggar', 'Termiter', 'Annat'
  ]

  const caseTypes = [
    'Besprutning', 'Servicebesök', 'Utredning', 'Konsultation', 
    'Uppföljning', 'Akutinsats', 'Avtalskontroll', 'Annat'
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/create-case', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: customer.id,
          ...formData
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte skapa ärendet')
      }

      setSubmitted(true)
      
      // Stäng modal efter 2 sekunder och trigga refresh
      setTimeout(() => {
        setSubmitted(false)
        setFormData({
          title: '',
          description: '',
          priority: 'normal',
          pest_type: '',
          case_type: '',
          address: '',
          phone: customer.phone || '',
          assigned_technician_email: ''
        })
        onClose()
        onSuccess()
      }, 2000)

    } catch (error: any) {
      console.error('Error creating case:', error)
      setError(error.message || 'Ett fel uppstod')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleTechnicianChange = (email: string) => {
    setFormData(prev => ({
      ...prev,
      assigned_technician_email: email
    }))
  }

  const handleClose = () => {
    if (!loading) {
      onClose()
    }
  }

  // Success state
  if (submitted) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={() => {}} // Förhindra stängning under success
        title="Ärendet har skapats!"
        size="md"
        preventClose={true}
      >
        <div className="p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">
            Framgångsrikt skapat!
          </h3>
          <p className="text-slate-400 mb-4">
            Ärendet för <strong className="text-white">{customer.company_name}</strong> har skapats och tilldelats i ClickUp.
          </p>
          <div className="flex items-center justify-center text-sm text-slate-400">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500 mr-2"></div>
            Stänger automatiskt...
          </div>
        </div>
      </Modal>
    )
  }

  const footer = (
    <div className="flex gap-3 p-6">
      <Button
        type="button"
        variant="secondary"
        onClick={handleClose}
        disabled={loading}
        className="flex-1"
      >
        Avbryt
      </Button>
      <Button
        type="submit"
        form="create-case-form"
        loading={loading}
        disabled={loading || !formData.title || !formData.description}
        className="flex-1"
      >
        {loading ? 'Skapar ärende...' : 'Skapa ärende'}
      </Button>
    </div>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Skapa nytt ärende"
      subtitle={`För ${customer.company_name}`}
      size="xl"
      footer={footer}
      preventClose={loading}
    >
      <div className="p-6">
        <form id="create-case-form" onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Kundinfo */}
          <div className="bg-slate-800/30 rounded-lg p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
              <User className="w-4 h-4" />
              Kunduppgifter
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-400">Företag:</span>
                <span className="text-white ml-2">{customer.company_name}</span>
              </div>
              <div>
                <span className="text-slate-400">Kontakt:</span>
                <span className="text-white ml-2">{customer.contact_person}</span>
              </div>
              <div>
                <span className="text-slate-400">E-post:</span>
                <span className="text-white ml-2">{customer.email}</span>
              </div>
              <div>
                <span className="text-slate-400">Telefon:</span>
                <span className="text-white ml-2">{customer.phone}</span>
              </div>
            </div>
          </div>

          {/* Ärendeinformation */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-400" />
              Ärendeinformation
            </h3>
            
            <Input
              label="Titel *"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              placeholder="Kort beskrivning av problemet"
              className="text-white"
            />

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Beskrivning *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                required
                rows={4}
                className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-y"
                placeholder="Detaljerad beskrivning av problemet, symptom och önskade åtgärder..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Prioritet
                </label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  {priorityOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Skadedjurstyp
                </label>
                <select
                  name="pest_type"
                  value={formData.pest_type}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">Välj skadedjur (om känt)</option>
                  {pestTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Typ av ärende
                </label>
                <select
                  name="case_type"
                  value={formData.case_type}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">Välj ärendetyp (om känt)</option>
                  {caseTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* NY: Tekniker-tilldelning */}
              <TechnicianDropdown
                label="Tilldela tekniker"
                value={formData.assigned_technician_email}
                onChange={handleTechnicianChange}
                placeholder="Ej tilldelad"
                includeUnassigned={true}
                onlyActive={true}
              />
            </div>
          </div>

          {/* Platsinformation */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-400" />
              Platsinformation
            </h3>
            
            <Input
              label="Specifik adress"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Om annan adress än företagsadress"
              className="text-white"
            />

            <Input
              label="Kontakttelefon"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Direkt nummer för kontakt på plats"
              className="text-white"
            />
          </div>

          {/* Process info */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-400 mb-2">
              Efter skapande
            </h4>
            <ul className="text-sm text-slate-300 space-y-1">
              <li>• Ärendet skapas automatiskt i ClickUp</li>
              <li>• Tilldelad tekniker får notifiering</li>
              <li>• Kunden får notifiering om ärendet</li>
              <li>• Ärendet visas i kundens portal</li>
            </ul>
          </div>
        </form>
      </div>
    </Modal>
  )
}