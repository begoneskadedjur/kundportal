import React, { useState } from 'react'
import { ArrowLeft, TestTube, Eye, FileText, Building2, Mail, Send, CheckCircle, ExternalLink, User, Hash, Phone, MapPin, Calendar } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'

// Oneflow mallar - FÖRENKLAD VERSION (inga ikoner/beskrivningar)
const ONEFLOW_TEMPLATES = [
  { 
    id: '8486368', 
    name: 'Skadedjursavtal', 
    popular: true
  },
  { 
    id: '10102378', 
    name: 'Komplett Skadedjursavtal', 
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

interface ContractData {
  [key: string]: string
}

interface Recipient {
  name: string
  email: string
  company_name: string
  organization_number: string
}

export default function OneflowContractCreator() {
  const navigate = useNavigate()
  
  const LIMIT = 1024

  const [selectedTemplate, setSelectedTemplate] = useState('8486368')
  const [agreementObjectText, setAgreementObjectText] = useState(
    'Regelbunden kontroll och bekämpning av skadedjur enligt överenskommet schema. Detta inkluderar inspektion av samtliga betesstationer, påfyllning av bete vid behov, samt dokumentation av aktivitet. Vid tecken på gnagaraktivitet vidtas omedelbara åtgärder med förstärkta insatser.'
  )

  // BeGone företagsinfo (leverantör) - ÄNDRAD TILL ÅR
  const [contractData, setContractData] = useState<ContractData>({
    anstalld: 'Christian Karlsson',
    avtalslngd: '1',                              // ÄNDRAT: Nu representerar år istället för månader
    begynnelsedag: new Date().toISOString().split('T')[0], 
    'dokument-skapat': new Date().toISOString().split('T')[0],
    'e-post-anstlld': 'christian.karlsson@begone.se',    
  })
  
  // Kundinfo (mottagare) - UPPDATERAD DUMMY DATA
  const [recipient, setRecipient] = useState<Recipient>({
    name: 'Anna Svensson',
    email: 'anna.svensson@example.com',
    company_name: 'Svenssons Restaurang AB',
    organization_number: '556789-1234',
  })

  // Kundspecifika fält
  const [customerData, setCustomerData] = useState({
    'e-post-kontaktperson': 'anna.svensson@example.com',
    'faktura-adress-pdf': 'anna.svensson@example.com',
    foretag: 'Svenssons Restaurang AB',
    Kontaktperson: 'Anna Svensson',
    'org-nr': '556789-1234',
    'telefonnummer-kontaktperson': '08-555 0123',
    'utforande-adress': 'Storgatan 15, 111 22 Stockholm',
  })

  const [partyType, setPartyType] = useState<'company' | 'individual'>('company')
  const [sendForSigning, setSendForSigning] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [createdContract, setCreatedContract] = useState<any>(null)

  const handleCustomerDataChange = (field: string, value: string) => {
    setCustomerData(prev => ({ ...prev, [field]: value }))
    
    // Synka med recipient
    if (field === 'Kontaktperson') {
      setRecipient(prev => ({ ...prev, name: value }))
    } else if (field === 'e-post-kontaktperson') {
      setRecipient(prev => ({ ...prev, email: value }))
    } else if (field === 'foretag') {
      setRecipient(prev => ({ ...prev, company_name: value }))
    } else if (field === 'org-nr') {
      setRecipient(prev => ({ ...prev, organization_number: value }))
    }
  }

  const handleBeGoneDataChange = (field: string, value: string) => {
    setContractData(prev => ({ ...prev, [field]: value }))
  }

  const handleCreateContract = async () => {
    if (!selectedTemplate || !recipient.email) {
      toast.error('Välj mall och fyll i kundens e-post.')
      return
    }

    const part1 = agreementObjectText.substring(0, LIMIT)
    const part2 = agreementObjectText.substring(LIMIT, LIMIT * 2)

    // KONVERTERA ÅR TILL MÅNADER för Oneflow (backend förväntar månader)
    const contractLengthInMonths = parseInt(contractData.avtalslngd) * 12

    const finalContractData = {
      ...contractData,
      ...customerData,
      avtalslngd: contractLengthInMonths.toString(), // Skicka månader till backend
      'stycke-1': part1,
      'stycke-2': part2,
    }

    setIsCreating(true)
    try {
      console.log('🚀 Skickar kontrakt-request:', {
        templateId: selectedTemplate,
        contractData: finalContractData,
        recipient,
        sendForSigning,
        partyType
      })

      const response = await fetch('/api/oneflow/create-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          templateId: selectedTemplate, 
          contractData: finalContractData, 
          recipient, 
          sendForSigning, 
          partyType 
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        console.error('❌ Oneflow API fel:', error)
        throw new Error(error.detail || error.message || 'Ett okänt serverfel inträffade')
      }
      
      const result = await response.json()
      console.log('✅ Kontrakt skapat:', result)
      setCreatedContract(result.contract)
      toast.success('✅ Kontrakt skapat framgångsrikt!')
      
    } catch (err: any) {
      console.error('Fel vid skapande av kontrakt:', err)
      toast.error(`❌ Fel: ${err.message}`)
    } finally {
      setIsCreating(false)
    }
  }

  const handlePreview = () => {
    const part1 = agreementObjectText.substring(0, LIMIT)
    const part2 = agreementObjectText.substring(LIMIT, LIMIT * 2)

    const contractLengthInMonths = parseInt(contractData.avtalslngd) * 12

    const finalContractData = {
      ...contractData,
      ...customerData,
      avtalslngd: contractLengthInMonths.toString(),
      'stycke-1': part1,
      'stycke-2': part2,
    }

    setPreviewData({
      template: ONEFLOW_TEMPLATES.find(t => t.id === selectedTemplate),
      contractData: finalContractData,
      recipient,
      partyType,
      sendForSigning
    })
    setShowPreview(true)
    toast.success('📋 Förhandsgranskning genererad!')
  }

  const selectedTemplateData = ONEFLOW_TEMPLATES.find(t => t.id === selectedTemplate)

  return (
    <div className="min-h-screen bg-slate-950">
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
                <h1 className="text-2xl font-bold text-white">Skapa Oneflow Avtal</h1>
                <p className="text-sm text-slate-400">Generera och skicka avtal för signering</p>
              </div>
            </div>
            {selectedTemplateData && (
              <div className="ml-auto flex items-center gap-2 bg-slate-800/50 px-3 py-2 rounded-lg">
                <span className="text-sm text-white">{selectedTemplateData.name}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* FÖRSTA RADEN: Mallval och Information */}
        <div className="grid lg:grid-cols-3 gap-8 mb-8">
          {/* Vänster kolumn - Mallval */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 text-blue-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">1. Välj Avtalstyp</h2>
              </div>
              
              {/* FÖRENKLAD MALLVAL - Inga ikoner/beskrivningar */}
              <div className="space-y-2">
                {ONEFLOW_TEMPLATES.map(template => (
                  <label 
                    key={template.id}
                    className={`relative flex items-center p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:bg-slate-800/50 ${
                      selectedTemplate === template.id 
                        ? 'border-green-500 bg-green-500/10' 
                        : 'border-slate-700 bg-slate-800/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="template"
                      value={template.id}
                      checked={selectedTemplate === template.id}
                      onChange={(e) => setSelectedTemplate(e.target.value)}
                      className="sr-only"
                    />
                    {template.popular && (
                      <div className="flex items-center justify-between">
                      <span className="text-slate-400">Status:</span>
                      <span className={`px-3 py-1 rounded text-sm font-medium ${
                        createdContract.state === 'published' 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {createdContract.state === 'published' ? '📧 Skickat för signering' : '📝 Utkast'}
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
                        setShowPreview(false)
                      }}
                      className="px-6"
                    >
                      Skapa nytt avtal
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  )
}absolute -top-1 -right-1 bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                        Populär
                      </div>
                    )}
                    <div className="flex items-center justify-between w-full">
                      <span className={`font-medium ${selectedTemplate === template.id ? 'text-green-300' : 'text-white'}`}>
                        {template.name}
                      </span>
                      {selectedTemplate === template.id && (
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </Card>

            {/* Signeringsalternativ */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                  <Send className="w-4 h-4 text-yellow-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">Signering</h2>
              </div>
              
              <label className="flex items-center space-x-3 text-white cursor-pointer p-3 rounded-lg hover:bg-slate-800/30 transition-colors">
                <input 
                  type="checkbox" 
                  checked={sendForSigning} 
                  onChange={() => setSendForSigning(prev => !prev)} 
                  className="rounded border-slate-600 text-green-500 focus:ring-green-500 focus:ring-offset-slate-900" 
                /> 
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  <span>Skicka för signering direkt</span>
                </div>
              </label>
              <p className="text-sm text-slate-400 mt-3 px-3">
                {sendForSigning 
                  ? '📧 Kontraktet skickas omedelbart till kunden för signering' 
                  : '📝 Kontraktet skapas som utkast och kan skickas senare'
                }
              </p>
            </Card>
          </div>

          {/* Mitten kolumn - BeGone Info */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-green-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">2. BeGone Information</h2>
              </div>
              
              <div className="space-y-4">
                <Input
                  label="Ansvarig från BeGone"
                  value={contractData.anstalld}
                  onChange={e => handleBeGoneDataChange('anstalld', e.target.value)}
                  icon={<User className="w-4 h-4" />}
                />
                <Input
                  label="E-post ansvarig"
                  type="email"
                  value={contractData['e-post-anstlld']}
                  onChange={e => handleBeGoneDataChange('e-post-anstlld', e.target.value)}
                  icon={<Mail className="w-4 h-4" />}
                />
                <div className="grid grid-cols-2 gap-3">
                  {/* ÄNDRAT: Nu år istället för månader */}
                  <Input
                    label="Avtalslängd (år)"
                    type="number"
                    min="1"
                    max="10"
                    value={contractData.avtalslngd}
                    onChange={e => handleBeGoneDataChange('avtalslngd', e.target.value)}
                    icon={<Calendar className="w-4 h-4" />}
                  />
                  <Input
                    label="Startdatum"
                    type="date"
                    value={contractData.begynnelsedag}
                    onChange={e => handleBeGoneDataChange('begynnelsedag', e.target.value)}
                    icon={<Calendar className="w-4 h-4" />}
                  />
                </div>
              </div>
            </Card>
          </div>

          {/* Höger kolumn - Kundinfo */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">3. Kundinformation</h2>
              </div>

              {/* Företag/Privatperson */}
              <div className="mb-6">
                <label className="text-sm text-white mb-3 block">Avtalspart</label>
                <div className="flex gap-3">
                  <label className="flex items-center space-x-2 text-white cursor-pointer flex-1 p-3 rounded-lg border border-slate-700 hover:bg-slate-800/30 transition-colors">
                    <input 
                      type="radio" 
                      checked={partyType === 'company'} 
                      onChange={() => setPartyType('company')} 
                      className="text-green-500" 
                    /> 
                    <Building2 className="w-4 h-4" />
                    <span>Företag</span>
                  </label>
                  <label className="flex items-center space-x-2 text-white cursor-pointer flex-1 p-3 rounded-lg border border-slate-700 hover:bg-slate-800/30 transition-colors">
                    <input 
                      type="radio" 
                      checked={partyType === 'individual'} 
                      onChange={() => setPartyType('individual')} 
                      className="text-green-500" 
                    /> 
                    <User className="w-4 h-4" />
                    <span>Privatperson</span>
                  </label>
                </div>
              </div>

              <div className="space-y-4">
                {partyType === 'company' && (
                  <>
                    <Input 
                      label="Företagsnamn" 
                      value={customerData.foretag} 
                      onChange={e => handleCustomerDataChange('foretag', e.target.value)}
                      icon={<Building2 className="w-4 h-4" />}
                      required
                    />
                    <Input 
                      label="Organisationsnummer" 
                      value={customerData['org-nr']} 
                      onChange={e => handleCustomerDataChange('org-nr', e.target.value)}
                      icon={<Hash className="w-4 h-4" />}
                      placeholder="556123-4567"
                    />
                  </>
                )}
                
                <Input 
                  label="Kontaktperson" 
                  value={customerData.Kontaktperson} 
                  onChange={e => handleCustomerDataChange('Kontaktperson', e.target.value)}
                  icon={<User className="w-4 h-4" />}
                  required
                />
                
                <Input 
                  label="E-post" 
                  type="email" 
                  value={customerData['e-post-kontaktperson']} 
                  onChange={e => handleCustomerDataChange('e-post-kontaktperson', e.target.value)}
                  icon={<Mail className="w-4 h-4" />}
                  required
                />
                
                <Input 
                  label="Telefon" 
                  type="tel" 
                  value={customerData['telefonnummer-kontaktperson']} 
                  onChange={e => handleCustomerDataChange('telefonnummer-kontaktperson', e.target.value)}
                  icon={<Phone className="w-4 h-4" />}
                />
                
                <Input 
                  label="Utförande adress" 
                  value={customerData['utforande-adress']} 
                  onChange={e => handleCustomerDataChange('utforande-adress', e.target.value)}
                  icon={<MapPin className="w-4 h-4" />}
                />
              </div>
            </Card>

            {/* Åtgärdsknappar */}
            <div className="space-y-3">
              <Button 
                disabled={isCreating || !selectedTemplate || !customerData['e-post-kontaktperson']} 
                onClick={handleCreateContract} 
                className="w-full flex items-center justify-center gap-2 h-12"
              >
                {isCreating ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <CheckCircle className="w-5 h-5" />
                )} 
                {sendForSigning ? 'Skapa & Skicka Avtal' : 'Skapa Utkast'}
              </Button>
              
              <Button 
                variant="outline" 
                onClick={handlePreview} 
                className="w-full flex items-center justify-center gap-2"
                disabled={!selectedTemplate}
              >
                <Eye className="w-4 h-4" /> 
                Förhandsgranska
              </Button>
            </div>

            {/* Snabbfyll */}
            <Card>
              <h3 className="text-white font-medium mb-3">⚡ Snabbfyll Kunddata</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const restaurangData = {
                      foretag: 'Bella Vista Ristorante AB',
                      'org-nr': '556789-0123',
                      Kontaktperson: 'Giuseppe Romano',
                      'e-post-kontaktperson': 'giuseppe@bellavista.se',
                      'telefonnummer-kontaktperson': '08-555 0123',
                      'utforande-adress': 'Kungsgatan 25, 111 56 Stockholm'
                    }
                    setCustomerData(prev => ({ ...prev, ...restaurangData }))
                    setRecipient(prev => ({ 
                      ...prev, 
                      name: restaurangData.Kontaktperson,
                      email: restaurangData['e-post-kontaktperson'],
                      company_name: restaurangData.foretag,
                      organization_number: restaurangData['org-nr']
                    }))
                    toast.success('🍝 Restaurangdata ifylld!')
                  }}
                  className="text-xs"
                >
                  🍝 Restaurang
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const hotellData = {
                      foretag: 'Grand Hotel Stockholm AB',
                      'org-nr': '556456-1234',
                      Kontaktperson: 'Elisabeth Andersson',
                      'e-post-kontaktperson': 'elisabeth@grandhotel.se',
                      'telefonnummer-kontaktperson': '08-679 3500',
                      'utforande-adress': 'Södra Blasieholmshamnen 8, 103 27 Stockholm'
                    }
                    setCustomerData(prev => ({ ...prev, ...hotellData }))
                    setRecipient(prev => ({ 
                      ...prev, 
                      name: hotellData.Kontaktperson,
                      email: hotellData['e-post-kontaktperson'],
                      company_name: hotellData.foretag,
                      organization_number: hotellData['org-nr']
                    }))
                    toast.success('🏨 Hotelldata ifylld!')
                  }}
                  className="text-xs"
                >
                  🏨 Hotell
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* ANDRA RADEN: Avtalsobjekt - NU STÖRRE YTA */}
        <div className="mb-8">
          <Card>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-purple-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Avtalsobjekt</h2>
              <div className="ml-auto text-sm text-slate-400">
                Beskriv avtalets omfattning och villkor i detalj
              </div>
            </div>
            
            <div className="space-y-4">
              <textarea
                value={agreementObjectText}
                onChange={(e) => setAgreementObjectText(e.target.value)}
                rows={8}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-green-500 focus:ring-1 focus:ring-green-500 text-sm leading-relaxed"
                placeholder="Beskriv avtalets omfattning och villkor i detalj. Inkludera vad som ingår i servicen, frekvens av besök, rapportering, och andra viktiga villkor..."
              />
              <div className="flex items-center justify-between text-sm">
                <span className={`${agreementObjectText.length > LIMIT * 2 ? 'text-red-500' : 'text-slate-400'}`}>
                  {agreementObjectText.length} / {LIMIT * 2} tecken
                </span>
                {agreementObjectText.length > LIMIT && (
                  <span className="text-yellow-500 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    Texten delas automatiskt i stycken för Oneflow
                  </span>
                )}
                {agreementObjectText.length > LIMIT * 2 && (
                  <span className="text-red-500 flex items-center gap-1">
                    ⚠️ För lång text kommer att trunkeras
                  </span>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Resultat sektion */}
        {(showPreview || createdContract) && (
          <div className="space-y-6">
            {/* Förhandsgranskning */}
            {showPreview && previewData && (
              <Card>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                  <Eye className="w-5 h-5 text-cyan-400" /> Förhandsgranskning
                </h2>
                <div className="bg-slate-800/50 p-4 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Mall:</span>
                      <div className="text-white font-medium">{previewData?.template?.name}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Kund:</span>
                      <div className="text-white">{previewData?.recipient?.company_name}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Kontakt:</span>
                      <div className="text-white">{previewData?.recipient?.name}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Signering:</span>
                      <div className={`text-sm px-2 py-1 rounded ${previewData.sendForSigning ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        {previewData.sendForSigning ? 'Direkt' : 'Utkast'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <span className="text-slate-400 text-sm">Avtalslängd:</span>
                    <div className="text-white font-medium">
                      {contractData.avtalslngd} år ({parseInt(contractData.avtalslngd) * 12} månader)
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Skapat kontrakt */}
            {createdContract && (
              <Card>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                  <CheckCircle className="w-5 h-5 text-green-400" /> Kontrakt skapat!
                </h3>
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6">
                  <div className="grid gap-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Kontrakt-ID:</span>
                      <span className="font-mono text-green-400 bg-green-500/10 px-3 py-1 rounded">
                        #{createdContract.id}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Avtalsnamn:</span>
                      <span className="text-white font-medium">{createdContract.name}</span>
                    </div>
                    
                    <div className="