// 📁 src/pages/admin/oneflow/OneflowContractCreator.tsx
// Avtalswizarden: steg för steg till ett avtal eller en offert i Oneflow.
//
// Flödet sedan 3.40.0: formulärstegen → Granska (avtalet som papper + kontrollista)
// → dokumentet skapas som UTKAST i Oneflow → Oneflows egen PDF visas här → skicka,
// ändra (utkastet tas bort och ett nytt skapas) eller spara som utkast.
// Inget skickas till kunden förrän PDF:en är godkänd.

import { formatPayback, marginTone, summarizeBillingLines, toneTextClass, type MarginLine } from '../../shared/marginEngine'
import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, Building2, Check, Clock, ExternalLink, FileText, Info, Loader2, Lock,
  Mail, MapPin, Phone, Sparkles, User,
} from 'lucide-react'
// Rubrikfonten (självhostad via npm, laddas bara när en rubrik använder den)
import '@fontsource-variable/fraunces/opsz.css'
import {
  IKON_TON, DokumentAvtalIkon, DokumentOffertIkon, ForetagIkon, PrivatpersonIkon,
  ikonForKundgrupp, ikonForMall,
} from '../../components/shared/avtalsIkoner'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext' // 🆕 HÄMTA ANVÄNDARINFO
import { apiFetch } from '../../lib/api'
import DateField from '../../components/ui/DateField'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import CaseServiceSelector from '../../components/shared/CaseServiceSelector'
import OneflowPdfFrame from '../../components/shared/OneflowPdfFrame'
import AnimatedProgressBar from '../../components/ui/AnimatedProgressBar'
import { SelectedProduct, CustomerType, SelectedArticleItem } from '../../types/products'
import { convertServicesToOneflowProducts } from '../../utils/articlePricingCalculator'
import { mapBillingItemsToPrefillServices, mapBillingItemsToSelectedArticles } from '../../utils/billingPrefill'
import type { CaseBillingItemWithRelations } from '../../types/caseBilling'
import { OFFER_TEMPLATES, CONTRACT_TEMPLATES, type OneflowTemplate } from '../../constants/oneflowTemplates'
import { OneflowTemplateService } from '../../services/oneflowTemplateService'
import { OneflowDraftService } from '../../services/oneflowDraftService'
import { WebInquiryService } from '../../services/webInquiryService'
import { CustomerGroupService } from '../../services/customerGroupService'
import { CustomerGroup } from '../../types/customerGroups'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { formatContractLength, type ContractLengthUnit } from '../../utils/contractLength'
import {
  formatAdress, formatEpost, formatForetagsnamn, formatIdNummer, formatPersonnamn, formatTelefon,
} from '../../shared/kontaktFormat'
import {
  AVTALSOBJEKT_MAX_TECKEN, harStopp, kontrolleraAvtal, type KontrollAvsnitt, type KontrollNiva,
} from '../../shared/avtalsKontroll'

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
  /** Enheten till avtalslngd. Skickas till Oneflow som "2 år" / "6 månader". */
  avtalslangdEnhet: ContractLengthUnit
  begynnelsedag: string
  /** Uppsägningstid i månader. Portalens data — skickas INTE till Oneflow.
   *  Styr bevakning av sista uppsägningsdag på kundsidan. */
  noticePeriodMonths: string
  /** Faktureringsintervall. Portalens data — skickas INTE till Oneflow.
   *  Styr avtalsfaktureringens perioder. */
  billingFrequency: string
  /** Sätts när wizarden öppnats via "Förnya avtal" på ett avslutat avtal.
   *  Bär id:t på avtalet som förnyas, så det nya kan kopplas till det gamla.
   *  Det gamla avtalet rörs aldrig — en förnyelse är en NY period. */
  renewalOfContractId?: string

  // Steg 5 - Motpart
  Kontaktperson: string
  'e-post-kontaktperson': string
  'telefonnummer-kontaktperson': string
  'utforande-adress': string
  foretag: string
  'org-nr': string
  /** Valfri. Skickas som 'faktura-adress-pdf' (avtal) eller 'epost-faktura' (offert).
   *  Tomt fält: avtalet lämnar det åt kunden, offerten använder kontaktpersonens e-post. */
  'e-post-faktura': string

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
    fastighetsbeteckning?: string | null
    service?: {
      rot_rate_percent?: number | null
      rut_rate_percent?: number | null
      rot_eligible?: boolean
      rut_eligible?: boolean
    } | null
  }>

  // Steg 7 - Avtalsobjekt
  agreementText: string

  // Case linking
  case_id?: string
  /** Ärendetyp för case_billing_items-uppslag (avtalsärenden lagrar rader med case_type='contract') */
  case_type?: 'private' | 'business' | 'contract'

  // Kundgrupp (bara vid avtal)
  customer_group_id: string | null

  /** Leads (Webb): förfrågan som offerten skapas från. Kopplas när offerten faktiskt skickats. */
  web_inquiry_id?: string
  /** Leads (Webb): sidan guiden går tillbaka till efter en skickad offert. */
  returnPath?: string
  /** Leads etapp 5: leaden som offerten eller avtalet skapas från (contracts.source_type 'lead'). */
  lead_id?: string
}

const DEFAULT_AGREEMENT_TEXT = 'Regelbunden kontroll och bekämpning av skadedjur enligt överenskommet schema. Detta inkluderar inspektion av samtliga betesstationer, påfyllning av bete vid behov, samt dokumentation av aktivitet. Vid tecken på gnagaraktivitet vidtas omedelbara åtgärder med förstärkta insatser.'

// Kontaktfälten snyggas till när de lämnas och igen innan avtalet skapas:
// namn med stor bokstav, telefon som "070-123 45 67", adress som "Gata 1, 111 22 Ort".
type KontaktFalt = 'foretag' | 'org-nr' | 'Kontaktperson' | 'e-post-kontaktperson'
  | 'telefonnummer-kontaktperson' | 'utforande-adress' | 'anstalld' | 'e-post-anstlld' | 'e-post-faktura'

const KONTAKT_FORMAT: Record<KontaktFalt, (s: string) => string> = {
  foretag: formatForetagsnamn,
  'org-nr': formatIdNummer,
  Kontaktperson: formatPersonnamn,
  'e-post-kontaktperson': formatEpost,
  'telefonnummer-kontaktperson': formatTelefon,
  'utforande-adress': formatAdress,
  anstalld: formatPersonnamn,
  'e-post-anstlld': formatEpost,
  'e-post-faktura': formatEpost,
}

function snyggaTillKontakt<T extends Record<KontaktFalt, string>>(d: T): T {
  const ut = { ...d }
  for (const falt of Object.keys(KONTAKT_FORMAT) as KontaktFalt[]) {
    ut[falt] = KONTAKT_FORMAT[falt](d[falt] ?? '') as T[KontaktFalt]
  }
  return ut
}

const OFFER_STEPS = [
  { id: 1, title: 'Dokument' },
  { id: 2, title: 'Mall' },
  { id: 3, title: 'Avtalspart' },
  { id: 4, title: 'BeGone' },
  { id: 5, title: 'Motpart' },
  { id: 6, title: 'Tjänster' },
  { id: 7, title: 'Offertinnehåll' },
  { id: 8, title: 'Granska' }
]

const CONTRACT_STEPS = [
  { id: 1, title: 'Dokument' },
  { id: 2, title: 'Mall' },
  { id: 3, title: 'Avtalspart' },
  { id: 4, title: 'Kundgrupp' },
  { id: 5, title: 'BeGone' },
  { id: 6, title: 'Motpart' },
  { id: 7, title: 'Tjänster' },
  { id: 8, title: 'Avtalsobjekt' },
  { id: 9, title: 'Granska' }
]

const BILLING_FREQUENCY_LABEL: Record<string, string> = {
  annual: 'Årsvis',
  semi_annual: 'Halvårsvis',
  quarterly: 'Kvartalsvis',
  monthly: 'Månadsvis',
}

const noticeLabel = (months: string) =>
  months === '0' ? 'Ingen' : months === '1' ? '1 månad' : `${months} månader`

const fmtSEK = (n: number) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

// --- Gemensamma klasser (slate-skalan mappas om i ljust tema) ----------------
// Neutrala ytor/text/kanter med slate så att båda temana fungerar. Det mörka
// bandet överst är mörkt i båda temana och använder därför hex-färger.
const RUBRIK_FONT = "font-['Fraunces_Variable',Georgia,serif] font-semibold"
const SKUGGA = 'shadow-[0_1px_2px_rgba(15,31,46,0.04),0_10px_28px_rgba(15,31,46,0.06)]'
const FIELD_CLASS = 'w-full min-h-[48px] px-3.5 bg-slate-800/60 border border-slate-600 rounded-[10px] text-[15px] text-white placeholder-slate-500 transition-shadow focus:outline-none focus:border-[#20c58f] focus:ring-4 focus:ring-[#20c58f]/15'
const LABEL_CLASS = 'flex flex-col gap-[7px] text-[13px] font-bold text-slate-300'
const CARD_CLASS = `bg-slate-900 border border-slate-700 rounded-2xl ${SKUGGA}`
const PRIMARY_BUTTON = 'min-h-[46px] px-[22px] rounded-[10px] bg-[#20c58f] hover:bg-[#1aaa7a] text-[#052e22] text-[15px] font-bold shadow-[0_6px_16px_rgba(32,197,143,0.35)] transition-colors disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed'
const PRIMARY_BUTTON_STOR = 'min-h-[48px] px-[22px] rounded-[10px] bg-[#20c58f] hover:bg-[#1aaa7a] text-[#052e22] text-base font-bold shadow-[0_6px_16px_rgba(32,197,143,0.35)] transition-colors disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed'
const OUTLINE_BUTTON ='min-h-[46px] px-[18px] rounded-[10px] border border-slate-600 bg-slate-900 hover:bg-slate-800 text-white text-[15px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
const SECONDARY_TONED_BUTTON = 'min-h-[44px] inline-flex items-center gap-2 px-3.5 rounded-[10px] border border-[#20c58f]/35 bg-[#20c58f]/10 hover:bg-[#20c58f]/15 text-emerald-300 text-sm font-bold transition-colors'
// Hover lyfter bara när användaren inte bett om minskad rörelse.
// Klasserna skrivs ut i klartext så att Tailwind hittar dem.
const LYFT = 'transition-[transform,box-shadow,border-color] duration-150 motion-safe:hover:-translate-y-0.5'
const LYFT_SKUGGA = 'hover:shadow-[0_2px_4px_rgba(15,31,46,0.06),0_14px_32px_rgba(15,31,46,0.10)]'

const PUNKT_FARG: Record<KontrollNiva, string> = {
  rod: 'bg-red-500',
  gul: 'bg-amber-500',
  gron: 'bg-[#20c58f]',
}

/** Grön bock-badge i hörnet på ett valt stort kort. */
function ValdBadge() {
  return (
    <span className="absolute top-3.5 right-3.5 w-[26px] h-[26px] rounded-full bg-[#20c58f] text-[#052e22] flex items-center justify-center">
      <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden="true" />
    </span>
  )
}

