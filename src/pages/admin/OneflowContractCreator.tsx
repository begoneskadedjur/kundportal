// src/pages/admin/OneflowContractCreator.tsx - Förbättrad Oneflow Contract Creator
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, FileText, Building2, Mail, Send, CheckCircle, 
  ExternalLink, Eye, AlertCircle, Settings, TestTube,
  User, Building, Calendar, DollarSign, Hash, MapPin
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { useOneflowContract } from '../../hooks/useOneflowContract'
import toast from 'react-hot-toast'

// Oneflow mallar från BeGone
const ONEFLOW_TEMPLATES = [
  { id: '8486368', name: 'Skadedjursavtal', description: 'Standard skadedjursavtal för företag' },
  { id: '9324573', name: 'Avtal Betesstationer', description: 'Avtal för underhåll av betesstationer' },
  { id: '8465556', name: 'Avtal Betongstationer', description: 'Specialavtal för betongstationer' },
  { id: '8462854', name: 'Avtal Mekaniska fällor', description: 'Avtal för mekaniska fällor och underhåll' },
  { id: '10102378', name: 'Komplett Skadedjursavtal', description: 'Omfattande skadedjursavtal med alla tjänster' },
  { id: '8732196', name: 'Skadedjursavtal indikationsfällor', description: 'Avtal för indikationsfällor och monitoring' }
]

