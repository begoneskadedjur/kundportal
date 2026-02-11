// src/components/admin/customers/AddContractCustomerModal.tsx
// Modal för att lägga till avtalskund via PDF-uppladdning med Gemini AI-extraktion

import React, { useState, useRef, useCallback } from 'react'
import {
  Upload, FileText, Building2, User, Calendar,
  Briefcase, AlertCircle, CheckCircle, Sparkles,
  ArrowLeft, Info
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Modal from '../../ui/Modal'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import LoadingSpinner from '../../shared/LoadingSpinner'
import { supabase } from '../../../lib/supabase'
import toast from 'react-hot-toast'

interface AddContractCustomerModalProps {
  isOpen: boolean
  onClose: () => void
  onCustomerCreated: () => void
}

interface ExtractedData {
  company_name: string | null
  organization_number: string | null
  contact_person: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_address: string | null
  billing_email: string | null
  billing_address: string | null
  contract_start_date: string | null
  contract_end_date: string | null
  contract_length: string | null
  annual_value: number | null
  monthly_value: number | null
  total_contract_value: number | null
  agreement_text: string | null
  products: Array<{ name: string; description?: string; quantity?: number; price?: number }> | null
  oneflow_contract_id: string | null
  assigned_account_manager: string | null
  sales_person: string | null
  business_type: string | null
  industry_category: string | null
  service_frequency: string | null
  confidence_score: number
  extraction_notes: string
}

type Step = 'upload' | 'extracting' | 'review'

export default function AddContractCustomerModal({
  isOpen,
  onClose,
  onCustomerCreated
}: AddContractCustomerModalProps) {
  const [step, setStep] = useState<Step>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [pdfBase64, setPdfBase64] = useState<string | null>(null)
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [extractionError, setExtractionError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetState = () => {
    setStep('upload')
    setSelectedFile(null)
    setPdfBase64(null)
    setExtractedData(null)
    setFormData({})
    setErrors({})
    setExtractionError(null)
    setIsSubmitting(false)
    setIsDragging(false)
  }

  const handleClose = () => {
    if (step === 'extracting') return
    resetState()
    onClose()
  }

  const handleFileSelect = useCallback((file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('Bara PDF-filer är tillåtna')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('PDF-filen är för stor (max 10MB)')
      return
    }
    setSelectedFile(file)
    setExtractionError(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      const base64 = result.split(',')[1]
      setPdfBase64(base64)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const startExtraction = async () => {
    if (!pdfBase64) return
    setStep('extracting')
    setExtractionError(null)

    try {
      const response = await fetch('/api/extract-contract-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64 }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Extrahering misslyckades')
      }

      const data = result.data as ExtractedData
      setExtractedData(data)
      setFormData({
        company_name: data.company_name || '',
        organization_number: data.organization_number || '',
        contact_person: data.contact_person || '',
        contact_email: data.contact_email || '',
        contact_phone: data.contact_phone || '',
        contact_address: data.contact_address || '',
        billing_email: data.billing_email || '',
        billing_address: data.billing_address || '',
        contract_start_date: data.contract_start_date || '',
        contract_end_date: data.contract_end_date || '',
        contract_length: data.contract_length || '',
        annual_value: data.annual_value ?? '',
        monthly_value: data.monthly_value ?? '',
        total_contract_value: data.total_contract_value ?? '',
        agreement_text: data.agreement_text || '',
        oneflow_contract_id: data.oneflow_contract_id || '',
        assigned_account_manager: data.assigned_account_manager || '',
        sales_person: data.sales_person || '',
        business_type: data.business_type || '',
        industry_category: data.industry_category || '',
        service_frequency: data.service_frequency || '',
      })
      setStep('review')
    } catch (err: any) {
      console.error('Extraction error:', err)
      setExtractionError(err.message || 'Ett oväntat fel uppstod')
      setStep('upload')
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!formData.company_name?.trim()) newErrors.company_name = 'Företagsnamn är obligatoriskt'
    if (!formData.contact_person?.trim()) newErrors.contact_person = 'Kontaktperson är obligatoriskt'
    if (!formData.contact_email?.trim()) {
      newErrors.contact_email = 'E-postadress är obligatorisk'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact_email)) {
      newErrors.contact_email = 'Ogiltig e-postadress'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) return
    setIsSubmitting(true)

    try {
      const customerData = {
        company_name: formData.company_name.trim(),
        organization_number: formData.organization_number?.trim() || null,
        contact_person: formData.contact_person.trim(),
        contact_email: formData.contact_email.trim().toLowerCase(),
        contact_phone: formData.contact_phone?.trim() || null,
        contact_address: formData.contact_address?.trim() || null,
        billing_email: formData.billing_email?.trim() || null,
        billing_address: formData.billing_address?.trim() || null,
        contract_start_date: formData.contract_start_date || null,
        contract_end_date: formData.contract_end_date || null,
        contract_length: formData.contract_length?.trim() || null,
        annual_value: formData.annual_value ? parseFloat(formData.annual_value) : null,
        monthly_value: formData.monthly_value ? parseFloat(formData.monthly_value) : null,
        total_contract_value: formData.total_contract_value ? parseFloat(formData.total_contract_value) : null,
        agreement_text: formData.agreement_text?.trim() || null,
        oneflow_contract_id: formData.oneflow_contract_id?.trim() || null,
        assigned_account_manager: formData.assigned_account_manager?.trim() || null,
        sales_person: formData.sales_person?.trim() || null,
        business_type: formData.business_type || null,
        industry_category: formData.industry_category?.trim() || null,
        service_frequency: formData.service_frequency?.trim() || null,
        source_type: 'import',
        contract_status: 'signed',
        is_active: true,
      }

      const { error } = await supabase
        .from('customers')
        .insert(customerData)

      if (error) throw error

      toast.success('Avtalskund skapad!')
      onCustomerCreated()
      handleClose()
    } catch (err: any) {
      console.error('Error creating customer:', err)
      toast.error('Kunde inte skapa kund: ' + (err.message || 'Okänt fel'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const confidenceColor = (score: number) => {
    if (score >= 80) return 'text-green-400 bg-green-400/10 border-green-400/30'
    if (score >= 50) return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30'
    return 'text-red-400 bg-red-400/10 border-red-400/30'
  }

  const selectStyles = 'w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#20c58f] focus:outline-none'

  const getTitle = () => {
    if (step === 'upload') return 'Lägg till avtalskund'
    if (step === 'extracting') return 'Analyserar dokument...'
    return 'Granska extraherad data'
  }

  const getFooter = () => {
    if (step === 'extracting') return undefined

    if (step === 'upload') {
      return (
        <div className="flex items-center justify-end px-4 py-2.5 gap-3">
          <Button variant="secondary" onClick={handleClose}>
            Avbryt
          </Button>
          <Button
            variant="primary"
            onClick={startExtraction}
            disabled={!pdfBase64}
            className="flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Analysera PDF
          </Button>
        </div>
      )
    }

    // review step
    return (
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <AlertCircle className="w-3.5 h-3.5" />
          Obligatoriska fält markeras med *
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => {
              setStep('upload')
              setExtractedData(null)
              setFormData({})
              setErrors({})
            }}
            disabled={isSubmitting}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Tillbaka
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2"
          >
            {isSubmitting ? <LoadingSpinner size="sm" /> : <CheckCircle className="w-4 h-4" />}
            Skapa kund
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={getTitle()}
      size="xl"
      preventClose={step === 'extracting' || isSubmitting}
      footer={getFooter()}
    >
      <AnimatePresence mode="wait">
        {/* STEP 1: Upload */}
        {step === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="p-4"
          >
            {extractionError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-400">Extrahering misslyckades</p>
                  <p className="text-xs text-red-300/70 mt-1">{extractionError}</p>
                </div>
              </div>
            )}

            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative flex flex-col items-center justify-center p-12 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200
                ${isDragging
                  ? 'border-[#20c58f] bg-[#20c58f]/5'
                  : selectedFile
                    ? 'border-[#20c58f]/50 bg-slate-800/30'
                    : 'border-slate-600 hover:border-slate-500 bg-slate-800/20 hover:bg-slate-800/30'
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFileSelect(file)
                }}
                className="hidden"
              />

              {selectedFile ? (
                <>
                  <div className="w-14 h-14 rounded-xl bg-[#20c58f]/10 flex items-center justify-center mb-4">
                    <FileText className="w-7 h-7 text-[#20c58f]" />
                  </div>
                  <p className="text-sm font-medium text-white mb-1">{selectedFile.name}</p>
                  <p className="text-xs text-slate-400">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <p className="text-xs text-slate-500 mt-3">Klicka eller dra för att byta fil</p>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-xl bg-slate-700/50 flex items-center justify-center mb-4">
                    <Upload className="w-7 h-7 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-white mb-1">
                    Dra och släpp avtalsdokument här
                  </p>
                  <p className="text-xs text-slate-400">
                    eller klicka för att välja fil (PDF, max 10MB)
                  </p>
                </>
              )}
            </div>

            <div className="mt-4 p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-slate-400 space-y-1">
                  <p>AI:n extraherar automatiskt kunddata, kontaktuppgifter, avtalsinformation och tjänstebeskrivningar från PDF-dokumentet.</p>
                  <p>Du kan granska och redigera alla fält innan kunden skapas.</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 2: Extracting */}
        {step === 'extracting' && (
          <motion.div
            key="extracting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="p-4 flex flex-col items-center justify-center min-h-[300px]"
          >
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="w-16 h-16 rounded-xl bg-[#20c58f]/10 flex items-center justify-center mb-6"
            >
              <Sparkles className="w-8 h-8 text-[#20c58f]" />
            </motion.div>
            <p className="text-lg font-medium text-white mb-2">Analyserar avtalsdokument...</p>
            <p className="text-sm text-slate-400 mb-6">Vi extraherar kunddata från PDF:en</p>
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-[#20c58f]"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* STEP 3: Review */}
        {step === 'review' && extractedData && (
          <motion.div
            key="review"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="p-4 space-y-4"
          >
            {/* Confidence + Notes */}
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${confidenceColor(extractedData.confidence_score)}`}>
                <Sparkles className="w-3.5 h-3.5" />
                AI-konfidens: {extractedData.confidence_score}%
              </span>
              {selectedFile && (
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  {selectedFile.name}
                </span>
              )}
            </div>

            {extractedData.extraction_notes && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-300/80">{extractedData.extraction_notes}</p>
              </div>
            )}

            {/* Företagsinformation */}
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-slate-400" />
                Företagsinformation
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Företagsnamn *"
                  value={formData.company_name || ''}
                  onChange={(e) => handleInputChange('company_name', e.target.value)}
                  error={errors.company_name}
                />
                <Input
                  label="Organisationsnummer"
                  value={formData.organization_number || ''}
                  onChange={(e) => handleInputChange('organization_number', e.target.value)}
                  placeholder="XXXXXX-XXXX"
                />
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Företagstyp</label>
                  <select
                    value={formData.business_type || ''}
                    onChange={(e) => handleInputChange('business_type', e.target.value)}
                    className={selectStyles}
                  >
                    <option value="">Välj typ</option>
                    <option value="private">Privatperson</option>
                    <option value="business">Företag</option>
                    <option value="organization">Organisation</option>
                  </select>
                </div>
                <Input
                  label="Bransch"
                  value={formData.industry_category || ''}
                  onChange={(e) => handleInputChange('industry_category', e.target.value)}
                  placeholder="T.ex. Restaurang, Lantbruk"
                />
              </div>
            </div>

            {/* Kontaktinformation */}
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                <User className="w-4 h-4 text-slate-400" />
                Kontaktinformation
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Kontaktperson *"
                  value={formData.contact_person || ''}
                  onChange={(e) => handleInputChange('contact_person', e.target.value)}
                  error={errors.contact_person}
                />
                <Input
                  label="E-postadress *"
                  type="email"
                  value={formData.contact_email || ''}
                  onChange={(e) => handleInputChange('contact_email', e.target.value)}
                  error={errors.contact_email}
                />
                <Input
                  label="Telefonnummer"
                  value={formData.contact_phone || ''}
                  onChange={(e) => handleInputChange('contact_phone', e.target.value)}
                  placeholder="070-123 45 67"
                />
                <Input
                  label="Adress"
                  value={formData.contact_address || ''}
                  onChange={(e) => handleInputChange('contact_address', e.target.value)}
                  placeholder="Gatuadress, Postnummer Ort"
                />
                <Input
                  label="Faktura e-post"
                  type="email"
                  value={formData.billing_email || ''}
                  onChange={(e) => handleInputChange('billing_email', e.target.value)}
                  placeholder="Om annan än kontaktepost"
                />
                <Input
                  label="Fakturaadress"
                  value={formData.billing_address || ''}
                  onChange={(e) => handleInputChange('billing_address', e.target.value)}
                  placeholder="Om annan än kontaktadress"
                />
              </div>
            </div>

            {/* Avtalsinformation */}
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-400" />
                Avtalsinformation
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="Startdatum"
                  type="date"
                  value={formData.contract_start_date || ''}
                  onChange={(e) => handleInputChange('contract_start_date', e.target.value)}
                />
                <Input
                  label="Slutdatum"
                  type="date"
                  value={formData.contract_end_date || ''}
                  onChange={(e) => handleInputChange('contract_end_date', e.target.value)}
                />
                <Input
                  label="Avtalslängd"
                  value={formData.contract_length || ''}
                  onChange={(e) => handleInputChange('contract_length', e.target.value)}
                  placeholder="T.ex. 3 år"
                />
                <Input
                  label="Årsvärde (SEK)"
                  type="number"
                  value={formData.annual_value ?? ''}
                  onChange={(e) => handleInputChange('annual_value', e.target.value)}
                />
                <Input
                  label="Månadsvärde (SEK)"
                  type="number"
                  value={formData.monthly_value ?? ''}
                  onChange={(e) => handleInputChange('monthly_value', e.target.value)}
                />
                <Input
                  label="Totalt kontraktsvärde (SEK)"
                  type="number"
                  value={formData.total_contract_value ?? ''}
                  onChange={(e) => handleInputChange('total_contract_value', e.target.value)}
                />
                <Input
                  label="Servicefrekvens"
                  value={formData.service_frequency || ''}
                  onChange={(e) => handleInputChange('service_frequency', e.target.value)}
                  placeholder="T.ex. Kvartalsvis"
                />
                <Input
                  label="Oneflow ID"
                  value={formData.oneflow_contract_id || ''}
                  onChange={(e) => handleInputChange('oneflow_contract_id', e.target.value)}
                />
              </div>
            </div>

            {/* Ansvariga */}
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-slate-400" />
                Ansvariga hos BeGone
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Ansvarig tekniker / Account Manager"
                  value={formData.assigned_account_manager || ''}
                  onChange={(e) => handleInputChange('assigned_account_manager', e.target.value)}
                />
                <Input
                  label="Säljare"
                  value={formData.sales_person || ''}
                  onChange={(e) => handleInputChange('sales_person', e.target.value)}
                />
              </div>
            </div>

            {/* Avtalstext */}
            {(formData.agreement_text || extractedData.products) && (
              <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-slate-400" />
                  Tjänster & Avtalstext
                </h3>
                <Input
                  as="textarea"
                  rows={3}
                  label="Avtalstext / Tjänstebeskrivning"
                  value={formData.agreement_text || ''}
                  onChange={(e) => handleInputChange('agreement_text', e.target.value)}
                />
                {extractedData.products && extractedData.products.length > 0 && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-slate-300 mb-2">Extraherade produkter/tjänster</label>
                    <div className="space-y-1">
                      {extractedData.products.map((product, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/20 border border-slate-700/50 rounded-lg text-xs text-slate-300">
                          <span className="font-medium">{product.name}</span>
                          {product.description && <span className="text-slate-500">- {product.description}</span>}
                          {product.price && <span className="ml-auto text-slate-400">{product.price} SEK</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  )
}
