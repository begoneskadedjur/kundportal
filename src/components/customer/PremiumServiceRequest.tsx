// src/components/customer/PremiumServiceRequest.tsx - Service Request Modal
import React, { useState } from 'react'
import { X, AlertCircle, Calendar, MessageSquare, Phone, Mail, Upload, CheckCircle } from 'lucide-react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import toast from 'react-hot-toast'

interface PremiumServiceRequestProps {
  isOpen: boolean
  onClose: () => void
  customer: {
    id: string
    company_name: string
    contact_person: string
    contact_email: string
    contact_phone: string | null
  }
}

const PremiumServiceRequest: React.FC<PremiumServiceRequestProps> = ({ 
  isOpen, 
  onClose, 
  customer 
}) => {
  const [requestType, setRequestType] = useState<'urgent' | 'scheduled' | 'general'>('general')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
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

    setSubmitting(true)
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    setSubmitting(false)
    setSubmitted(true)
    
    // Reset after showing success
    setTimeout(() => {
      onClose()
      setSubmitted(false)
      setSubject('')
      setDescription('')
      setFiles([])
    }, 2000)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files))
    }
  }

  const requestTypeConfig = {
    urgent: {
      icon: <AlertCircle className="w-5 h-5" />,
      label: 'Akut ärende',
      color: 'text-red-500 bg-red-500/10 border-red-500/20 hover:border-red-500/40'
    },
    scheduled: {
      icon: <Calendar className="w-5 h-5" />,
      label: 'Planerat besök',
      color: 'text-blue-500 bg-blue-500/10 border-blue-500/20 hover:border-blue-500/40'
    },
    general: {
      icon: <MessageSquare className="w-5 h-5" />,
      label: 'Allmän förfrågan',
      color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/40'
    }
  }

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
                <h3 className="text-2xl font-bold text-white mb-2">Tack för er förfrågan!</h3>
                <p className="text-slate-400">Vi återkommer inom kort.</p>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-700">
            <div>
              <h2 className="text-xl font-semibold text-white">Begär service</h2>
              <p className="text-sm text-slate-400 mt-1">Vi hjälper er gärna med era behov</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Request Type Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Typ av ärende
              </label>
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(requestTypeConfig).map(([type, config]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setRequestType(type as any)}
                    className={`
                      p-3 rounded-lg border transition-all
                      ${requestType === type 
                        ? config.color 
                        : 'border-slate-700 hover:border-slate-600'
                      }
                    `}
                  >
                    <div className={`flex flex-col items-center gap-2 ${
                      requestType === type ? '' : 'text-slate-400'
                    }`}>
                      {config.icon}
                      <span className="text-sm font-medium">{config.label}</span>
                    </div>
                  </button>
                ))}
              </div>
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
                placeholder="Beskriv kort vad ärendet gäller"
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
                placeholder="Ge oss mer detaljer om ert behov..."
                rows={4}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                Ju mer information ni ger oss, desto bättre kan vi hjälpa er.
              </p>
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Bifoga filer (valfritt)
              </label>
              <div className="relative">
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                  accept="image/*,.pdf,.doc,.docx"
                />
                <label
                  htmlFor="file-upload"
                  className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-700 rounded-lg hover:border-slate-600 cursor-pointer transition-colors"
                >
                  <Upload className="w-5 h-5 text-slate-400" />
                  <span className="text-slate-400">
                    {files.length > 0 
                      ? `${files.length} fil(er) valda` 
                      : 'Klicka för att välja filer'}
                  </span>
                </label>
              </div>
              {files.length > 0 && (
                <div className="mt-2 space-y-1">
                  {files.map((file, index) => (
                    <div key={index} className="text-xs text-slate-500">
                      • {file.name} ({(file.size / 1024).toFixed(1)} KB)
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Contact Method */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Hur vill ni bli kontaktade?
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
              {contactMethod === 'email' && (
                <p className="text-xs text-slate-500 mt-2">
                  Vi kontaktar er på: {customer.contact_email}
                </p>
              )}
              {contactMethod === 'phone' && customer.contact_phone && (
                <p className="text-xs text-slate-500 mt-2">
                  Vi ringer er på: {customer.contact_phone}
                </p>
              )}
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