/** Stort valbart kort (dokumenttyp, avtalspart): ikon i 84 px tonad ruta, rubrik, text. */
function ValKort({ vald, namn, text, ikon, ruta, onClick }: {
  vald: boolean; namn: string; text: string; ikon: React.ReactNode; ruta: string; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={vald}
      className={`relative flex flex-col gap-2.5 items-start text-left p-[26px] min-h-[230px] rounded-[18px] bg-slate-900 ${LYFT} ${
        vald
          ? 'border-2 border-[#20c58f] shadow-[0_0_0_4px_rgba(32,197,143,0.18),0_14px_32px_rgba(15,31,46,0.10)]'
          : `border border-slate-700 hover:border-slate-600 ${SKUGGA} ${LYFT_SKUGGA}`
      }`}
    >
      {vald && <ValdBadge />}
      <span className={`w-[84px] h-[84px] rounded-[20px] flex items-center justify-center mb-1 ${ruta}`}>{ikon}</span>
      <span className="text-xl font-bold text-white">{namn}</span>
      <span className="text-[15px] text-slate-400 leading-relaxed">{text}</span>
    </button>
  )
}

/** Mindre valbart kort i två kolumner (mall, kundgrupp): ikon i tonad ruta, namn, undertext. */
function ValKortLitet({ vald, namn, text, ikon, ruta, rutaStorlek = 56, onClick }: {
  vald: boolean; namn: string; text?: string; ikon: React.ReactNode; ruta: string; rutaStorlek?: number; onClick: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={vald}
      onClick={onClick}
      className={`flex items-center gap-3.5 p-4 min-h-[80px] rounded-[14px] text-left ${LYFT} ${
        vald
          ? 'bg-[#20c58f]/5 border-2 border-[#20c58f] shadow-[0_0_0_4px_rgba(32,197,143,0.15)]'
          : `bg-slate-900 border border-slate-700 hover:border-slate-600 shadow-[0_1px_2px_rgba(15,31,46,0.04),0_6px_16px_rgba(15,31,46,0.05)] ${LYFT_SKUGGA}`
      }`}
    >
      <span
        className={`shrink-0 rounded-xl flex items-center justify-center ${ruta}`}
        style={{ width: rutaStorlek, height: rutaStorlek }}
      >
        {ikon}
      </span>
      <span className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[15px] font-bold text-white break-words">{namn}</span>
        {text && <span className="text-[13px] text-slate-400">{text}</span>}
      </span>
    </button>
  )
}

/** Formulärfält: etikett ovanför, ruta på 48 px med ikon till vänster och grön fokusring. */
function Falt({ etikett, tillagg, ikon, slut, under, children, className = '' }: {
  etikett: string
  /** Liten dämpad text efter etiketten, t.ex. "valfritt". */
  tillagg?: string
  ikon?: React.ReactNode
  /** Något i rutans högra kant, t.ex. en bock. */
  slut?: React.ReactNode
  under?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={`${LABEL_CLASS} ${className}`}>
      <span>
        {etikett}
        {tillagg && <span className="font-normal text-slate-500"> {tillagg}</span>}
      </span>
      <span className="flex items-center gap-2.5 min-h-[48px] px-3.5 rounded-[10px] border border-slate-600 bg-slate-800/60 transition-shadow focus-within:border-[#20c58f] focus-within:ring-4 focus-within:ring-[#20c58f]/15">
        {ikon && <span className="text-slate-500 shrink-0 flex">{ikon}</span>}
        {children}
        {slut}
      </span>
      {under}
    </label>
  )
}

/** Klass för input inuti Falt. */
const FALT_INPUT = 'flex-1 min-w-0 min-h-[46px] bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-[15px] font-normal text-white placeholder-slate-500'

