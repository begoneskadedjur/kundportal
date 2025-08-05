// 📁 src/pages/admin/oneflow/OneflowContractCreator.tsx
// KOMPLETT WIZARD VERSION - STEG FÖR STEG GUIDE MED ANVÄNDARINTEGRATION

import React, { useState } from 'react'
import { ArrowLeft, ArrowRight, Eye, FileText, Building2, Mail, Send, CheckCircle, ExternalLink, User, Calendar, Hash, Phone, MapPin, DollarSign, FileCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext' // 🆕 HÄMTA ANVÄNDARINFO
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'

// Oneflow mallar för offertförslag
const OFFER_TEMPLATES = [
  { 
    id: '8598798', 
    name: 'Offertförslag – Exkl Moms (Företag)',
    type: 'company'
  },
  { 
    id: '8919037', 
    name: 'Offertförslag – Inkl moms (Privatperson)',
    type: 'individual'
  },
  { 
    id: '8919012', 
    name: 'Offertförslag – ROT (Privatperson)',
    type: 'individual'
  },
  { 
    id: '8919059', 
    name: 'Offertförslag – RUT (Privatperson)',
    type: 'individual'
  }
]

// Oneflow mallar för avtalsförslag
const CONTRACT_TEMPLATES = [
  { 
    id: '8486368', 
    name: 'Skadedjursavtal',
    popular: true
  },
  { 
    id: '9324573', 
    name: 'Avtal Betesstationer'
  },
  { 
    id: '8465556', 
    name: 'Avtal Betongstationer'
  },
  { 
    id: '8462854', 
    name: 'Avtal Mekaniska fällor'
  },
  { 
    id: '8732196', 
    name: 'Avtal Indikationsfällor'
  }
]

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
  
  // Steg 6 - Avtalsobjekt
  agreementText: string
  
  // Steg 7 - Slutsteg
  sendForSigning: boolean
}

const STEPS = [
  { id: 1, title: 'Dokumenttyp', icon: FileCheck },
  { id: 2, title: 'Välj Mall', icon: FileText },
  { id: 3, title: 'Avtalspart', icon: User },
  { id: 4, title: 'BeGone Info', icon: Building2 },
  { id: 5, title: 'Motpart', icon: Mail },
  { id: 6, title: 'Avtalsobjekt', icon: FileText },
  { id: 7, title: 'Granska & Skicka', icon: Send }
]

