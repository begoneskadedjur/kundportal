// src/components/customer/CreateCaseModal.tsx
import { useState } from 'react'
import { X, AlertCircle, CheckCircle, Bug, MapPin, Phone, FileText } from 'lucide-react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Card from '../ui/Card'

interface CreateCaseModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  customerId: string
  customerInfo: {
    company_name: string
    contact_person: string
    email: string
  }
}

export default function CreateCaseModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  customerId,
  customerInfo 
}: CreateCaseModalProps) {
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
    phone: ''
  })

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
          customer_id: customerId,
          ...formData
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte skapa ärendet')
      }

      setSubmitted(true)
      
      // Vänta 3 sekunder, stäng sedan modal och uppdatera listan
      setTimeout(() => {
        setSubmitted(false)
        setFormData({
          title: '',
          description: '',
          priority: 'normal',
          pest_type: '',
          case_type: '',
          address: '',
          phone: ''
        })
        onClose()
        onSuccess() // Triggers refresh of case list
      }, 3000)

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

  if (!isOpen) return null

  // Success state
  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-md text-center p-8">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">
            Ärendet har skapats!
          </h3>
          <p className="text-slate-400 mb-4">
            Ditt ärende har skickats till vårt team och kommer att behandlas så snart som möjligt.
          </p>
          <p className="text-sm text-slate-500">
            Status: <span className="text-blue-400">Under hantering</span>
          </p>
          <p className="text-xs text-slate-600 mt-4">
            Stänger automatiskt...
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div>
            <h2 className="text-xl font-semibold text-white">Skapa nytt ärende</h2>
            <p className="text-sm text-slate-400 mt-1">
              {customerInfo.company_name} - {customerInfo.contact_person}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Ärendeinformation */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-400" />
              Ärendeinformation
            </h3>
            
            <Input
              label="Titel på ärendet"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              placeholder="T.ex. 'Akut myrorproblem i köket'"
            />

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Beskrivning
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                required
                rows={4}
                placeholder="Beskriv problemet i detalj..."
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-green-500"
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
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-green-500"
                >
                  <option value="low">Låg</option>
                  <option value="normal">Normal</option>
                  <option value="high">Hög</option>
                  <option value="urgent">Akut</option>
                </select>
              </div>

              <Input
                label="Typ av skadedjur (om känt)"
                name="pest_type"
                value={formData.pest_type}
                onChange={handleChange}
                placeholder="T.ex. Myror, Råttor, Kackerlackor"
              />
            </div>

            <Input
              label="Typ av ärende (om känt)"
              name="case_type"
              value={formData.case_type}
              onChange={handleChange}
              placeholder="T.ex. Besprutning, Servicebesök, Utredning"
            />
          </div>

          {/* Platsinformation */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-400" />
              Platsinformation
            </h3>
            
            <Input
              label="Adress (om annat än företagsadress)"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Specifik adress för ärendet"
            />

            <Input
              label="Telefonnummer för kontakt"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Direkt nummer för kontakt"
            />
          </div>

          {/* Information om processen */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-400 mb-2">
              Vad händer härnäst?
            </h4>
            <ul className="text-sm text-slate-300 space-y-1">
              <li>• Ärendet skapas med status "Under hantering"</li>
              <li>• Vårt team får automatisk notifiering</li>
              <li>• En koordinator tilldelas ditt ärende</li>
              <li>• Ni kontaktas inom kort för vidare hantering</li>
            </ul>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="flex-1"
            >
              Avbryt
            </Button>
            <Button
              type="submit"
              loading={loading}
              disabled={loading || !formData.title || !formData.description}
              className="flex-1"
            >
              {loading ? 'Skapar ärende...' : 'Skapa ärende'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}