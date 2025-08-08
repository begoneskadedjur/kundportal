// src/components/admin/customers/EmailCampaignModal.tsx - Diskret e-postkampanjfunktionalitet
import React, { useState, useMemo } from 'react'
import { 
  X, Send, Mail, Users, User, Eye, AlertTriangle, 
  CheckCircle2, Circle, Search 
} from 'lucide-react'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import Card from '../../ui/Card'
import LoadingSpinner from '../../shared/LoadingSpinner'
import toast from 'react-hot-toast'

interface EmailCampaignModalProps {
  isOpen: boolean
  onClose: () => void
  customers: any[]
}

interface SelectedCustomer {
  id: string
  company_name: string
  contact_email: string
  contact_person: string
}

export default function EmailCampaignModal({ 
  isOpen, 
  onClose, 
  customers 
}: EmailCampaignModalProps) {
  const [step, setStep] = useState<'recipients' | 'compose' | 'preview'>('recipients')
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  // Filter customers for selection
  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return customers

    return customers.filter(customer => 
      customer.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.contact_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.contact_person?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [customers, searchTerm])

  // Get selected customer data
  const selectedCustomerData = useMemo(() => {
    return customers.filter(customer => selectedCustomers.has(customer.id))
  }, [customers, selectedCustomers])

  // Handle select all toggle
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedCustomers(new Set())
      setSelectAll(false)
    } else {
      const allIds = filteredCustomers
        .filter(c => c.contact_email)
        .map(c => c.id)
      setSelectedCustomers(new Set(allIds))
      setSelectAll(true)
    }
  }

  // Handle individual customer toggle
  const toggleCustomer = (customerId: string) => {
    const newSelected = new Set(selectedCustomers)
    if (newSelected.has(customerId)) {
      newSelected.delete(customerId)
    } else {
      newSelected.add(customerId)
    }
    setSelectedCustomers(newSelected)
    setSelectAll(false)
  }

  // Send email campaign
  const sendCampaign = async () => {
    if (selectedCustomers.size === 0) {
      toast.error('Ingen mottagare vald')
      return
    }

    if (!subject.trim()) {
      toast.error('Ämnesrad krävs')
      return
    }

    if (!message.trim()) {
      toast.error('Meddelande krävs')
      return
    }

    setSending(true)

    try {
      const response = await fetch('/api/send-email-campaign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipients: selectedCustomerData.map(customer => ({
            id: customer.id,
            email: customer.contact_email,
            name: customer.contact_person || customer.company_name,
            companyName: customer.company_name
          })),
          subject,
          message,
          loginLink: `${window.location.origin}/auth/login`
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Kunde inte skicka e-postkampanj')
      }

      toast.success(`E-postkampanj skickad till ${selectedCustomers.size} mottagare`)
      onClose()
    } catch (error: any) {
      console.error('Error sending email campaign:', error)
      toast.error(error.message || 'Ett fel uppstod vid skickande av e-postkampanj')
    } finally {
      setSending(false)
    }
  }

  // Reset state when modal closes
  const handleClose = () => {
    setStep('recipients')
    setSelectedCustomers(new Set())
    setSelectAll(false)
    setSearchTerm('')
    setSubject('')
    setMessage('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Mail className="w-6 h-6 text-green-400" />
            <div>
              <h2 className="text-xl font-semibold text-white">E-postkampanj</h2>
              <p className="text-sm text-slate-400">
                Skicka anpassade meddelanden till dina kunder
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Progress indicator */}
        <div className="px-6 py-4 border-b border-slate-700">
          <div className="flex items-center justify-between text-sm">
            <div className={`flex items-center gap-2 ${
              step === 'recipients' ? 'text-green-400' : 
              selectedCustomers.size > 0 ? 'text-white' : 'text-slate-500'
            }`}>
              {selectedCustomers.size > 0 ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Circle className="w-4 h-4" />
              )}
              <span>1. Välj mottagare ({selectedCustomers.size})</span>
            </div>
            <div className={`flex items-center gap-2 ${
              step === 'compose' ? 'text-green-400' : 
              subject && message ? 'text-white' : 'text-slate-500'
            }`}>
              {subject && message ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Circle className="w-4 h-4" />
              )}
              <span>2. Skriva meddelande</span>
            </div>
            <div className={`flex items-center gap-2 ${
              step === 'preview' ? 'text-green-400' : 'text-slate-500'
            }`}>
              <Circle className="w-4 h-4" />
              <span>3. Förhandsgranska & skicka</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {step === 'recipients' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  Välj mottagare
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  className="text-slate-400 hover:text-white"
                >
                  {selectAll ? 'Avmarkera alla' : 'Välj alla'}
                </Button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Sök företag, kontaktperson eller e-post..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Customer list */}
              <div className="max-h-96 overflow-y-auto border border-slate-700 rounded-lg">
                {filteredCustomers.filter(c => c.contact_email).length === 0 ? (
                  <div className="p-8 text-center">
                    <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400">Inga kunder med e-postadresser hittades</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-700">
                    {filteredCustomers.filter(c => c.contact_email).map((customer) => (
                      <div
                        key={customer.id}
                        className="flex items-center gap-3 p-3 hover:bg-slate-800/50 cursor-pointer"
                        onClick={() => toggleCustomer(customer.id)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedCustomers.has(customer.id)}
                          onChange={() => toggleCustomer(customer.id)}
                          className="w-4 h-4 text-green-400 bg-slate-700 border-slate-600 rounded focus:ring-green-400"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">
                            {customer.company_name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {customer.contact_person} • {customer.contact_email}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 'compose' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-white flex items-center gap-2">
                <Mail className="w-5 h-5 text-purple-400" />
                Skriv ditt meddelande
              </h3>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Ämnesrad
                </label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Skriv en tydlig ämnesrad..."
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Meddelande
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={8}
                  placeholder="Skriv ditt meddelande här. HTML-formatering stöds."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Meddelandet kommer att formateras med Begone-mallens design automatiskt.
                </p>
              </div>

              <Card className="p-4 bg-blue-500/10 border-blue-500/20">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-400 mb-1">Tips för effektiva e-postkampanjer</p>
                    <ul className="text-xs text-blue-300 space-y-1">
                      <li>• Håll ämnesraden kort och beskrivande</li>
                      <li>• Personalisera meddelandet när det är möjligt</li>
                      <li>• Inkludera en tydlig uppmaning till handling</li>
                      <li>• Testa meddelandet innan du skickar till alla</li>
                    </ul>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-white flex items-center gap-2">
                <Eye className="w-5 h-5 text-yellow-400" />
                Förhandsgranska & skicka
              </h3>

              <Card className="p-4">
                <h4 className="text-sm font-medium text-slate-300 mb-3">Kampanjöversikt</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-400">Mottagare:</span>
                    <span className="text-white ml-2">{selectedCustomers.size} kunder</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Ämne:</span>
                    <span className="text-white ml-2">{subject}</span>
                  </div>
                </div>
              </Card>

              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-3">Mottagare</h4>
                <div className="max-h-32 overflow-y-auto bg-slate-800 rounded-lg p-3">
                  {selectedCustomerData.map((customer, index) => (
                    <div key={customer.id} className="text-xs text-slate-300 py-1">
                      {index + 1}. {customer.company_name} ({customer.contact_email})
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-3">Meddelandeförhandsvisning</h4>
                <Card className="p-4 bg-slate-800/50">
                  <div className="text-sm text-slate-300 space-y-2">
                    <div><strong>Ämne:</strong> {subject}</div>
                    <div className="border-t border-slate-700 pt-2">
                      <div className="whitespace-pre-wrap text-slate-200" dangerouslySetInnerHTML={{ __html: message }} />
                    </div>
                  </div>
                </Card>
                <p className="text-xs text-slate-500 mt-2">
                  Slutgiltiga e-postmeddelanden kommer att ha Begones professionella design och branding.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-slate-700 bg-slate-800/50">
          <div className="flex gap-3">
            {step !== 'recipients' && (
              <Button
                variant="secondary"
                onClick={() => {
                  if (step === 'compose') setStep('recipients')
                  if (step === 'preview') setStep('compose')
                }}
              >
                Föregående
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={handleClose}
            >
              Avbryt
            </Button>
          </div>

          <div className="flex gap-3">
            {step === 'recipients' && (
              <Button
                onClick={() => setStep('compose')}
                disabled={selectedCustomers.size === 0}
                className="flex items-center gap-2"
              >
                Nästa: Skriv meddelande
              </Button>
            )}
            {step === 'compose' && (
              <Button
                onClick={() => setStep('preview')}
                disabled={!subject.trim() || !message.trim()}
                className="flex items-center gap-2"
              >
                Nästa: Förhandsgranska
              </Button>
            )}
            {step === 'preview' && (
              <Button
                onClick={sendCampaign}
                disabled={sending}
                className="flex items-center gap-2"
              >
                {sending ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Skickar...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Skicka kampanj
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}