export default function OneflowContractCreator() {
  const navigate = useNavigate()
  const { user, profile } = useAuth() // 🆕 HÄMTA ANVÄNDARINFO
  const [currentStep, setCurrentStep] = useState(1)
  const [isCreating, setIsCreating] = useState(false)
  const [createdContract, setCreatedContract] = useState<any>(null)
  
  // 🆕 DYNAMISK BEGONE INFO BASERAT PÅ INLOGGAD ANVÄNDARE
  const [wizardData, setWizardData] = useState<WizardData>({
    documentType: 'contract',
    selectedTemplate: '',
    partyType: 'company',
    // 🆕 ANVÄND INLOGGAD ANVÄNDARES INFO SOM DEFAULT
    anstalld: user?.user_metadata?.full_name || profile?.display_name || 'BeGone Medarbetare',
    'e-post-anstlld': user?.email || 'medarbetare@begone.se',
    avtalslngd: '1',
    begynnelsedag: new Date().toISOString().split('T')[0],
    Kontaktperson: '',
    'e-post-kontaktperson': '',
    'telefonnummer-kontaktperson': '',
    'utforande-adress': '',
    foretag: '',
    'org-nr': '',
    agreementText: 'Regelbunden kontroll och bekämpning av skadedjur enligt överenskommet schema. Detta inkluderar inspektion av samtliga betesstationer, påfyllning av bete vid behov, samt dokumentation av aktivitet. Vid tecken på gnagaraktivitet vidtas omedelbara åtgärder med förstärkta insatser.',
    sendForSigning: true
  })

  const updateWizardData = (field: keyof WizardData, value: any) => {
    setWizardData(prev => {
      const updated = { ...prev, [field]: value }
      
      // Om vi väljer en offertmall, uppdatera automatiskt partyType baserat på mallens typ
      if (field === 'selectedTemplate' && updated.documentType === 'offer') {
        const template = OFFER_TEMPLATES.find(t => t.id === value)
        if (template) {
          updated.partyType = template.type as 'company' | 'individual'
        }
      }
      
      // Om vi byter dokumenttyp, rensa vald mall
      if (field === 'documentType') {
        updated.selectedTemplate = ''
      }
      
      return updated
    })
  }

  const nextStep = () => {
    if (currentStep < STEPS.length) {
      let nextStepNumber = currentStep + 1
      
      // Om vi är på steg 2 (mallval) och har valt en offertmall,
      // hoppa över steg 3 (avtalspart) eftersom den väljs automatiskt
      if (currentStep === 2 && wizardData.documentType === 'offer' && wizardData.selectedTemplate) {
        nextStepNumber = 4
      }
      
      setCurrentStep(nextStepNumber)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      let prevStepNumber = currentStep - 1
      
      // Om vi kommer tillbaka från steg 4 och har en offertmall vald,
      // hoppa över steg 3 (avtalspart) tillbaka till steg 2 (mallval)
      if (currentStep === 4 && wizardData.documentType === 'offer' && wizardData.selectedTemplate) {
        prevStepNumber = 2
      }
      
      setCurrentStep(prevStepNumber)
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 1: return wizardData.documentType !== ''
      case 2: return wizardData.selectedTemplate !== ''
      case 3: return true // Partytype har default
      case 4: return wizardData.anstalld && wizardData['e-post-anstlld'] && wizardData.avtalslngd
      case 5: return wizardData.Kontaktperson && wizardData['e-post-kontaktperson']
      case 6: return wizardData.agreementText.length > 0
      case 7: return true
      default: return false
    }
  }

  // Hitta rätt mall baserat på dokumenttyp
  const availableTemplates = wizardData.documentType === 'offer' ? OFFER_TEMPLATES : CONTRACT_TEMPLATES
  const selectedTemplate = availableTemplates.find(t => t.id === wizardData.selectedTemplate)

  const handleSubmit = async () => {
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
      'faktura-adress-pdf': wizardData['e-post-kontaktperson'],
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
    try {
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
          // 🆕 SKICKA ANVÄNDARENS UPPGIFTER
          senderEmail: user?.email,
          senderName: wizardData.anstalld
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || error.message || 'Ett okänt serverfel inträffade')
      }
      
      const result = await response.json()
      setCreatedContract(result.contract)
      toast.success('✅ Kontrakt skapat framgångsrikt!')
      
    } catch (err: any) {
      toast.error(`❌ Fel: ${err.message}`)
    } finally {
      setIsCreating(false)
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

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Typ av Dokument</h2>
              <p className="text-slate-400">Välj om du vill skicka ett offertförslag eller avtalsförslag</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
              <div
                onClick={() => updateWizardData('documentType', 'offer')}
                className={`p-8 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:scale-105 ${
                  wizardData.documentType === 'offer'
                    ? 'border-green-500 bg-green-500/10 shadow-lg shadow-green-500/20'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                }`}
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
                    <CheckCircle className="w-6 h-6 text-green-500 mx-auto mt-4" />
                  )}
                </div>
              </div>

              <div
                onClick={() => updateWizardData('documentType', 'contract')}
                className={`p-8 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:scale-105 ${
                  wizardData.documentType === 'contract'
                    ? 'border-green-500 bg-green-500/10 shadow-lg shadow-green-500/20'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                }`}
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
                    <CheckCircle className="w-6 h-6 text-green-500 mx-auto mt-4" />
                  )}
                </div>
              </div>
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
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {availableTemplates.map(template => (
                <div
                  key={template.id}
                  onClick={() => updateWizardData('selectedTemplate', template.id)}
                  className={`relative p-6 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:scale-105 ${
                    wizardData.selectedTemplate === template.id
                      ? 'border-green-500 bg-green-500/10 shadow-lg shadow-green-500/20'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  }`}
                >
                  {template.popular && (
                    <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                      Populär
                    </div>
                  )}
                  
                  {wizardData.documentType === 'offer' && 'type' in template && (
                    <div className="absolute -top-2 -left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                      {template.type === 'company' ? 'Företag' : 'Privatperson'}
                    </div>
                  )}
                  
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-white mb-2">{template.name}</h3>
                    
                    {wizardData.selectedTemplate === template.id && (
                      <div className="flex items-center justify-center mt-4">
                        <CheckCircle className="w-6 h-6 text-green-500" />
                      </div>
                    )}
                  </div>
                </div>
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
                    Avtalet kommer att skapas i ditt namn och skickas från din e-post.
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

      case 6:
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
              </div>
            </Card>
          </div>
        )

      case 7:
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
                  <span className="text-slate-400">E-post:</span>
                  <span className="text-white">{user?.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Oneflow-användare:</span>
                  <span className="text-green-400">✓ Aktiv</span>
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
                  ? `📧 ${wizardData.documentType === 'offer' ? 'Offerten' : 'Kontraktet'} publiceras och skickas från ${user?.email} till motparten för ${wizardData.documentType === 'offer' ? 'granskning' : 'signering'}` 
                  : `📝 ${wizardData.documentType === 'offer' ? 'Offerten' : 'Kontraktet'} skapas som utkast i Oneflow och kan skickas senare`
                }
              </p>
            </Card>

            {/* Skapa kontrakt */}
            <div className="text-center">
              <Button 
                onClick={handleSubmit}
                disabled={isCreating}
                className="px-8 py-3 text-lg"
                size="lg"
              >
                {isCreating ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Skapar kontrakt...
                  </>
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
                        // 🆕 ÅTERSTÄLL MED ANVÄNDARENS INFO
                        anstalld: user?.user_metadata?.full_name || profile?.display_name || 'BeGone Medarbetare',
                        'e-post-anstlld': user?.email || 'medarbetare@begone.se',
                        avtalslngd: '1',
                        begynnelsedag: new Date().toISOString().split('T')[0],
                        Kontaktperson: '',
                        'e-post-kontaktperson': '',
                        'telefonnummer-kontaktperson': '',
                        'utforande-adress': '',
                        foretag: '',
                        'org-nr': '',
                        agreementText: 'Regelbunden kontroll och bekämpning av skadedjur enligt överenskommet schema. Detta inkluderar inspektion av samtliga betesstationer, påfyllning av bete vid behov, samt dokumentation av aktivitet. Vid tecken på gnagaraktivitet vidtas omedelbara åtgärder med förstärkta insatser.',
                        sendForSigning: true
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
      {/* Header */}
      <header className="bg-slate-900/50 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => navigate('/admin/dashboard')} 
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

      {/* Progress Steps */}
      <div className="bg-slate-900/30 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const Icon = step.icon
              const isActive = currentStep === step.id
              const isCompleted = currentStep > step.id
              const isClickable = currentStep > step.id || currentStep === step.id
              
              // Dölj steg 3 (avtalspart) för offerter eftersom det väljs automatiskt
              const shouldSkip = step.id === 3 && wizardData.documentType === 'offer' && wizardData.selectedTemplate
              if (shouldSkip) return null
              
              return (
                <div key={step.id} className="flex items-center">
                  <div 
                    className={`flex items-center gap-3 ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                    onClick={() => isClickable && setCurrentStep(step.id)}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                      isCompleted 
                        ? 'border-green-500 bg-green-500 text-white' 
                        : isActive 
                          ? 'border-blue-500 bg-blue-500 text-white' 
                          : 'border-slate-600 bg-slate-800 text-slate-400'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>
                    <div className="hidden md:block">
                      <p className={`text-sm font-medium ${
                        isActive ? 'text-blue-400' : isCompleted ? 'text-green-400' : 'text-slate-400'
                      }`}>
                        Steg {step.id}
                      </p>
                      <p className={`text-xs ${
                        isActive ? 'text-white' : isCompleted ? 'text-slate-300' : 'text-slate-500'
                      }`}>
                        {step.title}
                      </p>
                    </div>
                  </div>
                  
                  {index < STEPS.length - 1 && (
                    <div className={`w-8 md:w-16 h-0.5 mx-2 md:mx-4 ${
                      currentStep > step.id ? 'bg-green-500' : 'bg-slate-700'
                    }`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="min-h-[600px]">
          {renderStepContent()}
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