/** Rubrik i ett formulärkort med liten tonad ikonruta. */
function KortRubrik({ ikon, ruta, titel, text }: { ikon: React.ReactNode; ruta: string; titel: string; text?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 ${ruta}`}>{ikon}</span>
      <span className="flex flex-col">
        <span className="text-base font-bold text-white">{titel}</span>
        {text && <span className="text-[13px] font-normal text-slate-400">{text}</span>}
      </span>
    </div>
  )
}

/** Infobox med ikon (blågrå ton). */
function InfoRuta({ ikon, children }: { ikon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start px-4 py-3.5 rounded-xl bg-sky-400/10 text-sm text-slate-300 leading-relaxed">
      <span className="text-sky-400 shrink-0 mt-px flex">{ikon}</span>
      <span>{children}</span>
    </div>
  )
}

/** Ett uppgiftsfält på granskningspappret. */
function PappersFalt({ etikett, children }: { etikett: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[13px] text-slate-400">{etikett}</span>
      <span className="text-[15px] text-white break-words">{children}</span>
    </div>
  )
}

function createInitialWizardData(
  anstalld: string,
  epostAnstalld: string
): WizardData {
  return {
    documentType: 'contract',
    selectedTemplate: '',
    partyType: 'company',
    anstalld,
    'e-post-anstlld': epostAnstalld,
    avtalslngd: '1',
    avtalslangdEnhet: 'år',
    begynnelsedag: new Date().toISOString().split('T')[0],
    noticePeriodMonths: '3',
    billingFrequency: 'annual',
    Kontaktperson: '',
    'e-post-kontaktperson': '',
    'telefonnummer-kontaktperson': '',
    'utforande-adress': '',
    foretag: '',
    'org-nr': '',
    'e-post-faktura': '',
    selectedPriceListId: null,
    selectedArticles: [],
    deductionType: null,
    customTotalPrice: null,
    selectedProducts: [],
    draftItems: [],
    draftPriceAssignments: {},
    draftPriceMarkups: {},
    agreementText: DEFAULT_AGREEMENT_TEXT,
    customer_group_id: null
  }
}

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

  // Navigera till Dokumentsignering efter success (faller tillbaka till dashboard för admin)
  const getFollowUpRoute = useCallback(() => {
    const role = profile?.role || 'admin';
    switch (role) {
      case 'koordinator':
        return '/koordinator/dokumentsignering';
      case 'säljare':
        return '/saljare/dokumentsignering';
      case 'technician':
        return '/technician/dokumentsignering';
      default:
        return '/admin/dashboard';
    }
  }, [profile?.role]);

  // Sparade utkast listas i Dokumentsignering. Admins egen sida med samma namn
  // är pipelinen utan utkast, så admin skickas till koordinatorns vy.
  const getDraftListRoute = useCallback(() => {
    const route = getFollowUpRoute()
    return route === '/admin/dashboard' ? '/koordinator/dokumentsignering' : route
  }, [getFollowUpRoute])

  const [currentStep, setCurrentStep] = useState(1)
  const [maxReachedStep, setMaxReachedStep] = useState(1)
  /** Sant när användaren gått från granskningen till ett steg via "Ändra" */
  const [fromReview, setFromReview] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [creationStep, setCreationStep] = useState('')
  /** Utkastet i Oneflow som visas som PDF (steg 10). */
  const [draftContract, setDraftContract] = useState<{ id: number | string; warning?: string } | null>(null)
  const [draftAction, setDraftAction] = useState<'send' | 'remove' | null>(null)
  /** Skickat dokument — visar bekräftelsen. */
  const [createdContract, setCreatedContract] = useState<any>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitErrorStep, setSubmitErrorStep] = useState<number | null>(null)
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([])
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [groupsError, setGroupsError] = useState<string | null>(null)

  // 🆕 DYNAMISK BEGONE INFO BASERAT PÅ INLOGGAD ANVÄNDARE
  // Dynamiska mallar från oneflow_templates. Hårdkodade listan är initialvärde
  // tills DB-läsningen är klar; servicen faller själv tillbaka på den vid DB-fel.
  const [offerTemplates, setOfferTemplates] = useState<OneflowTemplate[]>(OFFER_TEMPLATES)
  const [contractTemplates, setContractTemplates] = useState<OneflowTemplate[]>(CONTRACT_TEMPLATES)

  useEffect(() => {
    OneflowTemplateService.getActiveByType('offer').then(setOfferTemplates)
    OneflowTemplateService.getActiveByType('contract').then(setContractTemplates)
  }, [])

  // Prioritera technicians.name om det finns, annars display_name eller user metadata
  const defaultAnstalld = profile?.technicians?.name || profile?.display_name || user?.user_metadata?.full_name || 'BeGone Medarbetare'
  const [wizardData, setWizardData] = useState<WizardData>(() =>
    createInitialWizardData(defaultAnstalld, user?.email || '')
  )

  // Dynamiska steg baserat på dokumenttyp
  const STEPS = wizardData.documentType === 'contract' ? CONTRACT_STEPS : OFFER_STEPS

  // Steg-offset: vid avtal skiftas steg 4+ med 1 (kundgrupp injicerat)
  const isContract = wizardData.documentType === 'contract'

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
            'e-post-faktura': customerData['e-post-faktura'] || prev['e-post-faktura'],
            // Lägg till tekniker-info om det finns
            anstalld: customerData.anstalld || prev.anstalld,
            'e-post-anstlld': customerData['e-post-anstlld'] || prev['e-post-anstlld'],
            // Lägg till avtalslängd och startdatum om det finns
            avtalslngd: customerData.avtalslngd || prev.avtalslngd,
            avtalslangdEnhet: customerData.avtalslangdEnhet || prev.avtalslangdEnhet,
            begynnelsedag: customerData.begynnelsedag || prev.begynnelsedag,
            // Lägg till case_id för webhook-koppling
            case_id: customerData.case_id || undefined,
            case_type: customerData.caseType || undefined,
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
            // --- Förnyelse av ett tidigare avtal ---------------------------
            // Fälten nedan mappades inte tidigare, eftersom prefill bara kom
            // från ärenden. En förnyelse bygger på ett HELT avtal och måste
            // därför bära med avtalsobjektet, tjänste-/artikelraderna och de
            // portalinterna villkoren (som aldrig går till Oneflow).
            agreementText: customerData.agreementText || prev.agreementText,
            draftItems: customerData.draftItems?.length > 0
              ? customerData.draftItems
              : prev.draftItems,
            draftPriceAssignments:
              customerData.draftPriceAssignments || prev.draftPriceAssignments,
            customer_group_id: customerData.customer_group_id ?? prev.customer_group_id,
            noticePeriodMonths: customerData.noticePeriodMonths || prev.noticePeriodMonths,
            billingFrequency: customerData.billingFrequency || prev.billingFrequency,
            renewalOfContractId: customerData.renewalOfContractId || undefined,
            // Leads (Webb): offert från en webbförfrågan
            web_inquiry_id: customerData.webInquiryId || undefined,
            // Leads: offert eller avtal från en lead; triggern på contracts flyttar leaden
            lead_id: customerData.leadId || undefined,
            returnPath: customerData.returnPath || undefined,
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
              const docType = customerData.documentType || prefillType
              // Produktsteget får bara hoppas över om ärendet har minst en
              // prissatt tjänst — annars landar wizarden på Produkter så att
              // tjänster och priser sätts upp innan dokumentet skapas.
              const hasUsableProducts = Array.isArray(customerData.prefillServices) &&
                customerData.prefillServices.some((s: { total_price?: number }) => (s?.total_price ?? 0) > 0)
              const productsStepNum = docType === 'contract' ? 7 : 6
              const objectStepNum = docType === 'contract' ? 8 : 7
              const targetStep = hasUsableProducts ? objectStepNum : productsStepNum
              console.log('Auto-selecting template and jumping to step:', targetStep, { hasUsableProducts })
              if (!hasUsableProducts) {
                toast('Ärendet saknar prissatta tjänster – lägg till dem innan du går vidare', { icon: '🛒', duration: 5000 })
              }
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

  // Navigation guard — varna om osparade ändringar.
  // Ett skapat utkast ligger kvar i Oneflow, så då finns inget osparat.
  const hasUnsavedProgress = useCallback((): boolean => {
    if (createdContract || draftContract) return false
    if (currentStep > 1) return true
    return (
      wizardData.Kontaktperson !== '' ||
      wizardData['e-post-kontaktperson'] !== '' ||
      wizardData.foretag !== '' ||
      wizardData.draftItems.length > 0 ||
      wizardData.selectedArticles.length > 0
    )
  }, [currentStep, wizardData, createdContract, draftContract])

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
        const template = offerTemplates.find(t => t.id === value)
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

  /** Snyggar till ett kontaktfält när det lämnas. */
  const snyggaTillFalt = (falt: KontaktFalt) => () => {
    setWizardData(prev => {
      const nytt = KONTAKT_FORMAT[falt](prev[falt] ?? '')
      return nytt === prev[falt] ? prev : { ...prev, [falt]: nytt }
    })
  }

  const nextStep = () => {
    if (currentStep < STEPS.length) {
      let nextStepNumber = currentStep + 1

      // Förifyllda uppgifter har aldrig fått fokus, så de snyggas till när steget lämnas
      if (currentStep === begoneStep || currentStep === counterpartyStep) {
        setWizardData(prev => snyggaTillKontakt(prev))
      }

      // Om vi är på steg 2 (mallval) och har valt en offertmall,
      // hoppa över steg 3 (avtalspart) eftersom den väljs automatiskt
      if (currentStep === 2 && wizardData.documentType === 'offer' && wizardData.selectedTemplate) {
        const template = offerTemplates.find(t => t.id === wizardData.selectedTemplate)
        if (template && template.category) {
          setWizardData(prev => ({ ...prev, partyType: template.category as 'company' | 'individual' }))
        }
        nextStepNumber = 4 // Hoppa över steg 3 (avtalspart) → direkt till BeGone Info
      }

      if (nextStepNumber === reviewStep) setFromReview(false)
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

  /** "Ändra" på granskningen: hoppa till steget och visa "Tillbaka till granskningen". */
  const goToStepFromReview = (step: number) => {
    setFromReview(true)
    setCurrentStep(step)
  }

  const backToReview = () => {
    if (currentStep === begoneStep || currentStep === counterpartyStep) {
      setWizardData(prev => snyggaTillKontakt(prev))
    }
    setFromReview(false)
    setCurrentStep(reviewStep)
  }

  /** Stegrad: att gå direkt till granskningen avslutar ett "Ändra". */
  const handleStepClick = (step: number) => {
    if (step === reviewStep) setFromReview(false)
    setCurrentStep(step)
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

    // Produkter – om ärendet är källan, kräv minst en tjänst i prefillServices.
    // Manuellt läge: kräv minst en tjänst (item_type='service') i draftItems
    if (currentStep === productsStep) {
      if (wizardData.case_id) {
        return !!(wizardData.prefillServices && wizardData.prefillServices.length > 0)
      }
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
      if (wizardData.case_id) {
        if (!wizardData.prefillServices || wizardData.prefillServices.length === 0) return 'Lägg till minst en tjänst på ärendet'
        return validateRotRutRows(wizardData.prefillServices)
      }
      if (!wizardData.draftItems.some(i => i.item_type === 'service')) return 'Lägg till minst en tjänst'
      return validateRotRutRows(wizardData.draftItems.filter(i => i.item_type === 'service'))
    }
    return ''
  }

  // Guardrail: ROT/RUT-avdrag måste ligga på arbetstidstjänster (avdraget
  // beräknas på arbetskostnaden) och ett dokument kan bara ha en avdragstyp.
  const validateRotRutRows = (
    rows: Array<{
      rot_rut_type?: 'ROT' | 'RUT' | null
      service_name?: string | null
      service?: { rot_eligible?: boolean; rut_eligible?: boolean } | null
    }>
  ): string => {
    const deductionRows = rows.filter(r => r.rot_rut_type)
    if (deductionRows.length === 0) return ''
    const hasRot = deductionRows.some(r => r.rot_rut_type === 'ROT')
    const hasRut = deductionRows.some(r => r.rot_rut_type === 'RUT')
    if (hasRot && hasRut) return 'Dokumentet kan inte ha både ROT och RUT – dela upp i separata ärenden'
    const misplaced = deductionRows.filter(
      r => r.service && !r.service.rot_eligible && !r.service.rut_eligible
    )
    if (misplaced.length > 0) {
      const names = misplaced.map(r => r.service_name || 'Tjänst').join(', ')
      return `ROT/RUT ligger på "${names}" som inte är en arbetstidstjänst – använd "Dela upp för ROT/RUT"`
    }
    return ''
  }

  // Hitta rätt mall baserat på dokumenttyp
  const availableTemplates = wizardData.documentType === 'offer' ? offerTemplates : contractTemplates
  const selectedTemplate = availableTemplates.find(t => t.id === wizardData.selectedTemplate)

  // Leads (Webb): kopplar en skickad offert till webbförfrågan som guiden öppnades från.
  // Anropas först när offerten publicerats; utkast och avtal kopplas aldrig.
  const kopplaOffertTillForfragan = async (oneflowId: unknown) => {
    if (!wizardData.web_inquiry_id || wizardData.documentType !== 'offer') return
    if (oneflowId === null || oneflowId === undefined || oneflowId === '') return
    try {
      await WebInquiryService.linkOffer(wizardData.web_inquiry_id, String(oneflowId))
      toast.success('Offerten är kopplad till webbförfrågan')
    } catch {
      toast.error('Offerten skickades men kunde inte kopplas till webbförfrågan')
    }
  }

  // --- Tjänster och pris: samma beräkning i granskningen och sidokortet ----
  const isPrivate = wizardData.partyType === 'individual'
  const priceMultiplier = isPrivate ? 1.25 : 1
  const prisData = useMemo(() => {
    const hasPrefill = !!wizardData.prefillServices && wizardData.prefillServices.length > 0
    const draftServices = wizardData.draftItems.filter(i => i.item_type === 'service')
    const draftArticles = wizardData.draftItems.filter(i => i.item_type === 'article')

    let serviceTotal = 0
    let articleCost = 0
    let rows: Array<{ key: string; name: string; quantity: number; total: number; articles: string[] }> = []
    // Raderna till motorn: varaktig utrustning (fällor, stationer) ska
    // ställas mot en återkommande årsintäkt, inte dras från år 1.
    let marginLines: MarginLine[] = []

    if (hasPrefill) {
      serviceTotal = wizardData.prefillServices!.reduce((s, i) => s + i.total_price, 0)
      articleCost = wizardData.selectedArticles.reduce((s, a) => s + a.effectivePrice * a.quantity, 0)
      marginLines = [
        ...wizardData.prefillServices!.map((s): MarginLine => ({ item_type: 'service', total_price: s.total_price })),
        ...wizardData.selectedArticles.map((a): MarginLine => ({
          item_type: 'article',
          total_price: a.effectivePrice * a.quantity,
          quantity: a.quantity,
          article_name: a.article.name,
          article: { is_durable: a.article.is_durable, category: a.article.category },
        })),
      ]
      rows = wizardData.prefillServices!.map(s => ({
        key: s.id,
        name: s.service_name ?? 'Tjänst',
        quantity: s.quantity,
        total: s.total_price,
        articles: wizardData.selectedArticles
          .filter(a => a.mapped_service_id === s.id)
          .map(a => `${a.article.name}${a.quantity > 1 ? ` × ${a.quantity}` : ''}`),
      }))
    } else {
      serviceTotal = draftServices.reduce((s, i) => s + i.total_price, 0)
      articleCost = draftArticles.reduce((s, i) => s + i.total_price, 0)
      marginLines = [...draftServices, ...draftArticles] as unknown as MarginLine[]
      rows = draftServices.map(svc => ({
        key: svc.id,
        name: svc.service_name ?? 'Tjänst',
        quantity: svc.quantity,
        total: svc.total_price,
        articles: draftArticles
          .filter(a => (wizardData.draftPriceAssignments[a.id] ?? a.mapped_service_id) === svc.id)
          .map(a => `${a.article_name}${a.quantity > 1 ? ` × ${a.quantity}` : ''}`),
      }))
    }

    // Ett avtalsförslag är ett avtal: löpande marginal är huvudtalet, men
    // säljaren ska också se att år 1 går back när fällorna köps in.
    const mb = summarizeBillingLines(marginLines, { context: 'contract' })
    return { rows, serviceTotal, articleCost, mb, serviceCount: rows.length }
  }, [wizardData.prefillServices, wizardData.selectedArticles, wizardData.draftItems, wizardData.draftPriceAssignments])

  const kontrollPunkter = useMemo(() => kontrolleraAvtal({
    dokumentTyp: wizardData.documentType,
    partTyp: wizardData.partyType,
    foretag: wizardData.foretag,
    orgNr: wizardData['org-nr'],
    kontaktperson: wizardData.Kontaktperson,
    epost: wizardData['e-post-kontaktperson'],
    telefon: wizardData['telefonnummer-kontaktperson'],
    epostFaktura: wizardData['e-post-faktura'],
    avtalslangd: formatContractLength(wizardData.avtalslngd, wizardData.avtalslangdEnhet),
    startdatum: wizardData.begynnelsedag,
    avtalsobjekt: wizardData.agreementText,
    antalTjanster: wizardData.case_id
      ? (wizardData.prefillServices?.length ?? 0)
      : wizardData.draftItems.filter(i => i.item_type === 'service').length,
  }), [wizardData])
  const kontrollStoppar = harStopp(kontrollPunkter)

  const avsnittSteg: Record<KontrollAvsnitt, number> = {
    motpart: counterpartyStep,
    avtalstid: begoneStep,
    avtalsobjekt: agreementStep,
    tjanster: productsStep,
  }
  const avsnittNamn: Record<KontrollAvsnitt, string> = {
    motpart: 'Motpart',
    avtalstid: 'BeGone',
    avtalsobjekt: isContract ? 'Avtalsobjekt' : 'Offertinnehåll',
    tjanster: 'Tjänster',
  }

  const handleSubmit = async () => {
    // Konvertera tjänster → SelectedProduct-format för API:et (aldrig inköpsartiklar!)
    const partyType = wizardData.partyType as CustomerType
    let convertedProducts: SelectedProduct[] = []

    if (wizardData.case_id && wizardData.prefillServices && wizardData.prefillServices.length > 0) {
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

    // Fastighetsbeteckning från raden med ROT/RUT-avdrag (arbetstidsraden) —
    // förifyller mallens Fastighetsbeteckning-fält i offerter
    const rotRutRow = (wizardData.case_id && wizardData.prefillServices?.length
      ? wizardData.prefillServices
      : wizardData.draftItems.filter(i => i.item_type === 'service')
    ).find(r => r.rot_rut_type)
    const fastighetsbeteckning = rotRutRow?.fastighetsbeteckning || ''

    // Samma formatering som när fälten lämnas, ifall något förifyllts och aldrig fått fokus
    const kontakt = snyggaTillKontakt(wizardData)

    const contractData: Record<string, string> = {
      anstalld: kontakt.anstalld,
      'e-post-anstlld': kontakt['e-post-anstlld'],
      // Mallen skriver "inledande period om {avtalslngd}", så enheten följer med
      avtalslngd: formatContractLength(wizardData.avtalslngd, wizardData.avtalslangdEnhet),
      begynnelsedag: wizardData.begynnelsedag,
      'dokument-skapat': new Date().toISOString().split('T')[0],
      'e-post-kontaktperson': kontakt['e-post-kontaktperson'],
      foretag: kontakt.foretag,
      Kontaktperson: kontakt.Kontaktperson,
      'org-nr': kontakt['org-nr'],
      'telefonnummer-kontaktperson': kontakt['telefonnummer-kontaktperson'],
      'utforande-adress': kontakt['utforande-adress'],
      'stycke-1': part1,
      'stycke-2': part2
    }
    // E-post för faktura: avtalsmallens fält 'faktura-adress-pdf', i offerter
    // 'epost-faktura' (mappas i create-contract). Tomt = kunden fyller i vid signering.
    if (kontakt['e-post-faktura']) contractData['faktura-adress-pdf'] = kontakt['e-post-faktura']

    const recipient = {
      name: kontakt.Kontaktperson,
      email: kontakt['e-post-kontaktperson'],
      company_name: kontakt.foretag,
      organization_number: kontakt['org-nr']
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
      setCreationStep('Skapar utkast i Oneflow...')
      const response = await apiFetch('/api/oneflow/create-contract', {
        method: 'POST',
        body: JSON.stringify({
          templateId: wizardData.selectedTemplate,
          contractData,
          recipient,
          // Allt skapas som utkast och skickas först när PDF:en är godkänd (steg 10)
          sendForSigning: false,
          partyType: wizardData.partyType,
          documentType: wizardData.documentType,
          fastighetsbeteckning, // Endast offerter använder fältet (hanteras i API:t)
          caseId: wizardData.case_id, // Skicka case_id för webhook-koppling
          leadId: wizardData.lead_id || null,
          senderEmail: user?.email,
          senderName: wizardData.anstalld,
          selectedProducts: convertedProducts,
          customerGroupId: wizardData.customer_group_id,
          // Portalens avtalsvillkor — sparas på contracts-raden, skickas
          // ALDRIG vidare till Oneflow (kunden ser dem inte).
          noticePeriodMonths:
            wizardData.documentType === 'contract' && wizardData.noticePeriodMonths !== ''
              ? parseInt(wizardData.noticePeriodMonths, 10)
              : null,
          billingFrequency:
            wizardData.documentType === 'contract' ? wizardData.billingFrequency : null,
          draftItems: (wizardData.case_id && wizardData.prefillServices?.length > 0
            ? wizardData.prefillServices.map(s => ({
                draft_id: s.id,
                item_type: 'service' as const,
                service_id: null,
                service_code: s.service_code ?? null,
                service_name: s.service_name ?? null,
                article_id: null,
                article_code: null,
                article_name: s.service_name ?? null,
                quantity: s.quantity,
                unit_price: s.unit_price,
                discount_percent: null,
                discounted_price: null,
                total_price: s.total_price,
                vat_rate: s.vat_rate ?? 25,
                price_source: null,
                notes: null,
                rot_rut_type: s.rot_rut_type ?? null,
                fastighetsbeteckning: s.fastighetsbeteckning ?? null,
                mapped_service_id: null,
              }))
            : wizardData.draftItems.map(i => ({
                draft_id: i.id,
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
                customer_unit_price: i.customer_unit_price ?? null,
                notes: i.notes,
                rot_rut_type: i.rot_rut_type,
                fastighetsbeteckning: i.fastighetsbeteckning ?? null,
                mapped_service_id: i.mapped_service_id,
              }))
          )
        })
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('[wizard] API-fel:', error)
        // Utkastet skapades i Oneflow men tjänsterna kunde inte sparas i portalen.
        // Visa PDF:en ändå: "Ändra i wizarden" tar bort utkastet och försöker igen.
        if (response.status === 502 && error?.contract?.id) {
          setDraftContract({
            id: error.contract.id,
            warning: 'Utkastet skapades i Oneflow men tjänsterna kunde inte sparas i portalen. Välj Ändra i wizarden och skapa det igen.',
          })
          return
        }
        const thrown: any = new Error(error.detail || error.message || 'Ett okänt serverfel inträffade')
        // Bifoga OneFlow-felobjektet (inkl. parameter_problems) för fält-specifik felhantering
        thrown.oneflowError = error.oneflow_error || error
        throw thrown
      }

      const result = await response.json()
      setCreationStep('Slutför...')

      // Handle multisite recipient saving for quotes
      if (wizardData.documentType === 'offer' && wizardData.multisite_recipient && wizardData.case_id) {
        setCreationStep('Sparar mottagare...')
        try {
          const recipientResponse = await apiFetch('/api/save-quote-recipient', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              quote_id: wizardData.case_id,
              recipient: wizardData.multisite_recipient,
              organization_id: wizardData.multisite_recipient.organization_id
            })
          })

          if (!recipientResponse.ok) {
            const data = await recipientResponse.json().catch(() => ({}))
            console.warn('Could not save quote recipient:', data.error || recipientResponse.status)
          } else {
            console.log('✅ Quote recipient saved successfully')
          }
        } catch (recipientError) {
          console.warn('Failed to save quote recipient:', recipientError)
        }
      }

      setDraftContract({ id: result.contract.id })
      window.scrollTo({ top: 0 })
      toast.success('Utkastet är skapat i Oneflow')
    } catch (err: any) {
      // Parse OneFlow parameter_problems om det finns, annars använd generic message
      const oneflowErr = err.oneflowError as
        | { parameter_problems?: Record<string, string[]>; detail?: string }
        | undefined
      let userMessage = err.message || 'Ett okänt fel inträffade'
      let targetStep: number | null = null

      if (oneflowErr?.parameter_problems) {
        const problems = oneflowErr.parameter_problems
        const lines: string[] = []
        for (const [field, msgs] of Object.entries(problems)) {
          // Mappa OneFlow-fältnamn till läsbar svenska + identifiera vilket steg som ska öppnas
          if (field === 'participant.email' || field.includes('email')) {
            lines.push(`E-postadressen är ogiltig. Kontrollera stavning och domän (t.ex. ${wizardData['e-post-kontaktperson']}).`)
            targetStep = counterpartyStep
          } else if (field === 'participant.name' || field.includes('name')) {
            lines.push('Kontaktpersonens namn är ogiltigt.')
            targetStep = counterpartyStep
          } else if (field.includes('organization_number') || field.includes('org')) {
            lines.push('Organisationsnumret är ogiltigt.')
            targetStep = counterpartyStep
          } else if (field.includes('phone')) {
            lines.push('Telefonnumret är ogiltigt.')
            targetStep = counterpartyStep
          } else {
            lines.push(`${field}: ${msgs.join(', ')}`)
          }
        }
        userMessage = lines.join(' ')
      }

      setSubmitError(userMessage)
      setSubmitErrorStep(targetStep)
      toast.error(`Fel: ${userMessage}`)
    } finally {
      setIsCreating(false)
      setCreationStep('')
    }
  }

  // --- Steg 10: utkastet --------------------------------------------------

  const handleSendDraft = async () => {
    if (!draftContract) return
    setDraftAction('send')
    try {
      const sent = await OneflowDraftService.publish(draftContract.id)
      // Leads (Webb): bara en offert som faktiskt skickats kopplas till förfrågan
      await kopplaOffertTillForfragan(sent.id)
      setCreatedContract({ id: sent.id, state: 'published' })
      setDraftContract(null)
      toast.success(isContract ? 'Avtalet är skickat för signering' : 'Offerten är skickad')

      // Redirecta till offertuppföljning efter kort paus så bekräftelsen hinner registreras
      setTimeout(() => {
        navigate(
          (wizardData.web_inquiry_id || wizardData.lead_id) && wizardData.returnPath
            ? wizardData.returnPath
            : getFollowUpRoute()
        )
      }, 2500)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte skicka dokumentet')
    } finally {
      setDraftAction(null)
    }
  }

  const handleEditDraft = async () => {
    if (!draftContract) return
    const ok = window.confirm(
      'Utkastet tas bort i Oneflow och du kommer tillbaka till granskningen med alla uppgifter kvar. Ett nytt utkast skapas när du är klar. Fortsätta?'
    )
    if (!ok) return
    setDraftAction('remove')
    try {
      await OneflowDraftService.remove(draftContract.id)
      setDraftContract(null)
      setSubmitError(null)
      setFromReview(false)
      setCurrentStep(reviewStep)
      toast.success('Utkastet är borttaget')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte ta bort utkastet')
    } finally {
      setDraftAction(null)
    }
  }

  const handleSaveDraft = () => {
    toast.success('Utkastet ligger kvar under Dokumentsignering')
    navigate(getDraftListRoute())
  }

  const leaveWizard = (route: string) => {
    if (hasUnsavedProgress()) {
      if (!window.confirm('Du har osparade ändringar. Vill du lämna sidan?')) return
    }
    navigate(route)
  }

  // --- Steginnehåll -------------------------------------------------------

  const stepHeadings = (): [string, string] => {
    if (isContract && currentStep === 4) return ['Kundgrupp', 'Styr prislista och hur kunden följs upp. Kundnumret tilldelas vid signering.']
    const logicalStep = isContract && currentStep >= 5 ? currentStep - 1 : currentStep
    switch (logicalStep) {
      case 1: return ['Vad ska du skapa?', 'Välj om kunden ska få ett avtalsförslag eller en offert.']
      case 2: return ['Välj mall', `Mallen styr ${isContract ? 'avtalets' : 'offertens'} fasta text i Oneflow.`]
      case 3: return ['Vem är avtalspart?', 'Företag eller privatperson.']
      case 4: return isContract
        ? ['Avtalstid och ansvarig', 'Vem som står på avtalet från Begone, och hur länge det gäller.']
        : ['Ansvarig', 'Vem som står på offerten från Begone.']
      case 5: return ['Motpart', `Kundens uppgifter som de står i ${isContract ? 'avtalet' : 'offerten'}.`]
      case 6: return ['Tjänster och pris', 'Det kunden betalar, och artiklarna som ingår internt.']
      case 7: return isContract
        ? ['Avtalsobjekt', 'Vad som ingår, med kundens egna ord.']
        : ['Offertinnehåll', 'Vad arbetet omfattar, med kundens egna ord.']
      case 8: return [
        isContract ? 'Granska avtalet' : 'Granska offerten',
        `Så här kommer ${isContract ? 'avtalet' : 'offerten'} att se ut för kunden. Ändra tar dig till rätt steg och tillbaka hit.`,
      ]
      default: return ['', '']
    }
  }

  // Rendera kundgruppsteget (bara för avtal, steg 4)
  const renderCustomerGroupStep = () => (
    <>
      {groupsLoading && (
        <div className="py-8">
          <LoadingSpinner text="Laddar kundgrupper…" />
        </div>
      )}

      {!groupsLoading && groupsError && (
        <div className={`${CARD_CLASS} p-5 space-y-3`}>
          <p className="flex items-center gap-2 text-[15px] text-white">
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            Kunde inte hämta kundgrupper: {groupsError}
          </p>
          <p className="text-[13px] text-slate-400">
            Om problemet kvarstår: logga ut och in igen, eller rensa webbläsarens cache.
          </p>
          <button type="button" onClick={loadCustomerGroups} className={OUTLINE_BUTTON}>Försök igen</button>
        </div>
      )}

      {!groupsLoading && !groupsError && customerGroups.length === 0 && (
        <p className="flex items-center gap-2 text-[15px] text-slate-300">
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          Inga aktiva kundgrupper hittades. Kontakta administratör.
        </p>
      )}

      {!groupsLoading && !groupsError && customerGroups.length > 0 && (
        <div role="radiogroup" aria-label="Kundgrupp" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {customerGroups.map(group => {
            const capacity = group.series_end - group.series_start + 1
            const used = Math.max(0, group.current_counter - group.series_start + 1)
            const remaining = capacity - used
            const vald = wizardData.customer_group_id === group.id
            const { Ikon, ton } = ikonForKundgrupp(group.name)
            return (
              <ValKortLitet
                key={group.id}
                vald={vald}
                namn={group.name}
                text={`Serie ${group.series_start}–${group.series_end} · ${remaining} lediga`}
                ikon={<Ikon size={30} />}
                ruta={vald ? IKON_TON[ton].rutaVald : IKON_TON[ton].ruta}
                rutaStorlek={48}
                onClick={() => updateWizardData('customer_group_id', group.id)}
              />
            )
          })}
        </div>
      )}
    </>
  )

  const renderAgreementSuggestionButton = () => {
    const hasPrefill = !!wizardData.case_id && !!wizardData.prefillServices && wizardData.prefillServices.length > 0
    const serviceDraftItems = wizardData.draftItems.filter(i => i.item_type === 'service')
    const articleDraftItems = wizardData.draftItems.filter(i => i.item_type === 'article')
    const canGenerate = hasPrefill || serviceDraftItems.length > 0
    if (!canGenerate) return null
    return (
      <button
        type="button"
        className={SECONDARY_TONED_BUTTON}
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
          toast.success('Förslaget är skrivet utifrån tjänsterna')
        }}
      >
        <Sparkles className="w-4 h-4" aria-hidden="true" />
        Skriv förslag från tjänsterna
      </button>
    )
  }

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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[18px]">
            <ValKort
              vald={wizardData.documentType === 'contract'}
              namn="Avtalsförslag"
              text="Löpande avtal med årspremie. Kunden signerar i Oneflow."
              ikon={<DokumentAvtalIkon size={56} />}
              ruta={IKON_TON.gron.ruta}
              onClick={() => updateWizardData('documentType', 'contract')}
            />
            <ValKort
              vald={wizardData.documentType === 'offer'}
              namn="Offert"
              text="Engångsuppdrag med fast pris. Kunden godkänner i Oneflow."
              ikon={<DokumentOffertIkon size={56} />}
              ruta={IKON_TON.bla.ruta}
              onClick={() => updateWizardData('documentType', 'offer')}
            />
          </div>
        )

      case 2:
        return (
          <div role="radiogroup" aria-label="Mall" className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {availableTemplates.map(template => {
              const vald = wizardData.selectedTemplate === template.id
              const { Ikon, ton, beskrivning } = ikonForMall(template.name)
              const text = [
                wizardData.documentType === 'offer' && template.category
                  ? (template.category === 'company' ? 'Företag' : 'Privatperson')
                  : null,
                template.popular ? 'Mest använd' : null,
              ].filter(Boolean).join(' · ') || beskrivning || undefined
              return (
                <ValKortLitet
                  key={template.id}
                  vald={vald}
                  namn={template.name}
                  text={text}
                  ikon={<Ikon size={40} />}
                  ruta={vald ? IKON_TON[ton].rutaVald : IKON_TON[ton].ruta}
                  onClick={() => updateWizardData('selectedTemplate', template.id)}
                />
              )
            })}
          </div>
        )

      case 3:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[18px]">
            <ValKort
              vald={wizardData.partyType === 'company'}
              namn="Företag"
              text="Org.nr och kontaktperson hos bolaget."
              ikon={<ForetagIkon size={56} />}
              ruta={IKON_TON.gron.ruta}
              onClick={() => updateWizardData('partyType', 'company')}
            />
            <ValKort
              vald={wizardData.partyType === 'individual'}
              namn="Privatperson"
              text="Personnummer. ROT-avdrag kan bli aktuellt."
              ikon={<PrivatpersonIkon size={56} />}
              ruta={IKON_TON.orange.ruta}
              onClick={() => updateWizardData('partyType', 'individual')}
            />
          </div>
        )

      case 4:
        return (
          <div className={`${CARD_CLASS} p-6 sm:p-7 grid grid-cols-1 sm:grid-cols-2 gap-[22px]`}>
            <Falt etikett="Ansvarig från BeGone" ikon={<User className="w-[18px] h-[18px]" />}>
              <input
                className={FALT_INPUT}
                value={wizardData.anstalld}
                onChange={e => updateWizardData('anstalld', e.target.value)}
                onBlur={snyggaTillFalt('anstalld')}
                placeholder="Förnamn Efternamn"
              />
            </Falt>
            <Falt etikett="E-post ansvarig" ikon={<Mail className="w-[18px] h-[18px]" />}>
              <input
                type="email"
                className={FALT_INPUT}
                value={wizardData['e-post-anstlld']}
                onChange={e => updateWizardData('e-post-anstlld', e.target.value)}
                onBlur={snyggaTillFalt('e-post-anstlld')}
                placeholder="namn@begone.se"
              />
            </Falt>

            {/* Visa endast avtalslängd och startdatum för avtal, inte för offerter */}
            {wizardData.documentType === 'contract' && (
              <>
                <div className="flex flex-col gap-[7px]">
                  <label htmlFor="avtalslangd" className="text-[13px] font-bold text-slate-300">Avtalslängd</label>
                  <div className="flex gap-2">
                    <span className="w-[120px] shrink-0 flex items-center gap-2.5 min-h-[48px] px-3.5 rounded-[10px] border border-slate-600 bg-slate-800/60 transition-shadow focus-within:border-[#20c58f] focus-within:ring-4 focus-within:ring-[#20c58f]/15">
                      <Clock className="w-[18px] h-[18px] text-slate-500 shrink-0" aria-hidden="true" />
                      <input
                        id="avtalslangd"
                        type="number"
                        min="1"
                        max={wizardData.avtalslangdEnhet === 'år' ? '10' : '120'}
                        className={FALT_INPUT}
                        value={wizardData.avtalslngd}
                        onChange={e => updateWizardData('avtalslngd', e.target.value)}
                      />
                    </span>
                    <select
                      aria-label="Enhet för avtalslängd"
                      value={wizardData.avtalslangdEnhet}
                      onChange={e => updateWizardData('avtalslangdEnhet', e.target.value)}
                      className={`${FIELD_CLASS} flex-1`}
                    >
                      <option value="år">år</option>
                      <option value="månader">månader</option>
                    </select>
                  </div>
                  <span className="text-[13px] text-slate-400">
                    I avtalet: "inledande period om {formatContractLength(wizardData.avtalslngd, wizardData.avtalslangdEnhet) || '…'}"
                  </span>
                </div>

                {/* DateField istället för <input type="date">: Chrome ignorerar lang="sv-SE"
                    och visar mm/dd/yyyy efter webbläsarens språk, aldrig dokumentets.
                    Labeln lyfts ut hit eftersom DateField saknar label-prop, och
                    kalenderikonen ingår redan i komponenten. */}
                <div className="flex flex-col gap-[7px]">
                  <label htmlFor="begynnelsedag" className="text-[13px] font-bold text-slate-300">Startdatum</label>
                  <DateField
                    id="begynnelsedag"
                    value={wizardData.begynnelsedag}
                    onChange={(v) => updateWizardData('begynnelsedag', v)}
                    className="w-full min-h-[48px] pr-3 bg-slate-800/60 border border-slate-600 rounded-[10px] text-[15px] text-white placeholder-slate-500 focus:outline-none focus:border-[#20c58f] focus:ring-4 focus:ring-[#20c58f]/15"
                  />
                </div>
              </>
            )}

            <div className="sm:col-span-2">
              <InfoRuta ikon={<Mail className="w-5 h-5" />}>
                {isContract ? 'Avtalet' : 'Offerten'} skickas från info@begone.se med dig som ansvarig. Inloggad som {user?.email}.
              </InfoRuta>
            </div>
          </div>
        )

      case 5: {
        const isCompany = wizardData.partyType === 'company'
        const epost = wizardData['e-post-kontaktperson']
        const epostFel = !!epost && !isValidEmail(epost)
        return (
          <div className="flex flex-col gap-4">
            <div className={`${CARD_CLASS} px-6 py-6 sm:px-7 flex flex-col gap-[18px]`}>
              {isCompany ? (
                <>
                  <KortRubrik ikon={<Building2 className="w-5 h-5 text-emerald-300" />} ruta={IKON_TON.gron.ruta} titel="Bolaget" />
                  <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-[18px]">
                    <Falt etikett="Företagsnamn" ikon={<Building2 className="w-[18px] h-[18px]" />}>
                      <input
                        className={FALT_INPUT}
                        value={wizardData.foretag}
                        onChange={e => updateWizardData('foretag', e.target.value)}
                        onBlur={snyggaTillFalt('foretag')}
                        placeholder="Företaget AB"
                      />
                    </Falt>
                    <Falt etikett="Org.nr" ikon={<FileText className="w-[18px] h-[18px]" />}>
                      <input
                        className={FALT_INPUT}
                        value={wizardData['org-nr']}
                        onChange={e => updateWizardData('org-nr', e.target.value)}
                        onBlur={snyggaTillFalt('org-nr')}
                        placeholder="556123-4567"
                      />
                    </Falt>
                  </div>
                </>
              ) : (
                <>
                  <KortRubrik ikon={<User className="w-5 h-5 text-orange-300" />} ruta={IKON_TON.orange.ruta} titel="Privatpersonen" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-[18px]">
                    <Falt etikett="Namn" ikon={<User className="w-[18px] h-[18px]" />}>
                      <input
                        className={FALT_INPUT}
                        value={wizardData.Kontaktperson}
                        onChange={e => updateWizardData('Kontaktperson', e.target.value)}
                        onBlur={snyggaTillFalt('Kontaktperson')}
                        placeholder="Förnamn Efternamn"
                      />
                    </Falt>
                    <Falt etikett="Personnummer" ikon={<FileText className="w-[18px] h-[18px]" />}>
                      <input
                        className={FALT_INPUT}
                        value={wizardData['org-nr']}
                        onChange={e => updateWizardData('org-nr', e.target.value)}
                        onBlur={snyggaTillFalt('org-nr')}
                        placeholder="ÅÅÅÅMMDD-XXXX"
                      />
                    </Falt>
                  </div>
                </>
              )}
            </div>

            <div className={`${CARD_CLASS} px-6 py-6 sm:px-7 flex flex-col gap-[18px]`}>
              {isCompany
                ? <KortRubrik ikon={<User className="w-5 h-5 text-orange-300" />} ruta={IKON_TON.orange.ruta} titel="Kontaktperson" />
                : <KortRubrik ikon={<Phone className="w-5 h-5 text-emerald-300" />} ruta={IKON_TON.gron.ruta} titel="Kontaktuppgifter" />}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-[18px]">
                {isCompany && (
                  <Falt etikett="Namn" ikon={<User className="w-[18px] h-[18px]" />}>
                    <input
                      className={FALT_INPUT}
                      value={wizardData.Kontaktperson}
                      onChange={e => updateWizardData('Kontaktperson', e.target.value)}
                      onBlur={snyggaTillFalt('Kontaktperson')}
                      placeholder="Förnamn Efternamn"
                    />
                  </Falt>
                )}
                <Falt etikett="Telefon" ikon={<Phone className="w-[18px] h-[18px]" />}>
                  <input
                    type="tel"
                    className={FALT_INPUT}
                    value={wizardData['telefonnummer-kontaktperson']}
                    onChange={e => updateWizardData('telefonnummer-kontaktperson', e.target.value)}
                    onBlur={snyggaTillFalt('telefonnummer-kontaktperson')}
                    placeholder="070-123 45 67"
                  />
                </Falt>
                <Falt
                  etikett="E-post"
                  ikon={<Mail className="w-[18px] h-[18px]" />}
                  under={epostFel ? (
                    <span className="flex items-center gap-1.5 text-xs font-normal text-red-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      Ogiltig e-postadress
                    </span>
                  ) : undefined}
                >
                  <input
                    type="email"
                    className={FALT_INPUT}
                    value={epost}
                    onChange={e => updateWizardData('e-post-kontaktperson', e.target.value)}
                    onBlur={snyggaTillFalt('e-post-kontaktperson')}
                    placeholder={isCompany ? 'namn@foretag.se' : 'namn@exempel.se'}
                    aria-invalid={epostFel}
                  />
                </Falt>
                <Falt
                  etikett="E-post för faktura"
                  tillagg="valfritt"
                  ikon={<FileText className="w-[18px] h-[18px]" />}
                  under={
                    <span className="text-xs font-normal text-slate-400">
                      {isContract ? 'Lämnas det tomt fyller kunden i det vid signering.' : 'Lämnas det tomt används e-posten ovan.'}
                    </span>
                  }
                >
                  <input
                    type="email"
                    className={FALT_INPUT}
                    value={wizardData['e-post-faktura']}
                    onChange={e => updateWizardData('e-post-faktura', e.target.value)}
                    onBlur={snyggaTillFalt('e-post-faktura')}
                    placeholder={isCompany ? 'faktura@foretag.se' : 'namn@exempel.se'}
                  />
                </Falt>
              </div>
              <Falt etikett="Utförande adress" ikon={<MapPin className="w-[18px] h-[18px]" />}>
                <input
                  className={FALT_INPUT}
                  value={wizardData['utforande-adress']}
                  onChange={e => updateWizardData('utforande-adress', e.target.value)}
                  onBlur={snyggaTillFalt('utforande-adress')}
                  placeholder="Gatuadress, postnummer ort"
                />
              </Falt>
            </div>
          </div>
        )
      }

      case 6: {
        const hasCaseLink = !!wizardData.case_id
        return (
          <div className={`${CARD_CLASS} p-4 sm:p-6`}>
            {hasCaseLink ? (
              <CaseServiceSelector
                caseId={wizardData.case_id}
                caseType={wizardData.case_type ?? (wizardData.partyType === 'company' ? 'business' : 'private')}
                customerId={null}
                primaryServiceId={null}
                onChange={(items) => {
                  const services = mapBillingItemsToPrefillServices(items)
                  const articles = mapBillingItemsToSelectedArticles(items)
                  setWizardData(prev => ({
                    ...prev,
                    prefillServices: services,
                    selectedArticles: articles,
                  }))
                }}
              />
            ) : (
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
            )}
          </div>
        )
      }

      case 7: {
        const length = wizardData.agreementText.length
        const forLang = length > AVTALSOBJEKT_MAX_TECKEN
        const andel = Math.min(100, (length / AVTALSOBJEKT_MAX_TECKEN) * 100)
        return (
          <div className="flex flex-col gap-4">
            <div className={`${CARD_CLASS} px-6 py-6 sm:px-7 flex flex-col gap-3`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="avtalsobjekt" className="text-[13px] font-bold text-slate-300">
                  {isContract ? 'Står under § 2 Avtalsobjekt' : 'Offertinnehåll, arbetsbeskrivningen i offerten'}
                </label>
                {renderAgreementSuggestionButton()}
              </div>
              <textarea
                id="avtalsobjekt"
                rows={8}
                value={wizardData.agreementText}
                onChange={(e) => updateWizardData('agreementText', e.target.value)}
                placeholder={isContract
                  ? 'Vad som ingår: antal kontroller per år, vilka stationer, objektets adress och hur aktivitet hanteras.'
                  : 'Vad arbetet omfattar: åtgärder, antal besök och vad som ingår i priset.'}
                className="w-full p-3.5 bg-slate-800/60 border border-slate-600 rounded-[10px] text-[15px] leading-relaxed text-white placeholder-slate-500 resize-y transition-shadow focus:outline-none focus:border-[#20c58f] focus:ring-4 focus:ring-[#20c58f]/15"
              />
              <div className="flex items-center gap-2.5">
                <div className="flex-1 h-1 rounded-full bg-slate-700 overflow-hidden" aria-hidden="true">
                  <div className={`h-1 ${forLang ? 'bg-red-500' : 'bg-[#20c58f]'}`} style={{ width: `${andel}%` }} />
                </div>
                <span className={`text-[13px] ${forLang ? 'text-red-400 font-semibold' : 'text-slate-400'}`}>
                  {length.toLocaleString('sv-SE')} av {AVTALSOBJEKT_MAX_TECKEN.toLocaleString('sv-SE')} tecken
                  {length > 1024 && !forLang && ', delas automatiskt i två stycken'}
                </span>
              </div>
            </div>

            {/* Portalens avtalsvillkor — skickas INTE till Oneflow.
                Styr uppsägningsbevakning och avtalsfakturering i portalen. */}
            {isContract && (
              <div className={`${CARD_CLASS} px-6 py-[22px] sm:px-7 flex flex-col gap-4`}>
                <KortRubrik
                  ikon={<Lock className="w-5 h-5 text-sky-400" />}
                  ruta="bg-sky-400/10"
                  titel="Villkor i portalen"
                  text="Styr bevakning och fakturering. Skickas inte till Oneflow och syns inte för kunden."
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-[18px]">
                  <label className={LABEL_CLASS}>
                    Uppsägningstid
                    <select
                      value={wizardData.noticePeriodMonths}
                      onChange={(e) => updateWizardData('noticePeriodMonths', e.target.value)}
                      className={FIELD_CLASS}
                    >
                      <option value="0">Ingen uppsägningstid</option>
                      <option value="1">1 månad</option>
                      <option value="2">2 månader</option>
                      <option value="3">3 månader</option>
                      <option value="6">6 månader</option>
                      <option value="12">12 månader</option>
                    </select>
                    <span className="text-xs font-normal text-slate-400">Styr när avtalet flaggas för bevakning inför förlängning.</span>
                  </label>
                  <label className={LABEL_CLASS}>
                    Faktureringsintervall
                    <select
                      value={wizardData.billingFrequency}
                      onChange={(e) => updateWizardData('billingFrequency', e.target.value)}
                      className={FIELD_CLASS}
                    >
                      <option value="annual">Årsvis (1 gång per år)</option>
                      <option value="semi_annual">Halvårsvis</option>
                      <option value="quarterly">Kvartalsvis</option>
                      <option value="monthly">Månadsvis</option>
                    </select>
                    <span className="text-xs font-normal text-slate-400">Styr hur årspremien delas upp i fakturaperioder.</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        )
      }

      case 8:
        return renderReview()

      default:
        return null
    }
  }

  // --- Steg 9: granskningen ---------------------------------------------------

  const renderReview = () => {
    const isCompany = wizardData.partyType === 'company'
    const motpartNamn = (isCompany ? wizardData.foretag : '') || wizardData.Kontaktperson || 'kund'
    const totalLabel = isContract
      ? `Årspremie ${isPrivate ? 'inkl.' : 'exkl.'} moms`
      : `Totalt ${isPrivate ? 'inkl.' : 'exkl.'} moms`
    const { rows, serviceTotal, articleCost, mb } = prisData
    const marginColor = toneTextClass(marginTone(mb.headline_percent))
    const hasDurable = mb.cost_durable > 0
    const kundgrupp = customerGroups.find(g => g.id === wizardData.customer_group_id)
    const tomt = (v: string) => v.trim() || '–'

    const andra = (step: number) => (
      <button type="button" onClick={() => goToStepFromReview(step)} className="min-h-[44px] px-1 text-sm font-semibold text-emerald-400 hover:underline">
        Ändra
      </button>
    )

    return (
      <div className="flex flex-wrap gap-6 items-start">
        {/* Pappret: det kunden ser */}
        <div className="flex-[999_1_600px] min-w-0 bg-slate-900 border border-slate-700 rounded-md shadow-[0_2px_4px_rgba(15,31,46,0.05),0_24px_48px_rgba(15,31,46,0.10)] px-6 py-8 sm:px-14 sm:py-12 flex flex-col gap-7">
          <div className="flex flex-wrap justify-between items-baseline gap-2 border-b border-slate-700 pb-4">
            <span className="text-[22px] font-bold text-white">{isContract ? 'Avtal' : 'Offert'} – {motpartNamn}</span>
            <span className="text-[13px] text-slate-400">{selectedTemplate?.name}</span>
          </div>

          <section className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 tracking-[0.06em] uppercase">Kund</span>
              {andra(counterpartyStep)}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4">
              {isCompany && <PappersFalt etikett="Företag">{tomt(wizardData.foretag)}</PappersFalt>}
              <PappersFalt etikett={isCompany ? 'Org.nr' : 'Personnummer'}>{tomt(wizardData['org-nr'])}</PappersFalt>
              <PappersFalt etikett={isCompany ? 'Kontaktperson' : 'Namn'}>{tomt(wizardData.Kontaktperson)}</PappersFalt>
              <PappersFalt etikett="Utförande adress">{tomt(wizardData['utforande-adress'])}</PappersFalt>
              <PappersFalt etikett="Telefon">{tomt(wizardData['telefonnummer-kontaktperson'])}</PappersFalt>
              <PappersFalt etikett="E-post">{tomt(wizardData['e-post-kontaktperson'])}</PappersFalt>
              <PappersFalt etikett="E-post för faktura">
                {wizardData['e-post-faktura'].trim() || (isContract ? (
                  <span className="inline-flex items-center gap-1.5 text-amber-400 font-semibold">
                    <span className="w-[7px] h-[7px] rounded-full bg-amber-500" />
                    saknas, kunden fyller i
                  </span>
                ) : (
                  <span className="text-slate-400">{tomt(wizardData['e-post-kontaktperson'])}</span>
                ))}
              </PappersFalt>
            </div>
          </section>

          <section className="flex flex-col gap-2.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 tracking-[0.06em] uppercase">{isContract ? 'Avtalstid' : 'Ansvarig'}</span>
              {andra(begoneStep)}
            </div>
            {isContract && (
              <p className="text-[15px] leading-relaxed text-white">
                Avtalet gäller under en inledande period om{' '}
                <strong>{formatContractLength(wizardData.avtalslngd, wizardData.avtalslangdEnhet) || '…'}</strong>.
                {' '}Avtalets begynnelsedag är <strong>{wizardData.begynnelsedag || '…'}</strong>.
              </p>
            )}
            <p className="text-[15px] text-slate-300">
              Ansvarig hos Begone: {wizardData.anstalld}{wizardData['e-post-anstlld'] ? `, ${wizardData['e-post-anstlld']}` : ''}
            </p>
          </section>

          <section className="flex flex-col gap-2.5">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold text-white">{isContract ? '2. Avtalsobjekt' : 'Offertinnehåll'}</span>
              {andra(agreementStep)}
            </div>
            {wizardData.agreementText.trim() ? (
              <p className="text-[15px] leading-relaxed text-white whitespace-pre-line break-words">{wizardData.agreementText}</p>
            ) : (
              <div className="border border-dashed border-red-500 bg-red-500/10 text-red-400 text-[15px] px-4 py-3.5 rounded-md">
                {isContract ? 'Avtalsobjektet är tomt. Kunden får en tom § 2.' : 'Offertinnehållet är tomt.'}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-2.5">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold text-white">Produkter och pris</span>
              {andra(productsStep)}
            </div>
            <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,1fr)_minmax(0,1.2fr)] text-[15px] border-t border-slate-700">
              <span className="py-2.5 text-[13px] text-slate-400">Produkt</span>
              <span className="py-2.5 text-[13px] text-slate-400 text-right">Antal</span>
              <span className="py-2.5 text-[13px] text-slate-400 text-right">Pris</span>
              {rows.length === 0 && (
                <span className="col-span-3 py-2.5 border-t border-slate-700/60 text-red-400">Inga tjänster är valda</span>
              )}
              {rows.map(r => (
                <React.Fragment key={r.key}>
                  <span className="py-2.5 border-t border-slate-700/60 text-white">{r.name}</span>
                  <span className="py-2.5 border-t border-slate-700/60 text-right text-white tabular-nums">{r.quantity}</span>
                  <span className="py-2.5 border-t border-slate-700/60 text-right text-white tabular-nums">{fmtSEK(r.total * priceMultiplier)}</span>
                </React.Fragment>
              ))}
              <span className="py-2.5 border-t border-slate-600 font-bold text-white">{totalLabel}</span>
              <span className="py-2.5 border-t border-slate-600" />
              <span className="py-2.5 border-t border-slate-600 text-right font-bold text-white tabular-nums">{fmtSEK(serviceTotal * priceMultiplier)}</span>
            </div>
          </section>

          <p className="border-t border-slate-700 pt-4 text-[13px] text-slate-400">
            Mallens fasta text, som § 1 Bakgrund, § 3 Omfattning och prislistan, syns i Oneflows PDF i nästa steg.
          </p>
        </div>

        {/* Sidokolumnen: kontroll, interna villkor, skapa */}
        <div className="flex-[1_1_320px] min-w-[280px] flex flex-col gap-4">
          <div className={`${CARD_CLASS} p-5 flex flex-col gap-3.5`}>
            <span className="text-base font-bold text-white">Kontroll före utskick</span>
            <ul className="flex flex-col gap-3 text-[15px]">
              {kontrollPunkter.map((p, i) => (
                <li key={i} className="flex gap-2.5 items-start">
                  <span className={`w-2 h-2 rounded-full mt-[7px] shrink-0 ${PUNKT_FARG[p.niva]}`} />
                  <span className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-white break-words">{p.text}</span>
                    {p.niva !== 'gron' && (
                      <button
                        type="button"
                        onClick={() => goToStepFromReview(avsnittSteg[p.avsnitt])}
                        className="self-start min-h-[44px] text-sm font-semibold text-emerald-400 hover:underline"
                      >
                        {p.niva === 'rod' ? 'Rätta' : 'Fyll i'} under {avsnittNamn[p.avsnitt]}
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <span className="text-[13px] text-slate-400 border-t border-slate-700/60 pt-3">
              Röd punkt stoppar. Rätta först, sedan går det vidare.
            </span>
          </div>

          <div className={`${CARD_CLASS} p-5 flex flex-col gap-3`}>
            <div className="flex flex-col gap-0.5">
              <span className="text-base font-bold text-white">{isContract ? 'Villkor i portalen' : 'Internt'}</span>
              <span className="text-[13px] text-slate-400">Syns inte för kunden</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[15px]">
              {isContract && (
                <>
                  <span className="text-slate-400">Uppsägningstid</span><span className="text-white">{noticeLabel(wizardData.noticePeriodMonths)}</span>
                  <span className="text-slate-400">Fakturering</span><span className="text-white">{BILLING_FREQUENCY_LABEL[wizardData.billingFrequency] ?? wizardData.billingFrequency}</span>
                  <span className="text-slate-400">Kundgrupp</span><span className="text-white break-words">{kundgrupp?.name ?? '–'}</span>
                </>
              )}
              {articleCost > 0 ? (
                <>
                  <span className="text-slate-400">Intern inköpskostnad</span><span className="text-white tabular-nums">{fmtSEK(articleCost)}</span>
                  {hasDurable && (
                    <><span className="text-slate-400">varav varaktig utrustning, engångs</span><span className="text-white tabular-nums">{fmtSEK(mb.cost_durable)}</span></>
                  )}
                  <span className="text-slate-400">{hasDurable ? 'Löpande marginal' : 'Marginal'}</span>
                  <span className={`font-semibold tabular-nums ${marginColor}`}>
                    {(mb.headline_percent ?? 0).toFixed(1)} % ({fmtSEK(mb.contribution_ongoing)}{hasDurable ? '/år' : ''})
                  </span>
                  {hasDurable && (
                    <>
                      <span className="text-slate-400">Marginal år 1</span>
                      <span className="text-white tabular-nums">{mb.margin_percent_year1 != null ? `${mb.margin_percent_year1.toFixed(1)} %` : '–'}</span>
                      <span className="text-slate-400">Återbetald efter</span>
                      <span className="text-white tabular-nums">{mb.payback_never ? 'återbetalas inte' : formatPayback(mb.payback_years)}</span>
                      {mb.margin_percent_3y != null && (
                        <><span className="text-slate-400">Marginal över tre år</span><span className="text-white tabular-nums">{mb.margin_percent_3y.toFixed(1)} %</span></>
                      )}
                    </>
                  )}
                </>
              ) : (
                <><span className="text-slate-400">Marginal</span><span className="text-slate-400">inga interna artiklar</span></>
              )}
            </div>
            {hasDurable && (
              <p className="text-[13px] text-slate-400">Fällor och stationer säljs oftast som årspris (tilläggsstation per år), inte som engångsköp.</p>
            )}
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => { setSubmitError(null); handleSubmit() }}
              disabled={kontrollStoppar || isCreating}
              className={`${PRIMARY_BUTTON_STOR} flex items-center justify-center gap-2`}
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {creationStep || 'Skapar utkast...'}
                </>
              ) : 'Skapa och visa Oneflows PDF'}
            </button>
            <span className="text-sm text-slate-400 leading-relaxed">
              {isContract ? 'Avtalet' : 'Offerten'} skapas som utkast i Oneflow. Inget skickas till kunden förrän du godkänt PDF:en.
            </span>
            {submitError && !isCreating && (
              <div className="flex gap-2.5 items-start text-[15px]">
                <span className="w-2 h-2 rounded-full mt-[7px] shrink-0 bg-red-500" />
                <span className="flex flex-col gap-0.5">
                  <span className="text-white">{submitError}</span>
                  {submitErrorStep !== null && (
                    <button type="button" onClick={() => goToStepFromReview(submitErrorStep)} className="self-start min-h-[44px] text-sm font-semibold text-emerald-400 hover:underline">
                      Rätta under {avsnittNamn.motpart}
                    </button>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // --- Steg 10: Oneflows PDF -------------------------------------------------

  const renderDraft = () => {
    if (!draftContract) return null
    const isCompany = wizardData.partyType === 'company'
    const motpartNamn = (isCompany ? wizardData.foretag : '') || wizardData.Kontaktperson || 'kund'
    const dokNamn = `${isContract ? 'Avtal' : 'Offert'} – ${motpartNamn}`
    const busy = draftAction !== null
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className={`text-[30px] leading-tight tracking-[-0.015em] text-white ${RUBRIK_FONT}`}>Så här ser kunden {isContract ? 'avtalet' : 'offerten'}</h1>
          <p className="text-base text-slate-400 max-w-[680px]">
            Oneflows egen PDF, med mallens fasta text. Bläddra igenom och godkänn innan {isContract ? 'det' : 'den'} skickas.
          </p>
        </div>

        {draftContract.warning && (
          <p className="flex gap-2.5 items-start text-[15px] text-white">
            <span className="w-2 h-2 rounded-full mt-[7px] shrink-0 bg-red-500" />
            {draftContract.warning}
          </p>
        )}

        <div className="flex flex-wrap gap-6 items-start">
          <OneflowPdfFrame
            oneflowContractId={draftContract.id}
            title={dokNamn}
            className="flex-[999_1_600px] min-w-0 shadow-[0_1px_2px_rgba(15,31,46,0.04),0_10px_28px_rgba(15,31,46,0.06)]"
          />

          <div className="flex-[1_1_320px] min-w-[280px] flex flex-col gap-4">
            <div className={`${CARD_CLASS} p-5 flex flex-col gap-4`}>
              <span className="text-base font-bold text-white">Ser allt rätt ut?</span>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleSendDraft}
                  disabled={busy || !!draftContract.warning}
                  className={`${PRIMARY_BUTTON_STOR} flex items-center justify-center gap-2`}
                >
                  {draftAction === 'send' && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isContract ? 'Skicka för signering' : 'Skicka offerten'}
                </button>
                <span className="text-sm text-slate-400 break-words">
                  Skickas från info@begone.se till {wizardData['e-post-kontaktperson']}.
                </span>
              </div>
              <div className="flex flex-col gap-2 border-t border-slate-700/60 pt-4">
                <button
                  type="button"
                  onClick={handleEditDraft}
                  disabled={busy}
                  className={`${OUTLINE_BUTTON} flex items-center justify-center gap-2`}
                >
                  {draftAction === 'remove' && <Loader2 className="w-4 h-4 animate-spin" />}
                  Ändra i wizarden
                </button>
                <span className="text-sm text-slate-400">Utkastet tas bort i Oneflow och ett nytt skapas när du är klar.</span>
              </div>
              <div className="flex flex-col gap-2 border-t border-slate-700/60 pt-4">
                <button type="button" onClick={handleSaveDraft} disabled={busy} className={OUTLINE_BUTTON}>
                  Spara som utkast
                </button>
                <span className="text-sm text-slate-400">
                  Ligger kvar under Dokumentsignering. Därifrån kan du öppna PDF:en igen och skicka senare, utan att gå in i Oneflow.
                </span>
              </div>
            </div>

            <div className={`${CARD_CLASS} p-5 flex flex-col gap-2 text-[15px]`}>
              <span className="text-base font-bold text-white">Om något saknas i PDF:en</span>
              <span className="text-slate-400 leading-relaxed">
                Står ett fält tomt fast det var ifyllt i wizarden ligger felet i Oneflow-mallen. Välj Ändra och byt mall, eller säg till en admin.
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- Bekräftelse efter skick ------------------------------------------------

  const renderSent = () => (
    <div className={`${CARD_CLASS} p-6 flex flex-col gap-5`}>
      <div className="flex flex-col gap-1.5">
        <h1 className={`text-[30px] leading-tight tracking-[-0.015em] text-white ${RUBRIK_FONT}`}>
          {isContract ? 'Avtalet är skickat' : 'Offerten är skickad'}
        </h1>
        <p className="text-base text-slate-400">
          Kunden har fått {isContract ? 'avtalet för signering' : 'offerten för granskning'} från info@begone.se. Du skickas vidare till Dokumentsignering.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[15px] max-w-md">
        <span className="text-slate-400">{isContract ? 'Avtals-ID' : 'Offert-ID'}</span>
        <span className="font-mono text-white">#{createdContract?.id}</span>
        <span className="text-slate-400">Status</span>
        <span className="inline-flex items-center gap-1.5 text-white">
          <span className="w-2 h-2 rounded-full bg-[#20c58f]" />
          Skickat för {isContract ? 'signering' : 'granskning'}
        </span>
      </div>
      <div className="flex flex-wrap gap-3">
        <a
          href={`https://app.oneflow.com/contracts/${createdContract?.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${OUTLINE_BUTTON} inline-flex items-center gap-2`}
        >
          <ExternalLink className="w-4 h-4" />
          Öppna i Oneflow
        </a>
        <button
          type="button"
          className={OUTLINE_BUTTON}
          onClick={() => {
            setCreatedContract(null)
            setDraftContract(null)
            setCurrentStep(1)
            setMaxReachedStep(1)
            setFromReview(false)
            setWizardData(createInitialWizardData(defaultAnstalld, user?.email || ''))
          }}
        >
          Skapa nytt dokument
        </button>
      </div>
    </div>
  )

  // --- Sidan ---------------------------------------------------------------

  const visibleSteps = STEPS.filter(step => !(step.id === 3 && wizardData.documentType === 'offer' && wizardData.selectedTemplate))
  const visibleIndex = visibleSteps.findIndex(s => s.id === currentStep) + 1
  const [rubrik, ingress] = stepHeadings()
  const isReview = currentStep === reviewStep
  const phase: 'wizard' | 'draft' | 'sent' = createdContract ? 'sent' : draftContract ? 'draft' : 'wizard'
  const motpartNamn = (wizardData.partyType === 'company' ? wizardData.foretag : '') || wizardData.Kontaktperson
  const hint = !canProceed() ? getValidationHint() : ''
  const procent = Math.round(((Math.max(visibleIndex, 1) - 1) / visibleSteps.length) * 100)
  const bandTitel = phase === 'wizard'
    ? (isContract ? 'Nytt avtal' : 'Ny offert')
    : `${isContract ? 'Avtal' : 'Offert'} – ${motpartNamn || 'kund'}`

  // Sidokolumnen "Ditt avtal": riktiga värden ur wizarden, grön punkt när ifyllt
  const visaSammanfattning = phase === 'wizard' && !isReview
  const kundgruppNamn = customerGroups.find(g => g.id === wizardData.customer_group_id)?.name
  const avtalslangdText = formatContractLength(wizardData.avtalslngd, wizardData.avtalslangdEnhet)
  const sammanfattning: Array<{ namn: string; text: string; klar: boolean }> = [
    { namn: 'Dokument', text: isContract ? 'Avtalsförslag' : 'Offert', klar: maxReachedStep > 1 },
    { namn: 'Mall', text: selectedTemplate?.name ?? '', klar: !!selectedTemplate },
    { namn: 'Avtalspart', text: isPrivate ? 'Privatperson' : 'Företag', klar: maxReachedStep > 3 },
    ...(isContract ? [
      { namn: 'Kundgrupp', text: kundgruppNamn ?? '', klar: !!kundgruppNamn },
      {
        namn: 'Avtalstid',
        text: `${avtalslangdText}${wizardData.begynnelsedag ? ` från ${wizardData.begynnelsedag}` : ''}`,
        klar: maxReachedStep > begoneStep && !!avtalslangdText,
      },
    ] : []),
    { namn: 'Motpart', text: motpartNamn, klar: !!motpartNamn.trim() },
    {
      namn: isContract ? 'Årspremie' : 'Pris',
      text: `${fmtSEK(prisData.serviceTotal * priceMultiplier)} ${isPrivate ? 'inkl.' : 'exkl.'} moms`,
      klar: prisData.serviceTotal > 0,
    },
    {
      namn: isContract ? 'Avtalsobjekt' : 'Offertinnehåll',
      text: `${wizardData.agreementText.length.toLocaleString('sv-SE')} tecken`,
      klar: maxReachedStep >= agreementStep && !!wizardData.agreementText.trim(),
    },
  ]
  const antalIfyllda = sammanfattning.filter(r => r.klar).length

  const renderSammanfattning = () => (
    <aside
      aria-label={isContract ? 'Ditt avtal' : 'Din offert'}
      className={`${currentStep === productsStep ? 'hidden xl:flex' : 'hidden lg:flex'} flex-[1_1_280px] min-w-[260px] max-w-[340px] sticky top-6 flex-col gap-3.5`}
    >
      <div className={`${CARD_CLASS} overflow-hidden`}>
        <div className="px-5 py-[18px] border-b border-slate-700 flex items-center justify-between">
          <span className="text-[15px] font-bold text-white">{isContract ? 'Ditt avtal' : 'Din offert'}</span>
          <span className="text-[13px] text-slate-500">{antalIfyllda} av {sammanfattning.length}</span>
        </div>
        <ul className="flex flex-col py-2">
          {sammanfattning.map(r => (
            <li key={r.namn} className="flex gap-3 items-start px-5 py-[9px]">
              <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${r.klar ? 'bg-[#20c58f]' : 'bg-slate-700'}`} />
              <span className="flex flex-col gap-px min-w-0">
                <span className="text-xs text-slate-500">{r.namn}</span>
                <span className={`text-sm truncate ${r.klar ? 'font-semibold text-white' : 'text-slate-500'}`} title={r.klar ? r.text : undefined}>
                  {r.klar ? r.text : 'Inte ifyllt än'}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <InfoRuta ikon={<Info className="w-[18px] h-[18px]" />}>
        Inget skickas till kunden förrän du har sett Oneflows PDF och godkänt den.
      </InfoRuta>
    </aside>
  )

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Mörkt band: mörkt i båda temana, därför hex-färger och aldrig slate/white */}
      <header className="relative overflow-hidden bg-[#0e1c2b] text-[#e8eef4]">
        <svg aria-hidden="true" className="absolute inset-0 w-full h-full opacity-50 pointer-events-none">
          <defs>
            <pattern id="avtalsband-prickar" width="22" height="22" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="#2a3d52" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#avtalsband-prickar)" />
        </svg>
        <svg aria-hidden="true" width="420" height="220" viewBox="0 0 420 220" className="absolute -right-10 -top-[30px] opacity-90 pointer-events-none">
          <circle cx="300" cy="90" r="120" fill="none" stroke="#20c58f" strokeOpacity="0.18" strokeWidth="1.5" />
          <circle cx="300" cy="90" r="80" fill="none" stroke="#20c58f" strokeOpacity="0.12" strokeWidth="1.5" />
          <circle cx="300" cy="90" r="40" fill="#20c58f" fillOpacity="0.08" />
        </svg>

        <div className={`relative max-w-[1180px] mx-auto px-4 sm:px-6 pt-[22px] flex flex-col gap-[22px] ${phase === 'wizard' ? '' : 'pb-[26px]'}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <span className="w-11 h-11 shrink-0 rounded-xl bg-[#20c58f] text-[#052e22] flex items-center justify-center shadow-[0_6px_18px_rgba(32,197,143,0.35)]">
                <FileText className="w-6 h-6" strokeWidth={1.9} aria-hidden="true" />
              </span>
              <div className="flex flex-col gap-0.5 min-w-0">
                <button
                  type="button"
                  onClick={() => leaveWizard(getDraftListRoute())}
                  className="self-start min-h-[44px] -my-3 flex items-center text-[13px] text-[#8ea3b8] hover:text-[#fff] transition-colors"
                >
                  Avtal &amp; Offerter
                </button>
                <span className={`text-2xl tracking-[-0.01em] text-[#fff] truncate ${RUBRIK_FONT}`}>{bandTitel}</span>
              </div>
            </div>
            {phase === 'draft' && draftContract ? (
              <span className="flex items-center gap-2 text-sm text-[#c9d6e2]">
                <span className="w-2 h-2 rounded-full bg-[#f5a524] shadow-[0_0_0_4px_rgba(245,165,36,0.2)]" />
                Utkast i Oneflow · ID {draftContract.id}
              </span>
            ) : phase === 'wizard' ? (
              <div className="flex items-center gap-[18px]">
                <span className="text-sm text-[#8ea3b8]">{procent} % klart</span>
                <button
                  type="button"
                  onClick={() => leaveWizard(getDashboardRoute())}
                  className="min-h-[44px] text-sm text-[#c9d6e2] hover:text-[#fff] transition-colors"
                >
                  Avbryt
                </button>
              </div>
            ) : null}
          </div>
          {phase === 'wizard' && (
            <AnimatedProgressBar
              steps={STEPS}
              currentStep={currentStep}
              onStepClick={handleStepClick}
              maxReachedStep={maxReachedStep}
              documentType={wizardData.documentType}
              selectedTemplate={wizardData.selectedTemplate}
              procent={procent}
            />
          )}
        </div>
      </header>

      {/* Innehåll */}
      <main className="flex-1 w-full max-w-[1180px] mx-auto px-4 sm:px-6 pt-9 sm:pt-10 pb-10">
        {phase === 'sent' ? renderSent() : phase === 'draft' ? renderDraft() : (
          <div className="flex flex-wrap gap-7 items-start">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="flex-[999_1_560px] min-w-0 flex flex-col gap-6"
              >
                {isReview ? (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[13px] text-slate-400">Steg {visibleIndex} av {visibleSteps.length}</span>
                    <h1 className={`text-[30px] leading-tight tracking-[-0.015em] text-white ${RUBRIK_FONT}`}>{rubrik}</h1>
                    <p className="text-base text-slate-400 max-w-[680px]">{ingress}</p>
                  </div>
                ) : (
                  <div className="flex gap-[18px] items-center">
                    <span className={`w-14 h-14 shrink-0 rounded-2xl bg-slate-900 border border-slate-700 shadow-[0_4px_14px_rgba(15,31,46,0.06)] flex items-center justify-center text-[22px] text-emerald-400 ${RUBRIK_FONT}`}>
                      {visibleIndex}
                    </span>
                    <div className="flex flex-col gap-1 min-w-0">
                      <h1 className={`text-[26px] sm:text-[30px] leading-tight tracking-[-0.015em] text-white ${RUBRIK_FONT}`}>{rubrik}</h1>
                      <p className="text-base text-slate-400">{ingress}</p>
                    </div>
                  </div>
                )}
                {renderStepContent()}
              </motion.div>
            </AnimatePresence>
            {visaSammanfattning && renderSammanfattning()}
          </div>
        )}
      </main>

      {/* Fast bottenlist: Föregående, valideringstips, Nästa */}
      {phase === 'wizard' && (
        <div className="sticky bottom-0 z-20 bg-slate-900/90 backdrop-blur border-t border-slate-700 shadow-[0_-8px_24px_rgba(15,31,46,0.05)]">
          <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={prevStep}
              disabled={currentStep === 1}
              className={`${OUTLINE_BUTTON} inline-flex items-center gap-2`}
            >
              <ArrowLeft className="w-[18px] h-[18px]" aria-hidden="true" />
              <span className="hidden sm:inline">Föregående</span>
              <span className="sm:hidden">Tillbaka</span>
            </button>

            <p className="flex-1 text-center text-[13px] min-w-0">
              {isReview
                ? (kontrollStoppar
                  ? <span className="text-red-400">Rätta de röda punkterna först</span>
                  : <span className="text-slate-400">Steg {visibleIndex} av {visibleSteps.length}</span>)
                : hint
                  ? <span className="text-amber-400">{hint}</span>
                  : <span className="text-slate-400">Steg {visibleIndex} av {visibleSteps.length}</span>}
            </p>

            {!isReview && (fromReview ? (
              <button type="button" onClick={backToReview} disabled={!canProceed()} className={`${PRIMARY_BUTTON} inline-flex items-center gap-2`}>
                Tillbaka till granskningen
                <ArrowRight className="w-[18px] h-[18px]" aria-hidden="true" />
              </button>
            ) : (
              <button type="button" onClick={nextStep} disabled={!canProceed()} className={`${PRIMARY_BUTTON} inline-flex items-center gap-2`}>
                {currentStep === agreementStep ? (isContract ? 'Granska avtalet' : 'Granska offerten') : 'Nästa'}
                <ArrowRight className="w-[18px] h-[18px]" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
