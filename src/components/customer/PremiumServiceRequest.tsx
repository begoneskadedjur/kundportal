// src/components/customer/PremiumServiceRequest.tsx - Service Request Modal
import React, { useState } from 'react'
import { X, AlertCircle, Calendar, MessageSquare, Search, HelpCircle, Phone, Mail, Upload, CheckCircle, Clock, Info } from 'lucide-react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ServiceType, CasePriority, serviceTypeConfig } from '../../types/cases'

interface PremiumServiceRequestProps {
  isOpen: boolean
  onClose: () => void
  customer: {
    id: string
    company_name: string
    contact_person: string
    contact_email: string
    contact_phone: string | null
    contact_address: string | null
  }
  onSuccess?: () => void
}

const PremiumServiceRequest: React.FC<PremiumServiceRequestProps> = ({ 
  isOpen, 
  onClose, 
  customer,
  onSuccess 
}) => {
  const { profile } = useAuth()
  const [serviceType, setServiceType] = useState<ServiceType>('inspection')
  const [priority, setPriority] = useState<CasePriority>('normal')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [pestType, setPestType] = useState('')
  const [otherPestType, setOtherPestType] = useState('')
  const [contactMethod, setContactMethod] = useState<'email' | 'phone'>('email')
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!subject.trim() || !description.trim()) {
      toast.error('Vänligen fyll i alla obligatoriska fält')
      return
    }

    if (!profile?.customer_id) {
      toast.error('Kunde inte identifiera kundinformation')
      return
    }

    setSubmitting(true)
    
    try {
      // Create the case in the database
      const { data, error } = await supabase
        .from('cases')
        .insert({
          customer_id: profile.customer_id,
          title: subject,
          description: description,
          status: 'requested', // Always requested for customer-created cases
          priority: priority,
          service_type: serviceType,
          pest_type: pestType || null,
          other_pest_type: otherPestType || null,
          contact_person: customer.contact_person,
          contact_email: customer.contact_email,
          contact_phone: customer.contact_phone,
          address: customer.contact_address ? {
            formatted_address: customer.contact_address
          } : null,
          // Files would need separate handling with storage
        })
        .select()
        .single()

      if (error) throw error

      setSubmitting(false)
      setSubmitted(true)
      
      toast.success('Serviceförfrågan skickad!')
      
      // Reset and close after animation
      setTimeout(() => {
        onClose()
        setSubmitted(false)
        setSubject('')
        setDescription('')
        setPestType('')
        setOtherPestType('')
        setFiles([])
        if (onSuccess) onSuccess()
      }, 2000)
    } catch (error: any) {
      console.error('Error creating case:', error)
      toast.error('Kunde inte skicka förfrågan. Försök igen.')
      setSubmitting(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files))
    }
  }

  const serviceTypeIcons = {
    routine: <Calendar className="w-5 h-5" />,
    acute: <AlertCircle className="w-5 h-5" />,
    inspection: <Search className="w-5 h-5" />,
    other: <HelpCircle className="w-5 h-5" />
  }

  const commonPestTypes = [
    'Gnagare (råttor/möss)',
    'Kackerlackor',
    'Myror',
    'Vägglöss',
    'Flugor',
    'Getingar',
    'Silverfisk',
    'Mal',
    'Annat'
  ]

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className={`
          relative bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl
          transform transition-all duration-300
          ${submitted ? 'scale-95' : 'scale-100'}
        `}>
          {/* Success Overlay */}
          {submitted && (
            <div className="absolute inset-0 bg-slate-800/95 backdrop-blur rounded-xl flex items-center justify-center z-10">
              <div className="text-center">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-green-500" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Förfrågan skickad!</h3>
                <p className="text-slate-400">Vi återkommer inom 24 timmar.</p>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-700">
            <div>
              <h2 className="text-xl font-semibold text-white">Begär service</h2>
              <p className="text-sm text-slate-400 mt-1">Beskriv ert behov så återkommer vi med förslag</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Important Notice */}
          <div className="mx-6 mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-blue-400 font-medium mb-1">Så här fungerar det:</p>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li>• Ni beskriver ert behov och vi återkommer med förslag på tid</li>
                  <li>• Normal svarstid: Inom 2-3 arbetsdagar</li>
                  <li>• Brådskande ärenden: Inom 24 timmar</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Service Type Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Typ av service
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(Object.entries(serviceTypeConfig) as [ServiceType, typeof serviceTypeConfig.routine][]).map(([type, config]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setServiceType(type)}
                    className={`
                      p-4 rounded-lg border transition-all text-left
                      ${serviceType === type 
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                        : 'border-slate-700 hover:border-slate-600 text-slate-400'
                      }
                    `}
                  >
                    <div className="flex items-start gap-3">
                      {serviceTypeIcons[type]}
                      <div>
                        <div className="font-medium text-sm">{config.label}</div>
                        <div className="text-xs mt-1 opacity-80">{config.description}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Priority Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Prioritet
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPriority('normal')}
                  className={`
                    p-3 rounded-lg border transition-all
                    ${priority === 'normal' 
                      ? 'bg-slate-700 border-slate-600 text-white' 
                      : 'border-slate-700 hover:border-slate-600 text-slate-400'
                    }
                  `}
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-medium">Normal</span>
                  </div>
                  <p className="text-xs mt-1 opacity-80">2-3 arbetsdagar</p>
                </button>
                
                <button
                  type="button"
                  onClick={() => setPriority('urgent')}
                  className={`
                    p-3 rounded-lg border transition-all
                    ${priority === 'urgent' 
                      ? 'bg-red-500/10 border-red-500/20 text-red-500' 
                      : 'border-slate-700 hover:border-slate-600 text-slate-400'
                    }
                  `}
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Brådskande</span>
                  </div>
                  <p className="text-xs mt-1 opacity-80">Inom 24 timmar</p>
                </button>
              </div>
            </div>

            {/* Pest Type */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Typ av skadedjur (om känt)
              </label>
              <select
                value={pestType}
                onChange={(e) => {
                  setPestType(e.target.value)
                  if (e.target.value !== 'Annat') {
                    setOtherPestType('')
                  }
                }}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="">Välj eller osäker</option>
                {commonPestTypes.map(pest => (
                  <option key={pest} value={pest}>{pest}</option>
                ))}
              </select>
              
              {pestType === 'Annat' && (
                <Input
                  type="text"
                  value={otherPestType}
                  onChange={(e) => setOtherPestType(e.target.value)}
                  placeholder="Beskriv skadedjuret"
                  className="mt-2"
                />
              )}
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Rubrik <span className="text-red-400">*</span>
              </label>
              <Input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Kort beskrivning av ärendet"
                className="w-full"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Beskrivning <span className="text-red-400">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Beskriv problemet, var det finns, hur länge det pågått, etc..."
                rows={4}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                Ju mer information ni ger, desto bättre kan vi förbereda rätt åtgärd.
              </p>
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Bifoga bilder (valfritt)
              </label>
              <div className="relative">
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                  accept="image/*"
                />
                <label
                  htmlFor="file-upload"
                  className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-700 rounded-lg hover:border-slate-600 cursor-pointer transition-colors"
                >
                  <Upload className="w-5 h-5 text-slate-400" />
                  <span className="text-slate-400">
                    {files.length > 0 
                      ? `${files.length} bild(er) valda` 
                      : 'Klicka för att ladda upp bilder'}
                  </span>
                </label>
              </div>
            </div>

            {/* Contact Method */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Föredragen kontaktmetod
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setContactMethod('email')}
                  className={`
                    flex-1 p-3 rounded-lg border transition-all flex items-center justify-center gap-2
                    ${contactMethod === 'email' 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                      : 'border-slate-700 hover:border-slate-600 text-slate-400'
                    }
                  `}
                >
                  <Mail className="w-4 h-4" />
                  <span className="text-sm font-medium">E-post</span>
                </button>
                <button
                  type="button"
                  onClick={() => setContactMethod('phone')}
                  className={`
                    flex-1 p-3 rounded-lg border transition-all flex items-center justify-center gap-2
                    ${contactMethod === 'phone' 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                      : 'border-slate-700 hover:border-slate-600 text-slate-400'
                    }
                  `}
                  disabled={!customer.contact_phone}
                >
                  <Phone className="w-4 h-4" />
                  <span className="text-sm font-medium">Telefon</span>
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-slate-700">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                className="flex-1"
                disabled={submitting}
              >
                Avbryt
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                disabled={submitting || !subject.trim() || !description.trim()}
              >
                {submitting ? 'Skickar...' : 'Skicka förfrågan'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default PremiumServiceRequest