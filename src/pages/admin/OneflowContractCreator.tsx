// 📁 src/pages/admin/oneflow/OneflowContractCreator.tsx
// KOMPLETT WIZARD VERSION - STEG FÖR STEG GUIDE MED ANVÄNDARINTEGRATION

import React, { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Confetti from 'react-confetti'
import { ArrowLeft, ArrowRight, Eye, FileText, Building2, Mail, Send, CheckCircle, ExternalLink, User, Calendar, Hash, Phone, MapPin, DollarSign, FileCheck, ShoppingCart, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext' // 🆕 HÄMTA ANVÄNDARINFO
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import CaseServiceSelector from '../../components/shared/CaseServiceSelector'
import AnimatedProgressBar from '../../components/ui/AnimatedProgressBar'
import { SelectedProduct, CustomerType, SelectedArticleItem } from '../../types/products'
import { convertServicesToOneflowProducts } from '../../utils/articlePricingCalculator'
import type { CaseBillingItemWithRelations } from '../../types/caseBilling'
import { OFFER_TEMPLATES, CONTRACT_TEMPLATES } from '../../constants/oneflowTemplates'
import { CustomerGroupService } from '../../services/customerGroupService'
import { CustomerGroup } from '../../types/customerGroups'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

interface WizardData {
  // Steg 1 - Dokumenttyp
  documentType: 'offer' | 'contract'
  
  // Steg 2 - Mall
  selectedTemplate: string
  
  // Steg 3 - Avtalspart
  partyType: 'company' | 'individual'
  
  // Steg 4 - BeGone info
  anstalld: string
  'e-post-anstlld': string
  avtalslngd: string
  begynnelsedag: string
  
  // Steg 5 - Motpart
  Kontaktperson: string
  'e-post-kontaktperson': string
  'telefonnummer-kontaktperson': string
  'utforande-adress': string
  foretag: string
  'org-nr': string
  
  // Steg 6 - Prislista & Artiklar
  selectedPriceListId: string | null
  selectedArticles: SelectedArticleItem[]
  deductionType: 'rot' | 'rut' | 'none' | null
  customTotalPrice: number | null
  selectedProducts: SelectedProduct[]
  /** Manuellt läge: items från CaseServiceSelector draftMode */
  draftItems: CaseBillingItemWithRelations[]
  /** Manuellt läge: mappning artikel-id → service-id (från Prisguiden) — lyfts ut så state överlever steg-navigering */
  draftPriceAssignments: Record<string, string>
  /** Manuellt läge: påslag per tjänst (från Prisguiden) */
  draftPriceMarkups: Record<string, number>
  prefillServices?: Array<{
    id: string
    service_name: string | null
    service_code: string | null
    unit_price: number
    quantity: number
    total_price: number
    vat_rate?: number
    rot_rut_type?: 'ROT' | 'RUT' | null
    service?: { rot_rate_percent?: number | null; rut_rate_percent?: number | null } | null
  }>
  
  // Steg 7 - Avtalsobjekt
  agreementText: string
  
  // Steg 8 - Slutsteg
  sendForSigning: boolean
  
  // Case linking
  case_id?: string

  // Kundgrupp (bara vid avtal)
  customer_group_id: string | null
}

const OFFER_STEPS = [
  { id: 1, title: 'Dokumenttyp', icon: FileCheck },
  { id: 2, title: 'Välj Mall', icon: FileText },
  { id: 3, title: 'Avtalspart', icon: User },
  { id: 4, title: 'BeGone Info', icon: Building2 },
  { id: 5, title: 'Motpart', icon: Mail },
  { id: 6, title: 'Produkter', icon: ShoppingCart },
  { id: 7, title: 'Avtalsobjekt', icon: FileText },
  { id: 8, title: 'Granska & Skicka', icon: Send }
]

const CONTRACT_STEPS = [
  { id: 1, title: 'Dokumenttyp', icon: FileCheck },
  { id: 2, title: 'Välj Mall', icon: FileText },
  { id: 3, title: 'Avtalspart', icon: User },
  { id: 4, title: 'Kundgrupp', icon: Users },
  { id: 5, title: 'BeGone Info', icon: Building2 },
  { id: 6, title: 'Motpart', icon: Mail },
  { id: 7, title: 'Produkter', icon: ShoppingCart },
  { id: 8, title: 'Avtalsobjekt', icon: FileText },
  { id: 9, title: 'Granska & Skicka', icon: Send }
]

export default function OneflowContractCreator() {
  const navigate = useNavigate()
  const { user, profile } = useAuth() // 🆕 HÄMTA ANVÄNDARINFO

  // Funktion för att navigera till rätt dashboard baserat på användarens roll
  const getDashboardRoute = useCallback(() => {
    const role = profile?.role || 'admin';
    switch (role) {
      case 'koordinator':
        return '/koordinator/dashboard';
      case 'technician':
        return '/technician/dashboard';
      default:
        return '/admin/dashboard';
    }
  }, [profile?.role]);
  const [currentStep, setCurrentStep] = useState(1)
  const [maxReachedStep, setMaxReachedStep] = useState(1)
  const [isCreating, setIsCreating] = useState(false)
  const [creationStep, setCreationStep] = useState('')
  const [createdContract, setCreatedContract] = useState<any>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([])
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [groupsError, setGroupsError] = useState<string | null>(null)

  // 🆕 DYNAMISK BEGONE INFO BASERAT PÅ INLOGGAD ANVÄNDARE
  const [wizardData, setWizardData] = useState<WizardData>({
    documentType: 'contract',
    selectedTemplate: '',
    partyType: 'company',
    // 🆕 ANVÄND INLOGGAD ANVÄNDARES INFO SOM DEFAULT
    // Prioritera technicians.name om det finns, annars display_name eller user metadata
    anstalld: profile?.technicians?.name || profile?.display_name || user?.user_metadata?.full_name || 'BeGone Medarbetare',
    'e-post-anstlld': user?.email || '',
    avtalslngd: '1',
    begynnelsedag: new Date().toISOString().split('T')[0],
    Kontaktperson: '',
    'e-post-kontaktperson': '',
    'telefonnummer-kontaktperson': '',
    'utforande-adress': '',
    foretag: '',
    'org-nr': '',
    selectedPriceListId: null,
    selectedArticles: [],
    deductionType: null,
    customTotalPrice: null,
    selectedProducts: [],
    draftItems: [],
    draftPriceAssignments: {},
    draftPriceMarkups: {},
    agreementText: 'Regelbunden kontroll och bekämpning av skadedjur enligt överenskommet schema. Detta inkluderar inspektion av samtliga betesstationer, påfyllning av bete vid behov, samt dokumentation av aktivitet. Vid tecken på gnagaraktivitet vidtas omedelbara åtgärder med förstärkta insatser.',
    sendForSigning: true,
    customer_group_id: null
  })

  // Dynamiska steg baserat på dokumenttyp
  const STEPS = wizardData.documentType === 'contract' ? CONTRACT_STEPS : OFFER_STEPS

  // Steg-offset: vid avtal skiftas steg 4+ med 1 (kundgrupp injicerat)
  const isContract = wizardData.documentType === 'contract'
  // Mappa logiska steg-ID:n till offer-steg (för renderStepContent)
  const stepOffset = (step: number) => isContract && step >= 5 ? step - 1 : step

  // Hämta kundgrupper (med session-check + error/retry-handling)
  const loadCustomerGroups = useCallback(async () => {
    setGroupsLoading(true)
    setGroupsError(null)
    try {
      // Säkerställ att vi har en giltig session innan RLS-skyddad tabell läses
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        throw new Error('Din session har gått ut. Ladda om sidan och logga in igen.')
      }
      const groups = await CustomerGroupService.getActiveGroups()
      setCustomerGroups(groups)
      console.info(`[CustomerGroups] Laddade ${groups.length} aktiva grupper`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Okänt fel'
      console.error('[OneflowContractCreator] Kunde inte hämta kundgrupper:', err)
      setGroupsError(msg)
      toast.error(`Kunde inte hämta kundgrupper: ${msg}`)
    } finally {
      setGroupsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    loadCustomerGroups()
  }, [user, loadCustomerGroups])

  // Hantera förifyllda data från EditCaseModal
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const prefillType = urlParams.get('prefill')
    
    if (prefillType && (prefillType === 'contract' || prefillType === 'offer')) {
      const savedData = sessionStorage.getItem('prefill_customer_data')
      if (savedData) {
        try {
          const customerData = JSON.parse(savedData)
          console.log('Prefilling customer data:', customerData)
          
          setWizardData(prev => ({
            ...prev,
            documentType: customerData.documentType || prefillType,
            selectedTemplate: customerData.selectedTemplate || '',
            partyType: customerData.partyType || 'company',
            Kontaktperson: customerData.Kontaktperson || '',
            'e-post-kontaktperson': customerData['e-post-kontaktperson'] || '',
            'telefonnummer-kontaktperson': customerData['telefonnummer-kontaktperson'] || '',
            'utforande-adress': customerData['utforande-adress'] || '',
            foretag: customerData.foretag || '',
            'org-nr': customerData['org-nr'] || '',
            // Lägg till tekniker-info om det finns
            anstalld: customerData.anstalld || prev.anstalld,
            'e-post-anstlld': customerData['e-post-anstlld'] || prev['e-post-anstlld'],
            // Lägg till avtalslängd och startdatum om det finns
            avtalslngd: customerData.avtalslngd || prev.avtalslngd,
            begynnelsedag: customerData.begynnelsedag || prev.begynnelsedag,
            // Lägg till case_id för webhook-koppling
            case_id: customerData.case_id || undefined,
            // Lägg till prislista från kunden
            selectedPriceListId: customerData.selectedPriceListId || prev.selectedPriceListId,
            // Förifylla artiklar från ärendet
            selectedArticles: customerData.prefillArticles?.length > 0
              ? customerData.prefillArticles
              : prev.selectedArticles,
            // ROT/RUT-avdragstyp från ärendet
            deductionType: customerData.deductionType || prev.deductionType,
            // Anpassat pris från ärendet (exkl moms)
            customTotalPrice: customerData.customTotalPrice ?? prev.customTotalPrice,
            // Faktureringstjänster från ärendet (visas i steg 6)
            prefillServices: customerData.prefillServices || prev.prefillServices,
          }))
          
          // Debug-logging för att spåra prefill-processen
          console.log('Prefill data received:', {
            autoSelectTemplate: customerData.autoSelectTemplate,
            selectedTemplate: customerData.selectedTemplate,
            documentType: customerData.documentType,
            hasContact: !!customerData.Kontaktperson,
            hasEmail: !!customerData['e-post-kontaktperson']
          })
          
          // Använd setTimeout för att säkerställa att state har uppdaterats innan steg-hoppning
          setTimeout(() => {
            // Om vi har autoSelectTemplate flagga och all nödvändig data, hoppa direkt till steg 6
            if (customerData.autoSelectTemplate &&
                customerData.selectedTemplate &&
                customerData.Kontaktperson &&
                customerData['e-post-kontaktperson']) {
              // Vi har all data - hoppa förbi produktval till avtalsobjekt (steg 7 för offert, 8 för avtal)
              const docType = customerData.documentType || prefillType
              const targetStep = docType === 'contract' ? 8 : 7
              console.log('Auto-selecting template and jumping to step:', targetStep)
              setCurrentStep(targetStep)
              setMaxReachedStep(targetStep)
            } else if (customerData.autoSelectTemplate && customerData.selectedTemplate) {
              // Om vi har template men inte all kontaktdata, gå till steg 2 med förvald mall
              console.log('Auto-selecting template at step 2:', customerData.selectedTemplate)
              setCurrentStep(2)
              setMaxReachedStep(2)
            } else if (customerData.targetStep && customerData.targetStep >= 1 && customerData.targetStep <= STEPS.length) {
              // Använd specificerat steg
              setCurrentStep(customerData.targetStep)
              setMaxReachedStep(customerData.targetStep)
            } else {
              // Börja från steg 1
              setCurrentStep(1)
            }
            
            // Rensa sessionStorage efter användning
            sessionStorage.removeItem('prefill_customer_data')
          }, 100) // Vänta lite för att säkerställa state-uppdatering
          
          toast.success(`Kundinformation förifylld från ärende! (${prefillType === 'contract' ? 'Avtal' : 'Offert'})`, {
            duration: 4000,
            icon: prefillType === 'contract' ? '📄' : '💰'
          })
          
          // Debug: Visa vad som laddades
          console.log('Prefill completed:', {
            documentType: customerData.documentType || prefillType,
            selectedTemplate: customerData.selectedTemplate,
            autoSelectTemplate: customerData.autoSelectTemplate,
            hasCustomerData: !!(customerData.Kontaktperson && customerData['e-post-kontaktperson'])
          })
          
        } catch (error) {
          console.error('Error parsing prefill data:', error)
          toast.error('Kunde inte läsa förifylld kundinformation')
        }
      } else {
        // Om ingen data finns men prefill är angett, sätt bara dokumenttyp
        setWizardData(prev => ({
          ...prev,
          documentType: prefillType as 'contract' | 'offer'
        }))
        toast.info(`Startar ${prefillType === 'contract' ? 'avtals' : 'offert'}-skapning`)
      }
    }
  }, [])  // Kör bara en gång vid mount

  // Navigation guard — varna om osparade ändringar
  const hasUnsavedProgress = useCallback((): boolean => {
    if (createdContract) return false
    if (currentStep > 1) return true
    return (
      wizardData.Kontaktperson !== '' ||
      wizardData['e-post-kontaktperson'] !== '' ||
      wizardData.foretag !== '' ||
      wizardData.draftItems.length > 0 ||
      wizardData.selectedArticles.length > 0
    )
  }, [currentStep, wizardData, createdContract])

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedProgress()) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsavedProgress])

  const updateWizardData = (field: keyof WizardData, value: any) => {
    setWizardData(prev => {
      const updated = { ...prev, [field]: value }
      
      // Om vi väljer en offertmall, uppdatera automatiskt partyType baserat på mallens typ
      if (field === 'selectedTemplate' && updated.documentType === 'offer') {
        const template = OFFER_TEMPLATES.find(t => t.id === value)
        if (template && template.category) {
          updated.partyType = template.category as 'company' | 'individual'
        }
      }
      
      // Om vi byter dokumenttyp
      if (field === 'documentType') {
        updated.selectedTemplate = ''
        
        // Sätt default-värden för offerter (används inte i offertmallar men krävs av API)
        if (value === 'offer') {
          updated.avtalslngd = updated.avtalslngd || '1'
          updated.begynnelsedag = updated.begynnelsedag || new Date().toISOString().split('T')[0]
        }
      }
      
      return updated
    })
  }

  // Steg-nummer för produkter-steget (6 för offerter, 7 för avtal)
  const productsStep = isContract ? 7 : 6
  // Steg-nummer för avtalsobjekt
  const agreementStep = isContract ? 8 : 7
  // Steg-nummer för granskning
  const reviewStep = isContract ? 9 : 8
  // BeGone Info-steget
  const begoneStep = isContract ? 5 : 4
  // Motpart-steget
  const counterpartyStep = isContract ? 6 : 5

  const nextStep = () => {
    if (currentStep < STEPS.length) {
      let nextStepNumber = currentStep + 1

      // Om vi är på steg 2 (mallval) och har valt en offertmall,
      // hoppa över steg 3 (avtalspart) eftersom den väljs automatiskt
      if (currentStep === 2 && wizardData.documentType === 'offer' && wizardData.selectedTemplate) {
        const template = OFFER_TEMPLATES.find(t => t.id === wizardData.selectedTemplate)
        if (template && template.category) {
          setWizardData(prev => ({ ...prev, partyType: template.category as 'company' | 'individual' }))
        }
        nextStepNumber = 4 // Hoppa över steg 3 (avtalspart) → direkt till BeGone Info
      }

      setCurrentStep(nextStepNumber)
      setMaxReachedStep(prev => Math.max(prev, nextStepNumber))
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      let prevStepNumber = currentStep - 1

      // Om vi kommer tillbaka från BeGone Info (steg 4 för offert) och har en offertmall vald,
      // hoppa tillbaka till steg 2 (mallval)
      if (currentStep === 4 && wizardData.documentType === 'offer' && wizardData.selectedTemplate) {
        prevStepNumber = 2
      }

      setCurrentStep(prevStepNumber)
    }
  }

  const isValidEmail = (email: string): boolean =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  const canProceed = () => {
    // Steg 1-3 är samma för alla
    if (currentStep === 1) return wizardData.documentType !== ''
    if (currentStep === 2) return wizardData.selectedTemplate !== ''
    if (currentStep === 3) return true // Partytype har default

    // Steg 4 är Kundgrupp (bara för avtal) eller BeGone Info (för offerter)
    if (isContract && currentStep === 4) return wizardData.customer_group_id !== null

    // BeGone Info
    if (currentStep === begoneStep) return !!(wizardData.anstalld && wizardData['e-post-anstlld'] && (wizardData.documentType === 'offer' || wizardData.avtalslngd))

    // Motpart
    if (currentStep === counterpartyStep) {
      if (!wizardData.Kontaktperson.trim()) return false
      if (!wizardData['e-post-kontaktperson'].trim()) return false
      if (!isValidEmail(wizardData['e-post-kontaktperson'])) return false
      if (wizardData.partyType === 'company') {
        if (!wizardData.foretag.trim()) return false
        if (!wizardData['org-nr'].trim()) return false
      }
      return true
    }

    // Produkter – om prefill finns, kräv bara att det finns tjänster.
    // Manuellt läge: kräv minst en tjänst (item_type='service') i draftItems
    if (currentStep === productsStep) {
      if (wizardData.prefillServices && wizardData.prefillServices.length > 0) return true
      return wizardData.draftItems.some(i => i.item_type === 'service')
    }
    // Avtalsobjekt
    if (currentStep === agreementStep) return wizardData.agreementText.length > 0
    // Granskning
    if (currentStep === reviewStep) return true

    return false
  }

  const getValidationHint = (): string => {
    if (isContract && currentStep === 4) {
      if (!wizardData.customer_group_id) return 'Välj en kundgrupp'
      return ''
    }
    if (currentStep === counterpartyStep) {
      if (wizardData.partyType === 'company' && !wizardData.foretag.trim())
        return 'Fyll i företagsnamn'
      if (wizardData.partyType === 'company' && !wizardData['org-nr'].trim())
        return 'Fyll i organisationsnummer'
      if (!wizardData.Kontaktperson.trim())
        return 'Fyll i kontaktperson'
      if (!wizardData['e-post-kontaktperson'].trim())
        return 'Fyll i e-postadress'
      if (!isValidEmail(wizardData['e-post-kontaktperson']))
        return 'Ange en giltig e-postadress'
      return ''
    }
    if (currentStep === productsStep) {
      if (wizardData.prefillServices && wizardData.prefillServices.length > 0) return ''
      if (!wizardData.draftItems.some(i => i.item_type === 'service')) return 'Lägg till minst en tjänst'
      return ''
    }
    return ''
  }

  // Hitta rätt mall baserat på dokumenttyp
  const availableTemplates = wizardData.documentType === 'offer' ? OFFER_TEMPLATES : CONTRACT_TEMPLATES
  const selectedTemplate = availableTemplates.find(t => t.id === wizardData.selectedTemplate)

  const handleSubmit = async () => {
    // Konvertera tjänster → SelectedProduct-format för API:et (aldrig inköpsartiklar!)
    const partyType = wizardData.partyType as CustomerType
    let convertedProducts: SelectedProduct[] = []

    if (wizardData.prefillServices && wizardData.prefillServices.length > 0) {
      // Prefill-läge: använd prefillServices direkt
      convertedProducts = convertServicesToOneflowProducts(wizardData.prefillServices, partyType)
    } else {
      // Manuellt läge: använd draftItems (filtrera bara services — interna artiklar ska ej till OneFlow)
      const services = wizardData.draftItems
        .filter(i => i.item_type === 'service')
        .map(i => ({
          service_name: i.service_name,
          service_code: i.service_code,
          description: i.notes || i.service_name || '',
          unit_price: i.unit_price,
          quantity: i.quantity,
          vat_rate: i.vat_rate,
          rot_rut_type: i.rot_rut_type,
          service: i.service,
        }))
      convertedProducts = convertServicesToOneflowProducts(services, partyType)
    }

    const LIMIT = 1024
    const part1 = wizardData.agreementText.substring(0, LIMIT)
    const part2 = wizardData.agreementText.substring(LIMIT, LIMIT * 2)

    const contractData = {
      anstalld: wizardData.anstalld,
      'e-post-anstlld': wizardData['e-post-anstlld'],
      avtalslngd: wizardData.avtalslngd,
      begynnelsedag: wizardData.begynnelsedag,
      'dokument-skapat': new Date().toISOString().split('T')[0],
      'e-post-kontaktperson': wizardData['e-post-kontaktperson'],
      // 'faktura-adress-pdf' lämnas tom så kunden kan fylla i
      foretag: wizardData.foretag,
      Kontaktperson: wizardData.Kontaktperson,
      'org-nr': wizardData['org-nr'],
      'telefonnummer-kontaktperson': wizardData['telefonnummer-kontaktperson'],
      'utforande-adress': wizardData['utforande-adress'],
      'stycke-1': part1,
      'stycke-2': part2
    }

    const recipient = {
      name: wizardData.Kontaktperson,
      email: wizardData['e-post-kontaktperson'],
      company_name: wizardData.foretag,
      organization_number: wizardData['org-nr']
    }

    setIsCreating(true)
    setCreationStep('Förbereder data...')

    // Debug: logga vilka draftItems som skickas till API:et för persistens i case_billing_items
    console.log(
      '[wizard] Skickar draftItems:',
      wizardData.draftItems.length,
      'items',
      wizardData.draftItems.map(i => ({
        type: i.item_type,
        name: i.service_name || i.article_name,
        qty: i.quantity,
        total: i.total_price,
      }))
    )

    try {
      setCreationStep('Ansluter till Oneflow...')
      const response = await fetch('/api/oneflow/create-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          templateId: wizardData.selectedTemplate, 
          contractData, 
          recipient, 
          sendForSigning: wizardData.sendForSigning, 
          partyType: wizardData.partyType,
          documentType: wizardData.documentType,
          caseId: wizardData.case_id, // Skicka case_id för webhook-koppling
          senderEmail: user?.email,
          senderName: wizardData.anstalld,
          selectedProducts: convertedProducts,
          customerGroupId: wizardData.customer_group_id,
          draftItems: wizardData.draftItems.map(i => ({
            item_type: i.item_type,
            article_id: i.article_id,
            article_code: i.article_code,
            article_name: i.article_name,
            service_id: i.service_id,
            service_code: i.service_code,
            service_name: i.service_name,
            quantity: i.quantity,
            unit_price: i.unit_price,
            discount_percent: i.discount_percent,
            discounted_price: i.discounted_price,
            total_price: i.total_price,
            vat_rate: i.vat_rate,
            price_source: i.price_source,
            notes: i.notes,
            rot_rut_type: i.rot_rut_type,
            mapped_service_id: i.mapped_service_id,
          }))
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || error.message || 'Ett okänt serverfel inträffade')
      }
      
      setCreationStep('Skapar dokument...')
      const result = await response.json()
      
      setCreationStep('Slutför...')
      setCreatedContract(result.contract)
      setShowConfetti(true)
      
      // Handle multisite recipient saving for quotes
      if (wizardData.documentType === 'offer' && wizardData.multisite_recipient && wizardData.case_id) {
        setCreationStep('Sparar mottagare...')
        try {
          const { error } = await fetch('/api/save-quote-recipient', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              quote_id: wizardData.case_id,
              recipient: wizardData.multisite_recipient,
              organization_id: wizardData.multisite_recipient.organization_id
            })
          })
          
          if (error) {
            console.warn('Could not save quote recipient:', error)
          } else {
            console.log('✅ Quote recipient saved successfully')
          }
        } catch (recipientError) {
          console.warn('Failed to save quote recipient:', recipientError)
        }
      }
      
      toast.success('✅ Kontrakt skapat framgångslikt!')
      
      // Stäng av confetti efter 5 sekunder
      setTimeout(() => setShowConfetti(false), 5000)
      
    } catch (err: any) {
      setSubmitError(err.message || 'Ett okänt fel inträffade')
      toast.error(`Fel: ${err.message}`)
    } finally {
      setIsCreating(false)
      setCreationStep('')
    }
  }

  // Snabbfyll funktioner
  const fillTestData = (type: 'company' | 'individual') => {
    if (type === 'company') {
      updateWizardData('foretag', 'Bella Vista Ristorante AB')
      updateWizardData('org-nr', '556789-0123')
      updateWizardData('Kontaktperson', 'Giuseppe Romano')
      updateWizardData('e-post-kontaktperson', 'giuseppe@bellavista.se')
      updateWizardData('telefonnummer-kontaktperson', '08-555 0123')
      updateWizardData('utforande-adress', 'Kungsgatan 25, 111 56 Stockholm')
    } else {
      updateWizardData('Kontaktperson', 'Anna Svensson')
      updateWizardData('org-nr', '19850315-1234')
      updateWizardData('e-post-kontaktperson', 'anna.svensson@email.se')
      updateWizardData('telefonnummer-kontaktperson', '070-123 45 67')
      updateWizardData('utforande-adress', 'Storgatan 15, 111 22 Stockholm')
    }
    toast.success('📝 Testdata ifylld!')
  }

  // Rendera kundgruppsteget (bara för avtal, steg 4)
  const renderCustomerGroupStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Välj Kundgrupp</h2>
        <p className="text-slate-400">Vilken kundgrupp tillhör kunden? Kundnumret tilldelas vid signering.</p>
      </div>

      {groupsLoading && (
        <div className="max-w-xl mx-auto py-8">
          <LoadingSpinner text="Laddar kundgrupper…" />
        </div>
      )}

      {!groupsLoading && groupsError && (
        <div className="max-w-xl mx-auto p-4 border border-red-500/40 bg-red-500/10 rounded-xl text-center">
          <p className="text-red-300 text-sm mb-3">Kunde inte hämta kundgrupper: {groupsError}</p>
          <Button variant="primary" onClick={loadCustomerGroups}>Försök igen</Button>
          <p className="text-xs text-slate-400 mt-2">
            Om problemet kvarstår: logga ut och in igen, eller rensa webbläsarens cache.
          </p>
        </div>
      )}

      {!groupsLoading && !groupsError && customerGroups.length === 0 && (
        <div className="max-w-xl mx-auto p-4 border border-amber-500/40 bg-amber-500/10 rounded-xl text-center">
          <p className="text-amber-200 text-sm">Inga aktiva kundgrupper hittades. Kontakta administratör.</p>
        </div>
      )}

      {!groupsLoading && !groupsError && customerGroups.length > 0 && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
        {customerGroups.map((group, index) => {
          const capacity = group.series_end - group.series_start + 1
          const used = Math.max(0, group.current_counter - group.series_start + 1)
          const remaining = capacity - used
          const isSelected = wizardData.customer_group_id === group.id

          return (
            <motion.div
              key={group.id}
              onClick={() => updateWizardData('customer_group_id', group.id)}
              className={`relative p-5 rounded-xl border-2 cursor-pointer overflow-hidden ${
                isSelected
                  ? 'border-green-500 bg-green-500/10 shadow-lg shadow-green-500/30'
                  : 'border-slate-700 bg-slate-800/50'
              }`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{
                scale: 1.02,
                boxShadow: isSelected
                  ? '0 25px 50px -12px rgba(34, 197, 94, 0.4)'
                  : '0 25px 50px -12px rgba(148, 163, 184, 0.2)',
                borderColor: isSelected ? '#22c55e' : '#64748b'
              }}
              whileTap={{ scale: 0.98 }}
            >
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">{group.name}</h3>
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                  <span className="font-mono">Serie {group.series_start}–{group.series_end}</span>
                  <span>|</span>
                  <span>{remaining} lediga</span>
                </div>
                {/* Kapacitetsbar */}
                <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${remaining < 20 ? 'bg-amber-500' : 'bg-[#20c58f]'}`}
                    style={{ width: `${Math.min(100, (used / capacity) * 100)}%` }}
                  />
                </div>
              </div>
              {isSelected && (
                <motion.div
                  className="absolute top-2 right-2"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.3, type: 'spring', bounce: 0.5 }}
                >
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </motion.div>
              )}
            </motion.div>
          )
        })}
      </div>
      )}
    </div>
  )

  const renderStepContent = () => {
    // Steg 1-3 är samma för alla
    // Steg 4 för avtal = Kundgrupp, steg 4 för offert = BeGone Info (case 4 nedan)
    // Steg 5+ hanteras med variablerna begoneStep, counterpartyStep etc.

    // Kundgruppsteg (bara vid avtal, steg 4)
    if (isContract && currentStep === 4) return renderCustomerGroupStep()

    // Mappa till logiskt steg-nummer (för offer-baserade case-satser)
    // Offer: 1,2,3,4(begone),5(motpart),6(prod),7(avtal),8(review)
    // Contract: 1,2,3,4(kundgrupp->hanterat ovan),5(begone),6(motpart),7(prod),8(avtal),9(review)
    const logicalStep = isContract && currentStep >= 5 ? currentStep - 1 : currentStep

    switch (logicalStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Typ av Dokument</h2>
              <p className="text-slate-400">Välj om du vill skicka ett offertförslag eller avtalsförslag</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
              <motion.div
                onClick={() => updateWizardData('documentType', 'offer')}
                className={`p-8 rounded-xl border-2 cursor-pointer relative overflow-hidden ${
                  wizardData.documentType === 'offer'
                    ? 'border-green-500 bg-green-500/10 shadow-lg shadow-green-500/30'
                    : 'border-slate-700 bg-slate-800/50'
                }`}
                whileHover={{ 
                  scale: 1.02, 
                  boxShadow: wizardData.documentType === 'offer' 
                    ? '0 25px 50px -12px rgba(34, 197, 94, 0.4)' 
                    : '0 25px 50px -12px rgba(148, 163, 184, 0.2)',
                  borderColor: wizardData.documentType === 'offer' ? '#22c55e' : '#64748b'
                }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.2 }}
              >
                <div className="text-center">
                  <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <DollarSign className="w-10 h-10 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">Offertförslag</h3>
                  <p className="text-slate-400 text-sm mb-4">
                    Skicka prisförslag och tjänstebeskrivning till potentiell kund
                  </p>
                  <div className="text-xs text-slate-500 space-y-1">
                    <div>• Företag (exkl moms)</div>
                    <div>• Privatperson (inkl moms)</div>
                    <div>• ROT/RUT-avdrag</div>
                  </div>
                  {wizardData.documentType === 'offer' && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.3, type: "spring", bounce: 0.5 }}
                    >
                      <CheckCircle className="w-6 h-6 text-green-500 mx-auto mt-4" />
                    </motion.div>
                  )}
                </div>
              </motion.div>

              <motion.div
                onClick={() => updateWizardData('documentType', 'contract')}
                className={`p-8 rounded-xl border-2 cursor-pointer relative overflow-hidden ${
                  wizardData.documentType === 'contract'
                    ? 'border-green-500 bg-green-500/10 shadow-lg shadow-green-500/30'
                    : 'border-slate-700 bg-slate-800/50'
                }`}
                whileHover={{ 
                  scale: 1.02, 
                  boxShadow: wizardData.documentType === 'contract' 
                    ? '0 25px 50px -12px rgba(34, 197, 94, 0.4)' 
                    : '0 25px 50px -12px rgba(148, 163, 184, 0.2)',
                  borderColor: wizardData.documentType === 'contract' ? '#22c55e' : '#64748b'
                }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.2 }}
              >
                <div className="text-center">
                  <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FileCheck className="w-10 h-10 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">Avtalsförslag</h3>
                  <p className="text-slate-400 text-sm mb-4">
                    Skapa bindande serviceavtal med kund
                  </p>
                  <div className="text-xs text-slate-500 space-y-1">
                    <div>• Skadedjursavtal</div>
                    <div>• Betesstationer</div>
                    <div>• Speciallösningar</div>
                  </div>
                  {wizardData.documentType === 'contract' && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.3, type: "spring", bounce: 0.5 }}
                    >
                      <CheckCircle className="w-6 h-6 text-green-500 mx-auto mt-4" />
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">
                Välj {wizardData.documentType === 'offer' ? 'Offertmall' : 'Avtalsmall'}
              </h2>
              <p className="text-slate-400">
                Välj vilken {wizardData.documentType === 'offer' ? 'offertmall' : 'avtalsmall'} du vill använda
              </p>
              {wizardData.selectedTemplate && (
                <div className="mt-4 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-lg inline-block">
                  <p className="text-green-400 text-sm">
                    ✓ Mall förvald från ärende: {availableTemplates.find(t => t.id === wizardData.selectedTemplate)?.name}
                  </p>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {availableTemplates.map((template, index) => (
                <motion.div
                  key={template.id}
                  onClick={() => updateWizardData('selectedTemplate', template.id)}
                  className={`relative p-6 rounded-xl border-2 cursor-pointer overflow-hidden ${
                    wizardData.selectedTemplate === template.id
                      ? 'border-green-500 bg-green-500/10 shadow-lg shadow-green-500/30'
                      : 'border-slate-700 bg-slate-800/50'
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ 
                    scale: 1.02, 
                    boxShadow: wizardData.selectedTemplate === template.id 
                      ? '0 25px 50px -12px rgba(34, 197, 94, 0.4)' 
                      : '0 25px 50px -12px rgba(148, 163, 184, 0.2)',
                    borderColor: wizardData.selectedTemplate === template.id ? '#22c55e' : '#64748b'
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  {template.popular && (
                    <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                      Populär
                    </div>
                  )}
                  
                  {wizardData.documentType === 'offer' && template.category && (
                    <div className="absolute -top-2 -left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                      {template.category === 'company' ? 'Företag' : 'Privatperson'}
                    </div>
                  )}
                  
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-white mb-2">{template.name}</h3>
                    
                    {wizardData.selectedTemplate === template.id && (
                      <motion.div 
                        className="flex items-center justify-center mt-4"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.3, type: "spring", bounce: 0.5 }}
                      >
                        <CheckCircle className="w-6 h-6 text-green-500" />
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Typ av Avtalspart</h2>
              <p className="text-slate-400">Är {wizardData.documentType === 'offer' ? 'offerten' : 'avtalet'} för ett företag eller en privatperson?</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              <div
                onClick={() => updateWizardData('partyType', 'company')}
                className={`p-8 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:scale-105 ${
                  wizardData.partyType === 'company'
                    ? 'border-green-500 bg-green-500/10 shadow-lg shadow-green-500/20'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                }`}
              >
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Building2 className="w-8 h-8 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Företag</h3>
                  <p className="text-slate-400 text-sm">Avtal med företag, organisationsnummer krävs</p>
                  {wizardData.partyType === 'company' && (
                    <CheckCircle className="w-6 h-6 text-green-500 mx-auto mt-4" />
                  )}
                </div>
              </div>

              <div
                onClick={() => updateWizardData('partyType', 'individual')}
                className={`p-8 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:scale-105 ${
                  wizardData.partyType === 'individual'
                    ? 'border-green-500 bg-green-500/10 shadow-lg shadow-green-500/20'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                }`}
              >
                <div className="text-center">
                  <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <User className="w-8 h-8 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Privatperson</h3>
                  <p className="text-slate-400 text-sm">Avtal med privatperson, personnummer kan användas</p>
                  {wizardData.partyType === 'individual' && (
                    <CheckCircle className="w-6 h-6 text-green-500 mx-auto mt-4" />
                  )}
                </div>
              </div>
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6 max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-white mb-2 flex items-center justify-center gap-2">
                <Building2 className="w-6 h-6 text-blue-400" />
                BeGone Information
              </h3>
              <p className="text-slate-400">Uppgifter om ansvarig person från BeGone</p>
            </div>
            
            <Card className="p-6">
              <div className="space-y-6">
                {/* 🆕 VISA AKTUELL ANVÄNDARES INFO */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-blue-400 text-sm mb-2">
                    <User className="w-4 h-4" />
                    <span>Inloggad som: {user?.email}</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Avtalet kommer att skickas från info@begone.se med ditt namn som ansvarig.
                  </p>
                </div>
                
                <div className="border-t border-slate-700"></div>
                
                <div className="space-y-4">
                  <Input
                  label="Ansvarig från BeGone *"
                  value={wizardData.anstalld}
                  onChange={e => updateWizardData('anstalld', e.target.value)}
                  icon={<User className="w-4 h-4" />}
                  placeholder="Förnamn Efternamn"
                />
                
                <Input
                  label="E-post ansvarig *"
                  type="email"
                  value={wizardData['e-post-anstlld']}
                  onChange={e => updateWizardData('e-post-anstlld', e.target.value)}
                  icon={<Mail className="w-4 h-4" />}
                  placeholder="namn@begone.se"
                />
                
                {/* Visa endast avtalslängd och startdatum för avtal, inte för offerter */}
                {wizardData.documentType === 'contract' && (
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Avtalslängd (år) *"
                      type="number"
                      min="1"
                      max="10"
                      value={wizardData.avtalslngd}
                      onChange={e => updateWizardData('avtalslngd', e.target.value)}
                      icon={<Calendar className="w-4 h-4" />}
                    />
                    
                    <Input
                      label="Startdatum *"
                      type="date"
                      value={wizardData.begynnelsedag}
                      onChange={e => updateWizardData('begynnelsedag', e.target.value)}
                      icon={<Calendar className="w-4 h-4" />}
                    />
                  </div>
                )}
                </div>
              </div>
            </Card>
          </div>
        )

      case 5:
        return (
          <div className="space-y-6 max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-white mb-2 flex items-center justify-center gap-2">
                <User className="w-6 h-6 text-green-400" />
                {wizardData.partyType === 'company' ? 'Företagsinformation' : 'Personuppgifter'}
              </h3>
              <p className="text-slate-400">
                Uppgifter om {wizardData.partyType === 'company' ? 'företaget' : 'personen'} som ska {wizardData.documentType === 'offer' ? 'få offerten' : 'teckna avtalet'}
              </p>
            </div>
            
            <Card className="p-6">
              <div className="space-y-6">
                {wizardData.partyType === 'company' && (
                  <>
                    <Input
                      label="Företagsnamn *"
                      value={wizardData.foretag}
                      onChange={e => updateWizardData('foretag', e.target.value)}
                      icon={<Building2 className="w-4 h-4" />}
                      placeholder="AB Företagsnamn"
                    />
                    
                    <Input
                      label="Organisationsnummer"
                      value={wizardData['org-nr']}
                      onChange={e => updateWizardData('org-nr', e.target.value)}
                      icon={<Hash className="w-4 h-4" />}
                      placeholder="556123-4567"
                    />
                  </>
                )}
                
                {wizardData.partyType === 'company' && (
                  <div className="border-t border-slate-700"></div>
                )}
                
                {wizardData.partyType === 'individual' && (
                  <>
                    <Input
                      label="Personnummer"
                      value={wizardData['org-nr']}
                      onChange={e => updateWizardData('org-nr', e.target.value)}
                      icon={<Hash className="w-4 h-4" />}
                      placeholder="YYYYMMDD-XXXX"
                    />
                    <div className="border-t border-slate-700"></div>
                  </>
                )}
                
                <div className="space-y-4">
                  <Input
                    label={wizardData.partyType === 'company' ? 'Kontaktperson *' : 'Namn *'}
                  value={wizardData.Kontaktperson}
                  onChange={e => updateWizardData('Kontaktperson', e.target.value)}
                  icon={<User className="w-4 h-4" />}
                  placeholder="Förnamn Efternamn"
                />
                
                <Input
                  label="E-post *"
                  type="email"
                  value={wizardData['e-post-kontaktperson']}
                  onChange={e => updateWizardData('e-post-kontaktperson', e.target.value)}
                  icon={<Mail className="w-4 h-4" />}
                  placeholder="kontakt@exempel.se"
                  error={
                    wizardData['e-post-kontaktperson'] && !isValidEmail(wizardData['e-post-kontaktperson'])
                      ? 'Ogiltig e-postadress'
                      : undefined
                  }
                />
                
                <Input
                  label="Telefon"
                  type="tel"
                  value={wizardData['telefonnummer-kontaktperson']}
                  onChange={e => updateWizardData('telefonnummer-kontaktperson', e.target.value)}
                  icon={<Phone className="w-4 h-4" />}
                  placeholder="08-555 0123"
                />
                
                <Input
                  label="Adress"
                  value={wizardData['utforande-adress']}
                  onChange={e => updateWizardData('utforande-adress', e.target.value)}
                  icon={<MapPin className="w-4 h-4" />}
                  placeholder="Gatuadress, Postnummer Stad"
                />
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-slate-700">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fillTestData(wizardData.partyType)}
                  className="w-full"
                >
                  ⚡ Fyll i testdata
                </Button>
              </div>
            </Card>
          </div>
        )

      case 6: {
        const hasPrefill = wizardData.prefillServices && wizardData.prefillServices.length > 0
        const fmtSEK = (n: number) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
        return (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-white mb-2 flex items-center justify-center gap-2">
                <ShoppingCart className="w-6 h-6 text-green-400" />
                Produkter
              </h3>
              <p className="text-slate-400">
                {hasPrefill
                  ? 'Tjänster och interna kostnader från ärendet'
                  : `Välj prislista och artiklar som ska ingå i ${wizardData.documentType === 'offer' ? 'offerten' : 'avtalet'}`}
              </p>
            </div>

            {hasPrefill ? (
              <div className="space-y-3">
                {/* Faktureringstjänster */}
                <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                  <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">
                    Faktureringstjänster (ingår i offerten)
                  </p>
                  {wizardData.prefillServices!.map(s => (
                    <div key={s.id} className="flex justify-between items-center py-1.5 border-b border-slate-700/30 last:border-0">
                      <span className="text-sm text-white">
                        {s.service_code && <span className="text-xs text-slate-400 mr-1">{s.service_code}</span>}
                        {s.service_name}
                        {s.quantity > 1 && <span className="text-xs text-slate-500 ml-1">×{s.quantity}</span>}
                      </span>
                      <span className="text-sm font-semibold text-[#20c58f] whitespace-nowrap ml-4">
                        {fmtSEK(s.total_price)}
                      </span>
                    </div>
                  ))}
                  {/* Totalsumma tjänster */}
                  <div className="flex justify-between items-center pt-2 mt-1">
                    <span className="text-xs text-slate-400">Totalt exkl. moms</span>
                    <span className="text-sm font-bold text-white">
                      {fmtSEK(wizardData.prefillServices!.reduce((s, i) => s + i.total_price, 0))}
                    </span>
                  </div>
                </div>

                {/* Interna kostnadsartiklar (stöd för teknikern) */}
                {wizardData.selectedArticles.length > 0 && (
                  <div className="p-3 bg-slate-800/10 border border-slate-700/40 rounded-xl">
                    <div className="flex items-center gap-1.5 mb-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Interna kostnader
                      </p>
                      <span className="text-xs text-slate-600">(ingår ej i offerten)</span>
                    </div>
                    {wizardData.selectedArticles.map(item => (
                      <div key={item.article.id} className="py-1.5 border-b border-slate-700/20 last:border-0">
                        <div className="flex justify-between items-start">
                          <span className="text-sm text-slate-400">
                            {item.article.code && <span className="text-xs text-slate-600 mr-1">{item.article.code}</span>}
                            {item.article.name}
                            {item.quantity > 1 && <span className="text-xs text-slate-600 ml-1">×{item.quantity}</span>}
                          </span>
                          <span className="text-sm text-slate-500 whitespace-nowrap ml-4 shrink-0">
                            {fmtSEK(item.effectivePrice * item.quantity)}
                          </span>
                        </div>
                        {item.article.description && (
                          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                            {item.article.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="max-w-5xl mx-auto">
                <CaseServiceSelector
                  draftMode
                  caseType={wizardData.partyType === 'company' ? 'business' : 'private'}
                  customerId={null}
                  primaryServiceId={null}
                  initialDraftItems={wizardData.draftItems}
                  initialPriceAssignments={wizardData.draftPriceAssignments}
                  initialPriceMarkups={wizardData.draftPriceMarkups}
                  onChange={(items, _summary, meta) => {
                    setWizardData(prev => ({
                      ...prev,
                      draftItems: items,
                      draftPriceAssignments: meta?.priceAssignments ?? prev.draftPriceAssignments,
                      draftPriceMarkups: meta?.priceMarkups ?? prev.draftPriceMarkups,
                    }))
                  }}
                />
              </div>
            )}
          </div>
        )
      }

      case 7:
        return (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-white mb-2 flex items-center justify-center gap-2">
                <FileText className="w-6 h-6 text-blue-400" />
                {wizardData.documentType === 'offer' ? 'Offertinnehåll' : 'Avtalsobjekt'}
              </h3>
              <p className="text-slate-400">
                Beskriv vad som ska ingå i {wizardData.documentType === 'offer' ? 'offerten' : 'avtalet'}
              </p>
            </div>
            
            <Card className="p-6">
              <div className="space-y-4">
                <Input
                  as="textarea"
                  rows={10}
                  label={wizardData.documentType === 'offer' ? 'Offertens innehåll och omfattning *' : 'Avtalets innehåll och omfattning *'}
                  value={wizardData.agreementText}
                  onChange={(e) => updateWizardData('agreementText', e.target.value)}
                  placeholder={wizardData.documentType === 'offer' 
                    ? "Beskriv offertens omfattning och föreslagna tjänster i detalj. Inkludera vad som ingår, frekvens, priser och andra viktiga detaljer..."
                    : "Beskriv avtalets omfattning och villkor i detalj. Inkludera vad som ingår i servicen, frekvens av besök, rapportering, och andra viktiga villkor..."
                  }
                  helperText="Detaljerad beskrivning hjälper kunden att förstå vad som ingår i tjänsten"
                  icon={<FileText className="w-4 h-4" />}
                  required
                />
                <div className="flex items-center justify-between text-sm">
                  <span className={`${wizardData.agreementText.length > 2048 ? 'text-red-500' : 'text-slate-400'}`}>
                    {wizardData.agreementText.length} / 2048 tecken
                  </span>
                  {wizardData.agreementText.length > 1024 && (
                    <span className="text-yellow-500 flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      Texten delas automatiskt i stycken
                    </span>
                  )}
                </div>
                
                {(() => {
                  const hasPrefill = wizardData.prefillServices && wizardData.prefillServices.length > 0
                  const serviceDraftItems = wizardData.draftItems.filter(i => i.item_type === 'service')
                  const articleDraftItems = wizardData.draftItems.filter(i => i.item_type === 'article')
                  const canGenerate = hasPrefill || serviceDraftItems.length > 0
                  if (!canGenerate) return null
                  return (
                    <div className="pt-4 border-t border-slate-700">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const lines: string[] = []
                          if (hasPrefill) {
                            wizardData.prefillServices!.forEach(s => {
                              const qty = s.quantity > 1 ? ` (${s.quantity} st)` : ''
                              lines.push(`- ${s.service_name ?? 'Tjänst'}${qty}`)
                              // Artiklar mappade mot denna tjänsterad
                              const mappedArticles = wizardData.selectedArticles.filter(
                                a => a.mapped_service_id === s.id
                              )
                              mappedArticles.forEach(a => {
                                const aQty = a.quantity > 1 ? ` (${a.quantity} st)` : ''
                                const desc = a.article.description ? ` – ${a.article.description}` : ''
                                lines.push(`   • ${a.article.name}${aQty}${desc}`)
                              })
                            })
                          } else {
                            serviceDraftItems.forEach(svc => {
                              const qty = svc.quantity > 1 ? ` (${svc.quantity} st)` : ''
                              const extra = svc.notes ? ` - ${svc.notes}` : ''
                              lines.push(`- ${svc.service_name ?? 'Tjänst'}${qty}${extra}`)
                              // Artiklar mappade mot denna tjänst via priceAssignments eller mapped_service_id
                              const mapped = articleDraftItems.filter(a => {
                                const assigned = wizardData.draftPriceAssignments[a.id] ?? a.mapped_service_id
                                return assigned === svc.id
                              })
                              mapped.forEach(a => {
                                const aQty = a.quantity > 1 ? ` (${a.quantity} st)` : ''
                                const desc = a.article?.description ? ` – ${a.article.description}` : ''
                                lines.push(`   • ${a.article_name}${aQty}${desc}`)
                              })
                            })
                          }
                          const generatedText = `Tjänster som ingår:\n\n${lines.join('\n')}`
                          updateWizardData('agreementText', generatedText)
                          toast.success('Beskrivning genererad från valda tjänster!')
                        }}
                        className="w-full"
                      >
                        ⚡ Generera beskrivning från valda tjänster
                      </Button>
                    </div>
                  )
                })()}
              </div>
            </Card>
          </div>
        )

      case 8:
        return (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-white mb-2 flex items-center justify-center gap-2">
                <CheckCircle className="w-6 h-6 text-green-400" />
                Granska & Skicka
              </h3>
              <p className="text-slate-400">
                Kontrollera att allt ser korrekt ut innan du skapar {wizardData.documentType === 'offer' ? 'offerten' : 'avtalet'}
              </p>
            </div>
            
            {/* 🆕 VISA AVSÄNDARINFO */}
            <Card className="p-6 bg-green-500/10 border-green-500/20">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <User className="w-5 h-5" />
                Avsändare
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Namn:</span>
                  <span className="text-white">{wizardData.anstalld}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Avsändare:</span>
                  <span className="text-white">info@begone.se</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">OneFlow-konto:</span>
                  <span className="text-green-400">✓ Centraliserat</span>
                </div>
              </div>
            </Card>

            {/* Sammanfattning */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  {wizardData.documentType === 'offer' ? 'Offert & Mall' : 'Avtal & Mall'}
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Mall:</span>
                    <span className="text-white">{selectedTemplate?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Typ:</span>
                    <span className="text-white">
                      {wizardData.partyType === 'company' ? 'Företag' : 'Privatperson'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Längd:</span>
                    <span className="text-white">{wizardData.avtalslngd} år</span>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Motpart
                </h3>
                <div className="space-y-2 text-sm">
                  {wizardData.partyType === 'company' && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Företag:</span>
                      <span className="text-white">{wizardData.foretag || '-'}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-400">Kontakt:</span>
                    <span className="text-white">{wizardData.Kontaktperson}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">E-post:</span>
                    <span className="text-white">{wizardData['e-post-kontaktperson']}</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Tjänster & Priser (inkl. mappade artiklar + marginal) */}
            {(() => {
              const fmtSEK = (n: number) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
              const hasPrefill = wizardData.prefillServices && wizardData.prefillServices.length > 0
              const draftServices = wizardData.draftItems.filter(i => i.item_type === 'service')
              const draftArticles = wizardData.draftItems.filter(i => i.item_type === 'article')
              const hasContent = hasPrefill || draftServices.length > 0
              if (!hasContent) return null

              let serviceTotal = 0
              let articleCost = 0
              let rows: React.ReactNode[] = []

              if (hasPrefill) {
                serviceTotal = wizardData.prefillServices!.reduce((s, i) => s + i.total_price, 0)
                articleCost = wizardData.selectedArticles.reduce((s, a) => s + a.effectivePrice * a.quantity, 0)
                rows = wizardData.prefillServices!.map(s => {
                  const mapped = wizardData.selectedArticles.filter(a => a.mapped_service_id === s.id)
                  return (
                    <div key={s.id} className="flex justify-between items-start py-2 border-b border-slate-700/30 last:border-0">
                      <div className="flex-1">
                        <div className="text-sm text-white">
                          {s.service_name ?? 'Tjänst'} {s.quantity > 1 && <span className="text-slate-500">× {s.quantity}</span>}
                        </div>
                        {mapped.map(a => (
                          <div key={a.article.id} className="text-xs text-slate-500 ml-4 mt-0.5">
                            • {a.article.name} {a.quantity > 1 && `× ${a.quantity}`}
                          </div>
                        ))}
                      </div>
                      <div className="text-sm font-semibold text-[#20c58f] whitespace-nowrap ml-4">
                        {fmtSEK(s.total_price)}
                      </div>
                    </div>
                  )
                })
              } else {
                serviceTotal = draftServices.reduce((s, i) => s + i.total_price, 0)
                articleCost = draftArticles.reduce((s, i) => s + i.total_price, 0)
                rows = draftServices.map(svc => {
                  const mapped = draftArticles.filter(a => {
                    const assigned = wizardData.draftPriceAssignments[a.id] ?? a.mapped_service_id
                    return assigned === svc.id
                  })
                  return (
                    <div key={svc.id} className="flex justify-between items-start py-2 border-b border-slate-700/30 last:border-0">
                      <div className="flex-1">
                        <div className="text-sm text-white">
                          {svc.service_name ?? 'Tjänst'} {svc.quantity > 1 && <span className="text-slate-500">× {svc.quantity}</span>}
                        </div>
                        {mapped.map(a => (
                          <div key={a.id} className="text-xs text-slate-500 ml-4 mt-0.5">
                            • {a.article_name} {a.quantity > 1 && `× ${a.quantity}`}
                          </div>
                        ))}
                      </div>
                      <div className="text-sm font-semibold text-[#20c58f] whitespace-nowrap ml-4">
                        {fmtSEK(svc.total_price)}
                      </div>
                    </div>
                  )
                })
              }

              const marginAmount = serviceTotal - articleCost
              const marginPercent = serviceTotal > 0 ? (marginAmount / serviceTotal) * 100 : 0
              const marginColor = marginPercent >= 35 ? 'text-emerald-400' : marginPercent >= 20 ? 'text-yellow-400' : 'text-red-400'

              return (
                <Card className="p-6 mb-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Tjänster & Priser
                  </h3>
                  <div>{rows}</div>
                  <div className="flex justify-between pt-3 mt-2 border-t border-slate-700">
                    <span className="text-sm text-slate-400">Totalt exkl moms</span>
                    <span className="text-sm font-bold text-white">{fmtSEK(serviceTotal)}</span>
                  </div>
                  {articleCost > 0 && (
                    <>
                      <div className="flex justify-between mt-2">
                        <span className="text-xs text-slate-500">Intern inköpskostnad</span>
                        <span className="text-xs text-slate-400">{fmtSEK(articleCost)}</span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-xs text-slate-500">Marginal (intern)</span>
                        <span className={`text-xs font-semibold ${marginColor}`}>
                          {marginPercent.toFixed(1)}% ({fmtSEK(marginAmount)})
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-2 italic">
                        Marginalen visas bara internt och skickas inte till kund.
                      </p>
                    </>
                  )}
                </Card>
              )
            })()}

            {/* Avtalsobjekt-förhandsvisning */}
            {wizardData.agreementText && (
              <Card className="p-6 mb-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  {wizardData.documentType === 'offer' ? 'Offertinnehåll (det kunden ser)' : 'Avtalsobjekt (det kunden ser)'}
                </h3>
                <pre className="whitespace-pre-wrap text-sm text-slate-300 font-sans bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                  {wizardData.agreementText}
                </pre>
              </Card>
            )}

            {/* Signering */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Send className="w-5 h-5" />
                Signering & Skicka
              </h3>
              
              <label className="flex items-center space-x-3 text-white cursor-pointer p-4 rounded-lg border border-slate-700 hover:bg-slate-800/30 transition-colors">
                <input 
                  type="checkbox" 
                  checked={wizardData.sendForSigning} 
                  onChange={e => updateWizardData('sendForSigning', e.target.checked)} 
                  className="rounded border-slate-600 text-green-500 focus:ring-green-500" 
                /> 
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  <span>Skicka för signering direkt</span>
                </div>
              </label>
              
              <p className="text-sm text-slate-400 mt-3 px-4">
                {wizardData.sendForSigning 
                  ? `📧 ${wizardData.documentType === 'offer' ? 'Offerten' : 'Kontraktet'} publiceras och skickas från info@begone.se till motparten för ${wizardData.documentType === 'offer' ? 'granskning' : 'signering'}` 
                  : `📝 ${wizardData.documentType === 'offer' ? 'Offerten' : 'Kontraktet'} skapas som utkast i Oneflow och kan skickas senare`
                }
              </p>
            </Card>

            {/* Skapa kontrakt */}
            <div className="text-center">
              <Button
                onClick={() => {
                  setSubmitError(null)
                  setShowSubmitConfirm(true)
                }}
                disabled={isCreating}
                className="px-8 py-3 text-lg"
                size="lg"
              >
                {isCreating ? (
                  <motion.div 
                    className="flex items-center gap-2"
                    initial={{ opacity: 1 }}
                    animate={{ opacity: [1, 0.7, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <LoadingSpinner size="sm" />
                    {creationStep || 'Skapar kontrakt...'}
                  </motion.div>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    {wizardData.sendForSigning 
                      ? `Skapa & Skicka ${wizardData.documentType === 'offer' ? 'Offert' : 'Avtal'}` 
                      : 'Skapa Utkast'
                    }
                  </>
                )}
              </Button>
            </div>

            {/* Bekräftelsedialog */}
            {showSubmitConfirm && !isCreating && !createdContract && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={() => setShowSubmitConfirm(false)}>
                <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4"
                  onClick={e => e.stopPropagation()}>
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Send className="w-5 h-5 text-green-400" />
                    Bekräfta
                  </h3>
                  <p className="text-slate-300">
                    Du är på väg att {wizardData.sendForSigning ? 'skicka' : 'spara'}{' '}
                    {wizardData.documentType === 'offer' ? 'offerten' : 'avtalet'} till{' '}
                    <span className="text-white font-medium">{wizardData.Kontaktperson}</span>.
                  </p>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setShowSubmitConfirm(false)}>
                      Avbryt
                    </Button>
                    <Button size="sm" onClick={() => { setShowSubmitConfirm(false); handleSubmit() }}>
                      <CheckCircle className="w-4 h-4 mr-1" />
                      {wizardData.sendForSigning ? 'Skapa & Skicka' : 'Skapa Utkast'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Retry vid fel */}
            {submitError && !isCreating && !createdContract && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-center">
                <p className="text-red-400 text-sm mb-3">{submitError}</p>
                <Button size="sm" onClick={() => { setSubmitError(null); handleSubmit() }}>
                  Försök igen
                </Button>
              </div>
            )}

            {/* Resultat */}
            {createdContract && (
              <Card className="p-6 bg-green-500/10 border-green-500/20">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                  <CheckCircle className="w-5 h-5 text-green-400" /> 
                  {wizardData.documentType === 'offer' ? 'Offert skapad!' : 'Kontrakt skapat!'}
                </h3>
                <div className="grid gap-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{wizardData.documentType === 'offer' ? 'Offert-ID:' : 'Kontrakt-ID:'}</span>
                    <span className="font-mono text-green-400 bg-green-500/10 px-3 py-1 rounded">
                      #{createdContract.id}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Status:</span>
                    <span className={`px-3 py-1 rounded text-sm font-medium ${
                      createdContract.state === 'published' 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {createdContract.state === 'published' 
                        ? `📧 Skickat för ${wizardData.documentType === 'offer' ? 'granskning' : 'signering'}` 
                        : '📝 Utkast'
                      }
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-3 mt-6">
                  {createdContract.url && (
                    <Button 
                      onClick={() => window.open(createdContract.url, '_blank')} 
                      className="flex-1 flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" /> 
                      Öppna i Oneflow
                    </Button>
                  )}
                  
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setCreatedContract(null)
                      setCurrentStep(1)
                      setWizardData({
                        documentType: 'contract',
                        selectedTemplate: '',
                        partyType: 'company',
                        anstalld: profile?.technicians?.name || profile?.display_name || user?.user_metadata?.full_name || 'BeGone Medarbetare',
                        'e-post-anstlld': user?.email || '',
                        avtalslngd: '1',
                        begynnelsedag: new Date().toISOString().split('T')[0],
                        Kontaktperson: '',
                        'e-post-kontaktperson': '',
                        'telefonnummer-kontaktperson': '',
                        'utforande-adress': '',
                        foretag: '',
                        'org-nr': '',
                        selectedPriceListId: null,
                        selectedArticles: [],
                        deductionType: null,
                        customTotalPrice: null,
                        selectedProducts: [],
                        draftItems: [],
                        draftPriceAssignments: {},
                        draftPriceMarkups: {},
                        agreementText: 'Regelbunden kontroll och bekämpning av skadedjur enligt överenskommet schema. Detta inkluderar inspektion av samtliga betesstationer, påfyllning av bete vid behov, samt dokumentation av aktivitet. Vid tecken på gnagaraktivitet vidtas omedelbara åtgärder med förstärkta insatser.',
                        sendForSigning: true,
                        customer_group_id: null
                      })
                    }}
                    className="px-6"
                  >
                    Skapa nytt dokument
                  </Button>
                </div>
              </Card>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Success Confetti */}
      {showConfetti && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}  
          recycle={false}
          numberOfPieces={200}
          gravity={0.3}
        />
      )}
      {/* Header */}
      <header className="bg-slate-900/50 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (hasUnsavedProgress()) {
                  if (!window.confirm('Du har osparade ändringar. Vill du lämna sidan?')) return
                }
                navigate(getDashboardRoute())
              }}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Tillbaka
            </Button>
            <div className="flex items-center gap-3">
              <div className="bg-green-500/10 p-2 rounded-lg">
                <FileText className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Skapa Oneflow Dokument</h1>
                <p className="text-sm text-slate-400">Steg-för-steg guide för att skapa offert- eller avtalsförslag</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Enhanced Progress Steps */}
      <AnimatedProgressBar
        steps={STEPS}
        currentStep={currentStep}
        onStepClick={setCurrentStep}
        maxReachedStep={maxReachedStep}
        documentType={wizardData.documentType}
        selectedTemplate={wizardData.selectedTemplate}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="min-h-[600px] overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{
                duration: 0.4,
                ease: "easeInOut"
              }}
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation Buttons */}
        {!createdContract && (
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-800">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Föregående
            </Button>

            <div className="text-center">
              <p className="text-sm text-slate-400">
                Steg {currentStep} av {STEPS.length}
              </p>
              {!canProceed() && getValidationHint() && (
                <p className="text-xs text-amber-400 mt-1">{getValidationHint()}</p>
              )}
            </div>

            {currentStep < STEPS.length && (
              <Button
                onClick={nextStep}
                disabled={!canProceed()}
                className="flex items-center gap-2"
              >
                Nästa
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}

            {currentStep === STEPS.length && (
              <div className="w-20" /> // Placeholder för symmetri
            )}
          </div>
        )}
      </main>
    </div>
  )
}