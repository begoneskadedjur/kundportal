import React, { useState } from 'react'
import { ArrowLeft, TestTube, Eye, FileText, Building2, Mail, Phone, MapPin, Calendar, Send, CheckCircle, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'

// Dina exakta Oneflow-mallar
const ONEFLOW_TEMPLATES = [
  { id: '8486368', name: 'Skadedjursavtal' },
  { id: '9324573', name: 'Avtal Betesstationer' },
  { id: '8465556', name: 'Avtal Betongstationer' },
  { id: '8462854', name: 'Avtal Mekaniska fällor' },
  { id: '10102378', name: 'Komplett Skadedjursavtal' },
  { id: '8732196', name: 'Skadedjursavtal indikationsfällor' }
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

export default function OneflowTest() {
  const navigate = useNavigate()
  
  // ✅ FIX: Deklarera LIMIT här så att hela komponenten har tillgång till den.
  const LIMIT = 1024;

  const [selectedTemplate, setSelectedTemplate] = useState('8486368')
  const [agreementObjectText, setAgreementObjectText] = useState(
    'Regelbunden kontroll och bekämpning av skadedjur enligt överenskommet schema. Detta inkluderar inspektion av samtliga betesstationer, påfyllning av bete vid behov, samt dokumentation av aktivitet. Vid tecken på gnagaraktivitet vidtas omedelbara åtgärder med förstärkta insatser, såsom utplacering av ytterligare fällor eller alternativa bekämpningsmetoder. Kunden förbinder sig att följa de rekommendationer som ges av BeGone Skadedjur & Sanering AB för att minimera risken för nya angrepp, vilket inkluderar sophantering och tätning av fastigheten. Avtalet omfattar även telefonrådgivning och en årlig genomgång av fastighetens skadedjursskydd. Detta är en extra lång text för att säkerställa att vi överstiger gränsen på 1024 tecken och kan testa uppdelningslogiken korrekt. Vi lägger till ännu mer utfyllnadstext här för att vara på den säkra sidan. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Vi behöver ännu lite mer text för att nå över 1500 tecken och verkligen stresstesta systemet. Detta bör räcka.'
  );

  const [contractData, setContractData] = useState<ContractData>({
    anstalld: 'Christian Karlsson',
    avtalslngd: '12',                              
    begynnelsedag: new Date().toISOString().split('T')[0], 
    'dokument-skapat': new Date().toISOString().split('T')[0],
    'e-post-anstlld': 'christian.karlsson@begone.se',    
    'e-post-kontaktperson': 'christian.karlsson@hotmail.se', 
    'faktura-adress-pdf': 'christian.karlsson@hotmail.se',    
    foretag: 'Test Företag AB',                        
    Kontaktperson: 'Anna Andersson',
    'org-nr': '556123-4567',                          
    'telefonnummer-kontaktperson': '08-123 45 67',    
    'utforande-adress': 'Storgatan 15, 111 22 Stockholm', 
  })
  
  const [recipient, setRecipient] = useState<Recipient>({
    name: 'Anna Andersson',
    email: 'christian.karlsson@hotmail.se', 
    company_name: 'Test Företag AB',
    organization_number: '556123-4567',
  })

  const [partyType, setPartyType] = useState<'company' | 'individual'>('company')
  const [sendForSigning, setSendForSigning] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [createdContract, setCreatedContract] = useState<any>(null)

  const handleInputChange = (field: string, value: string) => {
    setContractData(prev => ({ ...prev, [field]: value }))
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

  const handleCreateContract = async () => {
    if (!selectedTemplate || !recipient.email) {
      toast.error('Välj mall och fyll i Mottagarens e-post.')
      return
    }

    const part1 = agreementObjectText.substring(0, LIMIT);
    const part2 = agreementObjectText.substring(LIMIT, LIMIT * 2);

    const finalContractData = {
      ...contractData,
      'stycke-1': part1,
      'stycke-2': part2,
    };

    setIsCreating(true)
    try {
      console.log('🚀 Skickar kontrakt-request med uppdelad data:', {
        templateId: selectedTemplate,
        contractData: finalContractData,
        recipient,
        sendForSigning,
        partyType
      })

      const response = await fetch('/api/oneflow-create-contract', {
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
     const part1 = agreementObjectText.substring(0, LIMIT);
     const part2 = agreementObjectText.substring(LIMIT, LIMIT * 2);

     const finalContractData = {
       ...contractData,
       'stycke-1': part1,
       'stycke-2': part2,
     };

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

  const formatFieldLabel = (key: string): string => {
    const labelMap: { [key: string]: string } = {
      'anstalld': 'Anställd hos BeGone',
      'avtalslngd': 'Avtalslängd (månader)',
      'begynnelsedag': 'Begynnelsedag',
      'dokument-skapat': 'Dokument skapat',
      'e-post-anstlld': 'E-post anställd',
      'e-post-kontaktperson': 'E-post kontaktperson',
      'faktura-adress-pdf': 'Faktura-adress (PDF)',
      'foretag': 'Företag',
      'Kontaktperson': 'Kontaktperson',
      'org-nr': 'Organisationsnummer',
      'telefonnummer-kontaktperson': 'Telefonnummer kontaktperson',
      'utforande-adress': 'Utförande adress',
    }
    return labelMap[key] || key.replace(/-/g, ' ')
  }

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
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <TestTube className="w-6 h-6" /> Oneflow Test
            </h1>
            <div className="ml-auto text-sm text-slate-400">
              Template: {ONEFLOW_TEMPLATES.find(t => t.id === selectedTemplate)?.name || 'Ingen vald'}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid lg:grid-cols-2 gap-8">
        <div className="space-y-6">
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
              {ONEFLOW_TEMPLATES.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5 text-green-500" /> Avtalsdata
            </h2>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {Object.entries(contractData).map(([key, value]) => (
                <Input
                  key={key}
                  label={formatFieldLabel(key)}
                  type={
                    key.includes('e-post') ? 'email' : 
                    key.includes('telefonnummer') ? 'tel' : 
                    key.includes('dag') ? 'date' : 
                    key === 'avtalslngd' ? 'number' :
                    'text'
                  }
                  value={value}
                  onChange={e => handleInputChange(key, e.target.value)}
                  className="text-sm"
                />
              ))}
              
              <div className="flex flex-col">
                <label htmlFor="agreement-object" className="mb-2 text-sm font-medium text-white">Avtalsobjekt (delas automatiskt)</label>
                <textarea
                  id="agreement-object"
                  value={agreementObjectText}
                  onChange={(e) => setAgreementObjectText(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                  placeholder="Beskriv avtalets omfattning här..."
                />
                <p className={`mt-1 text-xs ${agreementObjectText.length > LIMIT * 2 ? 'text-red-500' : 'text-slate-400'}`}>
                  Tecken: {agreementObjectText.length} / {LIMIT * 2}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <Mail className="w-5 h-5 text-red-500" /> Mottagare
            </h2>
            <div className="mb-4">
              <label className="text-sm text-white mb-2 block">Typ av motpart</label>
              <div className="flex gap-4">
                <label className="flex items-center space-x-2 text-white cursor-pointer">
                  <input type="radio" checked={partyType === 'company'} onChange={() => setPartyType('company')} className="text-blue-500" /> 
                  <span>Företag</span>
                </label>
                <label className="flex items-center space-x-2 text-white cursor-pointer">
                  <input type="radio" checked={partyType === 'individual'} onChange={() => setPartyType('individual')} className="text-blue-500" /> 
                  <span>Privatperson</span>
                </label>
              </div>
            </div>
            <div className="space-y-4">
              <Input label="Namn" type="text" value={recipient.name} onChange={e => setRecipient(prev => ({ ...prev, name: e.target.value }))} />
              <Input label="E-post" type="email" value={recipient.email} onChange={e => setRecipient(prev => ({ ...prev, email: e.target.value }))} />
              {partyType === 'company' && (
                <>
                  <Input label="Företag" type="text" value={recipient.company_name} onChange={e => setRecipient(prev => ({ ...prev, company_name: e.target.value }))} />
                  <Input label="Organisationsnummer" type="text" value={recipient.organization_number} onChange={e => setRecipient(prev => ({ ...prev, organization_number: e.target.value }))} />
                </>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <Send className="w-5 h-5 text-yellow-400" /> Signeringsalternativ
            </h2>
            <label className="flex items-center space-x-2 text-white cursor-pointer">
              <input type="checkbox" checked={sendForSigning} onChange={() => setSendForSigning(prev => !prev)} className="text-blue-500" /> 
              <span>Skicka för signering direkt</span>
            </label>
            <p className="text-sm text-slate-400 mt-2">
              {sendForSigning ? 'Kontraktet kommer att skickas för signering omedelbart' : 'Kontraktet skapas som utkast och kan skickas senare'}
            </p>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={handlePreview} className="flex items-center gap-2">
              <Eye className="w-4 h-4" /> Förhandsgranska
            </Button>
            <Button disabled={isCreating || !selectedTemplate} onClick={handleCreateContract} className="flex items-center gap-2 flex-1">
              {isCreating ? <LoadingSpinner size="sm" /> : <CheckCircle className="w-4 h-4" />} 
              {sendForSigning ? 'Skapa & skicka' : 'Skapa utkast'}
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {showPreview && (
            <Card>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Eye className="w-5 h-5 text-cyan-400" /> Förhandsgranskning
              </h2>
              <div className="bg-slate-800/50 p-4 rounded-lg">
                <div className="text-sm text-slate-300 space-y-2 mb-4">
                  <div><strong>Mall:</strong> {previewData?.template?.name}</div>
                  <div><strong>Motpart:</strong> {previewData?.recipient?.company_name} ({previewData?.recipient?.name})</div>
                  <div><strong>Typ:</strong> {partyType === 'company' ? 'Företag' : 'Privatperson'}</div>
                  <div><strong>Signering:</strong> {sendForSigning ? 'Ja' : 'Nej'}</div>
                </div>
                <details className="text-xs">
                  <summary className="text-slate-400 cursor-pointer hover:text-white">Visa fullständig payload</summary>
                  <pre className="text-slate-400 bg-slate-900/50 p-3 rounded mt-2 overflow-x-auto">
                    {JSON.stringify(previewData, null, 2)}
                  </pre>
                </details>
              </div>
            </Card>
          )}

          {createdContract && (
            <Card>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <CheckCircle className="w-5 h-5 text-green-400" /> Kontrakt skapat!
              </h3>
              <div className="space-y-3">
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                  <div className="text-sm text-white space-y-2">
                    <div><strong>ID:</strong> <span className="font-mono text-green-400">{createdContract.id}</span></div>
                    <div><strong>Namn:</strong> {createdContract.name}</div>
                    <div><strong>Status:</strong> 
                      <span className={`ml-2 px-2 py-1 rounded text-xs ${createdContract.state === 'published' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        {createdContract.state}
                      </span>
                    </div>
                    {createdContract.url && (
                      <Button onClick={() => window.open(createdContract.url, '_blank')} className="w-full flex items-center justify-center gap-2 mt-3" size="sm">
                        <ExternalLink className="w-4 h-4" /> Öppna i Oneflow
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}

          <Card>
            <h3 className="text-lg font-semibold text-white mb-3">💡 Tips</h3>
            <div className="text-sm text-slate-300 space-y-2">
              <div>• Alla fält är förifyllda med testdata</div>
              <div>• Kontrollera att rätt mall är vald</div>
              <div>• Använd "Förhandsgranska" för att se payload</div>
              <div>• Utkast kan redigeras innan signering</div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}