// src/components/admin/AdminCreateCaseModal.tsx

import { useState, useEffect } from 'react'
import { X, AlertCircle, CheckCircle, Bug, MapPin, Phone, FileText, User } from 'lucide-react'
import Button from '../ui/Button'
import Input from '../ui/Input'

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
    phone: customer.phone || ''
  })

  // Förhindra body scroll och hantera ESC
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !loading) {
          onClose()
        }
      }
      
      document.addEventListener('keydown', handleEsc)
      
      return () => {
        document.body.style.overflow = 'unset'
        document.removeEventListener('keydown', handleEsc)
      }
    }
  }, [isOpen, loading, onClose])

  const priorityOptions = [
    { value: 'low', label: 'Låg' },
    { value: 'normal', label: 'Normal' },
    { value: 'high', label: 'Hög' },
    { value: 'urgent', label: 'Akut' }
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
      
      setTimeout(() => {
        setSubmitted(false)
        setFormData({
          title: '',
          description: '',
          priority: 'normal',
          pest_type: '',
          case_type: '',
          address: '',
          phone: customer.phone || ''
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

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !loading && !submitted) {
      onClose()
    }
  }

  if (!isOpen) return null

  // Success state
  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4">
        <div className="glass w-full max-w-md bg-slate-900/95 backdrop-blur-lg border border-slate-600 rounded-xl shadow-2xl p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">
            Ärendet har skapats!
          </h3>
          <p className="text-slate-400 mb-4">
            Ärendet för <strong className="text-white">{customer.company_name}</strong> har skapats och tilldelats i ClickUp.
          </p>
          <div className="flex items-center justify-center text-sm text-slate-400">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500 mr-2"></div>
            Stänger automatiskt...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4"
      onClick={handleBackdropClick}
    >
      <div 
        className="glass w-full max-w-4xl max-h-[95vh] bg-slate-900/95 backdrop-blur-lg border border-slate-600 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fixed */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700 bg-slate-900/98 backdrop-blur">
          <div>
            <h2 className="text-xl font-semibold text-white">Skapa nytt ärende</h2>
            <p className="text-slate-400 mt-1">För {customer.company_name}</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            disabled={loading}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Kundinfo */}
          <div className="glass bg-slate-800/50 backdrop-blur rounded-lg p-4 border border-slate-700">
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

          {/* Form Content */}
          <form id="create-case-form" onSubmit={handleSubmit} className="space-y-6">
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
                className="bg-slate-800/50 border-slate-600 text-white"
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
                  className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-y backdrop-blur"
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
                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 backdrop-blur"
                  >
                    {priorityOptions.map(option => (
                      <option key={option.value} value={option.value} className="bg-slate-800">
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
                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 backdrop-blur"
                  >
                    <option value="" className="bg-slate-800">Välj skadedjur (om känt)</option>
                    {pestTypes.map(type => (
                      <option key={type} value={type} className="bg-slate-800">{type}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Typ av ärende
                </label>
                <select
                  name="case_type"
                  value={formData.case_type}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 backdrop-blur"
                >
                  <option value="" className="bg-slate-800">Välj ärendetyp (om känt)</option>
                  {caseTypes.map(type => (
                    <option key={type} value={type} className="bg-slate-800">{type}</option>
                  ))}
                </select>
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
                className="bg-slate-800/50 border-slate-600 text-white"
              />

              <Input
                label="Kontakttelefon"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Direkt nummer för kontakt på plats"
                className="bg-slate-800/50 border-slate-600 text-white"
              />
            </div>

            {/* Process info */}
            <div className="glass bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 backdrop-blur">
              <h4 className="text-sm font-medium text-blue-400 mb-2">
                Efter skapande
              </h4>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• Ärendet skapas automatiskt i ClickUp</li>
                <li>• En koordinator tilldelas ärendet</li>
                <li>• Kunden får notifiering om ärendet</li>
                <li>• Ärendet visas i kundens portal</li>
              </ul>
            </div>
          </form>
        </div>

        {/* Footer - Fixed */}
        <div className="flex gap-3 p-6 border-t border-slate-700 bg-slate-900/98 backdrop-blur">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
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
      </div>
    </div>
  )
}