// Standarddata för avtal
const DEFAULT_CONTRACT_DATA = {
  anstalld: 'Christian Karlsson',
  'e-post-anstlld': 'christian.karlsson@begone.se',
  'dokument-skapat': new Date().toISOString().split('T')[0],
  begynnelsedag: new Date().toISOString().split('T')[0],
  avtalslngd: '12',
}

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
  const { isCreating, createdContract, error, createContract, clearError, resetContract } = useOneflowContract()

  // Template och konfiguration
  const [selectedTemplate, setSelectedTemplate] = useState('8486368')
  const [partyType, setPartyType] = useState<'company' | 'individual'>('company')
  const [sendForSigning, setSendForSigning] = useState(true)

  // Avtalsdata
  const [contractData, setContractData] = useState<ContractData>(DEFAULT_CONTRACT_DATA)
  const [agreementText, setAgreementText] = useState(
    'Regelbunden kontroll och bekämpning av skadedjur enligt överenskommet schema. Detta inkluderar inspektion av samtliga betesstationer, påfyllning av bete vid behov, samt dokumentation av aktivitet. Vid tecken på gnagaraktivitet vidtas omedelbara åtgärder med förstärkta insatser.'
  )

  // Mottagardata
  const [recipient, setRecipient] = useState<Recipient>({
    name: 'Anna Andersson',
    email: 'christian.karlsson@hotmail.se',
    company_name: 'Test Företag AB',
    organization_number: '556123-4567',
  })

  // UI states
  const [showPreview, setShowPreview] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)

  // Konstanter för textuppdelning
  const TEXT_LIMIT = 1024

  // Uppdatera recipient när contractData ändras
  useEffect(() => {
    if (contractData.Kontaktperson) {
      setRecipient(prev => ({ ...prev, name: contractData.Kontaktperson }))
    }
    if (contractData['e-post-kontaktperson']) {
      setRecipient(prev => ({ ...prev, email: contractData['e-post-kontaktperson'] }))
    }
    if (contractData.foretag) {
      setRecipient(prev => ({ ...prev, company_name: contractData.foretag }))
    }
    if (contractData['org-nr']) {
      setRecipient(prev => ({ ...prev, organization_number: contractData['org-nr'] }))
    }
  }, [contractData])

  // Hantera input-ändringar
  const handleInputChange = (field: string, value: string) => {
    setContractData(prev => ({ ...prev, [field]: value }))
  }

  // Generera förhandsgranskning
  const handlePreview = () => {
    const finalContractData = buildFinalContractData()
    
    setPreviewData({
      template: ONEFLOW_TEMPLATES.find(t => t.id === selectedTemplate),
      contractData: finalContractData,
      recipient,
      partyType,
      sendForSigning,
      agreementTextLength: agreementText.length,
      splitIntoStycken: agreementText.length > TEXT_LIMIT
    })
    setShowPreview(true)
    toast.success('📋 Förhandsgranskning genererad!')
  }

  // Bygg slutgiltig kontraktdata
  const buildFinalContractData = () => {
    const finalData = { ...contractData }

    // Dela upp långt avtalsobjekt i stycken
    if (agreementText.length > TEXT_LIMIT) {
      finalData['stycke-1'] = agreementText.substring(0, TEXT_LIMIT)
      finalData['stycke-2'] = agreementText.substring(TEXT_LIMIT, TEXT_LIMIT * 2)
    } else {
      finalData['stycke-1'] = agreementText
    }

    return finalData
  }

  // Skapa kontrakt
  const handleCreateContract = async () => {
    // Validering
    if (!selectedTemplate) {
      toast.error('Välj en mall')
      return
    }

    if (!recipient.email) {
      toast.error('Mottagarens e-post måste fyllas i')
      return
    }

    if (!recipient.name) {
      toast.error('Mottagarens namn måste fyllas i')
      return
    }

    try {
      const finalContractData = buildFinalContractData()
      
      await createContract({
        templateId: selectedTemplate,
        contractData: finalContractData,
        recipient,
        sendForSigning,
        partyType
      })
      
    } catch (error) {
      // Error hanteras redan i hooken
      console.error('Fel vid skapande av kontrakt:', error)
    }
  }

  // Formatera fält-labels
  const formatFieldLabel = (key: string): string => {
    const labelMap: { [key: string]: string } = {
      'anstalld': 'Ansvarig från BeGone',
      'avtalslngd': 'Avtalslängd (månader)',
      'begynnelsedag': 'Startdatum',
      'dokument-skapat': 'Dokument skapat',
      'e-post-anstlld': 'E-post ansvarig',
      'e-post-kontaktperson': 'E-post kontaktperson',
      'faktura-adress-pdf': 'Faktura-adress',
      'foretag': 'Företag',
      'Kontaktperson': 'Kontaktperson',
      'org-nr': 'Organisationsnummer',
      'telefonnummer-kontaktperson': 'Telefonnummer',
      'utforande-adress': 'Utförande adress',
    }
    return labelMap[key] || key.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase())
  }

  // Hämta input-typ baserat på fältnamn
  const getInputType = (key: string): string => {
    if (key.includes('e-post')) return 'email'
    if (key.includes('telefonnummer')) return 'tel'
    if (key.includes('dag') || key.includes('datum')) return 'date'
    if (key === 'avtalslngd') return 'number'
    return 'text'
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
              onClick={() => navigate('/admin/customers')} 
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Tillbaka
            </Button>
            
            <div className="flex items-center gap-3">
              <div className="bg-blue-500/10 p-2 rounded-lg">
                <FileText className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Oneflow Kontrakt</h1>
                <p className="text-sm text-slate-400">Skapa och skicka avtal för signering</p>
              </div>
            </div>
            
            <div className="ml-auto flex items-center gap-3">
              <div className="text-sm text-slate-400">
                Mall: <span className="text-white">{ONEFLOW_TEMPLATES.find(t => t.id === selectedTemplate)?.name || 'Ingen vald'}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/admin/oneflow-diagnostics')}
                className="flex items-center gap-2"
              >
                <TestTube className="w-4 h-4" /> Diagnostik
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <Card className="mb-6 border-red-500/20 bg-red-500/5">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-red-400 font-medium mb-1">Fel vid skapande av kontrakt</h3>
                <p className="text-red-300 text-sm">{error}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={clearError}
                  className="mt-3 text-red-400 border-red-500/30 hover:bg-red-500/10"
                >
                  Stäng
                </Button>
              </div>
            </div>
          </Card>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Vänster kolumn - Formulär */}
          <div className="space-y-6">
            {/* Mallval */}
            <Card>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-blue-500" /> Välj Mall
              </h2>
              <select 
                value={selectedTemplate} 
                onChange={e => setSelectedTemplate(e.target.value)} 
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- Välj mall --</option>
                {ONEFLOW_TEMPLATES.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              {selectedTemplate && (
                <p className="text-sm text-slate-400 mt-2">
                  {ONEFLOW_TEMPLATES.find(t => t.id === selectedTemplate)?.description}
                </p>
              )}
            </Card>

            {/* Avtalsdata */}
            <Card>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Settings className="w-5 h-5 text-green-500" /> Avtalsdata
              </h2>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {Object.entries(contractData).map(([key, value]) => (
                  <Input
                    key={key}
                    label={formatFieldLabel(key)}
                    type={getInputType(key)}
                    value={value}
                    onChange={e => handleInputChange(key, e.target.value)}
                    className="text-sm"
                  />
                ))}
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">
                    Avtalsobjekt {agreementText.length > TEXT_LIMIT && '(delas automatiskt)'}
                  </label>
                  <textarea
                    value={agreementText}
                    onChange={(e) => setAgreementText(e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                    placeholder="Beskriv avtalets omfattning och villkor..."
                  />
                  <div className="flex items-center justify-between text-xs">
                    <span className={`${agreementText.length > TEXT_LIMIT * 2 ? 'text-red-500' : 'text-slate-400'}`}>
                      {agreementText.length} / {TEXT_LIMIT * 2} tecken
                    </span>
                    {agreementText.length > TEXT_LIMIT && (
                      <span className="text-yellow-500">Delas i stycken automatiskt</span>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Mottagare */}
            <Card>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Mail className="w-5 h-5 text-purple-500" /> Mottagare
              </h2>
              
              <div className="mb-4">
                <label className="text-sm text-white mb-2 block">Typ av motpart</label>
                <div className="flex gap-4">
                  <label className="flex items-center space-x-2 text-white cursor-pointer">
                    <input 
                      type="radio" 
                      checked={partyType === 'company'} 
                      onChange={() => setPartyType('company')} 
                      className="text-blue-500" 
                    /> 
                    <Building className="w-4 h-4" />
                    <span>Företag</span>
                  </label>
                  <label className="flex items-center space-x-2 text-white cursor-pointer">
                    <input 
                      type="radio" 
                      checked={partyType === 'individual'} 
                      onChange={() => setPartyType('individual')} 
                      className="text-blue-500" 
                    /> 
                    <User className="w-4 h-4" />
                    <span>Privatperson</span>
                  </label>
                </div>
              </div>
              
              <div className="space-y-4">
                <Input 
                  label="Kontaktperson" 
                  type="text" 
                  value={recipient.name} 
                  onChange={e => setRecipient(prev => ({ ...prev, name: e.target.value }))}
                  icon={<User className="w-4 h-4" />}
                />
                
                <Input 
                  label="E-post" 
                  type="email" 
                  value={recipient.email} 
                  onChange={e => setRecipient(prev => ({ ...prev, email: e.target.value }))}
                  icon={<Mail className="w-4 h-4" />}
                  required
                />
                
                {partyType === 'company' && (
                  <>
                    <Input 
                      label="Företag" 
                      type="text" 
                      value={recipient.company_name} 
                      onChange={e => setRecipient(prev => ({ ...prev, company_name: e.target.value }))}
                      icon={<Building className="w-4 h-4" />}
                    />
                    <Input 
                      label="Organisationsnummer" 
                      type="text" 
                      value={recipient.organization_number} 
                      onChange={e => setRecipient(prev => ({ ...prev, organization_number: e.target.value }))}
                      icon={<Hash className="w-4 h-4" />}
                    />
                  </>
                )}
              </div>
            </Card>

            {/* Signeringsalternativ */}
            <Card>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Send className="w-5 h-5 text-yellow-400" /> Signeringsalternativ
              </h2>
              <label className="flex items-center space-x-3 text-white cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={sendForSigning} 
                  onChange={() => setSendForSigning(prev => !prev)} 
                  className="rounded border-slate-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900" 
                /> 
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  <span>Skicka för signering direkt</span>
                </div>
              </label>
              <p className="text-sm text-slate-400 mt-3">
                {sendForSigning 
                  ? 'Kontraktet kommer att skickas för signering omedelbart efter skapande' 
                  : 'Kontraktet skapas som utkast och kan skickas för signering senare'
                }
              </p>
            </Card>

            {/* Åtgärdsknappar */}
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={handlePreview} 
                className="flex items-center gap-2"
                disabled={!selectedTemplate}
              >
                <Eye className="w-4 h-4" /> 
                Förhandsgranska
              </Button>
              
              <Button 
                disabled={isCreating || !selectedTemplate || !recipient.email} 
                onClick={handleCreateContract} 
                className="flex items-center gap-2 flex-1"
              >
                {isCreating ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )} 
                {sendForSigning ? 'Skapa & skicka' : 'Skapa utkast'}
              </Button>
            </div>
          </div>

          {/* Höger kolumn - Förhandsgranskning & Resultat */}
          <div className="space-y-6">
            {/* Förhandsgranskning */}
            {showPreview && previewData && (
              <Card>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                  <Eye className="w-5 h-5 text-cyan-400" /> Förhandsgranskning
                </h2>
                <div className="bg-slate-800/50 p-4 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Mall:</span>
                      <div className="text-white font-medium">{previewData.template?.name}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Typ:</span>
                      <div className="text-white">{previewData.partyType === 'company' ? 'Företag' : 'Privatperson'}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Mottagare:</span>
                      <div className="text-white">{previewData.recipient?.name}</div>
                      <div className="text-slate-400 text-xs">{previewData.recipient?.email}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Signering:</span>
                      <div className={`text-sm px-2 py-1 rounded ${previewData.sendForSigning ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        {previewData.sendForSigning ? 'Skicka direkt' : 'Spara som utkast'}
                      </div>
                    </div>
                  </div>
                  
                  {previewData.partyType === 'company' && (
                    <div className="border-t border-slate-700 pt-3">
                      <div className="text-sm">
                        <span className="text-slate-400">Företag:</span>
                        <div className="text-white">{previewData.recipient?.company_name}</div>
                        <div className="text-slate-400 text-xs">Org.nr: {previewData.recipient?.organization_number}</div>
                      </div>
                    </div>
                  )}
                  
                  <div className="border-t border-slate-700 pt-3">
                    <div className="text-sm">
                      <span className="text-slate-400">Avtalsobjekt:</span>
                      <div className="text-white text-xs mt-1">{previewData.agreementTextLength} tecken</div>
                      {previewData.splitIntoStycken && (
                        <div className="text-yellow-400 text-xs">⚠️ Delas i flera stycken</div>
                      )}
                    </div>
                  </div>

                  <details className="text-xs border-t border-slate-700 pt-3">
                    <summary className="text-slate-400 cursor-pointer hover:text-white">Visa fullständig data</summary>
                    <pre className="text-slate-400 bg-slate-900/50 p-3 rounded mt-2 overflow-x-auto max-h-60">
                      {JSON.stringify(previewData, null, 2)}
                    </pre>
                  </details>
                </div>
              </Card>
            )}

            {/* Skapat kontrakt */}
            {createdContract && (
              <Card>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                  <CheckCircle className="w-5 h-5 text-green-400" /> Kontrakt skapat!
                </h3>
                <div className="space-y-4">
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                    <div className="grid gap-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Kontrakt-ID:</span>
                        <span className="font-mono text-green-400 bg-green-500/10 px-2 py-1 rounded">
                          #{createdContract.id}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Namn:</span>
                        <span className="text-white">{createdContract.name}</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Status:</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          createdContract.state === 'published' 
                            ? 'bg-green-500/20 text-green-400' 
                            : createdContract.state === 'draft'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {createdContract.state === 'published' && '📧 Skickat'}
                          {createdContract.state === 'draft' && '📝 Utkast'}
                          {createdContract.state !== 'published' && createdContract.state !== 'draft' && createdContract.state}
                        </span>
                      </div>

                      {createdContract.created_time && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Skapat:</span>
                          <span className="text-white text-xs">
                            {new Date(createdContract.created_time).toLocaleString('sv-SE')}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2 mt-4">
                      {createdContract.url && (
                        <Button 
                          onClick={() => window.open(createdContract.url, '_blank')} 
                          className="flex-1 flex items-center justify-center gap-2" 
                          size="sm"
                        >
                          <ExternalLink className="w-4 h-4" /> 
                          Öppna i Oneflow
                        </Button>
                      )}
                      
                      <Button 
                        variant="outline"
                        onClick={resetContract}
                        size="sm"
                        className="px-4"
                      >
                        Skapa nytt
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Tips och hjälp */}
            <Card>
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-blue-500" />
                Tips & Information
              </h3>
              <div className="text-sm text-slate-300 space-y-3">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Alla fält är förifyllda med standarddata som kan anpassas</span>
                </div>
                
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span>Långa avtalsobjekt delas automatiskt i flera stycken (max 1024 tecken per stycke)</span>
                </div>
                
                <div className="flex items-start gap-2">
                  <Send className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <span>Utkast kan redigeras och skickas för signering senare via Oneflow</span>
                </div>
                
                <div className="flex items-start gap-2">
                  <Mail className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                  <span>Mottagaren får automatiskt ett email när kontraktet skickas för signering</span>
                </div>

                <div className="border-t border-slate-700 pt-3 mt-4">
                  <div className="text-xs text-slate-400">
                    <strong>Teknisk information:</strong><br />
                    Kontrakt skapas via Oneflow API och lagras i deras system. 
                    All signering och hantering sker via Oneflow's plattform.
                  </div>
                </div>
              </div>
            </Card>

            {/* Snabbfyll-knappar */}
            <Card>
              <h3 className="text-lg font-semibold text-white mb-3">⚡ Snabbfyll</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setContractData(prev => ({
                      ...prev,
                      foretag: 'Restaurang Goda Biten AB',
                      'org-nr': '556789-0123',
                      Kontaktperson: 'Maria Svensson',
                      'e-post-kontaktperson': 'maria@godabiten.se',
                      'telefonnummer-kontaktperson': '08-555 0123',
                      'utforande-adress': 'Drottninggatan 50, 111 21 Stockholm'
                    }))
                    toast.success('Restaurangdata ifylld!')
                  }}
                  className="text-xs"
                >
                  🍽️ Restaurang
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setContractData(prev => ({
                      ...prev,
                      foretag: 'Lagerlogistik Stockholm AB',
                      'org-nr': '556123-9876',
                      Kontaktperson: 'Lars Andersson',
                      'e-post-kontaktperson': 'lars@lagerlogistik.se',
                      'telefonnummer-kontaktperson': '08-666 0987',
                      'utforande-adress': 'Industrivägen 25, 125 30 Älvsjö'
                    }))
                    toast.success('Lagerdata ifylld!')
                  }}
                  className="text-xs"
                >
                  📦 Lager
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setContractData(prev => ({
                      ...prev,
                      foretag: 'Hotell Comfort Inn',
                      'org-nr': '556456-1234',
                      Kontaktperson: 'Anna Johansson',
                      'e-post-kontaktperson': 'anna@comfortinn.se',
                      'telefonnummer-kontaktperson': '08-777 4567',
                      'utforande-adress': 'Vasagatan 10, 111 20 Stockholm'
                    }))
                    toast.success('Hotelldata ifylld!')
                  }}
                  className="text-xs"
                >
                  🏨 Hotell
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setContractData(prev => ({
                      ...prev,
                      foretag: 'Fastigheter Nordic AB',
                      'org-nr': '556321-6549',
                      Kontaktperson: 'Per Nilsson',
                      'e-post-kontaktperson': 'per@nordicfastigheter.se',
                      'telefonnummer-kontaktperson': '08-888 3210',
                      'utforande-adress': 'Storgatan 15, 114 44 Stockholm'
                    }))
                    toast.success('Fastighetsdata ifylld!')
                  }}
                  className="text-xs"
                >
                  🏢 Fastighet
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}